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
  const keyboard = document.getElementById("keyboardMap");

  const key = {};

  const mapper = { " ": " " };

  for (let i = 0; i < 3; i++) {
    const row = keyboard.children[i].children;

    for (let j = 0, l = row.length; j < l; j++) {
      const keyName = (row[j].id || "").slice(-1);
      key[keyName] = row[j];
      mapper[keyName] = row[j].textContent;
    }
  }

  /**
   * Visually presses a key on the keyboard for a short duration
   * @param {string} keyName - The key identifier to press
   */
  function press(keyName) {
    setTimeout(function () {
      classOps.remove(key[keyName], "press");
    }, 150);

    classOps.add(key[keyName], "press");
  }

  /**
   * Shows a hint by highlighting a specific key on the keyboard
   * @param {string} keyName - The key identifier to highlight
   */
  function hint(keyName) {
    if (key.hint) classOps.remove(key[key.hint], "hint");
    classOps.add(key[keyName], "hint");
    key.hint = keyName;
  }

  return {
    press: press,
    hint: hint,
    mapper: mapper,
    key: key,
  };
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
  const characterTable = document.getElementById("character");
  const defaultCharacterArray = characterTable.textContent.split("\n");
  let characterArray = defaultCharacterArray.slice();
  const questBar = document.getElementById("questAlphabet").children;
  let nowCharacter;
  let isRadicalMode = false;
  let lastPickedCharacter = null;

  /**
   * Selects a random character from the current character array
   * In radical mode, avoids repeating the last picked character
   * @returns {string} The selected character string
   */
  function pickRandomCharacter() {
    const start = 1;
    const end = characterArray.length - 2;
    const count = end - start + 1;
    let idx;
    if (count <= 0) return characterArray[0];
    if (isRadicalMode && count > 1 && lastPickedCharacter !== null) {
      do {
        idx = Math.floor(Math.random() * count) + start;
      } while (characterArray[idx] === lastPickedCharacter);
    } else {
      idx = Math.floor(Math.random() * count) + start;
    }
    lastPickedCharacter = characterArray[idx];
    return characterArray[idx];
  }

  /**
   * Clears any active keyboard hint
   */
  function clearHint() {
    if (keyboard.key && keyboard.key.hint) {
      classOps.remove(keyboard.key[keyboard.key.hint], "hint");
      keyboard.key.hint = null;
    }
  }

  /**
   * Sets the visual status of the quest display for radical mode
   * @param {string} status - The status to set ("wrong" or "off")
   */
  function setQuestStatus(status) {
    const qc = questBar[0];
    classOps.remove(qc, "radical-wrong");
    if (status === "wrong") classOps.add(qc, "radical-wrong");
  }

  /**
   * Compares the user's input string with the current character
   * @param {string} string - The user's input to compare
   * @returns {number} The index where the first mismatch occurs, or the length if fully correct
   */
  function compare(string) {
    for (let i = 0, l = nowCharacter.length; i < l; i++) {
      if (string.charAt(i) !== nowCharacter.charAt(i)) return i;
    }
    return nowCharacter.length;
  }

  /**
   * Updates the visual indicators on the quest bar based on input progress
   * @param {number} index - The current correct position in the character
   * @param {number} wrong - The position where user input differs from correct answer
   * @returns {number} The hint character index for keyboard highlighting
   */
  function indicate(index, wrong) {
    const l = nowCharacter.length;
    let i = 0;
    while (i < index) {
      const el = questBar[i + 1];
      classOps.remove(el, "wrong");
      classOps.remove(el, "cursor");
      classOps.add(el, "right");
      i++;
    }

    const hintCharIndex = i;
    while (i < wrong) {
      const el = questBar[i + 1];
      classOps.remove(el, "right");
      classOps.remove(el, "cursor");
      classOps.add(el, "wrong");
      i++;
    }
    {
      const el = questBar[++i];
      classOps.remove(el, "right");
      classOps.remove(el, "wrong");
      classOps.add(el, "cursor");
    }

    while (i < l) {
      const el = questBar[i + 1];
      classOps.remove(el, "right");
      classOps.remove(el, "wrong");
      classOps.remove(el, "cursor");
      i++;
    }
    return hintCharIndex;
  }

  /**
   * Sets up a new character for practice in the quest bar
   * @param {string} characterString - The character string (radical + code) to display
   */
  function setNewCharacter(characterString) {
    nowCharacter = characterString.slice(1);
    questBar[0].textContent = characterString.charAt(0);
    for (let i = 1, l = questBar.length; i < l; i++) {
      if (isRadicalMode) {
        questBar[i].textContent = "";
      } else {
        questBar[i].textContent =
          keyboard.mapper[characterString.charAt(i) || " "];
      }

      const el = questBar[i];
      classOps.remove(el, "right");
      classOps.remove(el, "wrong");
      classOps.remove(el, "cursor");
    }

    if (isRadicalMode) setQuestStatus("off");
  }

  setNewCharacter(pickRandomCharacter());

  // Apply initial hint for the first character (單字模式)
  keyboard.hint(nowCharacter.charAt(indicate(0, 0)));

  /**
   * Checks user input against the current character and updates UI accordingly
   * @param {string} string - The user's input string
   * @returns {boolean} True if the character was completed successfully
   */
  function check(string) {
    let index = compare(string);

    if (index >= nowCharacter.length) {
      setNewCharacter(pickRandomCharacter());
      index = -1;
      string = "";

      // Apply hint for the new character's first key
      if (!isRadicalMode) {
        keyboard.hint(nowCharacter.charAt(indicate(0, 0)));
      } else {
        indicate(0, 0);
        clearHint();
      }
    }

    if (!isRadicalMode) {
      keyboard.hint(nowCharacter.charAt(indicate(index, string.length)));
    } else {
      // Radical mode: only keyboard highlight when wrong; no neutral/correct state
      if (string && string.length > index) {
        setQuestStatus("wrong");
        keyboard.hint(nowCharacter.charAt(0));
      } else if (!string) {
        setQuestStatus("off");
      }
    }

    return index == -1;
  }

  /**
   * Switches between normal character mode and radical practice mode
   * @param {boolean} newIsRadicalMode - Whether to enable radical mode
   * @param {string} categoryKey - The radical category key (philosophy, stroke, human, shape, all)
   */
  function setMode(newIsRadicalMode, categoryKey) {
    isRadicalMode = !!newIsRadicalMode;
    lastPickedCharacter = null;

    // Update the available character pool
    if (isRadicalMode) {
      const pool = RADICAL_POOLS[categoryKey] || RADICAL_POOLS.philosophy;
      characterArray = [""].concat(pool).concat([""]);
    } else {
      characterArray = defaultCharacterArray.slice();
    }

    // Toggle disabled state on keyboard keys based on radical pool
    (function updateDisabledKeys() {
      const allowed = {};
      if (isRadicalMode) {
        const selectedPool =
          RADICAL_POOLS[categoryKey] || RADICAL_POOLS.philosophy;
        for (let i = 0; i < selectedPool.length; i++) {
          const entry = selectedPool[i];
          const alpha = entry.charAt(entry.length - 1);
          allowed[alpha] = true;
        }
      }

      for (let alpha in keyboard.key) {
        if (!keyboard.key.hasOwnProperty(alpha)) continue;
        const node = keyboard.key[alpha];
        if (!node) continue;
        if (isRadicalMode) {
          if (allowed[alpha]) classOps.remove(node, "disabled");
          else classOps.add(node, "disabled");
        } else {
          classOps.remove(node, "disabled");
        }
      }
    })();

    setNewCharacter(pickRandomCharacter());

    if (isRadicalMode) {
      setQuestStatus("off");
      clearHint();
    } else {
      keyboard.hint(nowCharacter.charAt(indicate(0, 0)));
    }
  }

  return {
    check: check,
    setMode: setMode,
    isRadical: function () {
      return isRadicalMode;
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
  if (/[^a-y]/.test(string)) {
    this.value = "";
    string = "";
  }

  const inRadical = questCheck.isRadical ? questCheck.isRadical() : false;

  string && keyboard.press(string.slice(-1));

  const isCompleted = questCheck.check
    ? questCheck.check(string)
    : questCheck(string);
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
    ensureOriginalMapperSnapshot();
    isEnglishLayout = !isEnglishLayout;

    // Update keyboard visuals
    const keys = document.querySelectorAll('#keyboardMap span[id^="key-"]');
    keys.forEach((key) => {
      const alpha = (key.id || "").slice(4);
      const label = isEnglishLayout
        ? alpha.toUpperCase()
        : originalMapper[alpha];
      key.textContent = label;
    });
    if (toggleLayoutBtn) {
      toggleLayoutBtn.textContent = isEnglishLayout ? "倉頡鍵盤" : "英文鍵盤";
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
