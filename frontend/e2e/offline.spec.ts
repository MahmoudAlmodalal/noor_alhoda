import { expect, test, type Page } from "@playwright/test";

import { loginViaUi } from "./helpers/auth";
import { seedE2E } from "./helpers/backend";

async function loadControlledDashboard(page: Page) {
  await loginViaUi(page, "admin");
  await expect(page).toHaveURL("/");
  await expect(page.getByText("عدد الطلاب المسجلين")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Boolean(sessionStorage.getItem("_dbk"))))
    .toBe(true);
  // `_dbk` only means the encrypted DB is unlocked; wait for the seeded
  // records to arrive before simulating a network outage.
  await expect(page.getByText("Student One").first()).toBeVisible({
    timeout: 60_000,
  });

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
          once: true,
        });
      });
    }
  });

  // The first page load necessarily downloads Next chunks before the SW can
  // control the document. Reload once while online so those chunks enter the
  // runtime cache; a later offline reload then exercises the real cold-start
  // behavior rather than a missing development asset.
  await page.reload();
  await expect(page.getByText("Student One").first()).toBeVisible({
    timeout: 60_000,
  });
}

test.describe("Offline service worker fallback", () => {
  test.beforeEach(() => {
    seedE2E();
  });

  test("keeps the dashboard shell and shows the offline banner after reload", async ({
    page,
  }) => {
    await loadControlledDashboard(page);

    await page.context().setOffline(true);
    await page.reload();

    await expect(page.getByText("عدد الطلاب المسجلين")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("status")).toContainText("أنت تعمل دون اتصال", {
      timeout: 30_000,
    });
  });

  test("renders HTML fallback instead of raw Offline for an uncached route", async ({
    page,
  }) => {
    await loadControlledDashboard(page);

    await page.evaluate(async () => {
      await Promise.all((await caches.keys()).map((cacheName) => caches.delete(cacheName)));
    });
    await page.context().setOffline(true);

    const response = await page.goto("/route-that-is-not-cached");

    expect(response?.status()).toBe(503);
    await expect(page.locator("h1")).toHaveText("لا يوجد اتصال بالإنترنت");
    expect(await page.locator("body").innerText()).not.toContain("Offline");
  });

  test("keeps normal online navigation working", async ({ page }) => {
    await loadControlledDashboard(page);

    await page.context().setOffline(true);
    await page.reload();
    await expect(page.getByRole("status")).toContainText("أنت تعمل دون اتصال", {
      timeout: 30_000,
    });

    await page.context().setOffline(false);
    await page.goto("/students");
    await expect(page.getByText("Student One")).toBeVisible();
  });
});
