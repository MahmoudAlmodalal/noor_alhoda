import { expect, test } from "@playwright/test";

import { loginViaApi } from "./helpers/auth";
import { seedE2E } from "./helpers/backend";
import { seededIds } from "./helpers/fixtures";

test.describe("Confirmed regression coverage", () => {
  test.beforeEach(() => {
    seedE2E();
  });

  test("empty teacher submission stays open and shows local validation", async ({
    page,
  }) => {
    await loginViaApi(page, "admin");
    await page.goto("/teachers");

    await page.getByRole("button", { name: "إضافة محفظ" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "إضافة" }).click();

    await expect(dialog).toContainText(
      "الاسم الرباعي ورقم الهوية ورقم الجوال حقول مطلوبة."
    );
    await expect(dialog).toBeVisible();
  });

  test("empty course submission stays open and shows local validation", async ({
    page,
  }) => {
    await loginViaApi(page, "admin");
    await page.goto("/courses");

    await page.getByRole("button", { name: "إضافة دورة جديدة" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "إضافة" }).click();

    await expect(dialog).toContainText("اسم الدورة مطلوب.");
    await expect(dialog).toBeVisible();
  });

  test("monthly report modal closes with Escape", async ({ page }) => {
    await loginViaApi(page, "admin");
    await page.goto(`/students/${seededIds.student}`);

    const detailsButton = page.getByRole("button", { name: "عرض التفاصيل" }).first();
    await expect(detailsButton).toBeVisible();
    await detailsButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("التقرير الشهري الكامل");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

