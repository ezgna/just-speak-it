import { SymbolView } from 'expo-symbols';
import { type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyPalette } from '@/components/just-speak-it-ui';
import { ThemedText } from '@/components/themed-text';
import { GlideButton } from '@/components/ui/glide-button';
import { GlideTextInput } from '@/components/ui/glide-text-input';
import { type GlideTone } from '@/components/ui/glide-frame';
import {
  FOUNDATION_SCROLL_PRESS_DELAY_MS,
  FoundationSurface,
  FoundationSurfacePressDelayProvider,
} from '@/components/ui/foundation-surface';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

const AdoptedFoundationDistance = 0.56;
const FoundationBorderColor = '#111111';

function ButtonSourceShelf() {
  return (
    <View style={styles.buttonSourceShelf}>
      <View style={styles.buttonSourceCopy}>
        <ThemedText style={styles.buttonSourceTitle} selectable>
          Glide Button Source
        </ThemedText>
        <ThemedText style={styles.buttonSourceDescription} selectable>
          斜め下近接土台の元ボタン。サイズ差だけを比較するための基準。
        </ThemedText>
      </View>

      <View style={styles.buttonSourceGrid}>
        <ButtonSourceSample label="large">
          <GlideButton
            label="Speak it"
            tone="mint"
            caption="Core"
            icon={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
          />
        </ButtonSourceSample>

        <ButtonSourceSample label="medium">
          <GlideButton
            label="Done"
            tone="orange"
            size="medium"
            icon={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
          />
        </ButtonSourceSample>

        <ButtonSourceSample label="compact">
          <GlideButton
            label="Make cards"
            tone="blue"
            size="compact"
            fullWidth={false}
            icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
          />
        </ButtonSourceSample>
      </View>
    </View>
  );
}

function ButtonSourceSample({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.buttonSourceSample}>
      <ThemedText style={styles.buttonSourceLabel}>{label}</ThemedText>
      {children}
    </View>
  );
}

type GlideInputVariant = {
  accentTone: GlideTone;
  id: string;
  label: string;
  meta: string;
  textStyle: 'bold' | 'quiet' | 'wide';
  tone: GlideTone;
};

const ColorSystemColors = {
  core: '#2FDD6C',
  build: '#276EF1',
  warm: '#FF9F45',
  cool: '#65D7F2',
  shift: '#9B7CFF',
  accent: '#FF7661',
  spark: '#F4E75E',
  paper: '#FFF6E7',
} as const;

const GlideInputVariants: GlideInputVariant[] = [
  {
    id: 'cream-lift',
    label: 'Paper Core',
    meta: 'paper / core',
    tone: 'cream',
    accentTone: 'mint',
    textStyle: 'bold',
  },
  {
    id: 'mint-rail',
    label: 'Core Rail',
    meta: 'core / cool',
    tone: 'mint',
    accentTone: 'aqua',
    textStyle: 'wide',
  },
  {
    id: 'ink-press',
    label: 'Cool Press',
    meta: 'cool / shift',
    tone: 'aqua',
    accentTone: 'violet',
    textStyle: 'bold',
  },
  {
    id: 'coral-stamp',
    label: 'Warm Stamp',
    meta: 'accent / warm',
    tone: 'coral',
    accentTone: 'orange',
    textStyle: 'quiet',
  },
];

type ColorSystemRole = {
  color: string;
  id: string;
  label: string;
  note: string;
  role: string;
};

const CoreColorSystemRoles: ColorSystemRole[] = [
  {
    id: 'primary',
    role: 'Core',
    label: 'Speak it',
    color: ColorSystemColors.core,
    note: '入口 / 主役',
  },
  {
    id: 'done',
    role: 'Warm',
    label: 'Done',
    color: ColorSystemColors.warm,
    note: '完了 / 決定',
  },
  {
    id: 'process',
    role: 'Cool',
    label: 'Making it',
    color: ColorSystemColors.cool,
    note: '処理 / 変換',
  },
  {
    id: 'build',
    role: 'Build',
    label: 'Make cards',
    color: ColorSystemColors.build,
    note: '作成 / 次へ',
  },
  {
    id: 'alert',
    role: 'Accent',
    label: 'Alert',
    color: ColorSystemColors.accent,
    note: '注意 / 強調',
  },
  {
    id: 'fun',
    role: 'Spark',
    label: 'Play',
    color: ColorSystemColors.spark,
    note: '楽しさ / 報酬',
  },
  {
    id: 'paper',
    role: 'Paper',
    label: 'Surface',
    color: ColorSystemColors.paper,
    note: '背景 / 読み物',
  },
] as const;

function ColorSystemShelf() {
  return (
    <View style={styles.colorSystemShelf}>
      <View style={styles.colorSystemHeader}>
        <View style={styles.colorSystemCopy}>
          <ThemedText style={styles.colorSystemTitle}>Color System</ThemedText>
          <ThemedText style={styles.colorSystemDescription}>
            緑をCoreにして、作成・完了・処理を色相の違う役割色として固定する案。
          </ThemedText>
        </View>
        <View style={styles.colorSystemAxisBadge}>
          <ThemedText style={styles.colorSystemAxisText}>Hue Axis</ThemedText>
        </View>
      </View>

      <View style={styles.colorSystemSwatchGrid}>
        {CoreColorSystemRoles.map((role) => (
          <View key={role.id} style={styles.colorSystemSwatchCard}>
            <View style={[styles.colorSystemSwatch, { backgroundColor: role.color }]} />
            <View style={styles.colorSystemSwatchText}>
              <ThemedText style={styles.colorSystemRole}>{role.role}</ThemedText>
              <ThemedText style={styles.colorSystemLabel}>{role.label}</ThemedText>
              <ThemedText style={styles.colorSystemNote}>{role.note}</ThemedText>
              <ThemedText style={styles.colorSystemHex}>{role.color}</ThemedText>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.colorSystemFlow}>
        <GlideButton
          label="Speak it"
          caption="Core"
          tone="mint"
          icon={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
        />
        <GlideButton
          label="Done"
          caption="Warm"
          tone="orange"
          icon={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
        />
        <GlideButton
          label="Making it"
          caption="Cool"
          tone="aqua"
          busy
        />
        <GlideButton
          label="Make cards"
          caption="Build"
          tone="blue"
          icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
        />
      </View>
    </View>
  );
}

function GlideInputShelf() {
  return (
    <View style={styles.glideInputShelf}>
      <View style={styles.glideInputHeader}>
        <View style={styles.glideInputCopy}>
          <ThemedText style={styles.glideInputTitle}>Glide Input Set</ThemedText>
          <ThemedText style={styles.glideInputDescription}>
            今日タブの入力欄をGlide Buttonの土台・枠・色面に合わせる比較案。
          </ThemedText>
        </View>
        <View style={styles.glideInputBadge}>
          <ThemedText style={styles.glideInputBadgeText}>Draft Field</ThemedText>
        </View>
      </View>

      <View style={styles.glideInputGrid}>
        {GlideInputVariants.map((variant) => (
          <GlideInputCard key={variant.id} variant={variant} />
        ))}
      </View>
    </View>
  );
}

function GlideInputCard({ variant }: { variant: GlideInputVariant }) {
  const textStyle =
    variant.textStyle === 'wide'
      ? styles.glideInputTextWide
      : variant.textStyle === 'quiet'
        ? styles.glideInputTextQuiet
        : styles.glideInputTextBold;

  return (
    <View style={styles.glideInputCell}>
      <ThemedText style={styles.glideInputLabel}>{variant.label}</ThemedText>
      <GlideTextInput
        tone={variant.tone}
        accentTone={variant.accentTone}
        meta={variant.meta}
        editable={false}
        value="今日は帰り道に、駅前でコーヒーを買って少し遠回りしました。"
        accessibilityLabel={`${variant.label}入力欄案`}
        containerStyle={styles.glideInputSurface}
        frameStyle={styles.glideInputCard}
        inputStyle={[styles.glideInputPreview, textStyle]}
      />
    </View>
  );
}

type DiaryConceptEntry = {
  id: string;
  body: string;
};

type DiaryButtonVariant =
  | 'spine'
  | 'tray'
  | 'nMint'
  | 'nAmber'
  | 'nBlue'
  | 'nCoral'
  | 'nDiaryBlue'
  | 'nIceBlue'
  | 'nSkyBlue';

type DiaryButtonVariantSample = { id: DiaryButtonVariant; label: string; entryIndex: number };

const DiaryConceptEntries: DiaryConceptEntry[] = [
  {
    id: 'bakery',
    body: '今日は帰り道に、ずっと気になっていたパン屋に寄りました。店内は思っていたより静かで、夕方の光が棚の奥まで入っていて、少しだけ気持ちが落ち着きました。',
  },
  {
    id: 'meeting',
    body: '朝の会議で話した内容を、あとで英語でも説明できるようにしたいと思いました。言いたいこと自体はあるのに、英語にしようとすると急に細かい部分が抜けてしまいます。',
  },
  {
    id: 'shopping',
    body: '今日は少し疲れていたけれど、帰る前に買い物だけ済ませました。早く帰りたい気持ちもあったけれど、明日の朝に慌てずに済むと思うと、やっておいてよかったです。',
  },
];

const DiaryButtonVariants: DiaryButtonVariantSample[] = [
  { id: 'spine', label: 'C', entryIndex: 2 },
  { id: 'tray', label: 'K', entryIndex: 1 },
];

const DiaryCardSourceVariants: DiaryButtonVariantSample[] = [
  { id: 'nMint', label: 'Mint', entryIndex: 0 },
  { id: 'nAmber', label: 'Amber', entryIndex: 0 },
  { id: 'nBlue', label: 'Cobalt', entryIndex: 0 },
  { id: 'nCoral', label: 'Coral', entryIndex: 0 },
  { id: 'nDiaryBlue', label: 'Seafoam', entryIndex: 0 },
  { id: 'nIceBlue', label: 'Ice', entryIndex: 0 },
  { id: 'nSkyBlue', label: 'Sky', entryIndex: 0 },
];

const PaperPressRestOffset = 7;
const StaticPaperInset = 3;

const StaticPaperPressVariants = [
  {
    id: 'coralTray',
    label: 'Coral Tray',
    trayColor: '#FF7661',
    paperColor: '#FFF0EC',
    trayBorderWidth: 4,
    paperBorderWidth: 0,
  },
] as const;

const DynamicStampVariants = [
  {
    id: 'tightSnapStamp',
    label: 'Tight Snap',
    offset: 5,
    foundationColor: '#2FDD6C',
    foundationBorderWidth: 0,
    frontColor: '#111111',
    textColor: '#FFF9EC',
    pressedOffset: 5,
    pressOutDuration: 240,
  },
  {
    id: 'tightShallowStamp',
    label: 'Tight Shallow Dark',
    offset: 4,
    foundationColor: '#2FDD6C',
    foundationBorderWidth: 0,
    frontColor: '#111111',
    textColor: '#FFF9EC',
    pressedOffset: 4,
    pressOutDuration: 240,
  },
  {
    id: 'tightShallowLightStamp',
    label: 'Tight Shallow Light',
    offset: 4,
    foundationColor: '#2FDD6C',
    foundationBorderWidth: 0,
    frontColor: '#EEEEEE',
    textColor: '#000613',
    pressedOffset: 4,
    pressOutDuration: 240,
  },
  {
    id: 'matchedStamp',
    label: 'Matched Mint Dark',
    offset: PaperPressRestOffset,
    foundationColor: '#2FDD6C',
    foundationBorderWidth: 0,
    frontColor: '#111111',
    textColor: '#FFF9EC',
    pressedOffset: undefined,
    pressOutDuration: 270,
  },
  {
    id: 'matchedLightMintPairStamp',
    label: 'Matched Mint Light',
    offset: PaperPressRestOffset,
    foundationColor: '#2FDD6C',
    foundationBorderWidth: 0,
    frontColor: '#EEEEEE',
    textColor: '#000613',
    pressedOffset: undefined,
    pressOutDuration: 270,
  },
  {
    id: 'matchedAmberStamp',
    label: 'Matched Amber',
    offset: PaperPressRestOffset,
    foundationColor: '#FFE2A6',
    foundationBorderWidth: 0,
    frontColor: '#111111',
    textColor: '#FFF9EC',
    pressedOffset: undefined,
    pressOutDuration: 270,
  },
  {
    id: 'matchedCoralStamp',
    label: 'Matched Coral',
    offset: PaperPressRestOffset,
    foundationColor: '#FF7661',
    foundationBorderWidth: 0,
    frontColor: '#111111',
    textColor: '#FFF9EC',
    pressedOffset: undefined,
    pressOutDuration: 270,
  },
  {
    id: 'matchedSeafoamStamp',
    label: 'Matched Seafoam',
    offset: PaperPressRestOffset,
    foundationColor: '#9EDCCC',
    foundationBorderWidth: 0,
    frontColor: '#111111',
    textColor: '#FFF9EC',
    pressedOffset: undefined,
    pressOutDuration: 270,
  },
  {
    id: 'matchedIceStamp',
    label: 'Matched Ice',
    offset: PaperPressRestOffset,
    foundationColor: '#B7E3F0',
    foundationBorderWidth: 0,
    frontColor: '#111111',
    textColor: '#FFF9EC',
    pressedOffset: undefined,
    pressOutDuration: 270,
  },
  {
    id: 'matchedSkyStamp',
    label: 'Matched Sky',
    offset: PaperPressRestOffset,
    foundationColor: '#9FD0F8',
    foundationBorderWidth: 0,
    frontColor: '#111111',
    textColor: '#FFF9EC',
    pressedOffset: undefined,
    pressOutDuration: 270,
  },
  {
    id: 'matchedCobaltStamp',
    label: 'Matched Cobalt',
    offset: PaperPressRestOffset,
    foundationColor: '#276EF1',
    foundationBorderWidth: 0,
    frontColor: '#111111',
    textColor: '#FFF9EC',
    pressedOffset: undefined,
    pressOutDuration: 270,
  },
  {
    id: 'matchedDarkWarmStamp',
    label: 'Dark Warm',
    offset: PaperPressRestOffset,
    foundationColor: '#2A231F',
    foundationBorderWidth: 0,
    frontColor: '#111111',
    textColor: '#FFF9EC',
    pressedOffset: undefined,
    pressOutDuration: 270,
  },
  {
    id: 'matchedLightInverseStamp',
    label: 'Light Inverse',
    offset: PaperPressRestOffset,
    foundationColor: '#D2D2D2',
    foundationBorderWidth: 0,
    frontColor: '#EEEEEE',
    textColor: '#000613',
    pressedOffset: undefined,
    pressOutDuration: 270,
  },
  {
    id: 'matchedLightCreamStamp',
    label: 'Light Cream',
    offset: PaperPressRestOffset,
    foundationColor: '#2FDD6C',
    foundationBorderWidth: 0,
    frontColor: '#FFF9EC',
    textColor: '#111111',
    pressedOffset: undefined,
    pressOutDuration: 270,
  },
  {
    id: 'matchedLightWarmStamp',
    label: 'Light Warm',
    offset: PaperPressRestOffset,
    foundationColor: '#FFE2A6',
    foundationBorderWidth: 0,
    frontColor: '#FFF6E6',
    textColor: '#111111',
    pressedOffset: undefined,
    pressOutDuration: 270,
  },
  {
    id: 'matchedLightCoralStamp',
    label: 'Light Coral',
    offset: PaperPressRestOffset,
    foundationColor: '#FF7661',
    foundationBorderWidth: 0,
    frontColor: '#FFF0EC',
    textColor: '#111111',
    pressedOffset: undefined,
    pressOutDuration: 270,
  },
  {
    id: 'matchedLightIceStamp',
    label: 'Light Ice',
    offset: PaperPressRestOffset,
    foundationColor: '#B7E3F0',
    foundationBorderWidth: 0,
    frontColor: '#F0FAFD',
    textColor: '#111111',
    pressedOffset: undefined,
    pressOutDuration: 270,
  },
  {
    id: 'matchedLightMintStamp',
    label: 'Light Mint',
    offset: PaperPressRestOffset,
    foundationColor: '#2FDD6C',
    foundationBorderWidth: 0,
    frontColor: '#EAFBF0',
    textColor: '#111111',
    pressedOffset: undefined,
    pressOutDuration: 270,
  },
  {
    id: 'deepStamp',
    label: 'Deep',
    offset: 9,
    foundationColor: '#2FDD6C',
    foundationBorderWidth: 0,
    frontColor: '#111111',
    textColor: '#FFF9EC',
    pressedOffset: undefined,
    pressOutDuration: 290,
  },
] as const;

const ChicAccentModes = {
  dark: {
    label: 'Dark',
    frontColor: '#111111',
    textColor: '#FFF9EC',
  },
  light: {
    label: 'Light',
    frontColor: '#EEEEEE',
    textColor: '#000613',
  },
} as const;

const ChicAccentVariants = [
  {
    id: 'chicSage',
    label: 'Sage',
    accentColor: '#74836F',
  },
  {
    id: 'chicBrass',
    label: 'Brass',
    accentColor: '#B79A5B',
  },
  {
    id: 'chicOxblood',
    label: 'Oxblood',
    accentColor: '#8B3E46',
  },
  {
    id: 'chicSlate',
    label: 'Slate',
    accentColor: '#596D7E',
  },
  {
    id: 'chicPlum',
    label: 'Plum',
    accentColor: '#72536B',
  },
  {
    id: 'chicTaupe',
    label: 'Taupe',
    accentColor: '#958B7E',
  },
] as const;

const noopPress = () => {};

const NFoundationColors: Partial<Record<DiaryButtonVariant, string>> = {
  nMint: '#2FDD6C',
  nAmber: '#FFE2A6',
  nBlue: '#276EF1',
  nCoral: '#FF7661',
  nDiaryBlue: '#9EDCCC',
  nIceBlue: '#B7E3F0',
  nSkyBlue: '#9FD0F8',
};

const NCardColors: Partial<Record<DiaryButtonVariant, string>> = {
  nMint: '#EAFBF0',
  nBlue: '#EAF2FF',
  nCoral: '#FFF0EC',
  nDiaryBlue: '#ECF9F5',
  nIceBlue: '#F0FAFD',
  nSkyBlue: '#EEF7FF',
};

const NMatchedFoundationOffset: Partial<Record<DiaryButtonVariant, number>> = {
  nMint: PaperPressRestOffset,
  nAmber: PaperPressRestOffset,
  nBlue: PaperPressRestOffset,
  nCoral: PaperPressRestOffset,
  nDiaryBlue: PaperPressRestOffset,
  nIceBlue: PaperPressRestOffset,
  nSkyBlue: PaperPressRestOffset,
};

const NMatchedFoundationBorderWidth: Partial<Record<DiaryButtonVariant, number>> = {
  nMint: 4,
  nAmber: 4,
  nBlue: 4,
  nCoral: 4,
  nDiaryBlue: 4,
  nIceBlue: 4,
  nSkyBlue: 4,
};

const NConcentricFoundationRadiusVariants: Partial<Record<DiaryButtonVariant, boolean>> = {
  nMint: true,
  nAmber: true,
  nBlue: true,
  nCoral: true,
  nDiaryBlue: true,
  nIceBlue: true,
  nSkyBlue: true,
};

const NMatchedPressDiagonalRatio: Partial<Record<DiaryButtonVariant, number>> = {
  nMint: 1,
  nAmber: 1,
  nBlue: 1,
  nCoral: 1,
  nDiaryBlue: 1,
  nIceBlue: 1,
  nSkyBlue: 1,
};

function DiaryButtonConcepts() {
  return (
    <View style={styles.diaryVariantGrid}>
      {DiaryButtonVariants.map((variant) => (
        <View key={variant.id} style={styles.diaryVariantCell}>
          <View style={styles.diaryVariantBadge}>
            <ThemedText style={styles.diaryVariantBadgeText}>{variant.label}</ThemedText>
          </View>
          <DiaryConceptButton
            entry={DiaryConceptEntries[variant.entryIndex]}
            variant={variant.id}
          />
        </View>
      ))}
    </View>
  );
}

function DiaryCardSourceShelf() {
  return (
    <View style={styles.diarySourceShelf}>
      <View style={styles.diarySourceHeader}>
        <ThemedText style={styles.diarySourceTitle}>Dynamic Paper Set</ThemedText>
        <View style={styles.diarySourceRange}>
          <ThemedText style={styles.diarySourceRangeText}>Press Surface</ThemedText>
        </View>
      </View>

      <View style={styles.diarySourceGrid}>
        {DiaryCardSourceVariants.map((variant) => (
          <View key={variant.id} style={styles.diarySourceCell}>
            <View style={styles.diarySourceLabel}>
              <ThemedText style={styles.diarySourceLabelText}>{variant.label}</ThemedText>
            </View>
            <DiaryConceptButton
              entry={DiaryConceptEntries[variant.entryIndex]}
              variant={variant.id}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function StaticPaperPressShelf() {
  return (
    <View style={styles.staticPaperShelf}>
      <View style={styles.staticPaperHeader}>
        <ThemedText style={styles.staticPaperTitle}>Static Paper Set</ThemedText>
        <View style={styles.staticPaperRange}>
          <ThemedText style={styles.staticPaperRangeText}>Read Surface</ThemedText>
        </View>
      </View>

      <View style={styles.staticPaperGrid}>
        {StaticPaperPressVariants.map((variant) => (
          <View key={variant.id} style={styles.staticPaperCell}>
            <View style={styles.staticPaperLabel}>
              <ThemedText style={styles.staticPaperLabelText}>{variant.label}</ThemedText>
            </View>
            <StaticPaperPressCard variant={variant} />
          </View>
        ))}
      </View>
    </View>
  );
}

function StaticPaperPressCard({ variant }: { variant: (typeof StaticPaperPressVariants)[number] }) {
  return (
    <View
      accessibilityRole="summary"
      style={[
        styles.staticPaperSurface,
        styles.staticPaperTray,
        {
          backgroundColor: variant.trayColor,
          borderWidth: variant.trayBorderWidth,
        },
      ]}>
      <View
        style={[
          styles.staticPaperTrayPaper,
          {
            backgroundColor: variant.paperColor,
            borderWidth: variant.paperBorderWidth,
          },
        ]}>
        <ThemedText style={styles.staticPaperBody}>{DiaryConceptEntries[0].body}</ThemedText>
      </View>
    </View>
  );
}

function DynamicStampShelf() {
  return (
    <View style={styles.dynamicStampShelf}>
      <View style={styles.dynamicStampHeader}>
        <ThemedText style={styles.dynamicStampTitle}>Dynamic Stamp Set</ThemedText>
        <View style={styles.dynamicStampRange}>
          <ThemedText style={styles.dynamicStampRangeText}>Stamp Motion</ThemedText>
        </View>
      </View>

      <View style={styles.dynamicStampGrid}>
        {DynamicStampVariants.map((variant) => (
          <View key={variant.id} style={styles.dynamicStampCell}>
            <View style={styles.dynamicStampLabel}>
              <ThemedText style={styles.dynamicStampLabelText}>{variant.label}</ThemedText>
            </View>
            <DynamicStampCard variant={variant} />
          </View>
        ))}
      </View>
    </View>
  );
}

function DynamicStampCard({ variant }: { variant: (typeof DynamicStampVariants)[number] }) {
  return (
    <FoundationSurface
      onPress={noopPress}
      haptic="selection"
      accessibilityLabel={`日記を開く: ${DiaryConceptEntries[1].body}`}
      foundationDepth={12}
      foundationDistanceScale={0.72}
      foundationDirection="diagonal"
      foundationColor={variant.foundationColor}
      foundationBorderColor="#111111"
      foundationBorderWidth={variant.foundationBorderWidth}
      foundationOffsetX={variant.offset}
      foundationOffsetY={variant.offset}
      foundationRadiusMode="concentric"
      pressedOffsetX={variant.pressedOffset}
      pressedOffsetY={variant.pressedOffset}
      pressTravelRatio={0.36}
      pressDiagonalRatio={1}
      pressInDuration={142}
      pressOutDuration={variant.pressOutDuration}
      containerStyle={styles.dynamicStampSurface}
      style={[styles.dynamicStampCard, { backgroundColor: variant.frontColor }]}>
      <ThemedText style={[styles.dynamicStampBody, { color: variant.textColor }]}>
        {DiaryConceptEntries[1].body}
      </ThemedText>
    </FoundationSurface>
  );
}

function ChicAccentShelf() {
  return (
    <View style={styles.chicAccentShelf}>
      <View style={styles.chicAccentHeader}>
        <ThemedText style={styles.chicAccentTitle}>Chic Accent Set</ThemedText>
        <View style={styles.chicAccentRange}>
          <ThemedText style={styles.chicAccentRangeText}>Muted Accent</ThemedText>
        </View>
      </View>

      <View style={styles.chicAccentGrid}>
        {ChicAccentVariants.map((variant) => (
          <View key={variant.id} style={styles.chicAccentCell}>
            <View style={styles.chicAccentLabelRow}>
              <View
                style={[
                  styles.chicAccentSwatch,
                  { backgroundColor: variant.accentColor },
                ]}
              />
              <ThemedText style={styles.chicAccentLabelText}>{variant.label}</ThemedText>
            </View>

            <View style={styles.chicAccentPairRow}>
              <ChicAccentCard mode={ChicAccentModes.dark} accentColor={variant.accentColor} />
              <ChicAccentCard mode={ChicAccentModes.light} accentColor={variant.accentColor} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function ChicAccentCard({
  accentColor,
  mode,
}: {
  accentColor: string;
  mode: (typeof ChicAccentModes)[keyof typeof ChicAccentModes];
}) {
  return (
    <View style={styles.chicAccentSample}>
      <View style={styles.chicAccentTag}>
        <ThemedText style={styles.chicAccentTagText}>{mode.label}</ThemedText>
      </View>

      <FoundationSurface
        onPress={noopPress}
        haptic="selection"
        accessibilityLabel={`日記を開く: ${DiaryConceptEntries[1].body}`}
        foundationDepth={12}
        foundationDistanceScale={0.72}
        foundationDirection="diagonal"
        foundationColor={accentColor}
        foundationBorderColor="#111111"
        foundationBorderWidth={0}
        foundationOffsetX={PaperPressRestOffset}
        foundationOffsetY={PaperPressRestOffset}
        foundationRadiusMode="concentric"
        pressTravelRatio={0.36}
        pressDiagonalRatio={1}
        pressInDuration={142}
        pressOutDuration={270}
        containerStyle={styles.chicAccentSurface}
        style={[styles.chicAccentCard, { backgroundColor: mode.frontColor }]}>
        <ThemedText style={[styles.chicAccentBody, { color: mode.textColor }]}>
          {DiaryConceptEntries[1].body}
        </ThemedText>
      </FoundationSurface>
    </View>
  );
}

function DiaryConceptButton({
  entry,
  variant,
}: {
  entry: DiaryConceptEntry;
  variant: DiaryButtonVariant;
}) {
  if (variant === 'spine') {
    return (
      <FoundationSurface
        onPress={noopPress}
        haptic="selection"
        accessibilityLabel={`日記を開く: ${entry.body}`}
        foundationDepth={7}
        foundationDistanceScale={0.7}
        foundationDirection="down"
        foundationColor="#111111"
        pressTravelRatio={0.38}
        pressInDuration={132}
        pressOutDuration={228}
        containerStyle={styles.diaryConceptSurface}
        style={[styles.diaryConceptCard, styles.diarySpineCard]}>
        <View style={styles.diarySpineRail}>
          <View style={styles.diarySpineDot} />
          <View style={styles.diarySpineDot} />
        </View>
        <ThemedText style={styles.diaryConceptBody}>
          {entry.body}
        </ThemedText>
      </FoundationSurface>
    );
  }

  if (variant === 'tray') {
    return (
      <FoundationSurface
        onPress={noopPress}
        haptic="selection"
        accessibilityLabel={`日記を開く: ${entry.body}`}
        foundationDepth={9}
        foundationDistanceScale={0.6}
        foundationDirection="diagonal"
        foundationColor="#111111"
        pressTravelRatio={0.26}
        pressDiagonalRatio={0.16}
        pressInDuration={128}
        pressOutDuration={250}
        containerStyle={styles.diaryConceptSurface}
        style={[styles.diaryTrayCard]}>
        <View style={styles.diaryTrayPaper}>
          <ThemedText style={styles.diaryTrayBody}>
            {entry.body}
          </ThemedText>
        </View>
      </FoundationSurface>
    );
  }

  const nFoundationColor = NFoundationColors[variant];
  if (nFoundationColor) {
    return (
      <FoundationSurface
        onPress={noopPress}
        haptic="selection"
        accessibilityLabel={`日記を開く: ${entry.body}`}
        foundationDepth={12}
        foundationDistanceScale={0.72}
        foundationDirection="diagonal"
        foundationColor={nFoundationColor}
        foundationBorderColor="#111111"
        foundationBorderWidth={NMatchedFoundationBorderWidth[variant] ?? 3}
        foundationOffsetX={NMatchedFoundationOffset[variant]}
        foundationOffsetY={NMatchedFoundationOffset[variant]}
        foundationRadiusMode={NConcentricFoundationRadiusVariants[variant] ? 'concentric' : 'same'}
        pressTravelRatio={0.36}
        pressDiagonalRatio={NMatchedPressDiagonalRatio[variant] ?? 0.2}
        pressInDuration={142}
        pressOutDuration={270}
        containerStyle={styles.diaryConceptSurface}
        style={[
          styles.diaryConceptCard,
          styles.diaryBaseCreamCard,
          NCardColors[variant] ? { backgroundColor: NCardColors[variant] } : null,
        ]}>
        <ThemedText style={styles.diaryConceptBody}>
          {entry.body}
        </ThemedText>
      </FoundationSurface>
    );
  }

  return null;
}

function RaisedPanel({
  children,
  style,
  surfaceColor = '#FFF9EC',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  surfaceColor?: string;
}) {
  return (
    <FoundationSurface
      accessibilityRole="summary"
      foundationDepth={7}
      foundationDistanceScale={AdoptedFoundationDistance}
      foundationDirection="diagonal"
      foundationColor={FoundationBorderColor}
      style={[
        styles.raisedPanel,
        {
          backgroundColor: surfaceColor,
        },
        style,
      ]}>
      {children}
    </FoundationSurface>
  );
}

function PressboardHeader() {
  return (
    <View style={styles.pressboardHeader}>
      <View style={styles.brandStamp}>
        <SymbolView
          name={{ ios: 'pencil.and.list.clipboard', android: 'edit_note', web: 'edit_note' }}
          size={19}
          tintColor="#111111"
        />
      </View>
      <View style={styles.pressboardTitleBlock}>
        <ThemedText style={styles.pressboardTitle} selectable>
          Daily Pressboard
        </ThemedText>
        <ThemedText style={styles.pressboardSubtitle} selectable>
          日本語の紙片を押して、英語のカードへ送る
        </ThemedText>
      </View>
      <View style={styles.dayBadge}>
        <ThemedText style={styles.dayBadgeText}>DAY 18</ThemedText>
      </View>
    </View>
  );
}

function JapaneseSlip() {
  return (
    <RaisedPanel style={styles.japaneseSlip}>
      <View style={styles.slipTopRow}>
        <View style={styles.slipPin} />
        <ThemedText style={styles.slipLabel}>今日の日本語</ThemedText>
      </View>
      <ThemedText style={styles.japaneseText} selectable>
        今日は帰り道に、ずっと気になっていたパン屋に寄りました。
      </ThemedText>
      <View style={styles.slipFooter}>
        <ThemedText style={styles.slipFooterText}>1文</ThemedText>
        <ThemedText style={styles.slipFooterText}>18:42</ThemedText>
      </View>
    </RaisedPanel>
  );
}

function EnglishPlate() {
  return (
    <RaisedPanel surfaceColor="#111111" style={styles.englishPlate}>
      <View style={styles.plateHeader}>
        <ThemedText style={styles.plateLabel}>English Card</ThemedText>
        <View style={styles.plateDot} />
      </View>
      <ThemedText style={styles.englishText} selectable>
        I stopped by the bakery I had been curious about on my way home.
      </ThemedText>
      <View style={styles.phraseChipRow}>
        <View style={[styles.phraseChip, styles.mintChip]}>
          <ThemedText style={styles.phraseChipText}>on my way home</ThemedText>
        </View>
        <View style={[styles.phraseChip, styles.amberChip]}>
          <ThemedText style={styles.phraseChipText}>curious about</ThemedText>
        </View>
      </View>
    </RaisedPanel>
  );
}

function ActionWorkbench() {
  return (
    <View style={styles.workbenchActions}>
      <GlideButton
        label="英語にする"
        tone="blue"
        caption="今日の1文"
        icon={{ ios: 'arrow.forward', android: 'arrow_forward', web: 'arrow_forward' }}
      />
      <View style={styles.compactActionRow}>
        <GlideButton
          label="下書き"
          tone="cream"
          icon={{ ios: 'tray.and.arrow.down.fill', android: 'save', web: 'save' }}
          iconSide="left"
          size="compact"
          fullWidth={false}
        />
        <GlideButton
          label="音声"
          tone="amber"
          icon={{ ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' }}
          iconSide="left"
          size="compact"
          fullWidth={false}
        />
      </View>
    </View>
  );
}

function ReviewDock() {
  return (
    <View style={styles.reviewDock}>
      <View style={styles.reviewQuestion}>
        <ThemedText style={styles.reviewLabel}>復習ドック</ThemedText>
        <ThemedText style={styles.reviewPrompt} selectable>
          「思ったより長く話した」を英語で言う
        </ThemedText>
      </View>
      <View style={styles.reviewActionRow}>
        <GlideButton
          label="もう一回"
          tone="amber"
          size="medium"
          containerStyle={styles.reviewAction}
        />
        <GlideButton
          label="言えた"
          tone="green"
          size="medium"
          containerStyle={styles.reviewAction}
        />
      </View>
    </View>
  );
}

function ProgressRail() {
  return (
    <View style={styles.progressRail}>
      <ProgressTile label="書いた" value="12" color="#2FDD6C" />
      <ProgressTile label="復習" value="8" color="#FFE2A6" />
      <ProgressTile label="連続" value="5" color="#FF7661" />
    </View>
  );
}

function ProgressTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <RaisedPanel surfaceColor={color} style={styles.progressTile}>
      <ThemedText style={styles.progressValue}>{value}</ThemedText>
      <ThemedText style={styles.progressLabel}>{label}</ThemedText>
    </RaisedPanel>
  );
}

export default function DesignLabScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const palette = useDailyPalette();
  const { width } = useWindowDimensions();
  const horizontalPaddingLeft = Math.max(safeAreaInsets.left, Spacing.three);
  const horizontalPaddingRight = Math.max(safeAreaInsets.right, Spacing.three);
  const containerMaxWidth: ViewStyle['maxWidth'] =
    process.env.EXPO_OS === 'web'
      ? (`min(${MaxContentWidth}px, 100vw)` as ViewStyle['maxWidth'])
      : MaxContentWidth;
  const boardColumnWidth: ViewStyle['width'] = width >= 760 ? '48.2%' : '100%';

  return (
    <FoundationSurfacePressDelayProvider pressDelay={FOUNDATION_SCROLL_PRESS_DELAY_MS}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={[styles.screen, { backgroundColor: palette.background }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four,
          },
        ]}>
        <View
          style={[
            styles.container,
            {
              maxWidth: containerMaxWidth,
              paddingLeft: horizontalPaddingLeft,
              paddingRight: horizontalPaddingRight,
            },
          ]}>
          <ButtonSourceShelf />

          <ColorSystemShelf />

          <GlideInputShelf />

          <DiaryCardSourceShelf />

          <StaticPaperPressShelf />

          <DynamicStampShelf />

          <ChicAccentShelf />

          <DiaryButtonConcepts />

          <View style={styles.pressboard}>
            <PressboardHeader />

            <View style={styles.boardBody}>
              <View style={[styles.boardColumn, { width: boardColumnWidth }]}>
                <JapaneseSlip />
                <ActionWorkbench />
              </View>

              <View style={[styles.boardColumn, { width: boardColumnWidth }]}>
                <EnglishPlate />
                <ReviewDock />
              </View>
            </View>

            <ProgressRail />
          </View>
        </View>
      </ScrollView>
    </FoundationSurfacePressDelayProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    boxSizing: 'border-box',
    paddingTop: Spacing.three,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    boxSizing: 'border-box',
    gap: Spacing.four,
  },
  buttonSourceShelf: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFF9EC',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  buttonSourceCopy: {
    gap: Spacing.one,
  },
  buttonSourceTitle: {
    color: '#111111',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: 900,
  },
  buttonSourceDescription: {
    color: '#5C4B32',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: 800,
  },
  buttonSourceGrid: {
    gap: Spacing.two,
  },
  buttonSourceSample: {
    alignItems: 'stretch',
    alignSelf: 'stretch',
    gap: Spacing.one,
  },
  buttonSourceLabel: {
    color: '#6E604C',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
  },
  colorSystemShelf: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFF6E7',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  colorSystemHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  colorSystemCopy: {
    flex: 1,
    minWidth: 220,
    gap: Spacing.one,
  },
  colorSystemTitle: {
    color: '#111111',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: 900,
  },
  colorSystemDescription: {
    color: '#5C4B32',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: 800,
  },
  colorSystemAxisBadge: {
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#65D7F2',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  colorSystemAxisText: {
    color: '#111111',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
  },
  colorSystemSwatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  colorSystemSwatchCard: {
    width: '48%',
    minWidth: 148,
    flexGrow: 1,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  colorSystemSwatch: {
    height: 54,
    borderBottomWidth: 3,
    borderColor: '#111111',
  },
  colorSystemSwatchText: {
    gap: 2,
    padding: Spacing.two,
  },
  colorSystemRole: {
    color: '#6E604C',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  colorSystemLabel: {
    color: '#111111',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: 900,
  },
  colorSystemNote: {
    color: '#4F4B43',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 800,
  },
  colorSystemHex: {
    color: '#6E604C',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: 900,
  },
  colorSystemFlow: {
    gap: Spacing.two,
  },
  glideInputShelf: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: ColorSystemColors.paper,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  glideInputHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  glideInputCopy: {
    flex: 1,
    minWidth: 220,
    gap: Spacing.one,
  },
  glideInputTitle: {
    color: '#111111',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: 900,
  },
  glideInputDescription: {
    color: '#4F4B43',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: 800,
  },
  glideInputBadge: {
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: ColorSystemColors.core,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  glideInputBadgeText: {
    color: '#111111',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
  },
  glideInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  glideInputCell: {
    flexGrow: 1,
    flexBasis: 280,
    gap: Spacing.one,
  },
  glideInputLabel: {
    color: '#4F4B43',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  glideInputSurface: {
    alignSelf: 'stretch',
  },
  glideInputCard: {
    minHeight: 190,
  },
  glideInputPreview: {
    minHeight: 116,
    padding: 0,
  },
  glideInputTextBold: {
    fontSize: 20,
    lineHeight: 31,
    fontWeight: 900,
  },
  glideInputTextWide: {
    fontSize: 19,
    lineHeight: 32,
    fontWeight: 800,
  },
  glideInputTextQuiet: {
    fontSize: 18,
    lineHeight: 30,
    fontWeight: 700,
  },
  diaryVariantGrid: {
    gap: Spacing.three,
  },
  diaryVariantCell: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  diaryVariantBadge: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#2FDD6C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaryVariantBadgeText: {
    color: '#111111',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: 900,
  },
  diarySourceShelf: {
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#E8F7F4',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  diarySourceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  diarySourceTitle: {
    color: '#111111',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: 900,
  },
  diarySourceRange: {
    borderRadius: 999,
    backgroundColor: '#111111',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  diarySourceRangeText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
  },
  diarySourceGrid: {
    gap: Spacing.three,
  },
  diarySourceCell: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  diarySourceLabel: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFF9EC',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  diarySourceLabelText: {
    color: '#111111',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: 900,
  },
  staticPaperShelf: {
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: '#FFF7F5',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  staticPaperHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  staticPaperTitle: {
    color: '#111111',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: 900,
  },
  staticPaperRange: {
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFF0EC',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  staticPaperRangeText: {
    color: '#111111',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
  },
  staticPaperGrid: {
    gap: Spacing.three,
  },
  staticPaperCell: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  staticPaperLabel: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#111111',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  staticPaperLabelText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: 900,
  },
  staticPaperSurface: {
    alignSelf: 'stretch',
  },
  staticPaperTray: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 24,
    borderCurve: 'continuous',
    borderColor: '#111111',
    minHeight: 148,
    padding: StaticPaperInset,
  },
  staticPaperTrayPaper: {
    flex: 1,
    borderRadius: 17,
    borderCurve: 'continuous',
    borderColor: '#111111',
    padding: Spacing.three,
  },
  staticPaperBody: {
    color: '#111111',
    fontSize: 18,
    lineHeight: 29,
    fontWeight: 800,
  },
  dynamicStampShelf: {
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#DDE7E1',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  dynamicStampHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  dynamicStampTitle: {
    color: '#111111',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: 900,
  },
  dynamicStampRange: {
    borderRadius: 999,
    backgroundColor: '#2FDD6C',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  dynamicStampRangeText: {
    color: '#111111',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
  },
  dynamicStampGrid: {
    gap: Spacing.three,
  },
  dynamicStampCell: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  dynamicStampLabel: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#111111',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  dynamicStampLabelText: {
    color: '#FFF9EC',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: 900,
  },
  dynamicStampSurface: {
    alignSelf: 'stretch',
  },
  dynamicStampCard: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: '#111111',
    minHeight: 140,
    padding: Spacing.three,
  },
  dynamicStampBody: {
    color: '#FFF9EC',
    fontSize: 18,
    lineHeight: 29,
    fontWeight: 900,
  },
  chicAccentShelf: {
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#DCD8CF',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  chicAccentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  chicAccentTitle: {
    color: '#111111',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: 900,
  },
  chicAccentRange: {
    borderRadius: 999,
    backgroundColor: '#111111',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chicAccentRangeText: {
    color: '#FFF9EC',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
  },
  chicAccentGrid: {
    gap: Spacing.three,
  },
  chicAccentCell: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  chicAccentLabelRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFF9EC',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chicAccentSwatch: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#111111',
  },
  chicAccentLabelText: {
    color: '#111111',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: 900,
  },
  chicAccentPairRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chicAccentSample: {
    flex: 1,
    minWidth: 154,
    gap: Spacing.one,
  },
  chicAccentTag: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#111111',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chicAccentTagText: {
    color: '#FFF9EC',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: 900,
  },
  chicAccentSurface: {
    alignSelf: 'stretch',
  },
  chicAccentCard: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 20,
    borderCurve: 'continuous',
    minHeight: 132,
    padding: Spacing.two,
  },
  chicAccentBody: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: 900,
  },
  diaryConceptCard: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 4,
    borderColor: '#111111',
    minHeight: 140,
    padding: Spacing.three,
  },
  diaryConceptBody: {
    flex: 1,
    flexShrink: 1,
    color: '#111111',
    fontSize: 18,
    lineHeight: 29,
    fontWeight: 900,
  },
  diarySpineCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.three,
    backgroundColor: '#FFFFFF',
    paddingLeft: Spacing.two,
  },
  diarySpineRail: {
    width: 20,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FF7661',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  diarySpineDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#111111',
  },
  diaryTrayCard: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 4,
    borderColor: '#111111',
    backgroundColor: '#2FDD6C',
    minHeight: 148,
    padding: Spacing.two,
  },
  diaryTrayPaper: {
    flex: 1,
    borderRadius: 17,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFF9EC',
    padding: Spacing.three,
  },
  diaryTrayBody: {
    flexShrink: 1,
    color: '#111111',
    fontSize: 17,
    lineHeight: 28,
    fontWeight: 900,
  },
  diaryConceptSurface: {
    alignSelf: 'stretch',
  },
  diaryBaseCreamCard: {
    backgroundColor: '#FFF9EC',
  },
  pressboard: {
    borderRadius: 26,
    borderCurve: 'continuous',
    borderWidth: 4,
    borderColor: '#111111',
    backgroundColor: '#F6E7C8',
    gap: Spacing.three,
    padding: Spacing.three,
    boxShadow: '0 18px 0 rgba(17, 17, 17, 0.12)',
  },
  pressboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandStamp: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#2FDD6C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressboardTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pressboardTitle: {
    color: '#111111',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: 900,
  },
  pressboardSubtitle: {
    color: '#3E3526',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 800,
  },
  dayBadge: {
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFF9EC',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dayBadgeText: {
    color: '#111111',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 900,
  },
  boardBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  boardColumn: {
    gap: Spacing.three,
  },
  raisedPanel: {
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  japaneseSlip: {
    minHeight: 188,
  },
  slipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  slipPin: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FF7661',
  },
  slipLabel: {
    color: '#5C4B32',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  japaneseText: {
    color: '#111111',
    fontSize: 22,
    lineHeight: 32,
    fontWeight: 900,
  },
  slipFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  slipFooterText: {
    color: '#6E604C',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  workbenchActions: {
    gap: Spacing.two,
  },
  compactActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  englishPlate: {
    minHeight: 188,
  },
  plateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  plateLabel: {
    color: '#A8F3C0',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  plateDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: '#276EF1',
  },
  englishText: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: 900,
  },
  phraseChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  phraseChip: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#111111',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mintChip: {
    backgroundColor: '#2FDD6C',
  },
  amberChip: {
    backgroundColor: '#FFE2A6',
  },
  phraseChipText: {
    color: '#111111',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: 900,
  },
  reviewDock: {
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: '#111111',
    backgroundColor: '#FFF9EC',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  reviewQuestion: {
    gap: Spacing.one,
  },
  reviewLabel: {
    color: '#088A81',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  reviewPrompt: {
    color: '#111111',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: 900,
  },
  reviewActionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  reviewAction: {
    flex: 1,
  },
  progressRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  progressTile: {
    flexGrow: 1,
    flexBasis: 120,
    padding: Spacing.two,
    gap: 0,
    alignItems: 'center',
  },
  progressValue: {
    color: '#111111',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  progressLabel: {
    color: '#111111',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
});
