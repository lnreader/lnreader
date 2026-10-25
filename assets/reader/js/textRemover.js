// Text selection functionality
window.textRemover = new (function () {
  let selectionUI = null;
  let isUIActive = false;

  function createSelectionUI() {
    if (selectionUI) return selectionUI;

    const { div, button } = van.tags;
    selectionUI = div(
      {
        id: 'text-selection-ui',
        role: 'group',
      },
      button(
        {
          type: 'button',
          onclick: e => {
            if (reader.hidden.val) {
              e.stopPropagation();
            }
            removeSelectedText();
          },
        },
        reader.strings.removeText,
      ),
      button(
        {
          type: 'button',
          onclick: e => {
            if (reader.hidden.val) {
              e.stopPropagation();
            }
            replaceSelectedText();
          },
        },
        reader.strings.replaceText,
      ),
    );

    document.body.appendChild(selectionUI);
    return selectionUI;
  }

  function showSelectionUI() {
    const ui = createSelectionUI();

    // Get selection bounds
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Get UI element heights from CSS variables (with fallbacks)
      const statusBarHeight =
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--StatusBar-currentHeight',
          ),
          10,
        ) || 24;
      const navigationBarHeight =
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--bottom-inset',
          ),
          10,
        ) || 24;
      const readerPadding =
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--readerSettings-padding',
          ),
          10,
        ) || 16;
      const uiHeight = 50; // Approximate height of our UI

      // Calculate available space
      const viewportHeight = window.innerHeight;
      const selectionCenterY = rect.top + rect.height / 2;
      const topSafeArea = statusBarHeight + readerPadding + 10;
      const bottomSafeArea = readerPadding + uiHeight + navigationBarHeight;

      // Position UI based on selection location
      let topPosition;
      if (selectionCenterY < (viewportHeight / 5) * 4) {
        // Selection is in top 4/5, position UI at bottom
        //TODO: make this dynamic
        const avoidScrollbar = reader.generalSettings.val.verticalSeekbar
          ? 0
          : 42;
        const avoidUI = !reader.hidden.val ? 46 + avoidScrollbar : 0;
        topPosition = viewportHeight - bottomSafeArea - avoidUI - 4;
        ui.style.top = topPosition + 'px';
        ui.style.bottom = 'auto';
      } else {
        // Selection is in bottom 1/5, position UI at top (accounting for status bar)
        topPosition = Math.max(topSafeArea, statusBarHeight + 20);
        const avoidUI = !reader.hidden.val ? 34 : 0;
        ui.style.top = topPosition + avoidUI + 'px';
        ui.style.bottom = 'auto';
      }

      // Center horizontally
      ui.style.left = '50%';
      ui.style.transform = 'translateX(-50%)';
    } else {
      // Fallback: position at top if no selection rect available
      ui.style.top = '20px';
      ui.style.left = '50%';
      ui.style.transform = 'translateX(-50%)';
      ui.style.bottom = 'auto';
    }

    ui.style.opacity = '1';
    ui.style.pointerEvents = 'auto';
    isUIActive = true;
  }

  function hideSelectionUI() {
    if (selectionUI) {
      selectionUI.style.opacity = '0';
      selectionUI.style.pointerEvents = 'none';
    }
    isUIActive = false;
  }

  function getSelectedText() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      return selection.toString().trim();
    }
    return '';
  }

  function removeSelectedText() {
    const selectedText = getSelectedText();
    if (selectedText) {
      reader.post({
        type: 'text-action',
        data: { remove: selectedText },
      });
    }
    hideSelectionUI();
    window.getSelection().removeAllRanges();
  }

  function replaceSelectedText() {
    const selectedText = getSelectedText();
    if (selectedText) {
      // For replace, we need user input, so send a different message
      reader.post({
        type: 'text-action',
        data: { replace: selectedText },
      });
    }
    hideSelectionUI();
    window.getSelection().removeAllRanges();
  }

  // Handle text selection
  document.addEventListener('selectionchange', function () {
    const selectedText = getSelectedText();
    if (selectedText) {
      showSelectionUI();
    } else if (!isUIActive) {
      hideSelectionUI();
    }
  });

  // Hide UI when clicking/tapping elsewhere
  document.addEventListener('touchstart', function (e) {
    if (isUIActive && selectionUI && !selectionUI.contains(e.target)) {
      const selectedText = getSelectedText();
      if (!selectedText) {
        hideSelectionUI();
      }
    }
  });

  document.addEventListener('click', function (e) {
    if (isUIActive && selectionUI && !selectionUI.contains(e.target)) {
      const selectedText = getSelectedText();
      if (!selectedText) {
        hideSelectionUI();
      }
    }
  });

  // Hide UI on scroll
  window.addEventListener('scroll', function () {
    hideSelectionUI();
  });
})();

/**
 * Directly replace text in every chapter in the DOM without reloading the
 * WebView. Also updates each chapter's raw HTML so the text-options deriver
 * (bionic reading, paragraph spacing) doesn't re-introduce the old text on its
 * next run.
 */
window.textRemover.replaceInChapters = function (from, to) {
  const m = from.match(/^\/(.*)\/([gmiyuvsd]*)$/);
  let pattern;
  if (m) {
    try {
      pattern = new RegExp(m[1], m[2]);
    } catch (_e) {
      return;
    }
  }
  for (const segment of reader.segments) {
    const html = segment.element.innerHTML;
    const result = pattern
      ? html.replace(pattern, to)
      : html.split(from).join(to);
    segment.element.innerHTML = result;
    segment.rawHTML = result;
    segment.appliedHTML = result;
  }
};

window.textRemover.performRemove = function (text) {
  window.textRemover.replaceInChapters(text, '');
};

window.textRemover.performReplace = function (from, to) {
  window.textRemover.replaceInChapters(from, to);
};
