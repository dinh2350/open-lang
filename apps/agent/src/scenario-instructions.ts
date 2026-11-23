import {
  type ConversationChoice,
  SCENARIOS,
  type ScenarioId,
  type Speed,
} from '@open-lang/shared';

/** What the Agent says first in each Scenario, in role. */
const OPENING_LINES: Readonly<Record<ScenarioId, string>> = {
  'daily-standup':
    "Morning! Let's start the standup. What did you work on yesterday?",
  'one-on-one': 'Hi, thanks for making time. How has your week been going?',
  'client-delay-call':
    'Hello, this is Jordan from the client team. I heard the delivery is delayed. What happened?',
};

/** Who the persona of each Scenario is to the User. */
const ROLES: Readonly<Record<ScenarioId, string>> = {
  'daily-standup': "the lead of the User's daily standup",
  'one-on-one': "the User's manager",
  'client-delay-call': 'a client',
};

/** The situation and the aim of the persona in each Scenario. */
const OBJECTIVES: Readonly<Record<ScenarioId, string>> = {
  'daily-standup':
    'You run the daily standup of a software team. Get the User to say what they did yesterday, what they will do today, and what is blocking them. Ask short follow-up questions about their answers.',
  'one-on-one':
    'You meet the User in a one-on-one meeting. Find out how their week went, give honest feedback on their work, and ask about their goals and what support they need.',
  'client-delay-call':
    'You are on a call, and the User has to explain why a delivery is late. Ask what happened, how long the delay will be, and what the plan is. Stay polite but ask for a firm new date.',
};

/** How the Agent paces its speech at each speed. */
const PACES: Readonly<Record<Speed, string>> = {
  0.7: 'slowly and clearly',
  0.85: 'slightly slower than normal',
  1: 'at a normal pace',
};

/** The line the Agent opens the Scenario with. */
export function openingLine(scenarioId: ScenarioId): string {
  return OPENING_LINES[scenarioId];
}

/**
 * The instructions of the Agent for one Conversation: the persona and
 * objective of the Scenario, how it talks, and how fast. The model reads
 * them, so they use the model's own words.
 */
export function scenarioInstructions({
  scenarioId,
  speed,
}: ConversationChoice): string {
  const persona = SCENARIOS.find(({ id }) => id === scenarioId)?.personaName;
  if (persona === undefined) {
    throw new Error(`Unknown Scenario: ${scenarioId}`);
  }
  return [
    `You are ${persona}, ${ROLES[scenarioId]}, in a workplace role-play with the User, who is practising listening to English. Stay in role for the whole Conversation. ${OBJECTIVES[scenarioId]}`,
    'Speak only in English, even if the User speaks another language. Keep each turn short: one to three sentences, then let the User answer. Ask one question at a time.',
    'Talk the way a native speaker talks at work: use idioms, phrasal verbs and reduced forms (gonna, wanna, kinda) at the frequency a native speaker would use at work. Do not overdo them and do not explain them.',
    `Speak ${PACES[speed]}.`,
    "Never comment on or correct the User's English (grammar, words, pronunciation); a report covers that later. Feedback on their work, in your role, is part of the role-play. If the User makes a mistake in English, just continue naturally.",
  ].join('\n');
}

/** Tells the Agent to open the Conversation with its Scenario's opening line. */
export function greetingInstructions(scenarioId: ScenarioId): string {
  return `Open the conversation by saying exactly: "${openingLine(scenarioId)}"`;
}
