import { expect, test } from "@playwright/test";

import { loginViaApi } from "./helpers/auth";
import { seedE2E } from "./helpers/backend";
import { seededIds } from "./helpers/fixtures";

test.describe("Role-based page coverage", () => {
  test.beforeEach(() => {
    seedE2E();
  });

  test("admin can load every primary page shell", async ({ page }) => {
    await loginViaApi(page, "admin");

    const checks: Array<[string, string]> = [
      ["/", "عدد الطلاب المسجلين"],
      ["/leaderboard", "Student One"],
      ["/notifications", "إشعار إداري - E2E"],
      ["/students", "Student One"],
      ["/students/register", "بطاقة الانتساب - طالب جديد"],
      [`/students/${seededIds.student}`, "Student One"],
      ["/teachers", "Teacher One"],
      ["/rings", "حلقة النور - E2E"],
      ["/courses", "التجويد التأسيسي - E2E"],
      ["/attendance", "Student One"],
      ["/reports/attendance", "Student One"],
    ];

    for (const [route, text] of checks) {
      await page.goto(route);
      await expect(page.getByText(text)).toBeVisible();
    }

    await page.goto("/notifications");
    await page.getByText("إشعار إداري - E2E").click();
    await expect(page.getByText("0 غير مقروءة")).toBeVisible();
  });

  test("teacher sees only owned data and is blocked from foreign student detail", async ({
    page,
  }) => {
    await loginViaApi(page, "teacher");

    await page.goto("/students");
    await expect(page.getByText("Student One")).toBeVisible();
    await expect(page.getByText("Student Two")).toHaveCount(0);

    await page.goto(`/students/${seededIds.student}`);
    await expect(page.getByText("Student One")).toBeVisible();

    await page.goto(`/students/${seededIds.studentTwo}`);
    await expect(page.getByText("لم يتم العثور على الطالب")).toBeVisible();

    await page.goto("/attendance");
    await expect(page.getByText("Student One")).toBeVisible();
    await expect(page.getByText("Student Two")).toHaveCount(0);

    await page.goto("/reports/attendance");
    await expect(page.getByText("Student One")).toBeVisible();
  });

  test("student can access the student-facing pages and shared pages", async ({
    page,
  }) => {
    await loginViaApi(page, "student");

    await page.goto("/student");
    await expect(page.getByText("السلام عليكم، Student One")).toBeVisible();

    await page.goto("/student/achievements");
    await expect(
      page.getByRole("button", { name: "تحميل التقرير التفصيلي (PDF)" })
    ).toBeVisible();

    await page.goto("/leaderboard");
    await expect(page.getByText("لوحة الشرف")).toBeVisible();

    await page.goto("/notifications");
    await expect(page.getByText("تذكير واجب - E2E")).toBeVisible();
  });
});
