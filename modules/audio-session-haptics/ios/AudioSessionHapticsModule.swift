import AVFAudio
import ExpoModulesCore

public class AudioSessionHapticsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AudioSessionHaptics")

    AsyncFunction("setAllowedDuringRecording") { (allowed: Bool) in
      #if os(iOS)
      if #available(iOS 13.0, *) {
        try AVAudioSession.sharedInstance()
          .setAllowHapticsAndSystemSoundsDuringRecording(allowed)
      }
      #endif
    }
    .runOnQueue(.main)
  }
}
