import { Host, FieldGroup, Picker, Row, Spacer, Text } from '@expo/ui';
import {
  Button as SwiftButton,
  HStack as SwiftHStack,
  Host as SwiftHost,
  Image as SwiftImage,
  Text as SwiftText,
  ZStack as SwiftZStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  animation,
  Animation,
  buttonStyle,
  controlSize,
  frame,
  opacity,
  padding,
  scrollIndicators,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { useGenerationMode } from '@/hooks/use-generation-mode';
import {
  type ThemePreference,
  useThemePreference,
} from '@/hooks/use-theme-preference';
import { type GenerationMode } from '@/lib/generation-mode';
import { isSupabaseConfigured, supabaseUrl } from '@/lib/supabase/client';

const ThemePreferenceOptions = [
  { label: '自動', value: 'system' },
  { label: 'ライト', value: 'light' },
  { label: 'ダーク', value: 'dark' },
] satisfies readonly { label: string; value: ThemePreference }[];

const GenerationModeOptions = [
  { caption: '自然な一文', label: '自然さ優先', value: 'natural' },
  { caption: '接続詞で分割', label: '短さ優先', value: 'compact' },
] satisfies readonly { caption: string; label: string; value: GenerationMode }[];

const MemoStackerCopyAccent = '#276EF1';
const fadeButtonStateAnimation = Animation.easeInOut({ duration: 0.16 });

export default function WorkbenchScreen() {
  const {
    resolvedColorScheme: colorScheme,
    setThemePreference,
    themePreference,
  } = useThemePreference();
  const { generationMode, setGenerationMode } = useGenerationMode();
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
          <FieldGroup.Section title="表示">
            <ThemePreferenceRow
              colors={colors}
              onValueChange={setThemePreference}
              selectedValue={themePreference}
            />
            <PaletteRow colors={colors} />
          </FieldGroup.Section>

          <FieldGroup.Section title="生成">
            <GenerationModeRow
              colors={colors}
              onValueChange={setGenerationMode}
              selectedValue={generationMode}
            />
            <FieldGroup.SectionFooter>
              <Text textStyle={getFooterTextStyle(colors)}>
                練習カード生成で使う文のまとめ方を切り替えます。
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          <FieldGroup.Section title="データ">
            <InfoRow colors={colors} label="ローカル保存" value="MMKV" valueTone="accent" />
            <InfoRow
              colors={colors}
              label="Supabase"
              value={isSupabaseConfigured ? '設定済み' : '未設定'}
              valueTone={isSupabaseConfigured ? 'accent' : 'secondary'}
            />
            <InfoRow colors={colors} label="プロジェクト" value={getSupabaseProjectLabel()} />
            <InfoRow colors={colors} label="セッション" value="必要時に匿名作成" />
            <FieldGroup.SectionFooter>
              <Text textStyle={getFooterTextStyle(colors)}>
                破壊的なリセット操作はまだ置かず、まず状態確認だけにしています。
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          <FieldGroup.Section title="画面ラボ">
            <ActionRow
              colors={colors}
              icon="◆"
              label="実験室を開く"
              onPress={() => router.push('/design-lab')}
              trailing="›"
            />
            <ActionRow
              colors={colors}
              icon="⌂"
              label="ホームを確認"
              onPress={() => router.push('/')}
              trailing="›"
            />
            <ActionRow
              colors={colors}
              icon="⚙"
              label="通常設定に戻る"
              onPress={() => router.push('/settings')}
              trailing="›"
            />
          </FieldGroup.Section>

          <FieldGroup.Section title="コピー状態">
            <Row alignment="center" spacing={10}>
              <Spacer flexible />
              <MemoStackerCopyButton colorScheme={colorScheme} />
              <Spacer flexible />
            </Row>
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
    </>
  );
}

function GenerationModeRow({
  colors,
  onValueChange,
  selectedValue,
}: {
  colors: WorkbenchColorSet;
  onValueChange: (nextMode: GenerationMode) => void;
  selectedValue: GenerationMode;
}) {
  return (
    <Row alignment="center" spacing={10}>
      <Text textStyle={getPrimaryTextStyle(colors)}>カード生成</Text>
      <Spacer flexible />
      <Picker<GenerationMode> selectedValue={selectedValue} onValueChange={onValueChange}>
        {GenerationModeOptions.map((option) => (
          <Picker.Item key={option.value} label={option.label} value={option.value} />
        ))}
      </Picker>
    </Row>
  );
}

function ThemePreferenceRow({
  colors,
  onValueChange,
  selectedValue,
}: {
  colors: WorkbenchColorSet;
  onValueChange: (nextPreference: ThemePreference) => void;
  selectedValue: ThemePreference;
}) {
  return (
    <Row alignment="center" spacing={10}>
      <Text textStyle={getPrimaryTextStyle(colors)}>テーマ</Text>
      <Spacer flexible />
      <Picker<ThemePreference> selectedValue={selectedValue} onValueChange={onValueChange}>
        {ThemePreferenceOptions.map((option) => (
          <Picker.Item key={option.value} label={option.label} value={option.value} />
        ))}
      </Picker>
    </Row>
  );
}

function PaletteRow({ colors }: { colors: WorkbenchColorSet }) {
  return (
    <Row alignment="center" spacing={10}>
      <Text textStyle={getPrimaryTextStyle(colors)}>パレット</Text>
      <Spacer flexible />
      <Text numberOfLines={1} textStyle={getCompactTextStyle(colors)}>
        {`背景 ${colors.background} / 文字 ${colors.text} / 強調 ${colors.accent}`}
      </Text>
    </Row>
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
  onPress,
  trailing,
}: {
  accent?: boolean;
  colors: WorkbenchColorSet;
  icon: string;
  label: string;
  onPress?: () => void;
  trailing?: string;
}) {
  return (
    <Row alignment="center" onPress={onPress} spacing={10}>
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

function MemoStackerCopyButton({ colorScheme }: { colorScheme: 'dark' | 'light' }) {
  const [isCopied, setIsCopied] = useState(false);

  function handleCopyPress() {
    setIsCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }

  return (
    <SwiftHost matchContents colorScheme={colorScheme}>
      <SwiftButton
        onPress={handleCopyPress}
        modifiers={[
          accessibilityLabel(isCopied ? '完了' : 'コピー'),
          frame({ minWidth: 140, minHeight: 44 }),
          padding({ top: 0, bottom: 0, leading: 18, trailing: 18 }),
          controlSize('large'),
          buttonStyle('glassProminent'),
          tint(MemoStackerCopyAccent),
        ]}>
        <SwiftZStack modifiers={[animation(fadeButtonStateAnimation, isCopied)]}>
          <SwiftHStack spacing={6} modifiers={[opacity(isCopied ? 0 : 1)]}>
            <SwiftImage systemName="doc.on.doc" size={15} />
            <SwiftText>コピー</SwiftText>
          </SwiftHStack>
          <SwiftHStack spacing={6} modifiers={[opacity(isCopied ? 1 : 0)]}>
            <SwiftImage systemName="checkmark" size={15} />
            <SwiftText>完了</SwiftText>
          </SwiftHStack>
        </SwiftZStack>
      </SwiftButton>
    </SwiftHost>
  );
}

function getSupabaseProjectLabel() {
  if (!supabaseUrl) {
    return 'なし';
  }

  try {
    return new URL(supabaseUrl).host;
  } catch {
    return '設定済み';
  }
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

const getCompactTextStyle = (colors: WorkbenchColorSet) =>
  ({
    color: colors.secondaryText,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
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
