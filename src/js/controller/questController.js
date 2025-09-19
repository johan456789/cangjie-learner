// Controller wiring state and views as ES module
import {
  CLASSES,
  SELECTORS,
  INVALID_KEY_REGEX,
  TIMINGS,
  RADICAL_POOLS,
} from "../constants.js";
import {
  initializeState,
  pickRandomCharacter,
  compareInput,
  computeIndicators,
  setMode as setModeState,
} from "../state/questState.js";
import {
  renderKeyboardLabels,
  applyKeyStates,
  getOriginalLabels,
  bindKeyHoldHandlers,
} from "../view/keyboardView.js";
import {
  renderQuestCharacter,
  applyQuestIndicators,
} from "../view/questBarView.js";

const constants = {
  CLASSES: CLASSES,
  SELECTORS: SELECTORS,
  INVALID_KEY_REGEX: INVALID_KEY_REGEX,
  TIMINGS: TIMINGS,
  RADICAL_POOLS: RADICAL_POOLS,
};

const stateApi = {
  initializeState: initializeState,
  pickRandomCharacter: pickRandomCharacter,
  compareInput: compareInput,
  computeIndicators: computeIndicators,
  setMode: setModeState,
};

const keyboardView = {
  renderKeyboardLabels: renderKeyboardLabels,
  applyKeyStates: applyKeyStates,
  getOriginalLabels: getOriginalLabels,
  bindKeyHoldHandlers: bindKeyHoldHandlers,
};

const questBarView = {
  renderQuestCharacter: renderQuestCharacter,
  applyQuestIndicators: applyQuestIndicators,
};

// Build initial state from DOM source list
function readDefaultCharacters() {
  const el = document.querySelector(constants.SELECTORS.characterList);
  const lines = el ? el.textContent.split("\n") : [];
  return lines;
}

const app = {
  state: null,
  originalLabels: null,
  isEnglishLayout: false,
};

let debugEnabled = false;
const rafState = { scheduled: false, lastInput: "" };

export function init() {
  const defaults = readDefaultCharacters();
  app.state = stateApi.initializeState({
    defaultCharacterArray: defaults,
    radicalPools: constants.RADICAL_POOLS,
  });
  app.originalLabels = keyboardView.getOriginalLabels();

  // Ensure persistent pressed-state handlers are attached once
  if (keyboardView.bindKeyHoldHandlers) keyboardView.bindKeyHoldHandlers();

  // First pick & render
  const pick = stateApi.pickRandomCharacter(app.state);
  app.state = pick.state;
  const characterString = pick.character; // e.g., "日a"
  app.state.nowCharacter = characterString.slice(1);

  const radical = characterString.charAt(0);
  const mapped = mapLabels(app.state.nowCharacter, app.originalLabels);
  questBarView.renderQuestCharacter({
    radical: radical,
    mappedLabels: mapped,
    isRadicalMode: app.state.isRadicalMode,
  });

  updateIndicators("");
}

function mapLabels(code, labels) {
  const result = [];
  for (let i = 0; i < code.length; i++) {
    const a = code.charAt(i) || " ";
    result.push(labels[a] || " ");
  }
  return result;
}

function updateIndicators(input) {
  rafState.lastInput = input;
  if (rafState.scheduled) return;
  rafState.scheduled = true;
  const raf =
    window.requestAnimationFrame ||
    function (cb) {
      return setTimeout(cb, 0);
    };
  raf(function () {
    rafState.scheduled = false;
    const t0 =
      debugEnabled && typeof performance !== "undefined"
        ? performance.now()
        : 0;
    const data = stateApi.computeIndicators(app.state, rafState.lastInput);
    const t1 =
      debugEnabled && typeof performance !== "undefined"
        ? performance.now()
        : 0;
    questBarView.applyQuestIndicators(data);
    keyboardView.applyKeyStates({
      hintKey: data.hintKey,
      pressedKey: rafState.lastInput ? rafState.lastInput.slice(-1) : null,
      disabledKeys: computeDisabledKeys(app.state),
    });
    if (debugEnabled && typeof performance !== "undefined") {
      const t2 = performance.now();
      try {
        console.log(
          "[CJL] compute/apply(ms)",
          (t1 - t0).toFixed(2),
          (t2 - t1).toFixed(2)
        );
      } catch (e) {}
    }
  });
}

function computeDisabledKeys(state) {
  const disabled = {};
  if (!state.isRadicalMode) return disabled;
  const pool = state.radicalPools[state.activeCategoryKey] || [];
  const allowed = {};
  for (let i = 0; i < pool.length; i++) {
    const entry = pool[i];
    allowed[entry.charAt(entry.length - 1)] = true;
  }
  const labels = keyboardView.getOriginalLabels();
  for (const a in labels) {
    if (!Object.hasOwn(labels, a)) continue;
    if (!allowed[a]) disabled[a] = true;
  }
  return disabled;
}

// Public API mirroring old questCheck
export const controller = {
  check: function (input) {
    const index = stateApi.compareInput(app.state, input);
    const completed = index >= app.state.nowCharacter.length;
    if (completed) {
      const pick = stateApi.pickRandomCharacter(app.state);
      app.state = pick.state;
      const characterString = pick.character;
      app.state.nowCharacter = characterString.slice(1);
      const radical = characterString.charAt(0);
      questBarView.renderQuestCharacter({
        radical: radical,
        mappedLabels: mapLabels(app.state.nowCharacter, app.originalLabels),
        isRadicalMode: app.state.isRadicalMode,
      });
      input = "";
    }

    updateIndicators(input);
    return completed;
  },
  setMode: function (isRadicalMode, categoryKey) {
    const res = stateApi.setMode(app.state, {
      isRadicalMode: isRadicalMode,
      categoryKey: categoryKey,
    });
    app.state = res.state;

    // Re-pick and render
    const pick = stateApi.pickRandomCharacter(app.state);
    app.state = pick.state;
    const characterString = pick.character;
    app.state.nowCharacter = characterString.slice(1);
    questBarView.renderQuestCharacter({
      radical: characterString.charAt(0),
      mappedLabels: mapLabels(app.state.nowCharacter, app.originalLabels),
      isRadicalMode: app.state.isRadicalMode,
    });

    // Update keyboard disabled keys and clear hint when entering radical mode
    updateIndicators("");
  },
  isRadical: function () {
    return !!app.state && app.state.isRadicalMode;
  },
  toggleLayout: function () {
    app.isEnglishLayout = !app.isEnglishLayout;
    keyboardView.renderKeyboardLabels({
      isEnglishLayout: app.isEnglishLayout,
      originalLabels: app.originalLabels,
    });
  },
  getOriginalLabels: function () {
    return app.originalLabels;
  },
  setDebug: function (enabled) {
    debugEnabled = !!enabled;
  },
};

export function wireEvents() {
  const SEL = constants.SELECTORS || {};
  const CL = constants.CLASSES || {};
  const TIMINGS = constants.TIMINGS || {};
  const inputEl = document.querySelector(SEL.inputBar);
  const modeSelect = document.querySelector(SEL.modeSelect);
  const categorySelect = document.querySelector(SEL.categorySelect);
  const toggleLayoutBtn = document.querySelector(SEL.toggleLayout);
  const toggleVisibilityBtn = document.querySelector(SEL.toggleVisibilityBtn);
  const keyboardEl = document.querySelector(SEL.keyboardMap);

  if (inputEl) {
    inputEl.addEventListener("input", function () {
      let string = this.value || "";
      const INVALID = constants.INVALID_KEY_REGEX || /[^a-y]/;
      if (INVALID.test(string)) {
        this.value = "";
        string = "";
      }
      const completed = controller.check(string);
      if (app.state.isRadicalMode || completed) this.value = "";
    });
  }

  function applyModeChange() {
    const isRadical = modeSelect && modeSelect.value === "radical";
    if (categorySelect) categorySelect.disabled = !isRadical;
    const cat = (categorySelect && categorySelect.value) || "philosophy";
    controller.setMode(!!isRadical, cat);
    if (inputEl) {
      inputEl.value = "";
      inputEl.focus();
    }
  }
  if (modeSelect) modeSelect.addEventListener("change", applyModeChange);
  if (categorySelect)
    categorySelect.addEventListener("change", applyModeChange);
  applyModeChange();

  if (toggleLayoutBtn) {
    toggleLayoutBtn.addEventListener("click", function () {
      controller.toggleLayout();
      if (inputEl) inputEl.focus();
    });
  }

  if (toggleVisibilityBtn && keyboardEl) {
    function syncVisibilityState() {
      const isHidden = keyboardEl.classList.contains(CL.hidden);
      toggleVisibilityBtn.textContent = isHidden ? "顯示鍵盤" : "隱藏鍵盤";
      if (toggleLayoutBtn) toggleLayoutBtn.disabled = isHidden;
      keyboardEl.setAttribute("aria-hidden", String(isHidden));
      toggleVisibilityBtn.setAttribute("aria-pressed", String(!isHidden));
      toggleVisibilityBtn.setAttribute(
        "aria-controls",
        keyboardEl.id || "keyboardMap"
      );
    }
    syncVisibilityState();
    toggleVisibilityBtn.addEventListener("click", function () {
      keyboardEl.classList.toggle(CL.hidden);
      syncVisibilityState();
      if (inputEl) inputEl.focus();
    });
  }

  // Overlay handling
  if (keyboardEl) {
    let overlay = keyboardEl.querySelector(".focus-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "focus-overlay";
      overlay.textContent = "點擊這裡以繼續輸入";
      keyboardEl.appendChild(overlay);
    }
    let overlayShowTimer = null;
    function showOverlayIfStillBlurred() {
      const isFocused = document.activeElement === inputEl;
      keyboardEl.classList.toggle(CL.noFocus, !isFocused);
    }
    function scheduleOverlayShow() {
      if (overlayShowTimer) {
        clearTimeout(overlayShowTimer);
        overlayShowTimer = null;
      }
      overlayShowTimer = setTimeout(
        function () {
          overlayShowTimer = null;
          showOverlayIfStillBlurred();
        },
        typeof TIMINGS.overlayDelayMs === "number"
          ? TIMINGS.overlayDelayMs
          : 200
      );
    }
    if (inputEl) {
      inputEl.addEventListener("focus", function () {
        if (overlayShowTimer) {
          clearTimeout(overlayShowTimer);
          overlayShowTimer = null;
        }
        keyboardEl.classList.remove(CL.noFocus);
      });
      inputEl.addEventListener("blur", scheduleOverlayShow);
    }
    overlay.addEventListener("click", function () {
      if (overlayShowTimer) {
        clearTimeout(overlayShowTimer);
        overlayShowTimer = null;
      }
      if (inputEl) inputEl.focus();
      keyboardEl.classList.remove(CL.noFocus);
    });
    showOverlayIfStillBlurred();
  }
}
