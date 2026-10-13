import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { loginViaApi } from "./helpers/auth";
import { seedE2E } from "./helpers/backend";
import { seededIds } from "./helpers/fixtures";

test.describe("Teacher and student analytics", () => {
  test.beforeEach(() => seedE2E());

  test("teacher selection, student history and back preserve filters; both reports download", async ({
    page,
  }, testInfo) => {
    await loginViaApi(page, "admin");
    await page.goto("/teachers");
    await page
      .getByRole("link", { name: /Teacher One/ })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "ملف المحفّظ وإحصائيات الطلاب" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "معلومات المحفّظ" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("teacher-overview.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Student One", exact: true })
      .click();
    await expect(
      page
        .getByRole("navigation", { name: "أقسام إحصائيات المحفّظ" })
        .getByRole("button", { name: "نظرة عامة", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page
      .getByRole("region", { name: "لوحة إنجاز الطالب" })
      .getByRole("button", { name: "العودة إلى إحصائيات المحفّظ" })
      .click();
    await expect(
      page
        .getByRole("navigation", { name: "أقسام إحصائيات المحفّظ" })
        .getByRole("button", { name: "نظرة عامة", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.getByLabel("البحث باسم الطالب").fill("Student One");
    await page
      .getByRole("navigation", { name: "أقسام إحصائيات المحفّظ" })
      .getByRole("button", { name: "الطلاب والإنجاز" })
      .click();
    await page.getByRole("button", { name: "عرض تفاصيل Student One" }).click();
    const student = page.getByRole("region", { name: "لوحة إنجاز الطالب" });
    await expect(
      student.getByRole("heading", { name: "إنجاز الطالب: Student One" }),
    ).toBeVisible();
    await student.screenshot({
      path: testInfo.outputPath("student-overview.png"),
    });
    await student
      .getByRole("button", { name: "تفاصيل الحفظ", exact: true })
      .click();
    await expect(
      student.getByRole("heading", { name: "سجل الحفظ التفصيلي" }),
    ).toBeVisible();
    await expect(
      student.getByText("الملك", { exact: true }).first(),
    ).toBeVisible();
    await student.getByRole("button", { name: "الحضور", exact: true }).click();
    await expect(
      student.getByRole("heading", { name: "سجل الحضور والالتزام" }),
    ).toBeVisible();
    const individualDownload = page.waitForEvent("download");
    await student.getByRole("button", { name: "تقرير الطالب PDF" }).click();
    const studentFile = await (await individualDownload).path();
    expect((await fs.readFile(studentFile!)).subarray(0, 5).toString()).toBe(
      "%PDF-",
    );
    await student
      .getByRole("button", { name: "العودة إلى إحصائيات المحفّظ" })
      .click();
    await expect(page.getByLabel("البحث باسم الطالب")).toHaveValue(
      "Student One",
    );
    await expect(student).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "أقسام إحصائيات المحفّظ" })
      .getByRole("button", { name: "التقارير", exact: true })
      .click();
    const teacherDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "تحميل تقرير المحفّظ PDF" }).click();
    const teacherFile = await (await teacherDownload).path();
    expect((await fs.readFile(teacherFile!)).subarray(0, 5).toString()).toBe(
      "%PDF-",
    );
  });

  test("custom periods, empty state, mobile RTL and network errors", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginViaApi(page, "admin");
    await page.goto(`/teachers/${seededIds.teacher}`);
    await page.getByLabel("الفترة", { exact: true }).selectOption("custom");
    await page.getByLabel("من تاريخ").fill("2020-01-01");
    await page.getByLabel("إلى تاريخ").fill("2020-01-31");
    await page.getByRole("button", { name: "تطبيق الفترة" }).click();
    await expect(
      page.getByText(/الفترة المعروضة: 2020-01-01 إلى 2020-01-31/),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const widths = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(widths[0]).toBeLessThanOrEqual(widths[1]);
    await page.getByLabel("البحث باسم الطالب").fill("لا يوجد طالب بهذا الاسم");
    await expect(
      page.getByText("لا توجد سجلات خلال الفترة المحددة.").first(),
    ).toBeVisible();
    await page.route("**/api/reports/teachers/**/analytics/**", (route) =>
      route.abort(),
    );
    await page.getByRole("button", { name: "تحديث الإحصائيات" }).click();
    await expect(
      page.getByRole("button", { name: "إعادة المحاولة" }),
    ).toBeVisible();
  });

  test("teachers cannot enter the admin teacher page", async ({ page }) => {
    await loginViaApi(page, "teacher");
    await page.goto(`/teachers/${seededIds.teacher}`);
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: "ملف المحفّظ وإحصائيات الطلاب" }),
    ).toHaveCount(0);
  });
});
