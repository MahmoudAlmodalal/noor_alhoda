import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import { loginViaApi } from "./helpers/auth";
import { seedE2E } from "./helpers/backend";
import { apiBaseUrl, seededIds, seededUsers } from "./helpers/fixtures";

const legacyId = "77777777-7777-4777-8777-777777777777";

// Only the local E2E database used by the existing seed_e2e command.
function seedProgress() {
  execFileSync("python3", ["manage.py", "shell", "-c", `
from datetime import date
from records.models import WeeklyPlan, DailyRecord
from evaluations.models import Evaluation
student_id = '${seededIds.student}'
today = date.today()
plan, _ = WeeklyPlan.objects.update_or_create(student_id=student_id, week_start=today.replace(day=1), defaults={'month_start': today.replace(day=1), 'required_pages': 5, 'review_required_pages': 10})
record, _ = DailyRecord.objects.get_or_create(student_id=student_id, date=today, defaults={'day': 'tue'})
record.weekly_plan = plan
record.attendance = 'present'
record.memorized_lines = 45
record.review_lines = 105
record.save()
Evaluation.objects.create(id='${legacyId}', student_id=student_id, title='اختبار تاريخي', scheduled_date=date(2021,5,18), evaluated_date=date(2021,5,20), status='passed', score=80, max_score=100, created_by=None)
`], { cwd: path.resolve(__dirname, "../../backend"), stdio: "ignore" });
}

async function serverEvaluations(request: APIRequestContext) {
  const credentials = seededUsers.teacher;
  const login = await request.post(`${apiBaseUrl}/api/auth/login/`, { data: { national_id: credentials.phone, password: credentials.password } });
  const { data } = await login.json();
  const response = await request.get(`${apiBaseUrl}/api/evaluations/?student_id=${seededIds.student}`, { headers: { Authorization: `Bearer ${data.access}` } });
  return (await response.json()).data as Array<{ id: string; score: string; status: string; title: string; result_note: string }>;
}

async function openLegacy(page: Page) {
  await page.goto("/evaluations");
  await page.getByRole("button", { name: "المنتهية", exact: true }).click();
  const card = page.locator("article").filter({ hasText: "اختبار تاريخي" });
  await card.getByRole("button", { name: "تعديل التقييم" }).click();
  return page.getByRole("dialog");
}

async function expectWorkload(page: Page, memorized = "3 صفحة", reviewed = "7 صفحة") {
  const table = page.getByRole("region", { name: "تقدم الحفظ والمراجعة" });
  await expect(table.getByRole("row", { name: "المطلوب" })).toContainText("5 صفحة");
  await expect(table.getByRole("row", { name: "المطلوب" })).toContainText("10 صفحة");
  await expect(table.getByRole("row", { name: "المنجز" })).toContainText(memorized);
  await expect(table.getByRole("row", { name: "المنجز" })).toContainText(reviewed);
  if (memorized === "3 صفحة") {
    await expect(table.getByRole("row", { name: "المتبقي" })).toContainText("2 صفحة");
    await expect(table.getByRole("row", { name: "المتبقي" })).toContainText("3 صفحة");
    await expect(table.getByRole("row", { name: "الإنجاز" })).toContainText("60%");
    await expect(table.getByRole("row", { name: "الإنجاز" })).toContainText("70%");
  }
}

test.describe("Saving and page progress regressions", () => {
  test.beforeEach(() => { seedE2E(); seedProgress(); });

  test("historical evaluation: prefill, save 90, reload, regrade, no duplicate", async ({ page, request }) => {
    await loginViaApi(page, "teacher");
    let dialog = await openLegacy(page);
    await expect(dialog.getByLabel("الدرجة", { exact: true })).toHaveValue("80.00");
    await dialog.getByLabel("الدرجة", { exact: true }).fill("90");
    await dialog.getByLabel("ملاحظة النتيجة (اختياري)").fill("تعديل مصرح");
    await dialog.getByRole("button", { name: "حفظ التقييم" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("تم حفظ تقييم الاختبار", { exact: true })).toBeVisible();
    let records = await serverEvaluations(request);
    expect(records.filter((r) => r.id === legacyId)).toHaveLength(1);
    expect(records.find((r) => r.id === legacyId)?.score).toBe("90.00");
    await page.reload();
    dialog = await openLegacy(page);
    await expect(dialog.getByLabel("الدرجة", { exact: true })).toHaveValue("90.00");
    await expect(dialog.getByLabel("ملاحظة النتيجة (اختياري)")).toHaveValue("تعديل مصرح");
    await dialog.getByRole("button", { name: "راسب", exact: true }).click();
    await dialog.getByLabel("الدرجة", { exact: true }).fill("70");
    await dialog.getByRole("button", { name: "حفظ التقييم" }).click();
    await expect(dialog).toHaveCount(0);
    records = await serverEvaluations(request);
    expect(records.filter((r) => r.title === "اختبار تاريخي")).toHaveLength(1);
    expect(records.find((r) => r.id === legacyId)).toMatchObject({ score: "70.00", status: "failed" });
  });

  test("attendance and memorization/revision edits persist and refresh student details", async ({ page }) => {
    await loginViaApi(page, "teacher");
    await page.goto("/attendance");
    const row = page.locator(`[data-student-id="${seededIds.student}"]`);
    await row.getByRole("button", { name: "مستأذن", exact: true }).click();
    await row.getByRole("button", { name: "تفاصيل الحفظ" }).filter({ visible: true }).click();
    await row.getByLabel("عدد الأسطر المحفوظة اليوم").fill("60");
    await row.getByLabel("عدد أسطر المراجعة").fill("120");
    const save = page.getByRole("button", { name: /حفظ/ }).first();
    await save.click();
    await expect(page.getByText("تم حفظ الحضور والتقييم بنجاح", { exact: true })).toBeVisible();
    await expect(save.locator(".animate-spin")).toHaveCount(0);
    await page.reload();
    await row.getByRole("button", { name: "تفاصيل الحفظ" }).filter({ visible: true }).click();
    await expect(row.getByLabel("عدد الأسطر المحفوظة اليوم")).toHaveValue("60");
    await expect(row.getByLabel("عدد أسطر المراجعة")).toHaveValue("120");
    await page.goto(`/students/${seededIds.student}`);
    await expectWorkload(page, "4 صفحة", "8 صفحة");
    await page.reload();
    await expectWorkload(page, "4 صفحة", "8 صفحة");
  });

  test("student dashboard, monthly plan and reload show assigned and completed workload", async ({ page }) => {
    await loginViaApi(page, "student");
    await expectWorkload(page);
    await page.reload();
    await expectWorkload(page);
    await page.goto("/student/plan");
    await expectWorkload(page);
  });

  test("period without assignment shows zeros and useful empty message", async ({ page }) => {
    await loginViaApi(page, "student");
    await page.goto("/student/plan");
    await page.getByRole("button", { name: "التالي", exact: true }).click();
    const table = page.getByRole("region", { name: "تقدم الحفظ والمراجعة" });
    await expect(table).toContainText("لا توجد خطة لهذه الفترة.");
    await expect(table.getByRole("row", { name: "المطلوب" })).toContainText("0 صفحة");
    await expect(table.getByRole("row", { name: "الإنجاز" })).toContainText("0%");
  });

  test("changing an assignment refreshes required pages and persists after reload", async ({ page }) => {
    await loginViaApi(page, "teacher");
    await page.goto("/plans");
    const row = page.getByRole("row").filter({ hasText: "Student One" }).filter({ hasText: "10 صفحة" });
    await row.getByRole("button", { name: "تعديل الخطة", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("عدد الصفحات المطلوبة", { exact: true })).toHaveValue("5");
    await expect(dialog.getByLabel("عدد صفحات المراجعة المطلوبة", { exact: true })).toHaveValue("10");
    await dialog.getByLabel("عدد الصفحات المطلوبة", { exact: true }).fill("6");
    await dialog.getByLabel("عدد صفحات المراجعة المطلوبة", { exact: true }).fill("12");
    await dialog.getByRole("button", { name: "تعديل الخطة", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.goto(`/students/${seededIds.student}`);
    const table = page.getByRole("region", { name: "تقدم الحفظ والمراجعة" });
    await expect(table.getByRole("row", { name: "المطلوب" })).toContainText("6 صفحة");
    await expect(table.getByRole("row", { name: "المطلوب" })).toContainText("12 صفحة");
    await expect(table.getByRole("row", { name: "الإنجاز" })).toContainText("50%");
    await page.reload();
    await expect(table.getByRole("row", { name: "المطلوب" })).toContainText("12 صفحة");
  });

  test("administrator can re-evaluate a completed exam in the teacher profile", async ({ page, request }) => {
    await loginViaApi(page, "admin");
    await page.goto(`/teachers/${seededIds.teacher}`);
    await page.getByRole("tab", { name: "الاختبارات", exact: true }).click();
    await page.getByRole("row").filter({ hasText: "اختبار تاريخي" }).getByRole("button", { name: "تعديل التقييم" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("الدرجة", { exact: true })).toHaveValue("80.00");
    await dialog.getByLabel("الدرجة", { exact: true }).fill("90");
    await dialog.getByRole("button", { name: "حفظ التقييم" }).click();
    await expect(dialog).toHaveCount(0);
    expect((await serverEvaluations(request)).find((r) => r.id === legacyId)?.score).toBe("90.00");
  });

  test("offline evaluation create and grade are labelled pending and persist after reconnection", async ({ page, request }) => {
    await loginViaApi(page, "teacher");
    await page.goto("/evaluations");
    await page.context().setOffline(true);
    await page.getByRole("button", { name: "إضافة اختبار" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("ابحث عن طالب").fill("Student One");
    await dialog.getByRole("button", { name: "Student One", exact: true }).click();
    await dialog.locator('input[placeholder="مثال: اختبار شهري"]').fill("اختبار دون اتصال");
    await dialog.getByRole("button", { name: "جدولة", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("حُفظ التعديل على الجهاز وينتظر المزامنة مع الخادم.", { exact: true })).toBeVisible();
    const card = page.locator("article").filter({ hasText: "اختبار دون اتصال" });
    await card.getByRole("button", { name: "تقييم الاختبار" }).click();
    await dialog.getByRole("button", { name: "ناجح", exact: true }).click();
    await dialog.getByLabel("الدرجة", { exact: true }).fill("90");
    await dialog.getByRole("button", { name: "حفظ التقييم" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("تم حفظ تقييم الاختبار", { exact: true })).toHaveCount(0);
    await page.context().setOffline(false);
    await expect(page.getByRole("button", { name: "متزامن", exact: true })).toBeVisible({ timeout: 30_000 });
    const saved = (await serverEvaluations(request)).filter((r) => r.title === "اختبار دون اتصال");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ score: "90.00", status: "passed" });
    await page.reload();
    await page.getByRole("button", { name: "المنتهية", exact: true }).click();
    await expect(card).toContainText("90");
  });

  test("storage failure rolls back the grade and outbox together and stops loading", async ({ page, request }) => {
    await loginViaApi(page, "teacher");
    const dialog = await openLegacy(page);
    await page.evaluate(() => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === "outbox") throw new DOMException("تعذّر تخزين التعديل على الجهاز", "QuotaExceededError");
        return put.apply(this, args);
      };
    });
    await dialog.getByLabel("الدرجة", { exact: true }).fill("90");
    const save = dialog.getByRole("button", { name: "حفظ التقييم" });
    await save.click();
    await expect(save).toBeEnabled();
    await expect(dialog).toContainText("تعذّر تخزين التعديل على الجهاز");
    await page.reload();
    const reopened = await openLegacy(page);
    await expect(reopened.getByLabel("الدرجة", { exact: true })).toHaveValue("80.00");
    expect((await serverEvaluations(request)).find((r) => r.id === legacyId)?.score).toBe("80.00");
  });

  for (const failure of ["validation", "forbidden", "network", "conflict"] as const) {
    test(`${failure} failure shows error, keeps form open, and stops loading`, async ({ page }) => {
      await loginViaApi(page, "teacher");
      const dialog = await openLegacy(page);
      await page.route("**/api/sync/push/", async (route) => {
        if (failure === "network") { await route.abort("failed"); return; }
        const { ops } = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: {
          results: ops.map((op: { client_id: string }) => ({ client_id: op.client_id, status: failure === "conflict" ? "conflict" : "error", error: { code: failure, message: `تعذر الحفظ: ${failure}` } })), server_time: new Date().toISOString(),
        } }) });
      });
      await dialog.getByLabel("الدرجة", { exact: true }).fill("90");
      const save = dialog.getByRole("button", { name: "حفظ التقييم" });
      await save.click();
      await expect(save).toBeEnabled();
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(failure === "network" ? "الاتصال" : `تعذر الحفظ: ${failure}`);
      await expect(page.getByText("تم حفظ تقييم الاختبار", { exact: true })).toHaveCount(0);
      if (failure === "validation" || failure === "forbidden") {
        await page.reload();
        const reopened = await openLegacy(page);
        await expect(reopened.getByLabel("الدرجة", { exact: true })).toHaveValue("80.00");
      }
    });
  }
});
