import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  expect,
  type Locator,
  type Page,
  type Route,
  test,
} from '@playwright/test';
import {
  type PostedNote,
  postNote,
  postTurn,
  roomNameOfNextConversation,
  secondsAgo,
} from './agent-ingest.ts';
import { registerNewUser } from './users.ts';

/** The Agent has to join the room before the tutor listens. */
const AGENT_JOIN_TIMEOUT = 30_000;
/** The notes panel asks the backend for the Notes every 2 s. */
const NOTES_TIMEOUT = 10_000;
/** The Report is written in the background, and the page looks every 2 s. */
const REPORT_TIMEOUT = 30_000;

const PHRASE: PostedNote = {
  kind: 'phrase',
  english: 'Yesterday I finished the login page.',
  meaning: 'Hôm qua tôi đã làm xong trang đăng nhập.',
  said: null,
};
const WORD: PostedNote = {
  kind: 'word',
  english: 'deadline',
  meaning: 'hạn chót',
  said: null,
};
const CORRECTION: PostedNote = {
  kind: 'correction',
  english: 'I fixed it yesterday.',
  meaning: 'Việc đã xong trong quá khứ thì dùng thì quá khứ: fixed.',
  said: 'I fix it yesterday.',
};
const MISSED: PostedNote = {
  kind: 'missed',
  english: 'We pushed the release to Friday because of the outage.',
  meaning: 'Chúng tôi dời bản phát hành sang thứ Sáu vì sự cố.',
  said: null,
};

/**
 * Where a test keeps a screenshot for a human to look at: next to the run's
 * evidence, when E2E_EVIDENCE_DIR (relative to the repository root) is set.
 */
async function saveScreen(page: Page, name: string): Promise<void> {
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
  await page.screenshot({
    path: path.join(screens, `${name}.png`),
    fullPage: true,
  });
}

/** Registers a new User and waits for the start screen. */
async function registerAndOpenStart(page: Page): Promise<void> {
  await page.goto('/');
  await registerNewUser(page);
  await expect(
    page.getByRole('heading', { name: 'Gia sư tiếng Anh của bạn' }),
  ).toBeVisible();
}

/** The status line; every Astryx button renders an empty status region too. */
function statusLine(page: Page): Locator {
  return page.getByRole('status').filter({ hasText: /\S/ });
}

/**
 * Registers a new User, presses Bắt đầu, waits until the tutor listens, and
 * gives the name of the Conversation's room.
 */
async function startConversation(page: Page): Promise<string> {
  await registerAndOpenStart(page);
  const roomName = roomNameOfNextConversation(page);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  await expect(
    statusLine(page).filter({ hasText: 'Gia sư đang nghe bạn nói.' }),
  ).toBeVisible({ timeout: AGENT_JOIN_TIMEOUT });
  return roomName;
}

/** Presses Kết thúc and waits for the Conversation's Report page. */
async function endConversation(page: Page, roomName: string): Promise<void> {
  await page.getByRole('button', { name: 'Kết thúc' }).click();
  await expect(page).toHaveURL(`/conversations/${roomName}`);
  await expect(
    page.getByRole('heading', { name: 'Hôm nay bạn học được gì' }),
  ).toBeVisible();
}

/** The group of Notes titled `title`, whatever its count. */
function noteGroup(scope: Page | Locator, title: string): Locator {
  return scope.getByRole('region', {
    name: new RegExp(`^${title} \\(\\d+\\)$`),
  });
}

/** Waits for `promise`, failing with `what` after `milliseconds`. */
async function withTimeout(
  promise: Promise<void>,
  milliseconds: number,
  what: string,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `Timed out after ${String(milliseconds)} ms waiting for ${what}.`,
        ),
      );
    }, milliseconds);
  });
  try {
    await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** A turn of each side, as the Agent reports them. */
async function postTwoTurns(roomName: string): Promise<void> {
  await postTurn(roomName, {
    role: 'agent',
    text: 'What did you do yesterday?',
    startedAt: secondsAgo(6),
    endedAt: secondsAgo(4),
  });
  await postTurn(roomName, {
    role: 'user',
    text: 'I fix it yesterday.',
    startedAt: secondsAgo(3),
    endedAt: secondsAgo(1),
  });
}

/** The cell of `row` in the column headed `column`. */
async function cellInColumn(
  page: Page,
  row: Locator,
  column: string,
): Promise<Locator> {
  const headers = await page.getByRole('columnheader').allInnerTexts();
  const index = headers.findIndex((header) => header.trim() === column);
  expect(index, `a column headed ${column}`).toBeGreaterThanOrEqual(0);
  return row.getByRole('rowheader').or(row.getByRole('cell')).nth(index);
}

test('one Bắt đầu button and no Scenario picker', async ({ page }) => {
  await registerAndOpenStart(page);

  await expect(page.getByRole('button', { name: 'Bắt đầu' })).toBeVisible();
  await expect(
    page.getByRole('radiogroup', { name: 'Tình huống' }),
  ).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
});

test('the session shows an empty transcript before anyone speaks', async ({
  page,
}) => {
  await startConversation(page);

  await expect(page.getByText('Chữ của cuộc nói sẽ hiện ở đây.')).toBeVisible();
  await expect(
    page.getByText('Gia sư sẽ ghi những điều đáng nhớ ở đây.'),
  ).toBeVisible();
});

test('mic button mutes and unmutes; no Chưa nghe kịp button', async ({
  page,
}) => {
  await startConversation(page);
  const mutedLine = page.getByText('Mic đang tắt. Gia sư không nghe thấy bạn.');

  await page.getByRole('button', { name: 'Tắt mic' }).click();
  await expect(page.getByRole('button', { name: 'Bật mic' })).toBeVisible();
  await expect(mutedLine).toBeVisible();

  await page.getByRole('button', { name: 'Bật mic' }).click();
  await expect(page.getByRole('button', { name: 'Tắt mic' })).toBeVisible();
  await expect(mutedLine).toHaveCount(0);

  await expect(page.getByRole('button', { name: 'Chưa nghe kịp' })).toHaveCount(
    0,
  );
});

test('a note the Agent saves appears in the notes panel', async ({ page }) => {
  const roomName = await startConversation(page);

  await postNote(roomName, PHRASE);

  const phrases = noteGroup(page, 'Câu hay');
  await expect(phrases).toBeVisible({ timeout: NOTES_TIMEOUT });
  await expect(
    phrases.getByText('Yesterday I finished the login page.'),
  ).toBeVisible();
  await expect(phrases.getByText(PHRASE.meaning)).toBeVisible();
});

test('the notes panel survives a failing poll', async ({ page }) => {
  const roomName = await startConversation(page);
  await postNote(roomName, PHRASE);
  const phrase = page.getByText(PHRASE.english);
  await expect(phrase).toBeVisible({ timeout: NOTES_TIMEOUT });

  // Two polls in a row fail. Waiting for the second failure means the page
  // has shown the outcome of the first for a whole poll interval, so what it
  // shows now is what it shows after a failed poll, not a race with it.
  const notesPath = `/api/conversations/${roomName}/notes`;
  const twoFailedPolls = new Promise<void>((resolve) => {
    let failures = 0;
    page.on('response', (response) => {
      if (
        new URL(response.url()).pathname === notesPath &&
        response.status() === 500
      ) {
        failures += 1;
        if (failures === 2) {
          resolve();
        }
      }
    });
  });
  const failNotes = (route: Route) =>
    route.fulfill({ status: 500, body: 'Internal Server Error' });
  const isNotesPath = (url: URL) => url.pathname === notesPath;
  await page.route(isNotesPath, failNotes);
  await withTimeout(twoFailedPolls, NOTES_TIMEOUT, 'two failed notes polls');

  await expect(phrase).toBeVisible();
  await expect(noteGroup(page, 'Câu hay')).toBeVisible();
  await expect(
    page.getByText('Gia sư sẽ ghi những điều đáng nhớ ở đây.'),
  ).toHaveCount(0);

  // The backend answers again: polling resumes, and the panel shows the
  // first Note and the one written since.
  await page.unroute(isNotesPath, failNotes);
  await postNote(roomName, WORD);
  await expect(noteGroup(page, 'Từ / cụm')).toBeVisible({
    timeout: NOTES_TIMEOUT,
  });
  await expect(page.getByText(WORD.english, { exact: true })).toBeVisible();
  await expect(phrase).toBeVisible();
  await expect(
    page.getByText('Gia sư sẽ ghi những điều đáng nhớ ở đây.'),
  ).toHaveCount(0);
});

test('a missed note shows under Câu nghe sót in the Report', async ({
  page,
}) => {
  const roomName = await startConversation(page);
  await postNote(roomName, MISSED);

  await endConversation(page, roomName);

  await expect(page.getByRole('tab', { name: 'Đã học' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const learned = page.getByRole('tabpanel', { name: 'Đã học' });
  const missed = noteGroup(learned, 'Câu nghe sót');
  await expect(missed).toBeVisible({ timeout: REPORT_TIMEOUT });
  await expect(missed.getByText(MISSED.english)).toBeVisible();
  await expect(missed.getByText(MISSED.meaning)).toBeVisible();
});

test('Report opens on Đã học, and Gia sư đánh giá fills in', async ({
  page,
}) => {
  const roomName = await startConversation(page);
  await postTwoTurns(roomName);
  await postNote(roomName, CORRECTION);
  // Notes of the other kinds too, so the screenshots show every group.
  await postNote(roomName, PHRASE);
  await postNote(roomName, WORD);
  await postNote(roomName, MISSED);
  for (const title of ['Câu hay', 'Từ / cụm', 'Sửa lỗi', 'Câu nghe sót']) {
    await expect(noteGroup(page, title)).toBeVisible({
      timeout: NOTES_TIMEOUT,
    });
  }
  await saveScreen(page, 'session-notes');

  await endConversation(page, roomName);

  const learnedTab = page.getByRole('tab', { name: 'Đã học' });
  await expect(learnedTab).toHaveAttribute('aria-selected', 'true');
  const learned = page.getByRole('tabpanel', { name: 'Đã học' });
  const corrections = noteGroup(learned, 'Sửa lỗi');
  await expect(corrections).toBeVisible({ timeout: REPORT_TIMEOUT });
  await expect(corrections.getByText(CORRECTION.said)).toBeVisible();
  await expect(corrections.getByText(CORRECTION.english)).toBeVisible();
  await saveScreen(page, 'report-learned');

  const assessmentTab = page.getByRole('tab', { name: 'Gia sư đánh giá' });
  await assessmentTab.click();
  await expect(assessmentTab).toHaveAttribute('aria-selected', 'true');
  const assessment = page.getByRole('tabpanel', { name: 'Gia sư đánh giá' });
  await expect(assessment.getByText('Nhận xét thử nghiệm.')).toBeVisible({
    timeout: REPORT_TIMEOUT,
  });
  await expect(
    assessment
      .getByRole('region', { name: 'Làm tốt' })
      .getByText('Điểm mạnh thử nghiệm.'),
  ).toBeVisible();
  await expect(
    assessment
      .getByRole('region', { name: 'Cần cải thiện' })
      .getByText('Điểm cần cải thiện thử nghiệm.'),
  ).toBeVisible();
  await saveScreen(page, 'report-assessment');
});

test('notes still show when the assessment fails', async ({ page }) => {
  const roomName = await startConversation(page);
  await postTwoTurns(roomName);
  await postNote(roomName, CORRECTION);

  // The Conversation itself says its Report failed; its Notes are untouched.
  const conversationPath = `/api/conversations/${roomName}`;
  await page.route(
    (url) => url.pathname === conversationPath,
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      const body = (await response.json()) as Record<string, unknown>;
      await route.fulfill({
        response,
        json: { ...body, reportStatus: 'failed', report: null },
      });
    },
  );

  await endConversation(page, roomName);

  const learned = page.getByRole('tabpanel', { name: 'Đã học' });
  await expect(page.getByRole('tab', { name: 'Đã học' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(noteGroup(learned, 'Sửa lỗi')).toBeVisible({
    timeout: REPORT_TIMEOUT,
  });
  await expect(learned.getByText(CORRECTION.english)).toBeVisible();

  await page.getByRole('tab', { name: 'Gia sư đánh giá' }).click();
  const assessment = page.getByRole('tabpanel', { name: 'Gia sư đánh giá' });
  await expect(assessment.getByRole('alert')).toHaveText(
    /Không tạo được phần đánh giá\. Ghi chú của bạn vẫn còn nguyên\./,
    { timeout: REPORT_TIMEOUT },
  );
  await expect(assessment.getByText('Nhận xét thử nghiệm.')).toHaveCount(0);
  await saveScreen(page, 'report-assessment-failed');

  await page.getByRole('tab', { name: 'Đã học' }).click();
  await expect(learned.getByText(CORRECTION.english)).toBeVisible();
});

test('closing the tab keeps the notes in Lịch sử học', async ({
  page,
  context,
}) => {
  const roomName = await startConversation(page);
  await postTwoTurns(roomName);
  await postNote(roomName, PHRASE);
  await expect(page.getByText(PHRASE.english)).toBeVisible({
    timeout: NOTES_TIMEOUT,
  });

  // Closed without Kết thúc.
  await page.close();
  const again = await context.newPage();
  await again.goto('/conversations');

  await expect(
    again.getByRole('heading', { name: 'Lịch sử học' }),
  ).toBeVisible();
  const row = again.getByRole('row').filter({ has: again.getByRole('link') });
  await expect(row).toHaveCount(1);
  await expect(await cellInColumn(again, row, 'Ghi chú')).toHaveText('1');

  await row.getByRole('link').click();
  await expect(again).toHaveURL(`/conversations/${roomName}`);
  await expect(
    again.getByRole('tabpanel', { name: 'Đã học' }).getByText(PHRASE.english),
  ).toBeVisible({ timeout: REPORT_TIMEOUT });
});

test('History is titled Lịch sử học and shows counts', async ({ page }) => {
  const roomName = await startConversation(page);
  await postTwoTurns(roomName);
  await postNote(roomName, PHRASE);
  await postNote(roomName, WORD);
  await endConversation(page, roomName);

  await page
    .getByRole('navigation', { name: 'Chính' })
    .getByRole('link', { name: 'Lịch sử' })
    .click();

  await expect(page).toHaveURL('/conversations');
  await expect(
    page.getByRole('heading', { name: 'Lịch sử học' }),
  ).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveText([
    'Ngày',
    'Ghi chú',
    'Thời lượng',
    'Báo cáo',
  ]);
  const row = page.getByRole('row').filter({ has: page.getByRole('link') });
  await expect(row).toHaveCount(1);
  await expect(await cellInColumn(page, row, 'Ghi chú')).toHaveText('2');
  await saveScreen(page, 'history');

  await page
    .getByRole('navigation', { name: 'Chính' })
    .getByRole('link', { name: 'Học' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Gia sư tiếng Anh của bạn' }),
  ).toBeVisible();
});
