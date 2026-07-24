package com.margelo.nitro.nitrotts

internal data class TtsPlaybackSnapshot(
    val state: TtsPlaybackState,
    val metadata: TtsMetadata?,
    val progress: TtsProgress?,
)
