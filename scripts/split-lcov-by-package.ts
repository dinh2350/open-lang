// Vitest only supports coverage at the root of a projects config, so
// `vitest run --coverage` writes one lcov report for the whole repo. This
// splits it into one report per package, at
// `<package directory>/coverage/lcov.info` (for example
// `apps/backend/coverage/lcov.info`).
// Source paths stay relative to the repo root, as SonarQube expects.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const END_OF_RECORD = 'end_of_record\n';

const repoRoot = path.resolve(import.meta.dirname, '..');
const rootReport = readFileSync(
  path.join(repoRoot, 'coverage', 'lcov.info'),
  'utf8',
);

const recordsByPackage = new Map<string, string[]>();
for (const record of rootReport.split(END_OF_RECORD)) {
  if (record.trim() === '') {
    continue;
  }
  const sourceFile = /^SF:(.+)$/m.exec(record)?.[1];
  if (sourceFile === undefined) {
    throw new Error(`lcov record without a source file:\n${record}`);
  }
  // `apps/backend/src/main.ts` belongs to `apps/backend`.
  const packageDirectory = sourceFile.split('/').slice(0, 2).join('/');
  const records = recordsByPackage.get(packageDirectory) ?? [];
  records.push(record + END_OF_RECORD);
  recordsByPackage.set(packageDirectory, records);
}

for (const [packageDirectory, records] of recordsByPackage) {
  const reportDirectory = path.join(repoRoot, packageDirectory, 'coverage');
  mkdirSync(reportDirectory, { recursive: true });
  writeFileSync(path.join(reportDirectory, 'lcov.info'), records.join(''));
}
