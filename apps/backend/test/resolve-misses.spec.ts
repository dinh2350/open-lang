import { describe, expect, it } from 'vitest';
import {
  resolveMisses,
  type TurnTimes,
} from '../src/reports/resolve-misses.js';

const at = (seconds: number): Date =>
  new Date(Date.UTC(2026, 10, 23, 10, 0, seconds));

const turn = (
  role: TurnTimes['role'],
  start: number,
  end: number | null,
): TurnTimes => ({
  role,
  startedAt: at(start),
  endedAt: end === null ? null : at(end),
});

describe('resolveMisses', () => {
  it('picks the Agent turn playing when the button was pressed', () => {
    const turns = [
      turn('agent', 0, 5),
      turn('user', 5, 8),
      turn('agent', 8, 14),
    ];

    expect(resolveMisses(turns, [at(10)])).toEqual([2]);
  });

  it('falls back to the latest Agent turn that started before the press', () => {
    const turns = [turn('agent', 0, 5), turn('agent', 8, 14)];

    expect(resolveMisses(turns, [at(6)])).toEqual([0]);
  });

  it('ignores a press before any Agent turn', () => {
    const turns = [turn('agent', 5, 9)];

    expect(resolveMisses(turns, [at(2)])).toEqual([]);
  });

  it('counts a turn once however often it was pressed', () => {
    const turns = [turn('agent', 0, 10), turn('agent', 12, 20)];

    expect(resolveMisses(turns, [at(3), at(4), at(15), at(16)])).toEqual([
      0, 1,
    ]);
  });

  it('never picks a User turn', () => {
    const turns = [turn('agent', 0, 5), turn('user', 6, 12)];

    expect(resolveMisses(turns, [at(9)])).toEqual([0]);
  });

  it('treats a turn without an end as started before the press only', () => {
    const turns = [turn('agent', 0, 5), turn('agent', 10, null)];

    expect(resolveMisses(turns, [at(7)])).toEqual([0]);
    expect(resolveMisses(turns, [at(12)])).toEqual([1]);

    const overlapping = [turn('agent', 0, null), turn('agent', 3, 6)];

    expect(resolveMisses(overlapping, [at(4)])).toEqual([1]);
  });
});
