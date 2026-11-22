import { expect, test, type Page } from '@playwright/test';

/** Stone's `--color-background-body`, which paints the page behind every card. */
const STONE_BODY = {
  light: 'rgb(240, 240, 247)',
  dark: 'rgb(16, 16, 24)',
} as const;

async function expectPagePainted(
  page: Page,
  mode: keyof typeof STONE_BODY,
): Promise<void> {
  await expect(page.locator('html')).toHaveCSS(
    'background-color',
    STONE_BODY[mode],
  );
}

test('a person turns on dark mode on the sign-in page, and it survives a reload', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectPagePainted(page, 'dark');
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Dark mode' })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectPagePainted(page, 'dark');
});

test.describe('a first visit follows the device', () => {
  test.describe('set to dark', () => {
    test.use({ colorScheme: 'dark' });
    test('a first visit follows a device set to dark', async ({ page }) => {
      await page.goto('/sign-in');
      await expect(
        page.getByRole('switch', { name: 'Dark mode' }),
      ).toBeChecked();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expectPagePainted(page, 'dark');
    });
  });
  test.describe('set to light', () => {
    test.use({ colorScheme: 'light' });
    test('a first visit follows a device set to light', async ({ page }) => {
      await page.goto('/sign-in');
      await expect(
        page.getByRole('switch', { name: 'Dark mode' }),
      ).not.toBeChecked();
      await expectPagePainted(page, 'light');
    });
  });
});
