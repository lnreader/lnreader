import NitroModules

final class HybridTtsFactory: HybridTtsFactorySpec {
  func createSession() throws -> Promise<any HybridTtsSessionSpec> {
    return Promise.resolved(withResult: HybridTtsSession())
  }
}
