package com.margelo.nitro.nitrotts

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
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

    private var audioManager: AudioManager? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var hasAudioFocus = false
    private var resumeOnFocusGain = false

    fun prepare(context: Context, completion: (Result<Unit>) -> Unit) {
        runOnOwner {
            applicationContext = context.applicationContext
            if (audioManager == null) {
                audioManager =
                    applicationContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            }
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

    /**
     * Manual pause (from the user, media notification, or MediaSession controls).
     * Always wins over a later focus regain — even if we're currently paused because of a
     * transient focus loss (e.g. a call), calling this makes sure TTS stays paused once the
     * call ends instead of auto-resuming.
     */
    fun pause() {
        resumeOnFocusGain = false
        abandonAudioFocus()
        pauseEngine()
    }

    fun stop() {
        generation += 1
        engine?.stop()
        paragraphs = emptyList()
        currentIndex = 0
        metadata = null
        state = TtsPlaybackState.IDLE
        resumeOnFocusGain = false
        abandonAudioFocus()
        emitState()
        applicationContext?.let { TtsPlaybackService.stop(it) }
    }

    /** Stops the engine and marks playback paused, without touching audio focus. */
    private fun pauseEngine() {
        if (state != TtsPlaybackState.PLAYING) {
            return
        }
        generation += 1
        engine?.stop()
        state = TtsPlaybackState.PAUSED
        emitState()
    }

    /**
     * Requests playback focus so the system can tell us to pause for a call or other audio
     * that genuinely needs exclusive use of the speaker. Duck-only interruptions (notification
     * sounds, alerts) are left alone - see [handleAudioFocusChange].
     */
    private fun requestAudioFocus(): Boolean {
        if (hasAudioFocus) return true
        val manager = audioManager ?: return false

        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attributes)
                .setOnAudioFocusChangeListener(audioFocusChangeListener, ownerHandler)
                .build()
            audioFocusRequest = request
            manager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        } else {
            @Suppress("DEPRECATION")
            manager.requestAudioFocus(
                audioFocusChangeListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN,
            ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        }
        hasAudioFocus = granted
        return granted
    }

    private fun abandonAudioFocus() {
        if (!hasAudioFocus) return
        val manager = audioManager
        if (manager != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest?.let { manager.abandonAudioFocusRequest(it) }
            } else {
                @Suppress("DEPRECATION")
                manager.abandonAudioFocus(audioFocusChangeListener)
            }
        }
        hasAudioFocus = false
    }

    private val audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        runOnOwner { handleAudioFocusChange(focusChange) }
    }

    private fun handleAudioFocusChange(focusChange: Int) {
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS -> {
                // Another app now owns audio focus outright (e.g. a call was answered).
                hasAudioFocus = false
                resumeOnFocusGain = false
                pauseEngine()
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                // Something needs exclusive use of the speaker for a short while
                // Pause and remember to resume once it's done.
                resumeOnFocusGain = state == TtsPlaybackState.PLAYING
                pauseEngine()
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                hasAudioFocus = true
                if (resumeOnFocusGain) {
                    resumeOnFocusGain = false
                    play()
                }
            }
        }
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

        if (!requestAudioFocus()) {
            fail("Couldn't get audio focus - another app or call may be using audio.")
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
        resumeOnFocusGain = false
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