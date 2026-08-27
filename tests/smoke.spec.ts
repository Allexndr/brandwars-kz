import { test, expect } from "@playwright/test";

test.describe("BrandWars.kz smoke", () => {
  test("homepage loads", async ({ page }) => {
    await page.goto("/ru");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("BrandWars.kz")).toBeVisible();
  });

  test("map page loads", async ({ page }) => {
    await page.goto("/ru/map");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/планет/i);
  });

  test("health API", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("brands page loads", async ({ page }) => {
    await page.goto("/ru/brands");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("claim brand page has wizard", async ({ page }) => {
    await page.goto("/ru/claim-brand");
    await expect(page.getByPlaceholder(/example/i)).toBeVisible();
  });
});
