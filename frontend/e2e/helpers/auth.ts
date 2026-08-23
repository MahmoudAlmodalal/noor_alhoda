import { expect, type Page } from "@playwright/test";
import { seededUsers } from "./fixtures";

type Role = keyof typeof seededUsers;

/**
 * Keep the helper name for existing specs, but use the real UI flow so the
 * application initializes and unlocks its encrypted offline database.
 */
export async function loginViaApi(page: Page, role: Role) {
  await loginViaUi(page, role);
  await expect(page).toHaveURL(role === "student" ? /\/student$/ : /\/$/);
  await expect
    .poll(() => page.evaluate(() => Boolean(sessionStorage.getItem("_dbk"))), {
      timeout: 30_000,
    })
    .toBe(true);
  await expect(page.getByRole("button", { name: "متزامن" })).toBeVisible({
    timeout: 60_000,
  });
}

export async function loginViaUi(page: Page, role: Role) {
  const credentials = seededUsers[role];

  await page.goto("/login");
  await page.getByLabel("رقم الهوية").fill(credentials.phone);
  await page.getByLabel("كلمة المرور").fill(credentials.password);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
}

export async function logoutViaUi(page: Page) {
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
}
