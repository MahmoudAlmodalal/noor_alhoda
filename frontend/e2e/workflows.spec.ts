import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";

import { loginViaApi } from "./helpers/auth";
import { seedE2E } from "./helpers/backend";
import { seededIds } from "./helpers/fixtures";

test.describe("Workflow coverage", () => {
  test.beforeEach(() => {
    seedE2E();
  });

  test("admin can create, edit, assign, and delete a student", async ({
    page,
  }) => {
    const suffix = Date.now().toString().slice(-6);
    const initialName = `Workflow Student ${suffix}`;
    const updatedName = `Workflow Student Updated ${suffix}`;

    await loginViaApi(page, "admin");
    await page.goto("/students/register");
    await page.getByRole("button", { name: /إضافة بيانات تفصيلية/ }).click();

    await page.getByLabel("رقم الهوية:").first().fill(`970500${suffix}`);
    await page.getByLabel("اسم الطالب الرباعي *").fill(initialName);
    await page.getByLabel("تاريخ الميلاد:").fill("2014-01-01");
    await page.locator("select").nth(1).selectOption({ label: "الصف الخامس" });
    await page.getByLabel("رقم الجوال:").first().fill(`970588${suffix}`);
    await page.getByLabel("عنوان السكن:").fill("Test Address");
    await page.getByLabel("الاسم رباعي:").fill("Workflow Guardian");
    await page.getByLabel("رقم الهوية:").nth(1).fill(`970600${suffix}`);
    await page.getByLabel("رقم الجوال:").nth(1).fill(`970577${suffix}`);
    await page
      .getByRole("button", { name: "حفظ كل البيانات وإصدار البطاقة" })
      .click();

    await expect(page).toHaveURL("/students");
    await expect(page.getByText(initialName).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "متزامن" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByLabel("البحث عن طالب").fill(initialName);

    await page
      .getByRole("button", { name: `تعديل الطالب ${initialName}` })
      .click();
    await page.getByLabel("الاسم رباعي").fill(updatedName);
    await page.getByRole("button", { name: "حفظ التعديلات" }).click();
    await expect(page.getByText("تم تحديث بيانات الطالب بنجاح")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByLabel("البحث عن طالب").fill(updatedName);
    await expect(page.getByText(updatedName).first()).toBeVisible({
      timeout: 30_000,
    });

    await page
      .getByRole("button", { name: `تعيين محفظ للطالب ${updatedName}` })
      .click();
    await page.getByLabel("اختر المحفظ").selectOption({ label: "Teacher One" });
    await page.getByRole("button", { name: "حفظ التعيين" }).click();

    const studentNationalId = `970500${suffix}`;
    await page.getByLabel("البحث عن طالب").fill(studentNationalId);
    const studentCard = page
      .getByText(studentNationalId)
      .locator("xpath=ancestor::div[.//button[contains(@aria-label, 'حذف الطالب')]][1]");
    await expect(studentCard).toBeVisible({ timeout: 30_000 });
    await expect(studentCard).toContainText("الشيخ Teacher One", {
      timeout: 30_000,
    });
    await studentCard.getByRole("button", { name: /حذف الطالب/ }).click();
    await page.getByRole("button", { name: "نعم، احذف" }).click();
    await expect(page.getByText(studentNationalId)).toHaveCount(0, {
      timeout: 30_000,
    });
  });

  test("teacher attendance saves persist after reload", async ({ page }) => {
    await loginViaApi(page, "teacher");
    await page.goto("/attendance");

    await page.getByRole("button", { name: "مستأذن" }).click();
    await page.getByRole("button", { name: "حفظ الكل" }).click();

    await page.reload();

    await expect(page.getByRole("button", { name: "مستأذن" })).toHaveClass(
      /bg-attend-excused-bg/
    );
  });

  test("student report download returns a non-empty PDF", async ({ page }) => {
    await loginViaApi(page, "admin");
    await page.goto(`/students/${seededIds.student}`);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "تحميل التقرير" }).click();
    const download = await downloadPromise;
    const filePath = await download.path();

    expect(filePath).toBeTruthy();
    const stat = await fs.stat(filePath!);
    expect(stat.size).toBeGreaterThan(0);
    const contents = await fs.readFile(filePath!);
    expect(contents.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
