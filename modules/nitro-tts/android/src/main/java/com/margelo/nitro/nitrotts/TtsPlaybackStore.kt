package com.margelo.nitro.nitrotts

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

internal object TtsPlaybackStore {
    private val ownerHandler = Handler(Looper.getMainLooper())
    private val stateListeners = TtsListenerRegistry<TtsPlaybackState>()
    private val progressListeners = TtsListenerRegistry<TtsProgress>()
    private val errorListeners = TtsListenerRegistry<String>()
    private val snapshotListeners = TtsListenerRegistry<TtsPlaybackSnapshot>()
    private val pendingInitialization = mutableListOf<(Result<Unit>) -> Unit>()

    private var applicationContext: Context? = null
    private var engine: TextToSpeech? = null
    private var boundEngineName: String? = null
    private var isReady = false
    private var paragraphs: List<TtsParagraph> = emptyList()
    private var currentIndex = 0
    private var metadata: TtsMetadata? = null
    private var settings = TtsSettings(null, null, 1.0, 1.0)
    private var state = TtsPlaybackState.IDLE
    private var generation = 0L

    fun prepare(context: Context, completion: (Result<Unit>) -> Unit) {
        runOnOwner {
            applicationContext = context.applicationContext
            if (isReady && boundEngineName == settings.engineName) {
                completion(Result.success(Unit))
                return@runOnOwner
            }

            pendingInitialization.add(completion)
            bindEngine(settings.engineName)
        }
    }

    /** Lists text-to-speech engines installed on the device. */
    fun listEngines(context: Context): List<TtsEngine> {
        val packageManager = context.packageManager
        val intent = Intent(TextToSpeech.Engine.INTENT_ACTION_TTS_SERVICE)
        val resolveInfos = packageManager.queryIntentServices(
            intent,
            PackageManager.GET_META_DATA,
        )
        return resolveInfos
            .map { resolveInfo ->
                TtsEngine(
                    name = resolveInfo.serviceInfo.packageName,
                    label = resolveInfo.serviceInfo.loadLabel(packageManager).toString(),
                )
            }
            .distinctBy { it.name }
            .sortedBy { it.label.lowercase() }
    }

    /** Lists voices offered by `engineName`, probing it independently of the active engine. */
    fun listVoices(
        context: Context,
        engineName: String?,
        completion: (Result<List<TtsVoice>>) -> Unit,
    ) {
        runOnOwner {
            var probe: TextToSpeech? = null
            val listener = TextToSpeech.OnInitListener { status ->
                runOnOwner {
                    val result = if (status == TextToSpeech.SUCCESS) {
                        val voices = probe?.voices
                            ?.map { voice ->
                                TtsVoice(
                                    identifier = voice.name,
                                    name = voice.name,
                                    language = voice.locale?.toLanguageTag(),
                                )
                            }
                            ?.sortedBy { it.name }
                            ?: emptyList()
                        Result.success(voices)
                    } else {
                        Result.failure(
                            IllegalStateException("The selected text-to-speech engine failed to initialize."),
                        )
                    }
                    probe?.shutdown()
                    probe = null
                    completion(result)
                }
            }
            probe = if (engineName != null) {
                TextToSpeech(context.applicationContext, listener, engineName)
            } else {
                TextToSpeech(context.applicationContext, listener)
            }
        }
    }

    /** (Re)binds [engine] to [engineName], shutting down any previously bound engine. */
    private fun bindEngine(engineName: String?) {
        val context = checkNotNull(applicationContext)
        isReady = false
        engine?.stop()
        engine?.shutdown()
        engine = null

        val listener = TextToSpeech.OnInitListener { status ->
            runOnOwner {
                if (status == TextToSpeech.SUCCESS) {
                    isReady = true
                    boundEngineName = engineName
                    engine?.setOnUtteranceProgressListener(progressListener)
                    completeInitialization(Result.success(Unit))
                } else {
                    engine = null
                    completeInitialization(
                        Result.failure(
                            IllegalStateException("The selected text-to-speech engine failed to initialize."),
                        ),
                    )
                }
            }
        }
        engine = if (engineName != null) {
            TextToSpeech(context, listener, engineName)
        } else {
            TextToSpeech(context, listener)
        }
    }

    fun load(
        nextParagraphs: Array<TtsParagraph>,
        initialIndex: Int,
        nextMetadata: TtsMetadata,
        nextSettings: TtsSettings,
    ) {
        requireReady()
        require(nextParagraphs.isNotEmpty()) { "The TTS queue cannot be empty." }

        generation += 1
        engine?.stop()
        paragraphs = nextParagraphs.filter { it.text.isNotBlank() }
        require(paragraphs.isNotEmpty()) { "The TTS queue contains no readable paragraphs." }
        currentIndex = initialIndex.coerceIn(paragraphs.indices)
        metadata = nextMetadata
        settings = nextSettings
        state = TtsPlaybackState.PAUSED
        emitProgress()
        emitState()

        val context = checkNotNull(applicationContext)
        TtsPlaybackService.start(context)
    }

    fun play() {
        requireReady()
        check(paragraphs.isNotEmpty()) { "Load a paragraph queue before starting TTS." }
        speakCurrent()
    }

    fun pause() {
        if (state != TtsPlaybackState.PLAYING) {
            return
        }
        generation += 1
        engine?.stop()
        state = TtsPlaybackState.PAUSED
        emitState()
    }

    fun stop() {
        generation += 1
        engine?.stop()
        paragraphs = emptyList()
        currentIndex = 0
        metadata = null
        state = TtsPlaybackState.IDLE
        emitState()
        applicationContext?.let { TtsPlaybackService.stop(it) }
    }

    fun skipPrevious() {
        check(paragraphs.isNotEmpty()) { "Load a paragraph queue before seeking." }
        currentIndex = (currentIndex - 1).coerceAtLeast(0)
        speakCurrent()
    }

    fun skipNext() {
        check(paragraphs.isNotEmpty()) { "Load a paragraph queue before seeking." }
        if (currentIndex >= paragraphs.lastIndex) {
            completeQueue()
            return
        }
        currentIndex += 1
        speakCurrent()
    }

    fun replayCurrent() {
        check(paragraphs.isNotEmpty()) { "Load a paragraph queue before replaying." }
        speakCurrent()
    }

    fun seekTo(index: Int) {
        check(paragraphs.isNotEmpty()) { "Load a paragraph queue before seeking." }
        currentIndex = index.coerceIn(paragraphs.indices)
        speakCurrent()
    }

    fun updateSettings(nextSettings: TtsSettings) {
        requireReady()
        val shouldResume = state == TtsPlaybackState.PLAYING
        settings = nextSettings
        if (shouldResume) {
            speakCurrent()
        }
    }

    fun addStateListener(listener: (TtsPlaybackState) -> Unit): () -> Unit {
        runOnOwner { listener(state) }
        return stateListeners.add(listener)
    }

    fun addProgressListener(listener: (TtsProgress) -> Unit): () -> Unit {
        runOnOwner { currentProgress()?.let(listener) }
        return progressListeners.add(listener)
    }

    fun addErrorListener(listener: (String) -> Unit): () -> Unit {
        return errorListeners.add(listener)
    }

    fun addSnapshotListener(listener: (TtsPlaybackSnapshot) -> Unit): () -> Unit {
        listener(snapshot())
        return snapshotListeners.add(listener)
    }

    fun snapshot(): TtsPlaybackSnapshot {
        return TtsPlaybackSnapshot(state, metadata, currentProgress())
    }

    private fun speakCurrent() {
        if (engine == null || settings.engineName != boundEngineName) {
            pendingInitialization.add { result ->
                result.fold(
                    onSuccess = { speakCurrent() },
                    onFailure = { fail("The selected text-to-speech engine failed to initialize.") },
                )
            }
            bindEngine(settings.engineName)
            return
        }

        val activeEngine = checkNotNull(engine)
        val paragraph = paragraphs[currentIndex]
        generation += 1
        val utteranceId = utteranceId(generation, currentIndex)

        activeEngine.setSpeechRate(settings.rate.toFloat().coerceIn(0.1f, 4.0f))
        activeEngine.setPitch(settings.pitch.toFloat().coerceIn(0.1f, 2.0f))
        applyVoice(activeEngine)

        val result = activeEngine.speak(
            paragraph.text,
            TextToSpeech.QUEUE_FLUSH,
            Bundle(),
            utteranceId,
        )
        if (result == TextToSpeech.ERROR) {
            fail("The text-to-speech engine rejected the current paragraph.")
            return
        }

        state = TtsPlaybackState.PLAYING
        emitProgress()
        emitState()
    }

    private fun applyVoice(activeEngine: TextToSpeech) {
        val voiceIdentifier = settings.voiceIdentifier
        if (voiceIdentifier.isNullOrBlank()) {
            activeEngine.setLanguage(Locale.getDefault())
            return
        }

        val selectedVoice = activeEngine.voices?.firstOrNull {
            it.name == voiceIdentifier
        }
        if (selectedVoice != null) {
            activeEngine.voice = selectedVoice
        }
    }

    private fun advance(utteranceId: String) {
        if (utteranceId != utteranceId(generation, currentIndex)) {
            return
        }
        if (currentIndex >= paragraphs.lastIndex) {
            completeQueue()
            return
        }
        currentIndex += 1
        speakCurrent()
    }

    private fun completeQueue() {
        state = TtsPlaybackState.COMPLETED
        emitState()
        applicationContext?.let { TtsPlaybackService.stop(it) }
    }

    private fun fail(message: String) {
        state = TtsPlaybackState.ERROR
        errorListeners.emit(message)
        emitState()
    }

    private fun emitState() {
        stateListeners.emit(state)
        snapshotListeners.emit(snapshot())
    }

    private fun emitProgress() {
        val progress = currentProgress() ?: return
        progressListeners.emit(progress)
        snapshotListeners.emit(snapshot())
    }

    private fun currentProgress(): TtsProgress? {
        val paragraph = paragraphs.getOrNull(currentIndex) ?: return null
        return TtsProgress(
            index = currentIndex.toDouble(),
            total = paragraphs.size.toDouble(),
            paragraphId = paragraph.id,
        )
    }

    private fun utteranceId(queueGeneration: Long, index: Int): String {
        return "lnreader-$queueGeneration-$index"
    }

    private fun completeInitialization(result: Result<Unit>) {
        val callbacks = pendingInitialization.toList()
        pendingInitialization.clear()
        callbacks.forEach { it(result) }
    }

    private fun requireReady() {
        check(isReady) { "The text-to-speech engine is not ready." }
    }

    private fun runOnOwner(operation: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            operation()
        } else {
            ownerHandler.post(operation)
        }
    }

    private val progressListener = object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String) {
            runOnOwner {
                if (utteranceId == utteranceId(generation, currentIndex)) {
                    state = TtsPlaybackState.PLAYING
                    emitState()
                }
            }
        }

        override fun onDone(utteranceId: String) {
            runOnOwner { advance(utteranceId) }
        }

        @Deprecated("Deprecated by Android")
        override fun onError(utteranceId: String) {
            runOnOwner {
                if (utteranceId == utteranceId(generation, currentIndex)) {
                    fail("The text-to-speech engine failed while speaking.")
                }
            }
        }

        override fun onError(utteranceId: String, errorCode: Int) {
            runOnOwner {
                if (utteranceId == utteranceId(generation, currentIndex)) {
                    fail("The text-to-speech engine failed with error code $errorCode.")
                }
            }
        }
    }
}
