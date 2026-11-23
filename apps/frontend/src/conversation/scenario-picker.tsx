import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@astryxdesign/core/SegmentedControl';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import {
  type ConversationChoice,
  DEFAULT_SPEED,
  SCENARIO_IDS,
  SCENARIOS,
  type ScenarioId,
  SPEED_LABELS,
  SPEEDS,
  type Speed,
} from '@open-lang/shared';
import { useState } from 'react';

const SCENARIO_LABEL = 'Tình huống';
const SPEED_LABEL = 'Tốc độ Agent nói';
const MAXIMUM_WIDTH = 480;

interface ScenarioPickerProps {
  /** Called with the Member's choice when they press Bắt đầu. */
  readonly onStart: (choice: ConversationChoice) => void;
  /**
   * The Scenario and speed that start out selected, such as the Member's last
   * choice. Without it, the first Scenario and the default speed.
   */
  readonly initialChoice?: ConversationChoice;
}

/**
 * Where the Member chooses a Scenario and the speed the Agent speaks at,
 * before a Conversation starts. The first Scenario and the default speed
 * are selected.
 */
export function ScenarioPicker({
  onStart,
  initialChoice,
}: ScenarioPickerProps) {
  const [scenarioId, setScenarioId] = useState<ScenarioId>(
    initialChoice?.scenarioId ?? SCENARIO_IDS[0],
  );
  const [speed, setSpeed] = useState<Speed>(
    initialChoice?.speed ?? DEFAULT_SPEED,
  );

  function chooseScenario(value: string): void {
    const chosen = SCENARIOS.find(({ id }) => id === value);
    if (chosen !== undefined) {
      setScenarioId(chosen.id);
    }
  }

  function chooseSpeed(value: string): void {
    const chosen = SPEEDS.find((candidate) => String(candidate) === value);
    if (chosen !== undefined) {
      setSpeed(chosen);
    }
  }

  return (
    <Stack gap={6} width="100%" maxWidth={MAXIMUM_WIDTH}>
      <Stack gap={1}>
        <Heading level={1}>Luyện nói hôm nay</Heading>
        <Text as="p" color="secondary">
          Chọn một tình huống công sở.
        </Text>
      </Stack>
      <RadioList
        label={SCENARIO_LABEL}
        isLabelHidden
        value={scenarioId}
        onChange={chooseScenario}
      >
        {SCENARIOS.map((scenario) => (
          <RadioListItem
            key={scenario.id}
            value={scenario.id}
            label={scenario.title}
            description={scenario.description}
          />
        ))}
      </RadioList>
      <Stack gap={2}>
        <Text as="p" type="label">
          {SPEED_LABEL}
        </Text>
        <SegmentedControl
          label={SPEED_LABEL}
          value={String(speed)}
          onChange={chooseSpeed}
        >
          {SPEEDS.map((candidate) => (
            <SegmentedControlItem
              key={candidate}
              value={String(candidate)}
              label={SPEED_LABELS[candidate]}
            />
          ))}
        </SegmentedControl>
      </Stack>
      <Button
        label="Bắt đầu"
        variant="primary"
        onClick={() => {
          onStart({ scenarioId, speed });
        }}
      />
    </Stack>
  );
}
