import { z } from 'zod';

/** The Scenarios a Member can practise, in the order the picker shows them. */
export const SCENARIO_IDS = [
  'daily-standup',
  'one-on-one',
  'client-delay-call',
] as const;

/** The id of one Scenario. */
export const scenarioIdSchema = z.enum(SCENARIO_IDS);

export type ScenarioId = z.infer<typeof scenarioIdSchema>;

/** What the Member sees about a Scenario before choosing it. */
export interface ScenarioInfo {
  id: ScenarioId;
  /** Vietnamese title shown on the picker. */
  title: string;
  /** Vietnamese one-line description shown on the picker. */
  description: string;
  /** First name of the person the Agent plays. */
  personaName: string;
}

/** Every Scenario, in the same order as `SCENARIO_IDS`. */
export const SCENARIOS: readonly ScenarioInfo[] = [
  {
    id: 'daily-standup',
    title: 'Họp standup',
    description: 'Báo cáo việc hôm qua, hôm nay và vướng mắc.',
    personaName: 'Sam',
  },
  {
    id: 'one-on-one',
    title: 'Họp 1:1 với quản lý',
    description: 'Nhận phản hồi, nói về mục tiêu.',
    personaName: 'Alex',
  },
  {
    id: 'client-delay-call',
    title: 'Gọi khách trễ hạn',
    description: 'Giải thích và xin thêm thời gian.',
    personaName: 'Jordan',
  },
];

/** The speaking speeds of the Agent: slow, medium and normal. */
export const SPEEDS = [0.7, 0.85, 1] as const;

/** One of the speeds in `SPEEDS`, and nothing in between. */
export const speedSchema = z.union([
  z.literal(SPEEDS[0]),
  z.literal(SPEEDS[1]),
  z.literal(SPEEDS[2]),
]);

export type Speed = z.infer<typeof speedSchema>;

/** Vietnamese label of each speed, as the speed picker shows it. */
export const SPEED_LABELS: Record<Speed, string> = {
  0.7: 'Chậm',
  0.85: 'Vừa',
  1: 'Bình thường',
};

/** The speed that is selected before the Member picks one. */
export const DEFAULT_SPEED: Speed = 0.85;

/** What a Member picks before a Conversation starts. */
export const conversationChoiceSchema = z.object({
  scenarioId: scenarioIdSchema,
  speed: speedSchema,
});

export type ConversationChoice = z.infer<typeof conversationChoiceSchema>;

/** The text the "I did not catch that" button sends on LiveKit's `lk.chat` topic. */
export const LISTENING_HELP_MESSAGE = 'listening-help';
