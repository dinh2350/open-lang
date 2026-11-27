import { expect, type Locator, type Page, test } from '@playwright/test';
import { registerNewUser } from './users.ts';

const WIDE = { width: 1280, height: 800 };
const PHONE = { width: 375, height: 667 };

/** The box of an element on the page, which must be there. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error(`${String(locator)} has no box`);
  }
  return box;
}

/** The page's H1 starts at or below the bottom edge of the header. */
async function expectHeadingBelowHeader(page: Page): Promise<void> {
  const header = await boxOf(page.getByRole('banner'));
  const heading = await boxOf(page.getByRole('heading', { level: 1 }));
  expect(
    heading.y,
    `the H1 top, under a header ${String(header.y)}-${String(header.y + header.height)}`,
  ).toBeGreaterThanOrEqual(header.y + header.height);
}

/** The page is no taller than the window, so it does not scroll. */
async function expectNoPageScroll(page: Page): Promise<void> {
  const { scrollHeight, innerHeight } = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(scrollHeight, 'the page height').toBeLessThanOrEqual(innerHeight);
}

test('the header covers no part of the sign-in, Start and History pages', async ({
  page,
}) => {
  for (const viewport of [WIDE, PHONE]) {
    await page.setViewportSize(viewport);
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expectHeadingBelowHeader(page);
    await expectNoPageScroll(page);
  }

  await page.setViewportSize(WIDE);
  await registerNewUser(page);
  await expect(
    page.getByRole('heading', { name: 'Gia sư tiếng Anh của bạn' }),
  ).toBeVisible();

  for (const viewport of [WIDE, PHONE]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Gia sư tiếng Anh của bạn' }),
    ).toBeVisible();
    await expectNoPageScroll(page);

    await page.goto('/conversations');
    await expect(
      page.getByRole('heading', { name: 'Lịch sử học', level: 1 }),
    ).toBeVisible();
    await expectHeadingBelowHeader(page);
  }
});
