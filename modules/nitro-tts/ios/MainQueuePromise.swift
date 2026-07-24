import Foundation
import NitroModules

enum MainQueuePromise {
  static func run(_ operation: @escaping () throws -> Void) -> Promise<Void> {
    let promise = Promise<Void>()
    DispatchQueue.main.async {
      do {
        try operation()
        promise.resolve()
      } catch {
        promise.reject(withError: error)
      }
    }
    return promise
  }
}
