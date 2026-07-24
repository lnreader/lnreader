import MediaPlayer

final class TtsRemoteCommandController {
  private let commandCenter = MPRemoteCommandCenter.shared()
  private var targets: [(MPRemoteCommand, Any)] = []

  init(
    onPlay: @escaping () -> Void,
    onPause: @escaping () -> Void,
    onStop: @escaping () -> Void,
    onPrevious: @escaping () -> Void,
    onNext: @escaping () -> Void
  ) {
    register(commandCenter.playCommand, action: onPlay)
    register(commandCenter.pauseCommand, action: onPause)
    register(commandCenter.stopCommand, action: onStop)
    register(commandCenter.previousTrackCommand, action: onPrevious)
    register(commandCenter.nextTrackCommand, action: onNext)
  }

  deinit {
    targets.forEach { command, target in
      command.removeTarget(target)
    }
  }

  private func register(_ command: MPRemoteCommand, action: @escaping () -> Void) {
    command.isEnabled = true
    let target = command.addTarget { _ in
      DispatchQueue.main.async {
        action()
      }
      return .success
    }
    targets.append((command, target))
  }
}
