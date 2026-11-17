import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers";

for (const change of ["distance", "growth", "resize"]) {
  test(`watchListEnd prefetches ${change === "distance" ? "at a distance" : `after a scroller change following ${change}`}`, async ({
    page,
  }) => {
    if (change === "distance") await page.setViewportSize({ width: 200, height: 200 });
    await gotoPage(page, "load-on-scroll");
    const result = await page.evaluate(async (change) => {
      const path = "/src/lib/components/virtual.ts";
      const { watchListEnd } = await import(path);
      const box = document.createElement("div");
      box.style.cssText =
        change === "distance"
          ? "position:fixed;top:0;left:0;width:200px;height:800px;overflow:auto"
          : "position:fixed;top:0;left:0;width:300px;height:600px;overflow:auto";
      box.innerHTML = `<div style="height:${change === "distance" ? 1199 : 500}px"></div><div style="height:1px"></div>`;
      document.body.append(box);
      const end = box.lastElementChild as HTMLElement;
      const belowView =
        end.getBoundingClientRect().top > Math.max(box.getBoundingClientRect().bottom, innerHeight);
      let count = 0;
      const detach = watchListEnd(end, () => count++);
      if (change !== "distance") {
        await new Promise((resolve) => setTimeout(resolve, 150));
        count = 0;
        if (change === "growth") (box.firstElementChild as HTMLElement).style.height = "1000px";
        else box.style.height = "200px";
        await new Promise((resolve) => setTimeout(resolve, 150));
        count = 0;
        box.scrollTop = change === "growth" ? 300 : 220;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      detach();
      box.remove();
      return { count, belowView };
    }, change);
    expect(result.count).toBeGreaterThan(0);
    if (change === "distance") {
      expect(result.belowView).toBe(true);
    }
  });
}

test("scrolling before placement cancels it", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  await page.evaluate(async () => {
    const path = "/src/lib/utils/list-position.ts";
    const { placeList } = await import(path);
    const box = document.createElement("div");
    box.dataset.testid = "placement-box";
    box.style.cssText = "position:fixed;top:0;left:0;width:300px;height:200px;overflow:auto";
    box.innerHTML =
      '<div style="height:1200px"><div data-list-row="target" style="margin-top:700px;height:40px">Row</div></div>';
    document.body.prepend(box);
    let release!: () => void;
    const ready = new Promise<void>((resolve) => (release = resolve));
    const placement = placeList(
      box.firstElementChild as HTMLElement,
      { rows: 1, top: "target", offset: 0, scrollTop: 700 },
      undefined,
      ready,
    );
    (window as any).finishPlacement = async () => {
      release();
      await placement;
    };
  });
  const box = page.getByTestId("placement-box");
  const before = await box.evaluate((el) => el.scrollTop);
  await box.hover();
  await page.mouse.wheel(0, 100);
  await expect.poll(() => box.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
  const position = await box.evaluate((el) => el.scrollTop);
  await page.evaluate(() => (window as any).finishPlacement());
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
    await box.evaluate((el) => (el.style.width = "200px"));
    const scroller = kind === "table" ? box.locator(".kit-table-wrapper") : box;
    await page.getByLabel("Fail next batch").check();
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const alert = box.getByRole("alert");
    await expect(alert).toBeVisible();
    await alert
      .locator("span")
      .first()
      .evaluate((el) => (el.textContent = "Failure ".repeat(80)));
    const bounds = await alert.evaluate((el) => {
      const alert = el.getBoundingClientRect();
      const box = el.closest('[data-testid$="-box"]')!.getBoundingClientRect();
      return { left: alert.left - box.left, right: alert.right - box.right };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(1);
    await box.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByTestId(`${kind}-count`)).toContainText("200");
    for (let n = 300; n <= 1000; n += 100) {
      await scroller.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(page.getByTestId(`${kind}-count`)).toContainText(String(n));
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
    if (kind === "list") {
      await link.focus();
      await page.keyboard.press("Enter");
    } else {
      await link.click();
    }
    await expect(page.getByRole("heading", { name: "Row 640" })).toBeVisible();
    const before = Number(await page.evaluate(() => sessionStorage.getItem("opened-offset")));
    await page.evaluate((kind) => {
      const counts: string[] = [];
      (window as Window & { restoredCounts: string[] }).restoredCounts = counts;
      new MutationObserver(() => {
        const count = document.querySelector(`[data-testid="${kind}-count"]`);
        if (count) counts.push(count.textContent ?? "");
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }, kind);
    await page.goBack();
    if (kind === "list") await expect(link).toBeFocused();
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
    expect(
      await page.evaluate(() => (window as Window & { restoredCounts: string[] }).restoredCounts),
    ).not.toContain("100 rows loaded");
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
    const sveltePath = "/node_modules/.vite/deps/svelte.js";
    const { default: ListEnd } = await import(componentPath);
    const { mount, unmount, flushSync } = await import(sveltePath);
    const internalPath = "/node_modules/.vite/deps/svelte_internal_client.js";
    const { state, get, set } = await import(internalPath);
    const idle = state(false);
    const host = document.createElement("ul");
    document.body.prepend(host);
    let count = 0;
    const props = {
      rows: { loading: false, problem: null, retry: () => {} },
      more: true,
      get idle() {
        return get(idle);
      },
      label: "rows",
      onmore: () => count++,
    };
    const component = mount(ListEnd, { target: host, props });
    flushSync();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const before = count;
    set(idle, true);
    flushSync();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await unmount(component);
    host.remove();
    return { before, after: count };
  });
  expect(calls.before).toBe(0);
  expect(calls.after).toBeGreaterThan(0);
});

test("only a row link click saves an opened row and scrolling clears it", async ({ page }) => {
  await gotoPage(page, "load-on-scroll");
  const saved = await page.evaluate(async () => {
    const path = "/src/lib/utils/list-position.ts";
    const { keepListPosition, savedListPosition } = await import(path);
    const box = document.createElement("div");
    box.style.cssText = "height:100px;overflow:auto";
    document.body.prepend(box);
    const node = document.createElement("div");
    box.append(node);
    const detach = keepListPosition("opened-test", () => 1)(node);
    node.innerHTML =
      '<div data-list-row="a" style="height:500px"><a href="#row">Row</a><button>Action</button></div>';
    node.addEventListener("click", (event) => event.preventDefault());
    node.querySelector("a")!.click();
    const afterLink = savedListPosition("opened-test")?.opened;
    node.querySelector("button")!.click();
    const afterButton = savedListPosition("opened-test")?.opened;
    node.querySelector("a")!.click();
    box.scrollTop = 200;
    await new Promise((resolve) => setTimeout(resolve, 300));
    const position = savedListPosition("opened-test");
    detach?.();
    box.remove();
    return {
      afterLink,
      afterButton,
      afterScroll: position?.opened,
      scrollTop: position?.scrollTop,
    };
  });
  expect(saved).toEqual({
    afterLink: "a",
    afterButton: undefined,
    afterScroll: undefined,
    scrollTop: 200,
  });
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
