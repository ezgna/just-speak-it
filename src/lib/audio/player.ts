import type { AudioPlayer } from 'expo-audio';

export function pauseAudioPlayerSafely(player: AudioPlayer) {
  try {
    player.pause();
  } catch {
    return;
  }
}

export async function seekAudioPlayerSafely(player: AudioPlayer, seconds: number) {
  try {
    await player.seekTo(seconds);
  } catch {
    return;
  }
}
