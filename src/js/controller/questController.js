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
    var data = stateApi.computeIndicators(app.state, input);
    questBarView.applyQuestIndicators(data);
    keyboardView.applyKeyStates({
      hintKey: data.hintKey,
      pressedKey: input ? input.slice(-1) : null,
      disabledKeys: computeDisabledKeys(app.state),
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
  };

  root.CJL.controller = controller;
  // Auto-init on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
