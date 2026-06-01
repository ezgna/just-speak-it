import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { GlideButton } from '@/components/ui/glide-button';
import { Spacing } from '@/constants/theme';
import {
  deleteAllLocalRecordings,
  getLocalRecordingStats,
  isLocalRecordingSaveEnabled,
  isLocalRecordingSupported,
  setLocalRecordingSaveEnabled,
  subscribeToLocalRecordings,
  type LocalRecordingStats,
} from '@/lib/local-recordings';

const SettingsColors = {
  ink: '#111111',
  paper: '#FFF6E7',
  cream: '#FFFFFF',
  mint: '#2FDD6C',
  coral: '#FF7661',
  sky: '#65D7F2',
} as const;

export function LocalRecordingSettings() {
  const [isEnabled, setIsEnabled] = useState(isLocalRecordingSaveEnabled);
  const [stats, setStats] = useState<LocalRecordingStats>(() => getLocalRecordingStats());
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    return subscribeToLocalRecordings(() => {
      setIsEnabled(isLocalRecordingSaveEnabled());
      setStats(getLocalRecordingStats());
    });
  }, []);

  if (!isLocalRecordingSupported()) {
    return null;
  }

  function handleToggle(nextValue: boolean) {
    setIsEnabled(nextValue);
    setLocalRecordingSaveEnabled(nextValue);
  }

  function handleDeletePress() {
    Alert.alert('保存済み録音を削除', '端末に保存された録音ファイルをすべて削除します。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          setIsDeleting(true);
          void deleteAllLocalRecordings().finally(() => {
            setStats(getLocalRecordingStats());
            setIsDeleting(false);
          });
        },
      },
    ]);
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionKicker}>
          <ThemedText style={styles.sectionKickerText}>Voice</ThemedText>
        </View>
        <View style={styles.titleRow}>
          <ThemedText style={styles.sectionTitle} selectable>
            録音保存
          </ThemedText>
          <View style={styles.currentBadge}>
            <ThemedText style={styles.currentBadgeText}>
              {formatRecordingStats(stats)}
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.toggleRow}>
          <View style={styles.iconBadge}>
            <SymbolView
              name={{ ios: 'mic.badge.plus', android: 'mic', web: 'mic' }}
              size={20}
              tintColor={SettingsColors.ink}
            />
          </View>
          <View style={styles.toggleCopy}>
            <ThemedText style={styles.toggleLabel} selectable>
              端末に残す
            </ThemedText>
            <ThemedText style={styles.toggleCaption} selectable>
              カードから元の音声を再生できます。
            </ThemedText>
          </View>
          <Switch
            accessibilityLabel="録音を端末に保存"
            onValueChange={handleToggle}
            thumbColor={SettingsColors.cream}
            trackColor={{ false: '#D8D0C1', true: SettingsColors.mint }}
            value={isEnabled}
          />
        </View>

        <GlideButton
          label="保存済み録音を削除"
          accessibilityLabel="保存済み録音をすべて削除"
          icon={{ ios: 'trash.fill', android: 'delete', web: 'delete' }}
          tone="coral"
          size="medium"
          busy={isDeleting}
          disabled={stats.count === 0 || isDeleting}
          onPress={handleDeletePress}
        />
      </View>
    </View>
  );
}

function formatRecordingStats(stats: LocalRecordingStats) {
  if (stats.count === 0) {
    return '0件';
  }

  return `${stats.count}件 / ${formatBytes(stats.sizeBytes)}`;
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))}KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  sectionHeader: {
    gap: Spacing.two,
  },
  sectionKicker: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: SettingsColors.ink,
    backgroundColor: SettingsColors.sky,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  sectionKickerText: {
    color: SettingsColors.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sectionTitle: {
    color: SettingsColors.ink,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: 900,
  },
  currentBadge: {
    borderRadius: 999,
    borderWidth: 3,
    borderColor: SettingsColors.ink,
    backgroundColor: SettingsColors.cream,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  currentBadgeText: {
    color: SettingsColors.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 900,
  },
  panel: {
    gap: Spacing.three,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: SettingsColors.ink,
    backgroundColor: SettingsColors.paper,
    padding: Spacing.three,
  },
  iconBadge: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 3,
    borderColor: SettingsColors.ink,
    backgroundColor: SettingsColors.cream,
  },
  toggleCopy: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  toggleLabel: {
    color: SettingsColors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 900,
  },
  toggleCaption: {
    color: 'rgba(17, 17, 17, 0.66)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
  },
});
