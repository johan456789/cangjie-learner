// Controller wiring state and views, adapting old APIs
(function () {
  var root = typeof window !== "undefined" ? window : globalThis;
  if (!root.CJL) root.CJL = {};
  var constants = root.CJL.constants;
  var stateApi = root.CJL.questState;
  var keyboardView = root.CJL.keyboardView;
  var questBarView = root.CJL.questBarView;

  if (!constants || !stateApi || !keyboardView || !questBarView) return;

  // Build initial state from DOM source list
  function readDefaultCharacters() {
    var el = document.querySelector(constants.SELECTORS.characterList);
    var lines = el ? el.textContent.split("\n") : [];
    return lines;
  }

  var app = {
    state: null,
    originalLabels: null,
    isEnglishLayout: false,
  };

  var debugEnabled = false;
  var rafState = { scheduled: false, lastInput: "" };

  function init() {
    var defaults = readDefaultCharacters();
    app.state = stateApi.initializeState({
      defaultCharacterArray: defaults,
      radicalPools: constants.RADICAL_POOLS,
    });
    app.originalLabels = keyboardView.getOriginalLabels();

    // Ensure persistent pressed-state handlers are attached once
    if (keyboardView.bindKeyHoldHandlers) keyboardView.bindKeyHoldHandlers();

    // First pick & render
    var pick = stateApi.pickRandomCharacter(app.state);
    app.state = pick.state;
    var characterString = pick.character; // e.g., "日a"
    app.state.nowCharacter = characterString.slice(1);

    var radical = characterString.charAt(0);
    var mapped = mapLabels(app.state.nowCharacter, app.originalLabels);
    questBarView.renderQuestCharacter({
      radical: radical,
      mappedLabels: mapped,
      isRadicalMode: app.state.isRadicalMode,
    });

    updateIndicators("");
  }

  function mapLabels(code, labels) {
    var result = [];
    for (var i = 0; i < code.length; i++) {
      var a = code.charAt(i) || " ";
      result.push(labels[a] || " ");
    }
    return result;
  }

  function updateIndicators(input) {
    rafState.lastInput = input;
    if (rafState.scheduled) return;
    rafState.scheduled = true;
    var raf =
      window.requestAnimationFrame ||
      function (cb) {
        return setTimeout(cb, 0);
      };
    raf(function () {
      rafState.scheduled = false;
      var t0 =
        debugEnabled && typeof performance !== "undefined"
          ? performance.now()
          : 0;
      var data = stateApi.computeIndicators(app.state, rafState.lastInput);
      var t1 =
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
        var t2 = performance.now();
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
    var disabled = {};
    if (!state.isRadicalMode) return disabled;
    var pool = state.radicalPools[state.activeCategoryKey] || [];
    var allowed = {};
    for (var i = 0; i < pool.length; i++) {
      var entry = pool[i];
      allowed[entry.charAt(entry.length - 1)] = true;
    }
    var labels = keyboardView.getOriginalLabels();
    for (var a in labels) {
      if (!Object.prototype.hasOwnProperty.call(labels, a)) continue;
      if (!allowed[a]) disabled[a] = true;
    }
    return disabled;
  }

  // Public API mirroring old questCheck
  var controller = {
    check: function (input) {
      var index = stateApi.compareInput(app.state, input);
      var completed = index >= app.state.nowCharacter.length;
      if (completed) {
        var pick = stateApi.pickRandomCharacter(app.state);
        app.state = pick.state;
        var characterString = pick.character;
        app.state.nowCharacter = characterString.slice(1);
        var radical = characterString.charAt(0);
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
      var res = stateApi.setMode(app.state, {
        isRadicalMode: isRadicalMode,
        categoryKey: categoryKey,
      });
      app.state = res.state;

      // Re-pick and render
      var pick = stateApi.pickRandomCharacter(app.state);
      app.state = pick.state;
      var characterString = pick.character;
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

  function wireEvents() {
    var SEL = constants.SELECTORS || {};
    var CL = constants.CLASSES || {};
    var TIMINGS = constants.TIMINGS || {};
    var inputEl = document.querySelector(SEL.inputBar);
    var modeSelect = document.querySelector(SEL.modeSelect);
    var categorySelect = document.querySelector(SEL.categorySelect);
    var toggleLayoutBtn = document.querySelector(SEL.toggleLayout);
    var toggleVisibilityBtn = document.querySelector(SEL.toggleVisibilityBtn);
    var keyboardEl = document.querySelector(SEL.keyboardMap);

    if (inputEl) {
      inputEl.addEventListener("input", function () {
        var string = this.value || "";
        var INVALID = constants.INVALID_KEY_REGEX || /[^a-y]/;
        if (INVALID.test(string)) {
          this.value = "";
          string = "";
        }
        var completed = controller.check(string);
        if (app.state.isRadicalMode || completed) this.value = "";
      });
    }

    function applyModeChange() {
      var isRadical = modeSelect && modeSelect.value === "radical";
      if (categorySelect) categorySelect.disabled = !isRadical;
      var cat = (categorySelect && categorySelect.value) || "philosophy";
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
        var isHidden = keyboardEl.classList.contains(CL.hidden);
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
      var overlay = keyboardEl.querySelector(".focus-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "focus-overlay";
        overlay.textContent = "點擊這裡以繼續輸入";
        keyboardEl.appendChild(overlay);
      }
      var overlayShowTimer = null;
      function showOverlayIfStillBlurred() {
        var isFocused = document.activeElement === inputEl;
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

  root.CJL.controller = controller;
  // Auto-init on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // After init, wire events
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireEvents);
  } else {
    wireEvents();
  }
})();
