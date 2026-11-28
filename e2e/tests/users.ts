import { randomBytes, randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

/** A random private IPv4 address, 10.x.y.z. */
export function randomClientAddress(): string {
  return ['10', ...randomBytes(3)].join('.');
}

/**
 * The backend limits register and sign-in to 5 requests a minute per client
 * IP, and every test's browser is on this one host. The frontend's dev proxy
 * appends the browser's real (loopback) address to X-Forwarded-For, and the
 * backend, which trusts loopback proxies only, takes the address before it,
 * so each User registered here counts as a client of its own.
 */
async function sendFromOwnClientAddress(page: Page): Promise<void> {
  const address = randomClientAddress();
  await page.context().route('**/api/**', (route) =>
    route.continue({
      headers: { ...route.request().headers(), 'x-forwarded-for': address },
    }),
  );
}

/** Registers a new User from the sign-in page the app opens on. */
export async function registerNewUser(page: Page): Promise<void> {
  await sendFromOwnClientAddress(page);
  await page.getByRole('link', { name: 'Register' }).click();
  // The router renders the new page asynchronously: until then, the
  // sign-in form's fields are the ones labelled Email and Password.
  await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
  await page.getByLabel('Email').fill(`e2e-${randomUUID()}@example.test`);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Register' }).click();
}
