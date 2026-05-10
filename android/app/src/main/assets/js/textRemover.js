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
        style:
          'position: fixed; background: color-mix(in srgb, var(--theme-surface), transparent 10%); border-radius: 8px; padding: 8px; z-index: 100000; opacity: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.25); transition: opacity 150ms',
      },
      button(
        {
          style:
            'background: var(--theme-secondary); color: var(--theme-onSecondary); border: none; padding: 6px 12px; margin: 2px; border-radius: 4px; font-size: 12px; cursor: pointer;',
          onclick: e => {
            e.stopPropagation();
            removeSelectedText();
          },
        },
        'Remove',
      ),
      button(
        {
          style:
            'background: var(--theme-primary); color: var(--theme-onPrimary); border: none; padding: 6px 12px; margin: 2px; border-radius: 4px; font-size: 12px; cursor: pointer;',
          onclick: e => {
            e.stopPropagation();
            replaceSelectedText();
          },
        },
        'Replace',
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
      if (selectionCenterY < viewportHeight / 2) {
        // Selection is in top half, position UI at bottom
        //TODO: make this dynamic
        const avoidScrollbar = reader.generalSettings.val.verticalSeekbar
          ? 0
          : 42;
        const avoidUI = !reader.hidden.val ? 46 + avoidScrollbar : 0;
        topPosition = viewportHeight - bottomSafeArea - avoidUI - 4;
        ui.style.top = topPosition + 'px';
        ui.style.bottom = 'auto';
      } else {
        // Selection is in bottom half, position UI at top (accounting for status bar)
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
    isUIActive = true;
  }

  function hideSelectionUI() {
    if (selectionUI) {
      selectionUI.style.opacity = '0';
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
