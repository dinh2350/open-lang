import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { roomNameOfNextConversation } from './agent-ingest.ts';
import { registerNewUser } from './users.ts';

/** The Agent has to join the room before the tutor listens. */
export const AGENT_JOIN_TIMEOUT = 30_000;

/**
 * Where a test keeps a screenshot for a human to look at: next to the run's
 * evidence, when E2E_EVIDENCE_DIR (relative to the repository root) is set.
 * `target` is the whole page, or one element of it.
 */
export async function saveScreen(
  target: Page | Locator,
  name: string,
): Promise<void> {
  const evidence = process.env.E2E_EVIDENCE_DIR;
  if (evidence === undefined) {
    return;
  }
  const screens = path.resolve(
    import.meta.dirname,
    '..',
    '..',
    evidence,
    'screens',
  );
  await mkdir(screens, { recursive: true });
  const file = path.join(screens, `${name}.png`);
  await ('goto' in target
    ? target.screenshot({ path: file, fullPage: true })
    : target.screenshot({ path: file }));
}

/** Registers a new User and waits for the start screen. */
export async function registerAndOpenStart(page: Page): Promise<void> {
  await page.goto('/');
  await registerNewUser(page);
  await expect(
    page.getByRole('heading', { name: 'Gia sư tiếng Anh của bạn' }),
  ).toBeVisible();
}

/** The status line; every Astryx button renders an empty status region too. */
export function statusLine(page: Page): Locator {
  return page.getByRole('status').filter({ hasText: /\S/ });
}

/**
 * Registers a new User, presses Bắt đầu, waits until the tutor listens, and
 * gives the name of the Conversation's room.
 */
export async function startConversation(page: Page): Promise<string> {
  await registerAndOpenStart(page);
  const roomName = roomNameOfNextConversation(page);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  await expect(
    statusLine(page).filter({ hasText: 'Gia sư đang nghe bạn nói.' }),
  ).toBeVisible({ timeout: AGENT_JOIN_TIMEOUT });
  return roomName;
}

/** The button of the controls bar that opens and closes the transcript. */
export function transcriptButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Cuộc nói', exact: true });
}

/** The button of the controls bar that opens and closes the Notes; its name may end with the count. */
export function notesButton(page: Page): Locator {
  return page.getByRole('button', { name: /^Ghi chú/ });
}
