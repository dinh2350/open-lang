import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

/** Registers a new User from the sign-in page the app opens on. */
export async function registerNewUser(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Register' }).click();
  // The router renders the new page asynchronously: until then, the
  // sign-in form's fields are the ones labelled Email and Password.
  await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
  await page.getByLabel('Email').fill(`e2e-${randomUUID()}@example.test`);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Register' }).click();
}
