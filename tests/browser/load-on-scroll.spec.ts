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

for (const kind of ["list", "table"]) {
  test(`${kind} restores the second followed link across history`, async ({ page }) => {
    await page.addInitScript(() => {
      const addLink = () => {
        for (const row of document.querySelectorAll('[data-list-row="5"]')) {
          if (row.querySelector("[data-second-link]")) continue;
          const first = row.querySelector("a[href]");
          if (!first) continue;
          const second = first.cloneNode(true) as HTMLAnchorElement;
          second.dataset.secondLink = "";
          second.textContent = "Second link";
          first.after(second);
        }
      };
      new MutationObserver(addLink).observe(document, { childList: true, subtree: true });
    });
    await gotoPage(page, "load-on-scroll");
    const box = page.getByTestId(`${kind}-box`);
    const link = box.getByRole("link", { name: "Second link" });
    await link.click();
    await page.goBack();
    await expect(link).toBeFocused();
    await (kind === "table" ? box.locator(".kit-table-wrapper") : box).evaluate((el) => {
      el.scrollTop += 20;
    });
    await page.waitForTimeout(300);
    await page.goForward();
    await page.goBack();
    await expect(link).toBeFocused();
  });
}

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
    await expect(link).toBeFocused();
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

test("focuses the opened virtual row in the saved viewport when the top row is missing", async ({
  page,
}) => {
  await gotoPage(page, "load-on-scroll");
  const box = page.getByTestId("table-box");
  const link = box.getByRole("link", { name: "Row 55", exact: true });
  await expect(link).toHaveCount(0);
  await page.evaluate(() => {
    history.replaceState(
      {
        listPositions: {
          "demo-table": { rows: 1000, top: "missing", offset: 0, scrollTop: 2000, opened: "55" },
        },
      },
      "",
    );
  });
  await page.reload();
  await expect(link).toBeFocused();
  await expect(box.locator(".kit-table-wrapper")).toHaveJSProperty("scrollTop", 2000);
  const visible = await link.evaluate((el) => {
    const row = el.getBoundingClientRect();
    const viewport = el.closest(".kit-table-wrapper")!.getBoundingClientRect();
    return row.top >= viewport.top && row.bottom <= viewport.bottom;
  });
  expect(visible).toBe(true);
});

test("restores the saved offset when the top virtual row is missing", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  await page.evaluate(() => {
    history.replaceState(
      {
        listPositions: {
          "demo-table": { rows: 1000, top: "missing", offset: 0, scrollTop: 2000, opened: "640" },
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
  await expect(page.locator("body")).toBeFocused();
});

test("restores the top row within the first 1000 when more rows were saved", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  await page.evaluate(() => {
    history.replaceState(
      {
        listPositions: {
          "demo-table": { rows: 1400, top: "950", offset: 50, scrollTop: 0, opened: "955" },
        },
      },
      "",
    );
  });
  await page.reload();
  const box = page.getByTestId("table-box");
  const row = box.locator('[data-list-row="950"]');
  await expect(row).toBeVisible();
  await expect(box.getByRole("link", { name: "Row 955", exact: true })).toBeFocused();
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

test("scroll saves retain the opened row across Forward and Back", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  const box = page.getByTestId("list-box");
  const link = box.getByRole("link", { name: "Row 30", exact: true });
  await link.click();
  await page.goBack();
  await expect(link).toBeFocused();
  await box.evaluate((el) => {
    el.scrollTop += 20;
  });
  await page.waitForTimeout(300);
  await page.goForward();
  await page.goBack();
  await expect(link).toBeFocused();
});

test("modified and new-context clicks keep the opened row", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  const opened = await page.evaluate(async () => {
    const path = "/src/lib/utils/list-position.ts";
    const { keepListPosition, savedListPosition } = await import(path);
    const box = document.createElement("div");
    box.innerHTML =
      '<div data-list-row="first"><a href="#first">First</a></div><div data-list-row="second"><a href="#second">Second</a></div>';
    document.body.prepend(box);
    const detach = keepListPosition("click-test", () => 2)(box);
    const links = box.querySelectorAll("a");
    box.addEventListener("click", (event) => event.preventDefault());
    links[0]!.click();
    links[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    const modified = savedListPosition("click-test")?.opened;
    links[1]!.target = "_blank";
    links[1]!.click();
    const target = savedListPosition("click-test")?.opened;
    links[1]!.removeAttribute("target");
    links[1]!.download = "file";
    links[1]!.click();
    const download = savedListPosition("click-test")?.opened;
    detach?.();
    box.remove();
    return { modified, target, download };
  });
  expect(opened).toEqual({ modified: "first", target: "first", download: "first" });
});
