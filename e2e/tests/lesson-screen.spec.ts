import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  notesButton,
  saveScreen,
  startConversation,
  statusLine,
  transcriptButton,
} from './lesson.ts';

const WIDE = { width: 1280, height: 800 };
const PHONE = { width: 375, height: 667 };

/** The tutor's Aura: a canvas, or the still circle without WebGL. */
function aura(page: Page): Locator {
  return page.getByRole('img', { name: 'Giọng nói của Gia sư' });
}

/** The side panel, found whether it is shown or hidden. */
function sidePanel(page: Page): Locator {
  return page.locator('aside[aria-label="Cuộc nói và ghi chú"]');
}

/** The bar at the bottom: the status line and the four buttons. */
function controlsBar(page: Page): Locator {
  return page.locator('.controls-bar');
}

/** The four buttons of the controls bar, the mic one while it is on. */
function controlButtons(page: Page): Locator[] {
  return [
    page.getByRole('button', { name: 'Tắt mic' }),
    transcriptButton(page),
    notesButton(page),
    page.getByRole('button', { name: 'Kết thúc' }),
  ];
}

/** Each of the four buttons is wholly inside the window. */
async function expectControlsInViewport(page: Page): Promise<void> {
  for (const button of controlButtons(page)) {
    await expect(button).toBeInViewport({ ratio: 1 });
  }
}

/** The page is no taller than the window, so it does not scroll. */
async function expectNoPageScroll(page: Page): Promise<void> {
  const { scrollHeight, innerHeight } = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(scrollHeight, 'the page height').toBeLessThanOrEqual(innerHeight);
}

/** How many colours a PNG has, decoded by the browser's own image decoder. */
async function colourCount(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (base64) => {
    const response = await fetch(`data:image/png;base64,${base64}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('The browser has no 2D canvas.');
    }
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const colours = new Set<string>();
    for (let index = 0; index < data.length; index += 4) {
      colours.add(data.subarray(index, index + 4).join(','));
    }
    return colours.size;
  }, png.toString('base64'));
}

/** Whether two boxes on the page overlap. */
function intersects(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/** The open side panel does not cover any part of the controls bar. */
async function expectPanelClearOfControls(page: Page): Promise<void> {
  const panelBox = await sidePanel(page).boundingBox();
  const barBox = await controlsBar(page).boundingBox();
  expect(panelBox, 'the side panel box').not.toBeNull();
  expect(barBox, 'the controls bar box').not.toBeNull();
  if (panelBox !== null && barBox !== null) {
    expect(
      intersects(panelBox, barBox),
      `the side panel ${JSON.stringify(panelBox)} overlaps the controls ${JSON.stringify(barBox)}`,
    ).toBe(false);
  }
}

test('the logo and the favicon are there, in light and dark mode', async ({
  page,
}) => {
  await page.goto('/sign-in');
  const logo = page.getByRole('link', { name: 'Open Lang' });
  // The mark is decorative (alt=""), so it has no role of its own.
  const mark = logo.locator('img');
  const modeSwitch = page.getByRole('switch', { name: 'Dark mode' });
  const sources: string[] = [];

  for (const mode of ['light', 'dark'] as const) {
    if ((await modeSwitch.isChecked()) !== (mode === 'dark')) {
      await modeSwitch.click();
    }
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    await expect(logo).toBeVisible();
    await expect
      .poll(() =>
        mark.evaluate((image: HTMLImageElement) =>
          image.complete ? image.naturalWidth : 0,
        ),
      )
      .toBeGreaterThan(0);
    sources.push((await mark.getAttribute('src')) ?? '');
    await saveScreen(page.getByRole('banner'), `header-${mode}`);
  }
  // Each mode has its own mark.
  expect(new Set(sources).size).toBe(2);

  const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(favicon, 'the favicon link').not.toBeNull();
  const response = await page.request.get(favicon ?? '');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^image\/png\b/);
});

test('the lesson screen shows only the aura, the status line and the controls', async ({
  page,
}) => {
  await page.setViewportSize(WIDE);
  await startConversation(page);

  for (const viewport of [WIDE, PHONE]) {
    await page.setViewportSize(viewport);
    await expect(aura(page)).toBeVisible();
    await expect(statusLine(page)).toHaveText('Gia sư đang nghe bạn nói.');
    await expect(sidePanel(page)).toBeAttached();
    await expect(sidePanel(page)).toBeHidden();
    await expect(
      page.getByText('Chữ của cuộc nói sẽ hiện ở đây.'),
    ).toBeHidden();
    await expect(
      page.getByText('Gia sư sẽ ghi những điều đáng nhớ ở đây.'),
    ).toBeHidden();
    await expectNoPageScroll(page);
    await expectControlsInViewport(page);
    await saveScreen(page, `lesson-${String(viewport.width)}`);
  }
});

test('the aura draws something', async ({ page }) => {
  await startConversation(page);

  await expect(aura(page).locator('canvas')).toBeVisible();
  await expect(aura(page).locator('.aura-fallback')).toHaveCount(0);
  // A blank canvas shows only the page behind it: a single colour.
  await expect
    .poll(async () => colourCount(page, await aura(page).screenshot()), {
      message: 'the colours in a screenshot of the aura',
    })
    .toBeGreaterThan(1);
});

test('the aura falls back to a still circle', async ({ page }) => {
  await page.addInitScript(() => {
    type GetContext = (
      this: HTMLCanvasElement,
      contextId: string,
      options?: unknown,
    ) => RenderingContext | null;
    const getContext = Reflect.get(
      HTMLCanvasElement.prototype,
      'getContext',
    ) as GetContext;
    function withoutWebGl(
      this: HTMLCanvasElement,
      contextId: string,
      options?: unknown,
    ): RenderingContext | null {
      if (contextId === 'webgl') {
        return null;
      }
      return getContext.call(this, contextId, options);
    }
    HTMLCanvasElement.prototype.getContext =
      withoutWebGl as typeof HTMLCanvasElement.prototype.getContext;
  });
  await startConversation(page);

  await expect(aura(page).locator('.aura-fallback')).toBeVisible();
  await expect(aura(page).locator('canvas')).toHaveCount(0);

  // The lesson goes on without the moving Aura.
  await page.getByRole('button', { name: 'Tắt mic' }).click();
  await expect(
    statusLine(page).filter({ hasText: 'Gia sư đang chờ bạn bật mic.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Bật mic' }).click();
  await expect(statusLine(page)).toHaveText('Gia sư đang nghe bạn nói.');
});

test('Cuộc nói and Ghi chú open and close the panel, and mic and Kết thúc keep working while it is open', async ({
  page,
}) => {
  await page.setViewportSize(WIDE);
  const roomName = await startConversation(page);
  const transcriptTab = page.getByRole('tab', { name: 'Cuộc nói' });
  const notesTab = page.getByRole('tab', { name: /^Ghi chú/ });
  const transcriptPanel = page.getByRole('tabpanel', { name: 'Cuộc nói' });
  const notesPanel = page.getByRole('tabpanel', { name: 'Ghi chú' });

  // Each button opens its tab, and closes the panel when pressed again.
  await transcriptButton(page).click();
  await expect(sidePanel(page)).toBeVisible();
  await expect(transcriptTab).toHaveAttribute('aria-selected', 'true');
  await expect(transcriptPanel).toBeVisible();
  await expect(transcriptButton(page)).toHaveAttribute('aria-expanded', 'true');
  // The panel sits beside the Aura and leaves the controls alone.
  await expectPanelClearOfControls(page);
  await transcriptButton(page).click();
  await expect(sidePanel(page)).toBeHidden();
  await expect(transcriptButton(page)).toHaveAttribute(
    'aria-expanded',
    'false',
  );

  await notesButton(page).click();
  await expect(sidePanel(page)).toBeVisible();
  await expect(notesTab).toHaveAttribute('aria-selected', 'true');
  await expect(notesPanel).toBeVisible();
  await expect(transcriptPanel).toBeHidden();
  await notesButton(page).click();
  await expect(sidePanel(page)).toBeHidden();

  // Đóng and Escape close it too.
  await transcriptButton(page).click();
  await expect(sidePanel(page)).toBeVisible();
  await page.getByRole('button', { name: 'Đóng' }).click();
  await expect(sidePanel(page)).toBeHidden();

  await notesButton(page).click();
  await expect(sidePanel(page)).toBeVisible();
  await notesTab.press('Escape');
  await expect(sidePanel(page)).toBeHidden();

  // With the panel open again, the controls still work.
  await transcriptButton(page).click();
  await expect(sidePanel(page)).toBeVisible();
  await expectPanelClearOfControls(page);
  await saveScreen(page, 'lesson-panel-1280');

  // The mic still mutes, and the panel stays open.
  await page.getByRole('button', { name: 'Tắt mic' }).click();
  await expect(page.getByRole('button', { name: 'Bật mic' })).toBeVisible();
  await expect(
    page.getByText('Mic đang tắt. Gia sư không nghe thấy bạn.'),
  ).toBeVisible();
  await expect(sidePanel(page)).toBeVisible();
  await page.getByRole('button', { name: 'Bật mic' }).click();
  await expect(page.getByRole('button', { name: 'Tắt mic' })).toBeVisible();

  // On a phone the controls stay in the window with the panel open.
  await page.setViewportSize(PHONE);
  await expect(sidePanel(page)).toBeVisible();
  await expectControlsInViewport(page);
  await saveScreen(page, 'lesson-panel-375');

  // Kết thúc still ends the lesson.
  await page.getByRole('button', { name: 'Kết thúc' }).click();
  await expect(page).toHaveURL(`/conversations/${roomName}`);
  await expect(
    page.getByRole('heading', { name: 'Hôm nay bạn học được gì' }),
  ).toBeVisible();
});

// Last in its file: the moving Aura burns CPU under software WebGL, and the
// tests that follow (nav, sign-in, theme mode) start no Conversation, so the
// load has dropped before the next Agent dispatch.
test('the aura moves when motion is allowed', async ({ page }) => {
  // The Agent joins while the Aura is still, so the moving one cannot delay
  // its dispatch.
  const roomName = await startConversation(page);
  await expect(aura(page).locator('canvas')).toBeVisible();

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // A single redraw would change the Aura once; a moving one keeps changing.
  let previous = await aura(page).screenshot();
  let changes = 0;
  await expect
    .poll(
      async () => {
        const next = await aura(page).screenshot();
        if (!next.equals(previous)) {
          changes += 1;
        }
        previous = next;
        return changes;
      },
      { message: 'how many times the aura changed between screenshots' },
    )
    .toBeGreaterThanOrEqual(2);

  // Ends at once, so the moving Aura unmounts and the CPU settles.
  await page.getByRole('button', { name: 'Kết thúc' }).click();
  await expect(page).toHaveURL(`/conversations/${roomName}`);
});
