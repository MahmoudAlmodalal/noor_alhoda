import { expect, test } from "@playwright/test";

import { loginViaUi, logoutViaUi } from "./helpers/auth";
import { seedE2E } from "./helpers/backend";
import { knownOtp, seededUsers } from "./helpers/fixtures";

test.describe("Authentication flows", () => {
  test.beforeEach(() => {
    seedE2E();
  });

  test("login via UI persists the session and logout clears it", async ({
    page,
  }) => {
    await loginViaUi(page, "admin");

    await expect(page).toHaveURL("/");
    await expect(page.getByText("عدد الطلاب المسجلين")).toBeVisible();

    await logoutViaUi(page);

    await expect(page).toHaveURL(/\/login$/);
    const tokens = await page.evaluate(() => ({
      access: localStorage.getItem("access_token"),
      refresh: localStorage.getItem("refresh_token"),
    }));

    expect(tokens.access).toBeNull();
    expect(tokens.refresh).toBeNull();
  });

  test("login shows invalid credentials and then a lockout message", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("رقم الجوال").fill(seededUsers.student.phone);
    await page.getByLabel("كلمة المرور").fill("wrong-password");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await page.getByRole("button", { name: "تسجيل الدخول" }).click();
      await expect(
        page.getByText("رقم الجوال أو كلمة المرور غير صحيحة.")
      ).toBeVisible();
    }

    await page.getByRole("button", { name: "تسجيل الدخول" }).click();
    await expect(page.getByText("الحساب مقفل")).toBeVisible();
  });

  test("password reset guards invalid entry and supports a successful reset", async ({
    page,
  }) => {
    await page.goto("/login/verify-otp");
    await expect(page).toHaveURL(/\/login\/forgot-password$/);

    await page.goto("/login/reset-password");
    await expect(page).toHaveURL(/\/login\/forgot-password$/);

    await page.goto("/login/forgot-password");
    await page.getByLabel("رقم الجوال").fill(seededUsers.student.phone);
    await page.getByRole("button", { name: "إرسال رمز التحقق" }).click();
    await expect(page).toHaveURL(/\/login\/verify-otp$/);

    seedE2E({ otpCode: knownOtp });

    const otpInputs = page.locator('input[inputmode="numeric"]');
    for (const [index, digit] of knownOtp.split("").entries()) {
      await otpInputs.nth(index).fill(digit);
    }

    await page.getByRole("button", { name: "تحقق من الرمز" }).click();
    await expect(page).toHaveURL(/\/login\/reset-password$/);

    await page.getByLabel("كلمة المرور الجديدة").fill("NewStudentPass123!");
    await page.getByLabel("تأكيد كلمة المرور").fill("MismatchPass123!");
    await page.getByRole("button", { name: "تأكيد وحفظ" }).click();
    await expect(page.getByText("كلمتا المرور غير متطابقتين")).toBeVisible();

    await page.getByLabel("كلمة المرور الجديدة").fill("NewStudentPass123!");
    await page.getByLabel("تأكيد كلمة المرور").fill("NewStudentPass123!");
    await page.getByRole("button", { name: "تأكيد وحفظ" }).click();

    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel("رقم الجوال").fill(seededUsers.student.phone);
    await page.getByLabel("كلمة المرور").fill("NewStudentPass123!");
    await page.getByRole("button", { name: "تسجيل الدخول" }).click();
    await expect(page).toHaveURL("/student");
  });
});
