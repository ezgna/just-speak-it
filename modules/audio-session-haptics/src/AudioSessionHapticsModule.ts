import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class AudioSessionHapticsModule extends NativeModule<{}> {
  setAllowedDuringRecording(allowed: boolean): Promise<void>;
}

const AudioSessionHaptics =
  requireOptionalNativeModule<AudioSessionHapticsModule>('AudioSessionHaptics');

let hasWarnedMissingModule = false;

function warnMissingModule() {
  if (!__DEV__ || hasWarnedMissingModule) {
    return;
  }

  hasWarnedMissingModule = true;
  console.warn(
    '[AudioSessionHaptics] Native module is not available. Rebuild the dev client with `npx expo run:ios` to enable haptics during recording.'
  );
}

export async function setAllowedDuringRecording(allowed: boolean) {
  if (!AudioSessionHaptics) {
    warnMissingModule();
    return;
  }

  await AudioSessionHaptics.setAllowedDuringRecording(allowed);
}
