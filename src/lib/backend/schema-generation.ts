import { clearLegacyCardLearningStatuses } from '@/lib/card-learning-statuses';
import { deleteAllLocalRecordings } from '@/lib/local-recordings';
import { getLocalString, setLocalString } from '@/lib/local-storage';
import { supabase } from '@/lib/supabase/client';

export const BackendSchemaGeneration = 'practice-db-v2';

const BackendSchemaGenerationStorageKey = 'just-speak-it:backend-schema-generation:v1';

export async function ensureBackendSchemaGeneration() {
  const currentGeneration = getLocalString(BackendSchemaGenerationStorageKey);

  if (currentGeneration === BackendSchemaGeneration) {
    return;
  }

  await supabase?.auth.signOut({ scope: 'local' }).catch(() => undefined);
  clearLegacyCardLearningStatuses();
  await deleteAllLocalRecordings();
  setLocalString(BackendSchemaGenerationStorageKey, BackendSchemaGeneration);
}
