import { expect, type Page } from "@playwright/test";

import { apiBaseUrl, seededUsers } from "./fixtures";

type Role = keyof typeof seededUsers;

export async function loginViaApi(page: Page, role: Role) {
  const credentials = seededUsers[role];
  const response = await page.request.post(`${apiBaseUrl}/api/auth/login/`, {
    data: {
      phone_number: credentials.phone,
      password: credentials.password,
    },
  });

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    data: { access: string; refresh: string };
  };

  await page.goto("/login");
  await page.evaluate(
    ({ access, refresh }) => {
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
    },
    {
      access: payload.data.access,
      refresh: payload.data.refresh,
    }
  );
}

export async function loginViaUi(page: Page, role: Role) {
  const credentials = seededUsers[role];

  await page.goto("/login");
  await page.getByLabel("رقم الجوال").fill(credentials.phone);
  await page.getByLabel("كلمة المرور").fill(credentials.password);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
}

export async function logoutViaUi(page: Page) {
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
}
