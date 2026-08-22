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

  test("evaluation scheduling uses month and grading records the actual date", async ({ page }) => {
    await loginViaApi(page, "teacher");
    await page.goto("/evaluations");
    await page.getByRole("button", { name: "إضافة اختبار" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("ابحث عن طالب").fill("Student One");
    await dialog.getByRole("button", { name: "Student One" }).click();
    await dialog.locator('input[placeholder="مثال: اختبار شهري"]').fill("اختبار شهر E2E");
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await dialog.locator('input[type="month"]').fill(currentMonth);
    await dialog.getByRole("button", { name: "جدولة" }).click();

    const card = page.locator("article").filter({ hasText: "اختبار شهر E2E" });
    await expect(card).toContainText("شهر الاختبار");
    await card.getByRole("button", { name: "تقييم الاختبار" }).click();
    const gradeDialog = page.getByRole("dialog");
    await gradeDialog.getByRole("button", { name: "ناجح" }).click();
    await gradeDialog.getByLabel("الدرجة").fill("88");
    await gradeDialog.getByRole("button", { name: "حفظ التقييم" }).click();

    await page.getByRole("button", { name: "المنتهية" }).click();
    const evaluatedCard = page.locator("article").filter({ hasText: "اختبار شهر E2E" });
    await expect(evaluatedCard).toContainText("تم التقييم في:");
    await expect(evaluatedCard).toContainText("88");
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

