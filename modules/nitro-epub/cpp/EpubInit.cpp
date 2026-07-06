#include <NitroModules/HybridObjectRegistry.hpp>
#include "EpubHybridObject.hpp"

using namespace margelo::nitro;

__attribute__((constructor))
static void initEpub() {
  HybridObjectRegistry::registerHybridObjectConstructor(
    "Epub",
    []() -> std::shared_ptr<HybridObject> {
      return std::make_shared<EpubHybridObject>();
    }
  );
}
