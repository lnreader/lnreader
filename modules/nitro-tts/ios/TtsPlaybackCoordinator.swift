import AVFAudio
import Foundation
import NitroModules

final class TtsPlaybackCoordinator: NSObject, AVSpeechSynthesizerDelegate {
  static let shared = TtsPlaybackCoordinator()

  private let synthesizer = AVSpeechSynthesizer()
  private let stateListeners = TtsListenerRegistry<TtsPlaybackState>()
  private let progressListeners = TtsListenerRegistry<TtsProgress>()
  private let errorListeners = TtsListenerRegistry<String>()
  private let sleepTimerListeners = TtsListenerRegistry<TtsSleepTimerState>()
  private let nowPlaying = TtsNowPlayingController()

  private var paragraphs: [TtsParagraph] = []
  private var currentIndex = 0
  private var metadata: TtsMetadata?
  private var settings = TtsSettings(engineName: nil, voiceIdentifier: nil, rate: 1, pitch: 1)
  private var state: TtsPlaybackState = .idle
  private var activeUtterance: AVSpeechUtterance?
  private var expectContinuation = false
  private var sleepTimerMode: TtsSleepTimerMode?
  private var remainingSeconds = 0
  private var remainingChapters = 0
  private var sleepTimerExpired = false
  private var sleepTimer: Timer?

  private lazy var remoteCommands = TtsRemoteCommandController(
    onPlay: { [weak self] in self?.play() },
    onPause: { [weak self] in self?.pause() },
    onStop: { [weak self] in self?.stop() },
    onPrevious: { [weak self] in self?.skipPrevious() },
    onNext: { [weak self] in self?.skipNext() }
  )

  override private init() {
    super.init()
    synthesizer.delegate = self
    _ = remoteCommands
  }

  func load(
    paragraphs nextParagraphs: [TtsParagraph],
    initialIndex: Int,
    metadata nextMetadata: TtsMetadata,
    settings nextSettings: TtsSettings,
    options: TtsLoadOptions
  ) throws {
    precondition(Thread.isMainThread)
    let readableParagraphs = nextParagraphs.filter { !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    guard !readableParagraphs.isEmpty else {
      throw RuntimeError.error(withMessage: "The TTS queue contains no readable paragraphs.")
    }

    interruptSpeech()
    paragraphs = readableParagraphs
    currentIndex = min(max(initialIndex, 0), readableParagraphs.count - 1)
    metadata = nextMetadata
    settings = nextSettings
    expectContinuation = options.expectContinuation
    state = .paused
    emitProgress()
    emitState()
  }

  func play() {
    precondition(Thread.isMainThread)
    guard !paragraphs.isEmpty else {
      fail("Load a paragraph queue before starting TTS.")
      return
    }
    if synthesizer.isPaused {
      synthesizer.continueSpeaking()
      state = .playing
      startDurationTimerIfNeeded()
      emitState()
      return
    }
    speakCurrent()
  }

  func pause() {
    precondition(Thread.isMainThread)
    guard state == .playing else { return }
    synthesizer.pauseSpeaking(at: .immediate)
    sleepTimer?.invalidate()
    sleepTimer = nil
    state = .paused
    emitState()
  }

  func stop() {
    precondition(Thread.isMainThread)
    interruptSpeech()
    paragraphs = []
    currentIndex = 0
    metadata = nil
    expectContinuation = false
    cancelSleepTimer()
    state = .idle
    nowPlaying.clear()
    emitState()
    try? AVAudioSession.sharedInstance().setActive(
      false,
      options: .notifyOthersOnDeactivation
    )
  }

  func skipPrevious() {
    precondition(Thread.isMainThread)
    guard !paragraphs.isEmpty else { return }
    currentIndex = max(currentIndex - 1, 0)
    speakCurrent()
  }

  func skipNext() {
    precondition(Thread.isMainThread)
    guard !paragraphs.isEmpty else { return }
    guard currentIndex < paragraphs.count - 1 else {
      completeQueue()
      return
    }
    currentIndex += 1
    speakCurrent()
  }

  func replayCurrent() {
    precondition(Thread.isMainThread)
    guard !paragraphs.isEmpty else { return }
    speakCurrent()
  }

  func seekTo(index: Int) {
    precondition(Thread.isMainThread)
    guard !paragraphs.isEmpty else { return }
    currentIndex = min(max(index, 0), paragraphs.count - 1)
    speakCurrent()
  }

  func updateSettings(_ nextSettings: TtsSettings) {
    precondition(Thread.isMainThread)
    let shouldResume = state == .playing
    settings = nextSettings
    if shouldResume {
      speakCurrent()
    }
  }

  func setSleepTimer(_ config: TtsSleepTimerConfig) throws {
    sleepTimer?.invalidate()
    sleepTimer = nil
    sleepTimerExpired = false
    sleepTimerMode = config.mode
    switch config.mode {
    case .duration:
      guard let seconds = config.durationSeconds.map(Int.init), (60...86_340).contains(seconds) else {
        throw RuntimeError.error(withMessage: "Duration must be between 1 minute and 23 hours 59 minutes.")
      }
      remainingSeconds = seconds
      remainingChapters = 0
      startDurationTimerIfNeeded()
    case .chapters:
      guard let chapters = config.chapterCount.map(Int.init), (1...999).contains(chapters) else {
        throw RuntimeError.error(withMessage: "Chapter count must be between 1 and 999.")
      }
      remainingChapters = chapters
      remainingSeconds = 0
    }
    emitSleepTimer()
  }

  func cancelSleepTimer() {
    sleepTimer?.invalidate()
    sleepTimer = nil
    sleepTimerMode = nil
    remainingSeconds = 0
    remainingChapters = 0
    sleepTimerExpired = false
    emitSleepTimer()
  }

  func addStateListener(
    _ listener: @escaping (TtsPlaybackState) -> Void
  ) -> () -> Void {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      listener(self.state)
    }
    return stateListeners.add(listener)
  }

  func addProgressListener(
    _ listener: @escaping (TtsProgress) -> Void
  ) -> () -> Void {
    DispatchQueue.main.async { [weak self] in
      guard let progress = self?.currentProgress() else { return }
      listener(progress)
    }
    return progressListeners.add(listener)
  }

  func addErrorListener(_ listener: @escaping (String) -> Void) -> () -> Void {
    return errorListeners.add(listener)
  }

  func addSleepTimerListener(
    _ listener: @escaping (TtsSleepTimerState) -> Void
  ) -> () -> Void {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      listener(self.sleepTimerState())
    }
    return sleepTimerListeners.add(listener)
  }

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer,
    didFinish utterance: AVSpeechUtterance
  ) {
    guard utterance === activeUtterance else { return }
    activeUtterance = nil
    if currentIndex >= paragraphs.count - 1 {
      completeQueue()
    } else {
      currentIndex += 1
      speakCurrent()
    }
  }

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer,
    didCancel utterance: AVSpeechUtterance
  ) {
    if utterance === activeUtterance {
      activeUtterance = nil
    }
  }

  private func speakCurrent() {
    interruptSpeech()
    do {
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(.playback, mode: .spokenAudio)
      try audioSession.setActive(true)
    } catch {
      fail("Unable to activate the audio session: \(error.localizedDescription)")
      return
    }

    let paragraph = paragraphs[currentIndex]
    let utterance = AVSpeechUtterance(string: paragraph.text)
    utterance.rate = (
      Float(settings.rate) * AVSpeechUtteranceDefaultSpeechRate
    ).clamped(
      to: AVSpeechUtteranceMinimumSpeechRate...AVSpeechUtteranceMaximumSpeechRate
    )
    utterance.pitchMultiplier = Float(settings.pitch).clamped(to: 0.5...2.0)
    if let identifier = settings.voiceIdentifier {
      utterance.voice = AVSpeechSynthesisVoice(identifier: identifier)
    }
    activeUtterance = utterance
    synthesizer.speak(utterance)
    state = .playing
    startDurationTimerIfNeeded()
    emitProgress()
    emitState()
  }

  private func interruptSpeech() {
    if synthesizer.isSpeaking || synthesizer.isPaused {
      synthesizer.stopSpeaking(at: .immediate)
    }
    activeUtterance = nil
  }

  private func completeQueue() {
    sleepTimer?.invalidate()
    sleepTimer = nil
    if sleepTimerMode == .chapters {
      remainingChapters = max(0, remainingChapters - 1)
      if remainingChapters == 0 {
        sleepTimerMode = nil
        sleepTimerExpired = true
      }
      emitSleepTimer()
    }
    state = expectContinuation ? .loading : .completed
    emitState()
    if !expectContinuation {
      cancelSleepTimer()
      try? AVAudioSession.sharedInstance().setActive(
        false,
        options: .notifyOthersOnDeactivation
      )
    }
  }

  private func fail(_ message: String) {
    sleepTimer?.invalidate()
    sleepTimer = nil
    state = .error
    errorListeners.emit(message)
    emitState()
  }

  private func emitState() {
    stateListeners.emit(state)
    nowPlaying.update(
      metadata: metadata,
      state: state,
      progress: currentProgress()
    )
  }

  private func emitProgress() {
    guard let progress = currentProgress() else { return }
    progressListeners.emit(progress)
    nowPlaying.update(metadata: metadata, state: state, progress: progress)
  }

  private func currentProgress() -> TtsProgress? {
    guard paragraphs.indices.contains(currentIndex) else { return nil }
    return TtsProgress(
      index: Double(currentIndex),
      total: Double(paragraphs.count),
      paragraphId: paragraphs[currentIndex].id
    )
  }

  private func startDurationTimerIfNeeded() {
    guard sleepTimerMode == .duration, state == .playing, sleepTimer == nil else { return }
    sleepTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] timer in
      guard let self else {
        timer.invalidate()
        return
      }
      self.remainingSeconds = max(0, self.remainingSeconds - 1)
      if self.remainingSeconds == 0 {
        timer.invalidate()
        self.sleepTimer = nil
        self.sleepTimerMode = nil
        self.sleepTimerExpired = true
        self.pause()
      }
      self.emitSleepTimer()
    }
  }

  private func sleepTimerState() -> TtsSleepTimerState {
    return TtsSleepTimerState(
      active: sleepTimerMode != nil,
      expired: sleepTimerExpired,
      mode: sleepTimerMode,
      remainingSeconds: sleepTimerMode == .duration ? Double(remainingSeconds) : nil,
      remainingChapters: sleepTimerMode == .chapters ? Double(remainingChapters) : nil
    )
  }

  private func emitSleepTimer() {
    sleepTimerListeners.emit(sleepTimerState())
  }
}
