import { expect } from 'vitest';
import { assertAgentMessage } from '../agent-messages.ts';
import type { LiveTutor } from './live-tutor.ts';

/**
 * What the tutor has to do in a live Conversation. A check judges its
 * behavior, not its exact words, and fails by throwing: a judge that says no,
 * or an assertion.
 */
export interface TutorCheck {
  /** The name of the test that runs the check. */
  name: string;
  run(tutor: LiveTutor): Promise<void>;
}

/** The User picks a topic, in Vietnamese, and asks to be taught a sentence. */
const ASK_TO_LEARN =
  'Mình muốn học cách nhờ đồng nghiệp giúp đỡ. Dạy mình một câu nhé.';

/** The checks every Agent Mode and Provider has to pass. */
export const basicChecks: readonly TutorCheck[] = [
  {
    name: 'the tutor opens in Vietnamese',
    run: async (tutor) => {
      await assertAgentMessage(tutor.opening).judge(tutor.judge, {
        intent:
          'Greets the User in Vietnamese and asks what they want to learn today.',
      });
    },
  },
  {
    name: 'the tutor calls saveNote after teaching a sentence',
    run: async (tutor) => {
      const teaching = await tutor.say(ASK_TO_LEARN);
      // The User says an English sentence back, as in a lesson.
      const practising = await tutor.say(
        'Could you help me with this report, please?',
      );

      const kinds = tutor.notes().map(({ kind }) => kind);
      expect(kinds, 'the kinds of the notes the tutor saved').toContain(
        'phrase',
      );
      // Few notes: only what is worth keeping.
      expect(kinds.length).toBeLessThanOrEqual(3);

      // saveNote completes silently, so a turn made only of the call would
      // leave the User in silence: the tutor has to speak in the same turn.
      const savingTurns = [teaching, practising].filter(({ events }) =>
        events.some(
          ({ type, item }) =>
            type === 'function_call' && item.name === 'saveNote',
        ),
      );
      expect(savingTurns, 'the turns with a saveNote call').not.toHaveLength(0);
      for (const turn of savingTurns) {
        turn.expect.containsMessage({ role: 'assistant' });
      }
    },
  },
  {
    name: 'the tutor answers in Vietnamese and gives the English sentence in English',
    run: async (tutor) => {
      const turn = await tutor.say(
        'Làm sao nói "tôi muốn xin nghỉ một ngày" bằng tiếng Anh?',
      );

      await turn.expect
        .containsMessage({ role: 'assistant' })
        .judge(tutor.judge, {
          intent:
            'Explains in Vietnamese and says a whole English sentence that means "I want to take a day off", in English, such as "I would like to take a day off."',
        });
    },
  },
];

/** The checks of saying a sentence again, which matter most with OpenAI Realtime. */
export const repeatingChecks: readonly TutorCheck[] = [
  {
    name: 'the tutor speaks more slowly when the User asks',
    run: async (tutor) => {
      await tutor.say(ASK_TO_LEARN);

      const turn = await tutor.say('Bạn nói chậm hơn được không?');

      await turn.expect
        .containsMessage({ role: 'assistant' })
        .judge(tutor.judge, {
          intent:
            'Says an English sentence again, slower, for example in short pieces or word by word, and may tell the User in Vietnamese that it goes slower.',
        });
    },
  },
  {
    name: 'the tutor says the sentence again slower after an off-topic reply and saves a missed note',
    run: async (tutor) => {
      await tutor.say('Hãy hỏi mình một câu tiếng Anh về công việc hôm nay.');

      const turn = await tutor.say('I like pizza and my cat is sleeping.');

      await turn.expect
        .containsMessage({ role: 'assistant' })
        .judge(tutor.judge, {
          intent:
            'Says an English sentence or question again, simpler and slower, for example in short pieces, instead of accepting the last reply or moving on to something new.',
        });
      turn.expect.containsFunctionCall({ name: 'saveNote' });
      const missed = tutor.notes().filter(({ kind }) => kind === 'missed');
      expect(missed, 'the missed notes the tutor saved').not.toHaveLength(0);
    },
  },
];
