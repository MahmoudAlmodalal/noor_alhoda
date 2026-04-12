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

    await page.getByLabel("رقم الهوية:").fill(`WF-${suffix}`);
    await page.getByLabel("الاسم رباعي:").fill(initialName);
    await page.getByLabel("تاريخ الميلاد:").fill("2014-01-01");
    await page.getByLabel("الصف الدراسي:").fill("Grade 5");
    await page.getByLabel("رقم الجوال:").first().fill(`970588${suffix}`);
    await page.getByLabel("عنوان السكن:").fill("Test Address");
    await page.getByLabel("اسم ولي الأمر:").fill("Workflow Guardian");
    await page.getByLabel("رقم الهوية:").nth(1).fill(`PG-${suffix}`);
    await page.getByLabel("رقم الجوال:").nth(1).fill(`970577${suffix}`);
    await page
      .getByRole("button", { name: "حفظ البيانات وإصدار البطاقة" })
      .click();

    await expect(page).toHaveURL("/students");
    await expect(page.getByText(initialName)).toBeVisible();

    await page
      .getByRole("button", { name: `تعديل الطالب ${initialName}` })
      .click();
    await page.getByLabel("الاسم الرباعي").fill(updatedName);
    await page.getByRole("button", { name: "حفظ التعديلات" }).click();
    await expect(page.getByText(updatedName)).toBeVisible();

    await page
      .getByRole("button", { name: `تعيين محفظ للطالب ${updatedName}` })
      .click();
    await page.getByLabel("اختر المحفظ").selectOption({ label: "Teacher One" });
    await page.getByRole("button", { name: "حفظ التعيين" }).click();
    await expect(page.getByText("Teacher One")).toBeVisible();

    await page
      .getByRole("button", { name: `حذف الطالب ${updatedName}` })
      .click();
    await page.getByRole("button", { name: "نعم، احذف" }).click();
    await expect(page.getByText(updatedName)).toHaveCount(0);
  });

  test("teacher attendance saves persist after reload", async ({ page }) => {
    await loginViaApi(page, "teacher");
    await page.goto("/attendance");

    await page.getByRole("button", { name: "مستأذن" }).click();
    await page.getByRole("button", { name: "حفظ الكل" }).click();

    await page.reload();

    await expect(page.getByRole("button", { name: "مستأذن" })).toHaveClass(
      /bg-blue-100/
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
  });
});
