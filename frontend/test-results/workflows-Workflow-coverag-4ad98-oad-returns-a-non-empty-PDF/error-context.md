# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workflows.spec.ts >> Workflow coverage >> student report download returns a non-empty PDF
- Location: e2e/workflows.spec.ts:74:7

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1  | import { expect, type Page } from "@playwright/test";
  2  | 
  3  | import { apiBaseUrl, seededUsers } from "./fixtures";
  4  | 
  5  | type Role = keyof typeof seededUsers;
  6  | 
  7  | export async function loginViaApi(page: Page, role: Role) {
  8  |   const credentials = seededUsers[role];
  9  |   const response = await page.request.post(`${apiBaseUrl}/api/auth/login/`, {
  10 |     data: {
  11 |       phone_number: credentials.phone,
  12 |       password: credentials.password,
  13 |     },
  14 |   });
  15 | 
> 16 |   expect(response.ok()).toBeTruthy();
     |                         ^ Error: expect(received).toBeTruthy()
  17 |   const payload = (await response.json()) as {
  18 |     data: { access: string; refresh: string };
  19 |   };
  20 | 
  21 |   await page.goto("/login");
  22 |   await page.evaluate(
  23 |     ({ access, refresh }) => {
  24 |       localStorage.setItem("access_token", access);
  25 |       localStorage.setItem("refresh_token", refresh);
  26 |     },
  27 |     {
  28 |       access: payload.data.access,
  29 |       refresh: payload.data.refresh,
  30 |     }
  31 |   );
  32 | }
  33 | 
  34 | export async function loginViaUi(page: Page, role: Role) {
  35 |   const credentials = seededUsers[role];
  36 | 
  37 |   await page.goto("/login");
  38 |   await page.getByLabel("رقم الجوال").fill(credentials.phone);
  39 |   await page.getByLabel("كلمة المرور").fill(credentials.password);
  40 |   await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  41 | }
  42 | 
  43 | export async function logoutViaUi(page: Page) {
  44 |   await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  45 | }
  46 | 
```