import ExpoModulesCore
import Foundation

public class NativeZipArchiveModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeZipArchive")

    AsyncFunction("unzip") { (sourceFilePath: String, distDirPath: String, promise: Promise) in
      promise.reject("NOT_IMPLEMENTED", "unzip is not implemented on iOS")
    }

    AsyncFunction("zip") { (sourceDirPath: String, zipFilePath: String, promise: Promise) in
      promise.reject("NOT_IMPLEMENTED", "zip is not implemented on iOS")
    }

    AsyncFunction("remoteUnzip") { (distDirPath: String, url: String, headers: [String: String], promise: Promise) in
      promise.reject("NOT_IMPLEMENTED", "remoteUnzip is not implemented on iOS")
    }

    AsyncFunction("remoteZip") { (sourceDirPath: String, url: String, headers: [String: String], promise: Promise) in
      promise.reject("NOT_IMPLEMENTED", "remoteZip is not implemented on iOS")
    }
  }
}
