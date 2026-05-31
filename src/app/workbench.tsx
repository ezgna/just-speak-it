import { Host, FieldGroup, Row, Spacer, Text } from '@expo/ui';
import { scrollIndicators } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useResolvedColorScheme } from '@/hooks/use-theme-preference';

const AccountRows = [
  { label: '名前', value: 'Workbench' },
  { label: 'モデル', value: 'Just Speak It' },
  { label: '開始', value: '2026年 5月' },
] as const;

const SupportRows = ['画面案を評価', '共有する', 'メモを送る'] as const;
const FollowRows = ['just-speak-it.app', 'Instagram', 'TikTok', 'X'] as const;

export default function WorkbenchScreen() {
  const colorScheme = useResolvedColorScheme();
  const colors = WorkbenchColors[colorScheme];

  return (
    <>
      <Stack.Header
        transparent
        style={{
          backgroundColor: 'transparent',
          color: colors.text,
          shadowColor: 'transparent',
        }}
        largeStyle={{
          backgroundColor: 'transparent',
          shadowColor: 'transparent',
        }}
      />
      <Stack.Title
        large
        style={{
          color: colors.text,
          fontWeight: '800',
          textAlign: 'center',
        }}
        largeStyle={{
          color: colors.text,
          fontSize: 34,
          fontWeight: '900',
        }}>
        ワークベンチ
      </Stack.Title>
      <Stack.Screen.BackButton displayMode="minimal" withMenu={false} />
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <Host colorScheme={colorScheme} style={{ flex: 1, backgroundColor: colors.background }}>
        <FieldGroup
          modifiers={[scrollIndicators('never', 'vertical')]}
          style={{ backgroundColor: colors.background }}>
          <FieldGroup.Section title="Account">
            {AccountRows.map((row) => (
              <InfoRow key={row.label} colors={colors} label={row.label} value={row.value} />
            ))}
            <FieldGroup.SectionFooter>
              <Text textStyle={getFooterTextStyle(colors)}>User ID: workbench-preview</Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          <FieldGroup.Section title="Credits">
            <InfoRow colors={colors} label="残り" value="1 credit" valueTone="accent" />
            <ActionRow colors={colors} icon="⚡" label="クレジットを追加" accent />
            <FieldGroup.SectionFooter>
              <Text textStyle={getFooterTextStyle(colors)}>
                1 credit unlocks one practice generation. Credits never expire.
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          <FieldGroup.Section>
            <ActionRow colors={colors} icon="🎁" label="Enjoying the app?" trailing="›" />
            <ActionRow colors={colors} icon="🎨" label="Are you an artist?" trailing="›" />
          </FieldGroup.Section>

          <FieldGroup.Section title="Support & Feedback">
            {SupportRows.map((label, index) => (
              <ActionRow
                key={label}
                colors={colors}
                icon={['★', '⇧', '✉'][index] ?? '•'}
                label={label}
              />
            ))}
          </FieldGroup.Section>

          <FieldGroup.Section title="Follow Us">
            {FollowRows.map((label, index) => (
              <ActionRow
                key={label}
                colors={colors}
                icon={['◎', '📷', '♪', '𝕏'][index] ?? '•'}
                label={label}
              />
            ))}
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
    </>
  );
}

function InfoRow({
  colors,
  label,
  value,
  valueTone = 'secondary',
}: {
  colors: WorkbenchColorSet;
  label: string;
  value: string;
  valueTone?: 'secondary' | 'accent';
}) {
  return (
    <Row alignment="center" spacing={10}>
      <Text textStyle={getPrimaryTextStyle(colors)}>{label}</Text>
      <Spacer flexible />
      <Text
        numberOfLines={1}
        textStyle={
          valueTone === 'accent' ? getAccentValueTextStyle(colors) : getSecondaryTextStyle(colors)
        }>
        {value}
      </Text>
    </Row>
  );
}

function ActionRow({
  accent = false,
  colors,
  icon,
  label,
  trailing,
}: {
  accent?: boolean;
  colors: WorkbenchColorSet;
  icon: string;
  label: string;
  trailing?: string;
}) {
  return (
    <Row alignment="center" spacing={10}>
      <Text textStyle={accent ? getAccentIconTextStyle(colors) : getIconTextStyle(colors)}>
        {icon}
      </Text>
      <Text textStyle={accent ? getAccentActionTextStyle(colors) : getPrimaryTextStyle(colors)}>
        {label}
      </Text>
      <Spacer flexible />
      {trailing ? <Text textStyle={getChevronTextStyle(colors)}>{trailing}</Text> : null}
    </Row>
  );
}

type WorkbenchColorSet = {
  accent: string;
  background: string;
  secondaryText: string;
  text: string;
};

const WorkbenchColors: Record<'dark' | 'light', WorkbenchColorSet> = {
  dark: {
    accent: '#FFE34D',
    background: '#000000',
    secondaryText: '#A6A6AE',
    text: '#FFFFFF',
  },
  light: {
    accent: '#B45309',
    background: '#F2F2F7',
    secondaryText: '#6E6E73',
    text: '#111111',
  },
};

const getPrimaryTextStyle = (colors: WorkbenchColorSet) =>
  ({
    color: colors.text,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
  }) as const;

const getSecondaryTextStyle = (colors: WorkbenchColorSet) =>
  ({
    color: colors.secondaryText,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'right',
  }) as const;

const getAccentValueTextStyle = (colors: WorkbenchColorSet) =>
  ({
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'right',
  }) as const;

const getFooterTextStyle = (colors: WorkbenchColorSet) =>
  ({
    color: colors.secondaryText,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  }) as const;

const getIconTextStyle = (colors: WorkbenchColorSet) =>
  ({
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  }) as const;

const getAccentIconTextStyle = (colors: WorkbenchColorSet) =>
  ({
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 23,
  }) as const;

const getAccentActionTextStyle = (colors: WorkbenchColorSet) =>
  ({
    color: colors.accent,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
  }) as const;

const getChevronTextStyle = (colors: WorkbenchColorSet) =>
  ({
    color: colors.text,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
  }) as const;
