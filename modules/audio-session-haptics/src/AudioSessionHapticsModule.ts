import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class AudioSessionHapticsModule extends NativeModule<{}> {
  setAllowedDuringRecording(allowed: boolean): Promise<void>;
}

const AudioSessionHaptics =
  requireOptionalNativeModule<AudioSessionHapticsModule>('AudioSessionHaptics');

export async function setAllowedDuringRecording(allowed: boolean) {
  await AudioSessionHaptics?.setAllowedDuringRecording(allowed);
}
