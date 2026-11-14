import { randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';

declare global {
  interface Window {
    e2ePeerConnections?: RTCPeerConnection[];
  }
}

interface RtpStats {
  type: string;
  kind?: string;
  bytesSent?: number;
}

/** Records every RTCPeerConnection the page creates, so the test can read its WebRTC stats. */
async function recordPeerConnections(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const peerConnections: RTCPeerConnection[] = [];
    window.e2ePeerConnections = peerConnections;
    const NativePeerConnection = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends NativePeerConnection {
      constructor(configuration?: RTCConfiguration) {
        super(configuration);
        peerConnections.push(this);
      }
    };
  });
}

/** Bytes of microphone audio the browser has sent to the LiveKit server over WebRTC. */
async function microphoneBytesSent(page: Page): Promise<number> {
  const reports = await page.evaluate(async () => {
    const collected: RtpStats[] = [];
    for (const peerConnection of window.e2ePeerConnections ?? []) {
      const stats = await peerConnection.getStats();
      stats.forEach((report: RtpStats) => {
        collected.push({
          type: report.type,
          kind: report.kind,
          bytesSent: report.bytesSent,
        });
      });
    }
    return collected;
  });
  return reports
    .filter(
      (report) => report.type === 'outbound-rtp' && report.kind === 'audio',
    )
    .reduce((total, report) => total + (report.bytesSent ?? 0), 0);
}

/** Registers a new User from the sign-in page the app opens on. */
async function registerNewUser(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByLabel('Email').fill(`e2e-${randomUUID()}@example.test`);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Register' }).click();
}

test('a person registers, starts a Conversation, the Agent joins its room, and End leaves it', async ({
  page,
}) => {
  await recordPeerConnections(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await registerNewUser(page);

  await page.getByRole('button', { name: 'Start' }).click();

  await expect(page.getByRole('status')).toHaveText('The Agent has joined.', {
    timeout: 30_000,
  });
  await expect.poll(() => microphoneBytesSent(page)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'End' }).click();

  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
});
