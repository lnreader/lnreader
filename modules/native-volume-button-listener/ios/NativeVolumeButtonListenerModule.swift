import ExpoModulesCore
import Foundation

public class NativeVolumeButtonListenerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeVolumeButtonListener")

    Events("VolumeUp", "VolumeDown")
  }
}
