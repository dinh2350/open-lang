// Claude Code PostToolUse hook (quality layer 1). After each file edit it runs
// Prettier and `eslint --fix` on the edited file. ESLint problems that remain
// are written to stderr with exit code 2, which reports them to the agent.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';
import * as prettier from 'prettier';

const LINTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

function editedFilePath(hookInput: unknown): string | undefined {
  if (typeof hookInput !== 'object' || hookInput === null) {
    return undefined;
  }
  const toolInput: unknown = Reflect.get(hookInput, 'tool_input');
  if (typeof toolInput !== 'object' || toolInput === null) {
    return undefined;
  }
  const filePath: unknown = Reflect.get(toolInput, 'file_path');
  return typeof filePath === 'string' ? filePath : undefined;
}

async function formatWithPrettier(filePath: string): Promise<void> {
  const fileInfo = await prettier.getFileInfo(filePath, {
    ignorePath: ['.gitignore', '.prettierignore'],
  });
  if (fileInfo.ignored || fileInfo.inferredParser === null) {
    return;
  }
  const options = await prettier.resolveConfig(filePath);
  const source = readFileSync(filePath, 'utf8');
  const formatted = await prettier.format(source, {
    ...options,
    filepath: filePath,
  });
  if (formatted !== source) {
    writeFileSync(filePath, formatted);
  }
}

/** Fixes what ESLint can and returns a report of what is left, or `undefined` when clean. */
async function fixWithEslint(
  projectDirectory: string,
  filePath: string,
): Promise<string | undefined> {
  if (!LINTED_EXTENSIONS.has(path.extname(filePath))) {
    return undefined;
  }
  const eslint = new ESLint({ cwd: projectDirectory, fix: true });
  if (await eslint.isPathIgnored(filePath)) {
    return undefined;
  }
  const results = await eslint.lintFiles([filePath]);
  await ESLint.outputFixes(results);
  const problemCount = results.reduce(
    (total, result) => total + result.errorCount + result.warningCount,
    0,
  );
  if (problemCount === 0) {
    return undefined;
  }
  const formatter = await eslint.loadFormatter('stylish');
  return formatter.format(results);
}

const projectDirectory = path.resolve(
  process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
);
const filePath = editedFilePath(JSON.parse(readFileSync(0, 'utf8')));
const insideProject =
  filePath !== undefined &&
  !path.relative(projectDirectory, filePath).startsWith('..');

if (filePath !== undefined && insideProject && existsSync(filePath)) {
  process.chdir(projectDirectory);
  await formatWithPrettier(filePath);
  const remainingProblems = await fixWithEslint(projectDirectory, filePath);
  if (remainingProblems !== undefined) {
    process.stderr.write(
      `ESLint found problems that --fix could not fix. Fix the code; don't suppress them:${remainingProblems}`,
    );
    process.exitCode = 2;
  }
}
