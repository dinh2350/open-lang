import { expect, test } from '@playwright/test';
import { registerNewUser } from './users.ts';

test('a User stays signed in across a reload, and once they sign out a reload keeps them signed out', async ({
  page,
}) => {
  const conversationPage = page.getByRole('heading', {
    name: 'Gia sư tiếng Anh của bạn',
  });
  const signInPage = page.getByRole('heading', { name: 'Sign in' });
  await page.goto('/');
  await registerNewUser(page);
  await expect(conversationPage).toBeVisible();

  // Only the refresh cookie can sign the User in again after a reload.
  await page.reload();

  await expect(conversationPage).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(signInPage).toBeVisible();
  await page.goto('/');

  await expect(signInPage).toBeVisible();
});
