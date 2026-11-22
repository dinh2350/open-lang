import { expect, test } from '@playwright/test';

test('a person turns on dark mode on the sign-in page, and it survives a reload', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Dark mode' })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test.describe('a first visit follows the device', () => {
  test.describe('set to dark', () => {
    test.use({ colorScheme: 'dark' });
    test('a first visit follows a device set to dark', async ({ page }) => {
      await page.goto('/sign-in');
      await expect(
        page.getByRole('switch', { name: 'Dark mode' }),
      ).toBeChecked();
    });
  });
  test.describe('set to light', () => {
    test.use({ colorScheme: 'light' });
    test('a first visit follows a device set to light', async ({ page }) => {
      await page.goto('/sign-in');
      await expect(
        page.getByRole('switch', { name: 'Dark mode' }),
      ).not.toBeChecked();
    });
  });
});
