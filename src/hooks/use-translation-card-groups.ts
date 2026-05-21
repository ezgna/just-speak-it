import { useCallback, useEffect, useRef, useState } from 'react';

import {
  listTranslationCardGroups,
  type TranslationCardGroup,
} from '@/lib/backend/practice';
import { subscribeToPracticeRefresh } from '@/lib/practice-refresh';

type LoadMode = 'initial' | 'refresh' | 'sync';

export function useTranslationCardGroups() {
  const isMountedRef = useRef(false);
  const isLoadingGroupsRef = useRef(false);
  const shouldSyncAfterCurrentLoadRef = useRef(false);
  const [groups, setGroups] = useState<TranslationCardGroup[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queuedSyncVersion, setQueuedSyncVersion] = useState(0);

  const loadGroups = useCallback(async (mode: LoadMode = 'initial') => {
    if (isLoadingGroupsRef.current) {
      if (mode !== 'initial') {
        shouldSyncAfterCurrentLoadRef.current = true;
      }
      return;
    }

    isLoadingGroupsRef.current = true;
    const shouldShowInitialLoading = mode === 'initial';

    try {
      await Promise.resolve();

      if (!isMountedRef.current) {
        return;
      }

      if (shouldShowInitialLoading) {
        setIsInitialLoading(true);
      }
      if (mode === 'refresh') {
        setIsRefreshing(true);
      }

      setErrorMessage(null);

      const nextGroups = await listTranslationCardGroups();
      if (!isMountedRef.current) {
        return;
      }

      setGroups(nextGroups);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : '英語カードを読み込めませんでした。');
    } finally {
      isLoadingGroupsRef.current = false;

      if (!isMountedRef.current) {
        return;
      }

      if (shouldShowInitialLoading) {
        setIsInitialLoading(false);
      }
      if (mode === 'refresh') {
        setIsRefreshing(false);
      }

      const shouldRunQueuedSync = shouldSyncAfterCurrentLoadRef.current;
      shouldSyncAfterCurrentLoadRef.current = false;

      if (shouldRunQueuedSync) {
        setQueuedSyncVersion((currentVersion) => currentVersion + 1);
      }
    }
  }, []);

  const refreshGroups = useCallback(() => {
    void loadGroups('refresh');
  }, [loadGroups]);

  useEffect(() => {
    isMountedRef.current = true;
    const timeoutId = setTimeout(() => {
      void loadGroups('initial');
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      isMountedRef.current = false;
      shouldSyncAfterCurrentLoadRef.current = false;
    };
  }, [loadGroups]);

  useEffect(() => {
    return subscribeToPracticeRefresh(() => {
      void loadGroups('sync');
    });
  }, [loadGroups]);

  useEffect(() => {
    if (queuedSyncVersion === 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void loadGroups('sync');
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadGroups, queuedSyncVersion]);

  return {
    groups,
    isInitialLoading,
    isRefreshing,
    errorMessage,
    refreshGroups,
  };
}
