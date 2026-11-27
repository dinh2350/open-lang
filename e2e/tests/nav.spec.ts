import { expect, test } from '@playwright/test';
import { registerNewUser } from './users.ts';

test('the nav underlines the page you are on, and only that one', async ({
  page,
}) => {
  await page.goto('/');
  await registerNewUser(page);
  await expect(
    page.getByRole('heading', { name: 'Gia sư tiếng Anh của bạn' }),
  ).toBeVisible();
  // The pointer is over no link, so none shows its hover underline.
  await page.mouse.move(0, 600);

  const nav = page.getByRole('navigation', { name: 'Chính' });
  const current = nav.getByRole('link', { name: 'Học' });
  const other = nav.getByRole('link', { name: 'Lịch sử' });

  await expect(current).toHaveAttribute('aria-current', 'page');
  await expect(current).toHaveCSS('text-decoration-line', 'underline');
  await expect(other).not.toHaveAttribute('aria-current');
  await expect(other).toHaveCSS('text-decoration-line', 'none');
});
