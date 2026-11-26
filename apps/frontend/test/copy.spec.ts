import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const frontend = path.resolve(import.meta.dirname, '..');
const src = path.join(frontend, 'src');

// The app teaches every skill, not only speaking, so no copy (comments
// included) says "luyện nói" or "buổi luyện": it says "học" and "buổi học".
const files = [
  path.join(frontend, 'index.html'),
  ...readdirSync(src, { encoding: 'utf8', recursive: true })
    .map((file) => path.join(src, file))
    .filter((file) => /\.tsx?$/.test(file)),
];

describe('UI copy', () => {
  it('no UI copy says luyện', () => {
    const offenders = files
      .filter((file) => /luyện/i.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(frontend, file));

    expect(files.length).toBeGreaterThan(1);
    expect(offenders).toEqual([]);
  });
});
