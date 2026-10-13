import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { loginViaApi } from "./helpers/auth";
import { seedE2E } from "./helpers/backend";
import { seededIds } from "./helpers/fixtures";

test.describe("Additional persistence and date coverage", () => {
  test.beforeEach(() => seedE2E());

  test("memorization and revision progress forms both save and survive reload", async ({ page }) => {
    await loginViaApi(page, "teacher");
    await page.goto(`/progress/${seededIds.student}`);
    const form = page.locator("form");
    for (const type of ["حفظ", "مراجعة"]) {
      await form.getByRole("button", { name: type, exact: true }).click();
      await form.getByRole("button", { name: "اختر السورة" }).click();
      await form.getByPlaceholder("ابحث عن سورة...").fill("الفاتحة");
      await form.getByRole("button", { name: /الفاتحة/ }).click();
      await form.locator('input[type="number"]').nth(0).fill("1");
      await form.locator('input[type="number"]').nth(1).fill("7");
      await form.getByPlaceholder("ملاحظة اختيارية عن أداء الطالب...").fill(`سجل ${type} محفوظ`);
      const pushed = page.waitForResponse((response) => response.url().endsWith("/api/sync/push/") && response.request().method() === "POST");
      await form.getByRole("button", { name: "حفظ التقدم" }).click();
      const result = await (await pushed).json();
      expect(result.data.results.every((row: { status: string }) => row.status === "synced")).toBe(true);
      await expect(page.getByRole("table").getByText(`سجل ${type} محفوظ`, { exact: true })).toBeVisible();
      await expect(form.getByRole("button", { name: "اختر السورة" })).toBeVisible();
    }
    await page.reload();
    await expect(page.getByRole("table").getByText("سجل حفظ محفوظ", { exact: true })).toBeVisible();
    await expect(page.getByRole("table").getByText("سجل مراجعة محفوظ", { exact: true })).toBeVisible();
  });

  test("student workload remains readable on mobile after reload", async ({ page }) => {
    await loginViaApi(page, "student");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    const progress = page.getByRole("region", { name: "تقدم الحفظ والمراجعة" });
    await expect(progress).toBeVisible();
    await expect(progress.getByRole("columnheader", { name: "الحفظ", exact: true })).toBeVisible();
    await expect(progress.getByRole("columnheader", { name: "المراجعة", exact: true })).toBeVisible();
    expect(await progress.evaluate((element) => getComputedStyle(element).direction)).toBe("rtl");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await progress.screenshot({ path: "/workspace/scratch/student-progress-mobile.png" });
  });

  test("monthly progress includes the last day of the month in Gaza timezone", async ({ browser }) => {
    execFileSync("python3", ["manage.py", "shell", "-c", `
from datetime import date, timedelta
from records.models import WeeklyPlan, DailyRecord
today = date.today()
last = today.replace(day=1) - timedelta(days=1)
plan, _ = WeeklyPlan.objects.update_or_create(student_id='${seededIds.student}', week_start=last.replace(day=1), defaults={'month_start': last.replace(day=1), 'required_pages': 5, 'review_required_pages': 5})
DailyRecord.objects.update_or_create(student_id='${seededIds.student}', date=last, defaults={'weekly_plan':plan, 'day':'tue', 'attendance':'present', 'memorized_lines':15, 'review_lines':15})
`], { cwd: path.resolve(__dirname, "../../backend"), stdio: "ignore" });
    const context = await browser.newContext({ timezoneId: "Asia/Gaza" });
    const page = await context.newPage();
    await loginViaApi(page, "student");
    await page.goto("/student/plan");
    await page.getByRole("button", { name: "السابق", exact: true }).click();
    const progress = page.getByRole("region", { name: "تقدم الحفظ والمراجعة" });
    await expect(progress.getByRole("row", { name: "المنجز" })).toHaveText(/المنجز.*1 صفحة.*1 صفحة/);
    await expect(progress.getByRole("row", { name: "الإنجاز" })).toHaveText(/الإنجاز.*20%.*20%/);
    await context.close();
  });
});
