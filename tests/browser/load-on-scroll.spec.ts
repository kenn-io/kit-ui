import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers";

test("custom watcher follows a box that starts overflowing", async ({ page }) => {
  await page.setViewportSize({ width: 200, height: 200 });
  await gotoPage(page, "load-on-scroll");
  const calls = await page.evaluate(async () => {
    const path = "/src/lib/components/virtual.ts";
    const { watchListEnd } = await import(path);
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;top:0;left:0;width:200px;height:400px;overflow:auto";
    box.innerHTML = '<div style="height:300px"></div><div style="height:1px"></div>';
    document.body.append(box);
    let count = 0;
    const detach = watchListEnd(box.lastElementChild as HTMLElement, () => count++);
    await new Promise((resolve) => setTimeout(resolve, 150));
    (box.firstElementChild as HTMLElement).style.height = "800px";
    await new Promise((resolve) => setTimeout(resolve, 150));
    count = 0;
    box.scrollTop = 300;
    await new Promise((resolve) => setTimeout(resolve, 300));
    detach();
    box.remove();
    return count;
  });
  expect(calls).toBeGreaterThan(0);
});

test("prefetch distance uses box height", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  const result = await page.evaluate(async () => {
    const path = "/src/lib/components/virtual.ts";
    const { watchListEnd } = await import(path);
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;top:0;left:0;width:200px;height:800px;overflow:auto";
    box.innerHTML = '<div style="height:1000px"></div><div style="height:1px"></div>';
    document.body.append(box);
    const NativeObserver = window.IntersectionObserver;
    let rootIsBox = false;
    let rootMargin: string | undefined;
    window.IntersectionObserver = class extends NativeObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super(callback, options);
        rootIsBox = options?.root === box;
        rootMargin = options?.rootMargin;
      }
    };
    let count = 0;
    const detach = watchListEnd(box.lastElementChild as HTMLElement, () => count++);
    window.IntersectionObserver = NativeObserver;
    await new Promise((resolve) => setTimeout(resolve, 300));
    detach();
    box.remove();
    return { count, rootIsBox, rootMargin };
  });
  expect(result.rootIsBox).toBe(true);
  expect(result.rootMargin).toBe("0px 0px 400px 0px");
  expect(result.count).toBeGreaterThan(0);
});

for (const change of ["growth", "resize"]) {
  test(`ListEnd prefetches after ${change} makes its box overflow`, async ({ page }) => {
    await gotoPage(page, "load-on-scroll");
    const calls = await page.evaluate(async (change) => {
      const path = "/src/lib/components/virtual.ts";
      const { watchListEnd } = await import(path);
      const box = document.createElement("div");
      box.style.cssText = "position:fixed;top:0;left:0;width:300px;height:600px;overflow:auto";
      box.innerHTML = '<div style="height:500px"></div><div style="height:1px"></div>';
      document.body.append(box);
      const content = box.firstElementChild as HTMLElement;
      const end = box.lastElementChild as HTMLElement;
      let count = 0;
      const detach = watchListEnd(end, () => count++);
      await new Promise((resolve) => setTimeout(resolve, 150));
      count = 0;
      if (change === "growth") content.style.height = "1000px";
      else box.style.height = "200px";
      await new Promise((resolve) => setTimeout(resolve, 150));
      count = 0;
      box.scrollTop = change === "growth" ? 300 : 220;
      await new Promise((resolve) => setTimeout(resolve, 300));
      detach();
      box.remove();
      return count;
    }, change);
    expect(calls).toBeGreaterThan(0);
  });
}

test("normalizes the filter in a shared URL", async ({ page }) => {
  await page.goto("/?filter=Open#load-on-scroll");
  await expect(page.getByRole("radio", { name: "Open" })).toBeChecked();
  await expect(page.getByTestId("list-box").getByText("Closed", { exact: true })).toHaveCount(0);
});

test("defaults an unknown filter to All", async ({ page }) => {
  await page.goto("/?filter=unknown#load-on-scroll");
  await expect(page.getByRole("radio", { name: "All" })).toBeChecked();
  await expect(page.getByTestId("list-count")).toContainText("100");
});

test("keyboard navigation returns focus to the opened row", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  const box = page.getByTestId("list-box");
  await box.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.getByTestId("list-count")).toHaveText("200 rows loaded");
  const link = box.getByRole("link", { name: "Row 150", exact: true });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#load-on-scroll-row-150$/);
  await expect(page.getByRole("heading", { name: "Row 150" })).toBeVisible();
  await page.goBack();
  await expect(link).toBeFocused();
});

test("scrolling during a saved-row read cancels placement", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  await page.evaluate(() => {
    history.replaceState(
      { listPositions: { "demo-list": { rows: 100, top: "60", offset: 0, scrollTop: 2500 } } },
      "",
    );
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.reload();
  const box = page.getByTestId("list-box");
  await box.hover();
  await page.mouse.wheel(0, 100);
  await expect.poll(() => box.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  const position = await box.evaluate((el) => el.scrollTop);
  await page.clock.runFor(700);
  await expect(box).toHaveJSProperty("scrollTop", position);
});

test("a restarted page-scrolled list returns to its top", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  const top = await page.evaluate(async () => {
    const path = "/src/lib/index.ts";
    const { showListTop } = await import(path);
    const list = document.createElement("div");
    list.style.cssText = "height:2000px";
    document.body.append(list);
    window.scrollTo(0, list.getBoundingClientRect().top + window.scrollY + 500);
    showListTop?.(list);
    const top = list.getBoundingClientRect().top;
    list.remove();
    return top;
  });
  expect(top).toBeGreaterThanOrEqual(0);
});

for (const kind of ["list", "table"]) {
  test(`${kind} loads, retries, and returns to an opened row`, async ({ page }) => {
    await gotoPage(page, "load-on-scroll");
    const box = page.getByTestId(`${kind}-box`);
    const scroller = kind === "table" ? box.locator(".kit-table-wrapper") : box;
    await page.getByLabel("Fail next batch").check();
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(box.getByRole("alert")).toBeVisible();
    await box.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByTestId(`${kind}-count`)).toContainText("200");
    for (let n = 300; n <= 1000; n += 100) {
      await scroller.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(page.getByTestId(`${kind}-count`)).toContainText(String(n));
      const ids = await box
        .locator("[data-list-row]")
        .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-list-row")));
      expect(new Set(ids).size).toBe(ids.length);
    }
    const link = box.getByRole("link", { name: "Row 640", exact: true });
    if (kind === "table") {
      await scroller.evaluate((el) => {
        el.scrollTop = el.scrollHeight * 0.64;
      });
    }
    await link.scrollIntoViewIfNeeded();
    await link.evaluate((el) =>
      el.addEventListener(
        "click",
        () => {
          sessionStorage.setItem(
            "opened-offset",
            String(
              el.getBoundingClientRect().top -
                el.closest('[data-testid$="-box"]')!.getBoundingClientRect().top,
            ),
          );
        },
        { once: true },
      ),
    );
    await link.click();
    const before = Number(await page.evaluate(() => sessionStorage.getItem("opened-offset")));
    await page.goBack();
    await expect
      .poll(async () =>
        Math.abs(
          (await link.evaluate(
            (el) =>
              el.getBoundingClientRect().top -
              el.closest('[data-testid$="-box"]')!.getBoundingClientRect().top,
          )) - before,
        ),
      )
      .toBeLessThan(3);
  });
}

for (const kind of ["list", "table"]) {
  test(`${kind} resets while a batch is loading`, async ({ page }) => {
    await gotoPage(page, "load-on-scroll");
    const box = page.getByTestId(`${kind}-box`);
    const scroller = kind === "table" ? box.locator(".kit-table-wrapper") : box;
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(box.getByText("Loading more rows")).toBeVisible();
    await page.getByRole("radio", { name: "Closed" }).click();
    await expect(page.getByTestId(`${kind}-count`)).toContainText("100");
    await page.waitForTimeout(400);
    await expect(box.getByText("Open", { exact: true })).toHaveCount(0);
    await expect(scroller).toHaveJSProperty("scrollTop", 0);
  });
}

test("restores the saved offset when the top virtual row is missing", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  await page.evaluate(() => {
    history.replaceState(
      {
        listPositions: {
          "demo-table": { rows: 1000, top: "missing", offset: 0, scrollTop: 2000 },
        },
      },
      "",
    );
  });
  await page.reload();
  const box = page.getByTestId("table-box");
  await expect(box.locator(".kit-table-wrapper")).toHaveJSProperty("scrollTop", 2000);
  await expect(page.getByTestId("table-count")).toHaveText("1000 rows loaded");
  await expect(box.getByRole("link", { name: "Row 640", exact: true })).toHaveCount(0);
});

test("restores the top row within the first 1000 when more rows were saved", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  await page.evaluate(() => {
    history.replaceState(
      {
        listPositions: {
          "demo-table": { rows: 1400, top: "950", offset: 50, scrollTop: 0 },
        },
      },
      "",
    );
  });
  await page.reload();
  const box = page.getByTestId("table-box");
  const row = box.locator('[data-list-row="950"]');
  await expect(row).toBeVisible();
  await expect
    .poll(() =>
      row.evaluate((el) =>
        Math.abs(
          el.getBoundingClientRect().top -
            el.closest(".kit-table-wrapper")!.getBoundingClientRect().top -
            50,
        ),
      ),
    )
    .toBeLessThan(3);
  await expect(page.getByTestId("table-count")).toHaveText("1000 rows loaded");
});

test("position tracking uses the page scroller past a horizontal wrapper", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  const result = await page.evaluate(async () => {
    const path = "/src/lib/utils/list-position.ts";
    const { keepListPosition, savedListPosition, placeList } = await import(path);
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "overflow-x:auto; width:200px";
    wrapper.innerHTML =
      '<div style="height:1800px;width:500px"><div data-list-row="a" style="margin-top:1000px;height:40px"><a href="#x">Row</a></div></div>';
    document.body.append(wrapper);
    const row = wrapper.querySelector<HTMLElement>("[data-list-row]")!;
    const node = wrapper.firstElementChild as HTMLElement;
    const detach = keepListPosition("page-test", () => 1)(node);
    window.scrollTo(0, row.getBoundingClientRect().top + window.scrollY - 100);
    row.querySelector("a")!.addEventListener("click", (event) => event.preventDefault());
    row
      .querySelector("a")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    const saved = savedListPosition("page-test")!;
    window.scrollTo(0, 0);
    await placeList(node, saved);
    const restored = window.scrollY;
    detach?.();
    wrapper.remove();
    return { saved: saved.scrollTop, restored };
  });
  expect(result.saved).toBeGreaterThan(500);
  expect(result.restored).toBeGreaterThan(500);
});

test("ListEnd waits for the replacement read before requesting more", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  const calls = await page.evaluate(async () => {
    const componentPath = "/src/lib/components/ListEnd.svelte";
    const sveltePath = "/node_modules/svelte/src/index-client.js";
    const { default: ListEnd } = await import(componentPath);
    const { mount, unmount, flushSync } = await import(sveltePath);
    const host = document.createElement("ul");
    document.body.prepend(host);
    let count = 0;
    const component = mount(ListEnd, {
      target: host,
      props: {
        rows: { loading: false, problem: null, batches: 1, retry: () => {} },
        more: true,
        idle: false,
        label: "rows",
        onmore: () => count++,
      },
    });
    flushSync();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await unmount(component);
    host.remove();
    return count;
  });
  expect(calls).toBe(0);
});

test("tracks a box that overflows after attachment", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  const saved = await page.evaluate(async () => {
    const path = "/src/lib/utils/list-position.ts";
    const { keepListPosition, savedListPosition } = await import(path);
    const box = document.createElement("div");
    box.style.cssText = "height:100px;overflow:auto";
    document.body.append(box);
    const node = document.createElement("div");
    box.append(node);
    const detach = keepListPosition("late-box", () => 1)(node);
    node.innerHTML =
      '<div style="height:500px"><div data-list-row="a" style="height:500px">Row</div></div>';
    box.scrollTop = 200;
    await new Promise((resolve) => setTimeout(resolve, 300));
    const position = savedListPosition("late-box");
    detach?.();
    box.remove();
    return position;
  });
  expect(saved?.scrollTop).toBe(200);
});

test("a click saves the current position before the scroll debounce", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  const saved = await page.evaluate(async () => {
    const path = "/src/lib/utils/list-position.ts";
    const { keepListPosition, savedListPosition } = await import(path);
    const box = document.createElement("div");
    box.style.cssText = "height:100px;overflow:auto";
    box.innerHTML =
      '<div><div data-list-row="first" style="height:500px"><button>Open</button></div></div>';
    document.body.prepend(box);
    const detach = keepListPosition("click-test", () => 1)(box.firstElementChild as HTMLElement);
    box.scrollTop = 200;
    box.dispatchEvent(new Event("scroll"));
    box.querySelector("button")!.click();
    const position = savedListPosition("click-test");
    detach?.();
    box.remove();
    return position?.scrollTop;
  });
  expect(saved).toBe(200);
});

test("only a row link click saves an opened row and scrolling clears it", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  const saved = await page.evaluate(async () => {
    const path = "/src/lib/utils/list-position.ts";
    const { keepListPosition, savedListPosition } = await import(path);
    const box = document.createElement("div");
    box.style.cssText = "height:100px;overflow:auto";
    box.innerHTML =
      '<div><div data-list-row="a" style="height:500px"><a href="#row">Row</a><button>Action</button></div></div>';
    document.body.prepend(box);
    const node = box.firstElementChild as HTMLElement;
    const detach = keepListPosition("opened-test", () => 1)(node);
    node.addEventListener("click", (event) => event.preventDefault());
    node.querySelector("a")!.click();
    const afterLink = savedListPosition("opened-test")?.opened;
    node.querySelector("button")!.click();
    const afterButton = savedListPosition("opened-test")?.opened;
    node.querySelector("a")!.click();
    box.scrollTop = 200;
    box.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => setTimeout(resolve, 300));
    const afterScroll = savedListPosition("opened-test")?.opened;
    detach?.();
    box.remove();
    return { afterLink, afterButton, afterScroll };
  });
  expect(saved).toEqual({ afterLink: "a", afterButton: undefined, afterScroll: undefined });
});

test("restoring a row leaves focus the reader already moved", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  const result = await page.evaluate(async () => {
    const path = "/src/lib/utils/list-position.ts";
    const { placeList } = await import(path);
    const node = document.createElement("div");
    node.innerHTML = '<div data-list-row="a"><a href="#row">Row</a></div>';
    const button = document.createElement("button");
    document.body.prepend(node, button);
    button.focus();
    await placeList(node, { rows: 1, top: "a", offset: 0, scrollTop: 0, opened: "a" });
    const keptFocus = document.activeElement === button;
    node.remove();
    button.remove();
    return keptFocus;
  });
  expect(result).toBe(true);
});

test("restoring a row focuses its link when the document has no active element", async ({
  page,
}) => {
  await gotoPage(page, "load-on-scroll");
  const result = await page.evaluate(async () => {
    const path = "/src/lib/utils/list-position.ts";
    const { placeList } = await import(path);
    const node = document.createElement("div");
    node.innerHTML = '<div data-list-row="a"><a href="#row">Row</a></div>';
    document.body.prepend(node);
    const link = node.querySelector("a")!;
    let focused = false;
    link.addEventListener("focus", () => {
      focused = true;
    });
    Object.defineProperty(document, "activeElement", { configurable: true, get: () => null });
    try {
      await placeList(node, { rows: 1, top: "a", offset: 0, scrollTop: 0, opened: "a" });
    } finally {
      delete (document as any).activeElement;
      node.remove();
    }
    return focused;
  });
  expect(result).toBe(true);
});
