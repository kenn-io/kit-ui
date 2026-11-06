import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { Page } from "@playwright/test";
import { gotoPage } from "../tests/browser/helpers.js";

// Model only the Playwright boundary used while loading the gallery.
function galleryPage(
  attempts: Array<"loaded" | "blank" | "network-change" | "module-error" | Error>,
) {
  const events = new EventEmitter();
  const urls: string[] = [];
  let rendered = false;
  const page = Object.assign(events, {
    async goto(url: string) {
      urls.push(url);
      const result = attempts[urls.length - 1];
      rendered = result === "loaded";
      if (result === "network-change" || result === "module-error") {
        events.emit("requestfailed", {
          failure: () => ({
            errorText: result === "network-change" ? "net::ERR_NETWORK_CHANGED" : "net::ERR_FAILED",
          }),
        });
      }
      if (result instanceof Error) throw result;
    },
    async reload() {
      // A failed first navigation can leave Chromium on about:blank.
      if (attempts[urls.length - 1] instanceof Error) throw new Error("No page to reload");
      await page.goto(urls[0]!);
    },
    locator() {
      return {
        async waitFor() {
          if (!rendered) throw new Error("Gallery did not render");
        },
      };
    },
  });
  return { page: page as unknown as Page, events, urls };
}

test("gallery navigation loads once when requests succeed", async () => {
  const { page, events, urls } = galleryPage(["loaded"]);
  await gotoPage(page, "command-palette");
  expect(urls).toEqual(["/#command-palette"]);
  expect(events.listenerCount("requestfailed")).toBe(0);
});

test("gallery navigation recovers modules aborted by a network change", async () => {
  const { page, events, urls } = galleryPage(["network-change", "loaded"]);
  await gotoPage(page, "command-palette");
  expect(urls).toEqual(["/#command-palette", "/#command-palette"]);
  expect(events.listenerCount("requestfailed")).toBe(0);
});

test("gallery navigation recovers a document aborted by a network change", async () => {
  const { page, urls } = galleryPage([
    new Error("page.goto: net::ERR_NETWORK_CHANGED at http://example.com/"),
    "loaded",
  ]);
  await gotoPage(page, "command-palette");
  expect(urls).toHaveLength(2);
});

test("gallery navigation leaves other navigation errors visible", async () => {
  const failure = new Error("page.goto: net::ERR_CONNECTION_REFUSED");
  const { page, events, urls } = galleryPage([failure, "loaded"]);
  await expect(gotoPage(page, "command-palette")).rejects.toBe(failure);
  expect(urls).toHaveLength(1);
  expect(events.listenerCount("requestfailed")).toBe(0);
});

test("gallery navigation leaves rendering failures visible", async () => {
  const { page, events, urls } = galleryPage(["blank", "loaded"]);
  await expect(gotoPage(page, "command-palette")).rejects.toThrow("Gallery did not render");
  expect(urls).toHaveLength(1);
  expect(events.listenerCount("requestfailed")).toBe(0);
});

test("gallery navigation leaves other module failures visible", async () => {
  const { page, events, urls } = galleryPage(["module-error", "loaded"]);
  await expect(gotoPage(page, "command-palette")).rejects.toThrow("Gallery did not render");
  expect(urls).toHaveLength(1);
  expect(events.listenerCount("requestfailed")).toBe(0);
});

test("gallery navigation retries a network change only once", async () => {
  const { page, events, urls } = galleryPage(["network-change", "network-change", "loaded"]);
  await expect(gotoPage(page, "command-palette")).rejects.toThrow("Gallery did not render");
  expect(urls).toHaveLength(2);
  expect(events.listenerCount("requestfailed")).toBe(0);
});
