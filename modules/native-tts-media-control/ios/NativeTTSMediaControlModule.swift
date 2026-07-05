import ExpoModulesCore
import Foundation

public class NativeTTSMediaControlModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeTTSMediaControl")

    Events("TTSPlay", "TTSPause", "TTSStop", "TTSPrev", "TTSNext", "TTSRewind", "TTSSeekTo")

    Function("showMediaNotification") { (title: String, subtitle: String, coverUri: String, isPlaying: Bool) in
      // Not implemented on iOS
    }

    Function("updatePlaybackState") { (isPlaying: Bool) in
      // Not implemented on iOS
    }

    Function("updateProgress") { (current: Double, total: Double) in
      // Not implemented on iOS
    }

    Function("dismiss") {
      // Not implemented on iOS
    }
  }
}
