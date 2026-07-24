import MediaPlayer

final class TtsNowPlayingController {
  func update(
    metadata: TtsMetadata?,
    state: TtsPlaybackState,
    progress: TtsProgress?
  ) {
    guard let metadata else {
      MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      return
    }

    MPNowPlayingInfoCenter.default().nowPlayingInfo = [
      MPMediaItemPropertyTitle: metadata.chapterName,
      MPMediaItemPropertyArtist: metadata.novelName,
      MPMediaItemPropertyPlaybackDuration: progress?.total ?? 0,
      MPNowPlayingInfoPropertyElapsedPlaybackTime: progress?.index ?? 0,
      MPNowPlayingInfoPropertyPlaybackRate: state == .playing ? 1.0 : 0.0,
    ]
  }

  func clear() {
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
  }
}
