/**
 * Utility functions for DOM class operations with safety checks
 * @type {Object}
 */
const classOps = {
  /**
   * Adds a CSS class to a DOM element if it exists
   * @param {HTMLElement} node - The DOM element to modify
   * @param {string} token - The CSS class name to add
   */
  add: function (node, token) {
    if (!node || !node.classList || !token) return;
    node.classList.add(token);
  },
  /**
   * Removes a CSS class from a DOM element if it exists
   * @param {HTMLElement} node - The DOM element to modify
   * @param {string} token - The CSS class name to remove
   */
  remove: function (node, token) {
    if (!node || !node.classList || !token) return;
    node.classList.remove(token);
  },
};

/**
 * Keyboard module for managing Cangjie keyboard interactions and visual feedback
 * @returns {Object} Public API for keyboard operations
 */
const keyboard = (function () {
  const mapper =
    (window.CJL &&
      window.CJL.keyboardView &&
      window.CJL.keyboardView.getOriginalLabels()) ||
    {};
  function press() {}
  function hint() {}
  return { press: press, hint: hint, mapper: mapper, key: {} };
})();

/**
 * Radical categories and their Cangjie code mappings for practice modes
 * Each entry contains a Chinese character radical and its corresponding Cangjie code
 * @type {Object.<string, string[]>}
 */
const RADICAL_POOLS = {
  philosophy: ["日a", "月b", "金c", "木d", "水e", "火f", "土g"],
  stroke: ["竹h", "戈i", "十j", "大k", "中l", "一m", "弓n"],
  human: ["人o", "心p", "手q", "口r"],
  shape: ["尸s", "廿t", "山u", "女v", "田w", "卜y"],
};

// Add combined 'all' pool programmatically, preserving order by groups
RADICAL_POOLS.all = [].concat(
  RADICAL_POOLS.philosophy,
  RADICAL_POOLS.stroke,
  RADICAL_POOLS.human,
  RADICAL_POOLS.shape,
  "難x"
);

/**
 * Main quiz checking module that handles character practice and input validation
 * @returns {Object} Public API for quiz operations
 */
const questCheck = (function () {
  const controller = (window.CJL && window.CJL.controller) || null;
  return {
    check: function (string) {
      return controller ? controller.check(string) : false;
    },
    setMode: function (newIsRadicalMode, categoryKey) {
      if (controller) controller.setMode(!!newIsRadicalMode, categoryKey);
    },
    isRadical: function () {
      return controller ? controller.isRadical() : false;
    },
  };
})();

/**
 * Ensures the input bar has focus for keyboard input
 */
function focusOnKeyboard() {
  const input = document.getElementById("inputBar");
  if (!input) return;
  if (document.activeElement !== input) input.focus();
}

/**
 * Input event handler for the main input bar - processes Cangjie input
 */
document.getElementById("inputBar").oninput = function () {
  let string = this.value;
  const INVALID =
    (window.CJL &&
      window.CJL.constants &&
      window.CJL.constants.INVALID_KEY_REGEX) ||
    /[^a-y]/;
  if (INVALID.test(string)) {
    this.value = "";
    string = "";
  }

  const isCompleted = questCheck.check(string);
  const inRadical = questCheck.isRadical ? questCheck.isRadical() : false;
  if (inRadical || isCompleted) this.value = "";
};

focusOnKeyboard();

/**
 * Initialization for mode and category dropdown selectors
 */
(function () {
  let modeSelect = document.getElementById("modeSelect");
  let categorySelect = document.getElementById("categorySelect");
  if (!modeSelect || !categorySelect) return;

  /**
   * Applies the selected mode and category to the quiz system
   */
  function applyMode() {
    const isRoot = modeSelect.value === "radical";
    categorySelect.disabled = !isRoot;
    const cat = categorySelect.value || "philosophy";
    if (questCheck.setMode) questCheck.setMode(isRoot, cat);
    const input = document.getElementById("inputBar");
    if (input) input.value = "";
    focusOnKeyboard();
  }

  modeSelect.addEventListener("change", applyMode);
  categorySelect.addEventListener("change", applyMode);
  applyMode();
})();

/**
 * DOMContentLoaded event handler - initializes UI controls and event listeners
 */
document.addEventListener("DOMContentLoaded", () => {
  const toggleVisibilityBtn = document.getElementById("toggleVisibilityBtn");
  const keyboardMap = document.getElementById("keyboardMap");
  const toggleLayoutBtn = document.getElementById("toggleLayout");
  const inputBar = document.getElementById("inputBar");

  // Layout toggle state moved from inline HTML <script>
  let isEnglishLayout = false;
  let originalMapper = null;

  /**
   * Creates a snapshot of the original keyboard mapper for layout switching
   */
  function ensureOriginalMapperSnapshot() {
    if (originalMapper) return;
    originalMapper = {};
    for (const alpha in keyboard.mapper) {
      if (Object.prototype.hasOwnProperty.call(keyboard.mapper, alpha)) {
        originalMapper[alpha] = keyboard.mapper[alpha];
      }
    }
  }

  /**
   * Toggles between Cangjie and English keyboard layouts
   */
  function toggleLayout() {
    if (
      window.CJL &&
      window.CJL.controller &&
      window.CJL.controller.toggleLayout
    ) {
      window.CJL.controller.toggleLayout();
    }
    focusOnKeyboard();
  }

  if (toggleLayoutBtn) {
    toggleLayoutBtn.addEventListener("click", toggleLayout);
  }

  if (toggleVisibilityBtn && keyboardMap) {
    /**
     * Synchronizes the visibility button text and layout button state with keyboard visibility
     */
    const syncVisibilityState = () => {
      const isHidden = keyboardMap.classList.contains("hidden");
      toggleVisibilityBtn.textContent = isHidden ? "顯示鍵盤" : "隱藏鍵盤";
      if (toggleLayoutBtn) toggleLayoutBtn.disabled = isHidden;
    };

    // initialize state on load
    syncVisibilityState();

    toggleVisibilityBtn.addEventListener("click", () => {
      keyboardMap.classList.toggle("hidden");
      syncVisibilityState();
      focusOnKeyboard();
    });
  }

  // Overlay for focus-lost state with delayed show to avoid flashes
  if (keyboardMap) {
    let overlay = keyboardMap.querySelector(".focus-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "focus-overlay";
      overlay.textContent = "點擊這裡以繼續輸入";
      keyboardMap.appendChild(overlay);
    }

    let overlayShowTimer = null;

    /**
     * Shows the focus overlay if the input bar is not currently focused
     */
    function showOverlayIfStillBlurred() {
      const isFocused = document.activeElement === inputBar;
      keyboardMap.classList.toggle("no-focus", !isFocused);
    }

    /**
     * Schedules the overlay to show after a delay to avoid flashes
     */
    function scheduleOverlayShow() {
      if (overlayShowTimer) {
        clearTimeout(overlayShowTimer);
        overlayShowTimer = null;
      }
      overlayShowTimer = setTimeout(function () {
        overlayShowTimer = null;
        showOverlayIfStillBlurred();
      }, 200);
    }

    if (inputBar) {
      inputBar.addEventListener("focus", function () {
        if (overlayShowTimer) {
          clearTimeout(overlayShowTimer);
          overlayShowTimer = null;
        }
        keyboardMap.classList.remove("no-focus");
      });
      inputBar.addEventListener("blur", scheduleOverlayShow);
    }

    // Any focus elsewhere cancels pending show to avoid a flash
    document.addEventListener("focusin", function () {
      if (overlayShowTimer) {
        clearTimeout(overlayShowTimer);
        overlayShowTimer = null;
      }
      // Hide overlay while interacting with any control
      if (document.activeElement && document.activeElement !== inputBar) {
        keyboardMap.classList.remove("no-focus");
      }
    });

    overlay.addEventListener("click", function () {
      if (overlayShowTimer) {
        clearTimeout(overlayShowTimer);
        overlayShowTimer = null;
      }
      focusOnKeyboard();
      keyboardMap.classList.remove("no-focus");
    });

    // initialize overlay state
    showOverlayIfStillBlurred();
  }
});
