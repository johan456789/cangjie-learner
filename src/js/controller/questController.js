// Controller wiring state and views as ES module
import {
  CLASSES,
  SELECTORS,
  INVALID_KEY_REGEX,
  TIMINGS,
  RADICAL_POOLS,
  AUX_JSON_PATH,
  AUX_BASE_PATH,
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
import { renderAuxPanel, applyAuxDetails } from "../view/auxiliaryView.js";

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
  mode: "char", // "char" | "radical" | "aux"
  aux: {
    data: null, // loaded JSON
    letterToRows: null,
    current: null, // selection detail
  },
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

  // Prepare aux panel DOM early to avoid layout jank later
  try {
    renderAuxPanel();
  } catch (e) {}

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
    if (app.mode === "aux") {
      const current = app.aux.current;
      if (current) {
        applyAuxDetails({
          show: !!data.radicalWrong,
          fuzhuFiles: current.fuzhuFiles || [],
          currentFuzhuIndex: current.fuzhuIndex,
          shuoMingHtml: current.shuoMingHtml || "",
        });
      }
    }
    keyboardView.applyKeyStates({
      hintKey: data.hintKey,
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
  if (!(state.isRadicalMode || app.mode === "aux")) return disabled;
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
      if (app.mode === "aux") {
        // Immediately pick a new aux zili
        selectAndRenderNextAux();
        input = "";
      } else {
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
    }

    updateIndicators(input);
    return completed;
  },
  setMode: function (isRadicalMode, categoryKey) {
    app.mode = isRadicalMode ? "radical" : "char";
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
  setAuxMode: async function (categoryKey) {
    app.mode = "aux";
    await ensureAuxDataLoaded();
    // In aux mode, reuse radical-like indicator behavior
    app.state.isRadicalMode = true;
    app.state.activeCategoryKey =
      categoryKey || app.state.activeCategoryKey || "philosophy";
    selectAndRenderNextAux();
    // Ensure panel stays hidden until first wrong input
    try {
      applyAuxDetails({
        show: false,
        fuzhuFiles: app.aux.current ? app.aux.current.fuzhuFiles : [],
        currentFuzhuIndex: app.aux.current ? app.aux.current.fuzhuIndex : -1,
        shuoMingHtml: app.aux.current ? app.aux.current.shuoMingHtml : "",
      });
    } catch (e) {}
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
      if (app.mode === "aux" || app.state.isRadicalMode || completed)
        this.value = "";
    });
  }

  async function applyModeChange() {
    const modeValue = modeSelect && modeSelect.value;
    const isRadical = modeValue === "radical";
    const isAux = modeValue === "aux";
    if (categorySelect) categorySelect.disabled = !(isRadical || isAux);
    const cat = (categorySelect && categorySelect.value) || "philosophy";
    if (isAux) {
      await controller.setAuxMode(cat);
    } else {
      controller.setMode(!!isRadical, cat);
    }
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

// ===== Aux helpers =====

async function ensureAuxDataLoaded() {
  if (app.aux.data) return app.aux.data;
  const res = await fetch(AUX_JSON_PATH, { cache: "force-cache" });
  const json = await res.json();
  app.aux.data = json || {};
  app.aux.letterToRows = buildLetterToRows(json);
  return app.aux.data;
}

function buildLetterToRows(data) {
  const map = {};
  for (const upper in data) {
    if (!Object.hasOwn(data, upper)) continue;
    const key = String(upper).toUpperCase();
    const letter = key.toLowerCase();
    const def = data[upper] || {};
    const rows = def.rows || [];
    map[letter] = { cangjieChar: def.cangjie_char || "", rows: rows };
  }
  return map;
}

function selectAuxLetterFromCategory(categoryKey) {
  const pool = constants.RADICAL_POOLS[categoryKey] || [];
  const allowedLetters = [];
  for (let i = 0; i < pool.length; i++) {
    const entry = pool[i];
    const letter = entry.charAt(entry.length - 1);
    if (app.aux.letterToRows && app.aux.letterToRows[letter]) {
      allowedLetters.push(letter);
    }
  }
  if (allowedLetters.length === 0) return null;
  // Avoid immediate same letter repeat if possible
  let pickLetter;
  const last = app.aux.current && app.aux.current.letter;
  if (allowedLetters.length > 1 && last) {
    do {
      pickLetter =
        allowedLetters[Math.floor(Math.random() * allowedLetters.length)];
    } while (pickLetter === last);
  } else {
    pickLetter =
      allowedLetters[Math.floor(Math.random() * allowedLetters.length)];
  }
  return pickLetter;
}

function selectAuxQuestionForLetter(letter) {
  const def = app.aux.letterToRows && app.aux.letterToRows[letter];
  if (!def) return null;
  const rows = def.rows || [];
  const candidates = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fuzhus = row && row.fuzhu_zixing ? row.fuzhu_zixing : [];
    let totalZili = 0;
    for (let j = 0; j < fuzhus.length; j++) {
      const z = (fuzhus[j] && fuzhus[j].zili) || [];
      totalZili += z.length;
    }
    if (totalZili > 0) candidates.push(i);
  }
  if (candidates.length === 0) return null;
  const rowIndex = candidates[Math.floor(Math.random() * candidates.length)];
  const row = rows[rowIndex];
  const fuzhus = row.fuzhu_zixing || [];
  const fuzhuChoices = [];
  for (let j = 0; j < fuzhus.length; j++) {
    const z = (fuzhus[j] && fuzhus[j].zili) || [];
    if (z.length > 0) fuzhuChoices.push(j);
  }
  const fuzhuIndex =
    fuzhuChoices[Math.floor(Math.random() * fuzhuChoices.length)];
  const ziliArr = (fuzhus[fuzhuIndex] && fuzhus[fuzhuIndex].zili) || [];
  const ziliIndex = Math.floor(Math.random() * ziliArr.length);
  const ziliFile = ziliArr[ziliIndex].file;
  const fuzhuFiles = fuzhus.map(function (f) {
    return f.file;
  });
  const shuoMingHtml = row.shuo_ming || "";
  return {
    letter: letter,
    radicalChar: def.cangjieChar,
    rowIndex: rowIndex,
    fuzhuIndex: fuzhuIndex,
    ziliIndex: ziliIndex,
    ziliFile: ziliFile,
    fuzhuFiles: fuzhuFiles,
    shuoMingHtml: shuoMingHtml,
  };
}

function selectAndRenderNextAux() {
  const letter = selectAuxLetterFromCategory(
    app.state.activeCategoryKey || "philosophy"
  );
  if (!letter) return;
  const detail = selectAuxQuestionForLetter(letter);
  if (!detail) return;
  app.aux.current = detail;
  // For indicator logic, set code to the single letter
  app.state.nowCharacter = letter;
  // Render zili SVG only in the quest box (no radical text)
  const mapped = mapLabels(app.state.nowCharacter, app.originalLabels);
  questBarView.renderQuestCharacter({
    radical: "",
    mappedLabels: mapped,
    isRadicalMode: true,
    isAuxMode: true,
    auxZiliFile: detail.ziliFile,
    auxBasePath: AUX_BASE_PATH,
  });
  // Hide aux panel by default on fresh pick
  try {
    applyAuxDetails({
      show: false,
      fuzhuFiles: detail.fuzhuFiles || [],
      currentFuzhuIndex: detail.fuzhuIndex,
      shuoMingHtml: detail.shuoMingHtml || "",
    });
  } catch (e) {}
}
