import { expect, test, type Page } from "@playwright/test";

import { loginViaApi } from "./helpers/auth";
import { seedE2E } from "./helpers/backend";
import { seededIds } from "./helpers/fixtures";

test.describe("Teacher request review workflows", () => {
  test.beforeEach(() => {
    seedE2E();
  });

  async function createAssignRequest(page: Page, studentName: string) {
    await loginViaApi(page, "teacher");
    await page.goto("/teacher-requests");
    await page.getByRole("button", { name: "طلب ضم طالب" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("بحث عن طالب").fill(studentName);
    await expect(dialog.getByText(studentName)).toBeVisible();
    await dialog.getByRole("button", { name: "طلب" }).first().click();
    await expect(
      page.getByText("تم إرسال طلب الضم، بانتظار موافقة الإدارة"),
    ).toBeVisible();
  }

  test("admin can approve a student-data update request with a note", async ({ page }) => {
    await loginViaApi(page, "teacher");
    await page.goto("/students");
    await page.getByRole("button", { name: "تعديل الطالب Student One" }).click();

    const editDialog = page.getByRole("dialog");
    await editDialog.getByLabel("الاسم رباعي").fill("Student One Updated");
    await editDialog.getByRole("button", { name: "إرسال طلب التعديل" }).click();
    await expect(page.getByText("تم إرسال طلب التعديل، بانتظار موافقة الإدارة")).toBeVisible();

    const adminPage = await page.context().newPage();
    await loginViaApi(adminPage, "admin");
    await adminPage.goto("/teacher-requests");
    await expect(adminPage.getByText("Student One")).toBeVisible();
    await expect(adminPage.getByText("تعديل بيانات")).toBeVisible();
    await adminPage.getByRole("button", { name: "قبول بملاحظة" }).first().click();

    const approveDialog = adminPage.getByRole("dialog");
    await approveDialog.getByLabel("ملاحظة الإدارة").fill("تم تدقيق بيانات الطالب");
    await approveDialog.getByRole("button", { name: "تأكيد الموافقة" }).click();
    await expect(adminPage.getByText("تمت الموافقة على الطلب بنجاح")).toBeVisible();
    await adminPage.getByRole("button", { name: "موافَق عليه" }).first().click();
    await expect(adminPage.getByText("ملاحظة الإدارة: تم تدقيق بيانات الطالب")).toBeVisible();
  });

  test("admin can quick-approve a teacher request", async ({ page }) => {
    await createAssignRequest(page, "Student Two");

    const adminPage = await page.context().newPage();
    await loginViaApi(adminPage, "admin");
    await adminPage.goto("/teacher-requests");
    await expect(adminPage.getByText("Student Two")).toBeVisible();
    await adminPage.getByRole("button", { name: "قبول" }).first().click();
    await expect(
      adminPage.getByText("تمت الموافقة على الطلب بنجاح"),
    ).toBeVisible();
    await adminPage.getByRole("button", { name: "موافَق عليه" }).first().click();
    await expect(adminPage.getByText("موافَق عليه").first()).toBeVisible();
  });

  test("admin can approve a request with a note", async ({ page }) => {
    await createAssignRequest(page, "Student Three");

    const adminPage = await page.context().newPage();
    await loginViaApi(adminPage, "admin");
    await adminPage.goto("/teacher-requests");
    await adminPage.getByRole("button", { name: "قبول بملاحظة" }).first().click();

    const dialog = adminPage.getByRole("dialog");
    await dialog.getByLabel("ملاحظة الإدارة").fill("تمت المراجعة والموافقة");
    await dialog.getByRole("button", { name: "تأكيد الموافقة" }).click();
    await expect(
      adminPage.getByText("تمت الموافقة على الطلب بنجاح"),
    ).toBeVisible();
    await adminPage.getByRole("button", { name: "موافَق عليه" }).first().click();
    await expect(adminPage.getByText("ملاحظة الإدارة: تمت المراجعة والموافقة")).toBeVisible();
  });

  test("admin can reject a request with a reason", async ({ page }) => {
    await createAssignRequest(page, "Student Three");

    const adminPage = await page.context().newPage();
    await loginViaApi(adminPage, "admin");
    await adminPage.goto("/teacher-requests");
    await adminPage.getByRole("button", { name: "رفض" }).first().click();

    const dialog = adminPage.getByRole("dialog");
    await dialog.getByLabel("سبب الرفض").fill("يرجى التنسيق مع الإدارة أولاً");
    await dialog.getByRole("button", { name: "رفض الطلب" }).click();
    await expect(adminPage.getByText("تم رفض الطلب")).toBeVisible();
    await adminPage.getByRole("button", { name: "مرفوض" }).first().click();
    await expect(
      adminPage.getByText("سبب الرفض: يرجى التنسيق مع الإدارة أولاً"),
    ).toBeVisible();
  });

  test("teacher can submit a remove-from-ring request from student details", async ({ page }) => {
    await loginViaApi(page, "teacher");
    await page.goto(`/students/${seededIds.student}`);
    await page.getByRole("button", { name: "طلب إزالة من الحلقة" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("سبب الطلب (اختياري)").fill("تنظيم الحلقة");
    await dialog.getByRole("button", { name: "تأكيد الطلب" }).click();
    await page.goto("/teacher-requests");
    await expect(page.getByText("إزالة من حلقة")).toBeVisible();
  });

  test("teacher can submit a delete-student request from student details", async ({ page }) => {
    await loginViaApi(page, "teacher");
    await page.goto(`/students/${seededIds.student}`);
    await page.getByRole("button", { name: "طلب حذف الطالب" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("سبب طلب الحذف (مطلوب)").fill("طلب ولي الأمر");
    await dialog.getByRole("button", { name: "تأكيد طلب الحذف" }).click();
    await page.goto("/teacher-requests");
    await expect(page.getByText("حذف طالب")).toBeVisible();
  });

  test("teacher can withdraw a pending request", async ({ page }) => {
    await createAssignRequest(page, "Student Three");
    await page.getByRole("button", { name: "سحب الطلب" }).click();
    await expect(page.getByText("تم سحب الطلب")).toBeVisible();
    await expect(page.getByText("لا توجد طلبات")).toBeVisible();
  });
});
