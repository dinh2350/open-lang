import {
  LEARNER_BRIEF_VERSION,
  type LearnerBrief,
  type LearnerBriefItem,
} from '@open-lang/shared';
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
  /** What the tutor knows the User has studied when the check starts it. */
  brief?: LearnerBrief;
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

/** The sentence the tutor must not teach as new in the first learner brief check. */
const MASTERED_SENTENCE = "I'd like to reschedule the meeting.";

function briefOf(items: LearnerBriefItem[]): LearnerBrief {
  return { version: LEARNER_BRIEF_VERSION, items };
}

/**
 * A sentence as it compares in a note: the model may save it without its
 * final punctuation mark, in other case or with a typographic apostrophe,
 * and it is still the same sentence.
 */
function sentenceKey(sentence: string): string {
  return sentence
    .trim()
    .toLowerCase()
    .replaceAll('\u2019', "'")
    .replace(/[.!?]$/, '');
}

/**
 * The checks of the learner brief: what the User has already studied changes
 * what the tutor teaches, and the tutor does not recite it. Each check starts
 * the tutor with its brief. The first fails when the tutor ignores the brief;
 * the second fails when it uses the brief too much.
 */
export const learnerBriefChecks: readonly TutorCheck[] = [
  {
    name: 'the tutor does not teach a mastered item as new',
    brief: briefOf([
      {
        english: MASTERED_SENTENCE,
        meaning: 'Tôi muốn dời cuộc họp.',
        status: 'mastered',
      },
    ]),
    run: async (tutor) => {
      const turn = await tutor.say(
        'Dạy mình cách xin dời lịch họp bằng tiếng Anh.',
      );

      await turn.expect
        .containsMessage({ role: 'assistant' })
        .judge(tutor.judge, {
          intent: `Does not teach the sentence "${MASTERED_SENTENCE}" from scratch: it may say the User already knows it, or give a different expression or new content`,
        });
      const saved = tutor.notes().map(({ english }) => sentenceKey(english));
      expect(
        saved,
        'the sentences of the notes the tutor saved, none of them the mastered one',
      ).not.toContain(sentenceKey(MASTERED_SENTENCE));
    },
  },
  {
    name: 'the tutor does not read the list aloud',
    brief: briefOf([
      {
        english: MASTERED_SENTENCE,
        meaning: 'Tôi muốn dời cuộc họp.',
        status: 'mastered',
      },
      {
        english: 'Could you send me the report by Friday?',
        meaning: 'Bạn gửi cho mình báo cáo trước thứ Sáu được không?',
        status: 'learning',
      },
      {
        english: "I'll get back to you by the end of the day.",
        meaning: 'Mình sẽ phản hồi bạn trước cuối ngày.',
        status: 'learning',
      },
    ]),
    run: async (tutor) => {
      const turn = await tutor.say('Chào bạn');

      await turn.expect
        .containsMessage({ role: 'assistant' })
        .judge(tutor.judge, {
          intent: 'Does not list or read out the items the User studied before',
        });
    },
  },
];
