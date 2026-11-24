import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';

const MAXIMUM_WIDTH = 480;

interface StartPanelProps {
  /** Called each time the Member presses Bắt đầu. */
  readonly onStart: () => void;
}

/** Where the Member starts a Conversation with the tutor: nothing to choose, one button. */
export function StartPanel({ onStart }: StartPanelProps) {
  return (
    <Stack gap={6} width="100%" maxWidth={MAXIMUM_WIDTH}>
      <Stack gap={1}>
        <Heading level={1}>Gia sư tiếng Anh của bạn</Heading>
        <Text as="p" color="secondary">
          Bấm Bắt đầu, rồi nói điều bạn cần: một từ, một câu, hay cả đoạn.
        </Text>
      </Stack>
      <Button
        label="Bắt đầu"
        variant="primary"
        icon={<Icon icon="microphone" />}
        onClick={onStart}
      />
    </Stack>
  );
}
