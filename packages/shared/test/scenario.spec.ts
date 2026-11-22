import { describe, expect, it } from 'vitest';
import {
  conversationChoiceSchema,
  DEFAULT_SPEED,
  SCENARIOS,
  SPEEDS,
} from '../src/scenario.ts';

describe('Scenario contracts', () => {
  it('lists the three Scenarios in order with Vietnamese title and description and a persona name', () => {
    expect(SCENARIOS.map((scenario) => scenario.id)).toEqual([
      'daily-standup',
      'one-on-one',
      'client-delay-call',
    ]);
    expect(SCENARIOS.map((scenario) => scenario.personaName)).toEqual([
      'Sam',
      'Alex',
      'Jordan',
    ]);
    expect(SCENARIOS.map((scenario) => scenario.title)).toEqual([
      'Họp standup',
      'Họp 1:1 với quản lý',
      'Gọi khách trễ hạn',
    ]);
    expect(SCENARIOS.map((scenario) => scenario.description)).toEqual([
      'Báo cáo việc hôm qua, hôm nay và vướng mắc.',
      'Nhận phản hồi, nói về mục tiêu.',
      'Giải thích và xin thêm thời gian.',
    ]);
  });

  it('accepts a choice only with one of the three speeds', () => {
    expect(
      conversationChoiceSchema.safeParse({
        scenarioId: 'daily-standup',
        speed: 0.85,
      }).success,
    ).toBe(true);
    expect(
      conversationChoiceSchema.safeParse({
        scenarioId: 'daily-standup',
        speed: 0.9,
      }).success,
    ).toBe(false);
    expect(
      conversationChoiceSchema.safeParse({
        scenarioId: 'daily-standup',
        speed: 2,
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown Scenario', () => {
    expect(
      conversationChoiceSchema.safeParse({
        scenarioId: 'job-interview',
        speed: 1,
      }).success,
    ).toBe(false);
  });

  it('defaults to a speed that is one of SPEEDS', () => {
    expect(DEFAULT_SPEED).toBeCloseTo(0.85);
    expect(SPEEDS).toContain(DEFAULT_SPEED);
  });
});
