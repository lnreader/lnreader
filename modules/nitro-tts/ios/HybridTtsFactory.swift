import AVFAudio
import NitroModules

final class HybridTtsFactory: HybridTtsFactorySpec {
  func createSession() throws -> Promise<any HybridTtsSessionSpec> {
    return Promise.resolved(withResult: HybridTtsSession())
  }

  /// iOS has no concept of swappable synthesis engines, so this always
  /// resolves to an empty array; the reader UI hides engine selection there.
  func getEngines() throws -> Promise<[TtsEngine]> {
    return Promise.resolved(withResult: [])
  }

  /// iOS ignores `engineName` and lists the system's speech-synthesis voices.
  func getVoices(engineName: String?) throws -> Promise<[TtsVoice]> {
    let voices = AVSpeechSynthesisVoice.speechVoices()
      .map { voice in
        TtsVoice(
          identifier: voice.identifier,
          name: voice.name,
          language: voice.language
        )
      }
      .sorted { $0.name < $1.name }
    return Promise.resolved(withResult: voices)
  }
}
