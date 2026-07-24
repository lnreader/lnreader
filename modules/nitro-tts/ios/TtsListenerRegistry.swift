import Foundation

final class TtsListenerRegistry<Value> {
  private let lock = NSLock()
  private var listeners: [UUID: (Value) -> Void] = [:]

  func add(_ listener: @escaping (Value) -> Void) -> () -> Void {
    let id = UUID()
    lock.lock()
    listeners[id] = listener
    lock.unlock()

    return { [weak self] in
      self?.lock.lock()
      self?.listeners.removeValue(forKey: id)
      self?.lock.unlock()
    }
  }

  func emit(_ value: Value) {
    lock.lock()
    let snapshot = Array(listeners.values)
    lock.unlock()
    snapshot.forEach { $0(value) }
  }
}
