import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@astryxdesign/core/SegmentedControl';
import { SelectableCard } from '@astryxdesign/core/SelectableCard';
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

const SPEED_LABEL = 'Tốc độ Agent nói';
const MAXIMUM_WIDTH = 480;

interface ScenarioPickerProps {
  /** Called with the Member's choice when they press Bắt đầu. */
  readonly onStart: (choice: ConversationChoice) => void;
}

/**
 * Where the Member chooses a Scenario and the speed the Agent speaks at,
 * before a Conversation starts. The first Scenario and the default speed
 * are selected.
 */
export function ScenarioPicker({ onStart }: ScenarioPickerProps) {
  const [scenarioId, setScenarioId] = useState<ScenarioId>(SCENARIO_IDS[0]);
  const [speed, setSpeed] = useState<Speed>(DEFAULT_SPEED);

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
      <Stack gap={3}>
        {SCENARIOS.map((scenario) => (
          <SelectableCard
            key={scenario.id}
            label={scenario.title}
            isSelected={scenario.id === scenarioId}
            // The cards are one choice: pressing the selected card again
            // keeps it selected.
            onChange={() => {
              setScenarioId(scenario.id);
            }}
            width="100%"
          >
            <Stack gap={1}>
              <Text weight="semibold">{scenario.title}</Text>
              <Text as="p" color="secondary">
                {scenario.description}
              </Text>
            </Stack>
          </SelectableCard>
        ))}
      </Stack>
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
