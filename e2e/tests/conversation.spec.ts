import { expect, type Page, test } from '@playwright/test';
import { postNote, roomNameOfNextConversation } from './agent-ingest.ts';
import { registerNewUser } from './users.ts';

/** The Agent has to join the room before the tutor listens. */
const AGENT_JOIN_TIMEOUT = 30_000;

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

test('a person registers, starts a Conversation, the Agent joins its room and shows its state, and Kết thúc leaves it', async ({
  page,
}) => {
  await recordPeerConnections(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await registerNewUser(page);

  await page.getByRole('button', { name: 'Bắt đầu' }).click();

  // Every Astryx button renders an empty status region of its own.
  await expect(page.getByRole('status').filter({ hasText: /\S/ })).toHaveText(
    'Gia sư đang nghe bạn nói.',
    { timeout: AGENT_JOIN_TIMEOUT },
  );
  await expect.poll(() => microphoneBytesSent(page)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Kết thúc' }).click();

  await expect(page).toHaveURL(/\/conversations\/conversation-[\w-]+$/);
  await expect(page.getByRole('button', { name: 'Kết thúc' })).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Hôm nay bạn học được gì' }),
  ).toBeVisible();
});

test("a second User cannot open the first User's Report", async ({ page }) => {
  const privateNote = 'My password is in this sentence.';
  await page.goto('/');
  await registerNewUser(page);
  const nextRoomName = roomNameOfNextConversation(page);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  const roomName = await nextRoomName;
  await expect(
    page.getByRole('status').filter({ hasText: 'Gia sư đang nghe bạn nói.' }),
  ).toBeVisible({ timeout: AGENT_JOIN_TIMEOUT });
  await postNote(roomName, {
    kind: 'phrase',
    english: privateNote,
    meaning: 'Một câu riêng tư.',
    said: null,
  });
  await page.getByRole('button', { name: 'Kết thúc' }).click();
  await expect(page).toHaveURL(`/conversations/${roomName}`);
  await expect(page.getByText(privateNote)).toBeVisible({ timeout: 10_000 });
  const firstUsersReport = page.url();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await registerNewUser(page);
  await expect(
    page.getByRole('heading', { name: 'Gia sư tiếng Anh của bạn' }),
  ).toBeVisible();
  await page.goto(firstUsersReport);

  await expect(page.getByRole('alert')).toHaveText(
    'Không tìm thấy buổi học này.',
  );
  await expect(page.getByText(privateNote)).toHaveCount(0);
});
