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
