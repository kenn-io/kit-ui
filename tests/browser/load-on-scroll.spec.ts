import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers";

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

  const focusedOffscreen = await page.evaluate(async () => {
    const path = "/src/lib/utils/list-position.ts";
    const { restoreListPosition } = await import(path);
    const box = document.createElement("div");
    box.style.cssText = "height:100px; overflow-y:auto";
    box.innerHTML = '<div style="height:1000px"></div><div data-list-row="opened"><a href="#row">Row</a></div>';
    document.body.append(box);
    restoreListPosition(box, { rows: 1, top: "missing", offset: 0, scrollTop: 200, opened: "opened" });
    const focused = document.activeElement === box.querySelector("a");
    box.remove();
    return focused;
  });
  expect(focusedOffscreen).toBe(false);
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
    const { keepListPosition, savedListPosition, restoreListPosition } = await import(path);
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
    restoreListPosition(node, saved);
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
