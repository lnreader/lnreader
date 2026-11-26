package com.margelo.nitro.nitrochapterlist.core

/**
 * Where the highlighted row is relative to the viewport, reported to JS only
 * when it changes. Pure, so it's unit tested without a RecyclerView.
 */
class HighlightVisibility {
  enum class State(val jsName: String) {
    ABOVE("above"),
    VISIBLE("visible"),
    BELOW("below"),
  }

  var last: State? = null
    private set

  /**
   * [first] and [last] are the first and last (partly) visible row indices,
   * [highlighted] the highlighted row's index; any of them negative means
   * unknown (nothing laid out, or the highlighted row isn't loaded). Returns
   * the new state when it changed, otherwise null.
   */
  fun update(first: Int, last: Int, highlighted: Int): State? {
    val state = compute(first, last, highlighted) ?: return null
    if (state == this.last) return null
    this.last = state
    return state
  }

  /** Forget the last state, so the next known one is reported again. */
  fun reset() {
    last = null
  }

  companion object {
    fun compute(first: Int, last: Int, highlighted: Int): State? {
      if (highlighted < 0 || first < 0 || last < first) return null
      return when {
        highlighted < first -> State.ABOVE
        highlighted > last -> State.BELOW
        else -> State.VISIBLE
      }
    }
  }
}
