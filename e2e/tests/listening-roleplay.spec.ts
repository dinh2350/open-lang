import { expect, type Page, test } from '@playwright/test';
import {
  postTurn,
  roomNameOfNextConversation,
  secondsAgo,
} from './agent-ingest.ts';
import { registerNewUser } from './users.ts';

/** The Report is written in the background, and the page looks every 2 s. */
const REPORT_TIMEOUT = 30_000;
/** The Agent has to join the room before the persona listens. */
const AGENT_JOIN_TIMEOUT = 30_000;

interface Choice {
  readonly scenario?: string;
  readonly speed?: string;
}

/**
 * Registers a new User, picks `choice` (or keeps the defaults), presses
 * Bắt đầu, and gives the name of the Conversation's room.
 */
async function startConversation(
  page: Page,
  choice: Choice = {},
): Promise<string> {
  await page.goto('/');
  await registerNewUser(page);
  await expect(
    page.getByRole('heading', { name: 'Luyện nói hôm nay' }),
  ).toBeVisible();
  if (choice.scenario !== undefined) {
    await page
      .getByRole('radiogroup', { name: 'Tình huống' })
      .getByRole('radio', { name: choice.scenario, exact: true })
      .click();
  }
  if (choice.speed !== undefined) {
    await page.getByRole('radio', { name: choice.speed, exact: true }).click();
  }
  const roomName = roomNameOfNextConversation(page);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  return roomName;
}

/** The status line; every Astryx button renders an empty status region too. */
function statusLine(page: Page) {
  return page.getByRole('status').filter({ hasText: /\S/ });
}

async function expectPersonaListening(
  page: Page,
  persona: string,
): Promise<void> {
  await expect(statusLine(page)).toHaveText(`${persona} đang nghe bạn nói.`, {
    timeout: AGENT_JOIN_TIMEOUT,
  });
}

/** Presses Kết thúc and waits for the Conversation's Report page. */
async function endConversation(page: Page, roomName: string): Promise<void> {
  await page.getByRole('button', { name: 'Kết thúc' }).click();
  await expect(page).toHaveURL(`/conversations/${roomName}`);
}

test('a person picks a Scenario and speed and the session shows that Scenario', async ({
  page,
}) => {
  await startConversation(page, {
    scenario: 'Họp 1:1 với quản lý',
    speed: 'Chậm',
  });

  await expect(
    page.getByText('Họp 1:1 với quản lý · tốc độ chậm', { exact: true }),
  ).toBeVisible();
  await expectPersonaListening(page, 'Alex');
});

test('during a session no conversation text appears', async ({ page }) => {
  const roomName = await startConversation(page);
  await expectPersonaListening(page, 'Sam');
  const agentText = 'Can you walk me through what you did yesterday?';
  const userText = 'I finished the login page and started the tests.';

  await postTurn(roomName, {
    role: 'agent',
    text: agentText,
    startedAt: secondsAgo(6),
    endedAt: secondsAgo(4),
  });
  await postTurn(roomName, {
    role: 'user',
    text: userText,
    startedAt: secondsAgo(3),
    endedAt: secondsAgo(1),
  });

  await expect(page.getByText(agentText)).toHaveCount(0);
  await expect(page.getByText(userText)).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('button')).toHaveText([
    'Chưa nghe kịp',
    'Kết thúc',
  ]);
  await expect(page.getByRole('main').getByRole('heading')).toHaveCount(0);
  await expect(page.getByRole('log')).toHaveCount(0);
});

test('pressing Chưa nghe kịp lists the sentence being said, in the Report', async ({
  page,
}) => {
  const roomName = await startConversation(page);
  await expectPersonaListening(page, 'Sam');
  const sentence = 'We pushed the release to Friday because of the outage.';
  // A sentence the Agent is saying now, and for the next 20 s: the press
  // falls inside it, whatever the Agent itself said before.
  await postTurn(roomName, {
    role: 'agent',
    text: sentence,
    startedAt: secondsAgo(0),
    endedAt: secondsAgo(-20),
  });

  // The real press is the only Miss: the Agent records it, and the Report
  // waits for the Agent's end marker, which follows the Miss.
  const helpButton = page.getByRole('button', { name: 'Chưa nghe kịp' });
  await helpButton.click();
  await expect(helpButton).toBeEnabled();
  await endConversation(page, roomName);

  const misses = page.getByRole('region', { name: '1. Câu bạn nghe sót' });
  await expect(misses).toBeVisible({ timeout: REPORT_TIMEOUT });
  await expect(misses.getByText(sentence, { exact: true })).toBeVisible();
  await expect(
    misses.getByText('Giải thích thử nghiệm.', { exact: true }),
  ).toBeVisible();
});

test('a wrong sentence appears in the Report with its correction', async ({
  page,
}) => {
  const roomName = await startConversation(page);
  await expectPersonaListening(page, 'Sam');
  await postTurn(roomName, {
    role: 'user',
    text: 'I fix it yesterday',
    startedAt: secondsAgo(3),
    endedAt: secondsAgo(1),
  });

  await endConversation(page, roomName);

  const grammar = page.getByRole('region', { name: '2. Lỗi ngữ pháp' });
  await expect(grammar).toBeVisible({ timeout: REPORT_TIMEOUT });
  await expect(grammar.getByText('Bạn nói:', { exact: true })).toBeVisible();
  await expect(
    grammar.getByText('I fix it yesterday', { exact: true }),
  ).toBeVisible();
  await expect(grammar.getByText('Sửa thành:', { exact: true })).toBeVisible();
  await expect(
    grammar.getByText('I fix it yesterday (đã sửa)', { exact: true }),
  ).toBeVisible();
});

test('an abandoned Conversation still has a Report from the history', async ({
  page,
  context,
}) => {
  const roomName = await startConversation(page);
  await expectPersonaListening(page, 'Sam');
  await postTurn(roomName, {
    role: 'agent',
    text: 'What are you working on today?',
    startedAt: secondsAgo(6),
    endedAt: secondsAgo(4),
  });
  await postTurn(roomName, {
    role: 'user',
    text: 'I am work on the report page.',
    startedAt: secondsAgo(3),
    endedAt: secondsAgo(1),
  });

  // Closed without Kết thúc.
  await page.close();
  const again = await context.newPage();
  await again.goto('/conversations');
  await expect(
    again.getByRole('heading', { name: 'Lịch sử luyện nói' }),
  ).toBeVisible();
  await again
    .getByRole('row')
    .filter({ hasText: 'Họp standup' })
    .getByRole('link')
    .click();

  await expect(again).toHaveURL(`/conversations/${roomName}`);
  await expect(
    again.getByRole('region', { name: '2. Lỗi ngữ pháp' }),
  ).toBeVisible({ timeout: REPORT_TIMEOUT });
  await expect(
    again.getByText('I am work on the report page. (đã sửa)', { exact: true }),
  ).toBeVisible();
});

test("a second User cannot open the first User's Report", async ({ page }) => {
  const roomName = await startConversation(page);
  await expectPersonaListening(page, 'Sam');
  await postTurn(roomName, {
    role: 'user',
    text: 'My password is in this sentence.',
    startedAt: secondsAgo(3),
    endedAt: secondsAgo(1),
  });
  await endConversation(page, roomName);
  const firstUsersReport = page.url();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await registerNewUser(page);
  await expect(
    page.getByRole('heading', { name: 'Luyện nói hôm nay' }),
  ).toBeVisible();
  await page.goto(firstUsersReport);

  await expect(page.getByRole('alert')).toHaveText(
    'Không tìm thấy buổi luyện này.',
  );
  await expect(page.getByText('My password is in this sentence.')).toHaveCount(
    0,
  );
});
