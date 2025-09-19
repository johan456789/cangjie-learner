// Keyboard view: caches DOM and applies labels/states. No business logic.
(function () {
  var root = typeof window !== "undefined" ? window : globalThis;
  if (!root.CJL) root.CJL = {};
  var constants = root.CJL.constants || { CLASSES: {}, SELECTORS: {} };

  var dom = null;
  var originalLabels = null;
  var listenersBound = false;
  var pressedKeys = {};
  var pressTimers = {};

  function ensureDomCache() {
    if (dom) return dom;
    var keyboardEl = document.querySelector(constants.SELECTORS.keyboardMap);
    var keyNodes = keyboardEl
      ? keyboardEl.querySelectorAll('span[id^="key-"]')
      : [];
    var keyByAlpha = {};
    for (var i = 0; i < keyNodes.length; i++) {
      var node = keyNodes[i];
      var alpha = (node.id || "").slice(4);
      keyByAlpha[alpha] = node;
    }
    dom = { keyboardEl: keyboardEl, keyByAlpha: keyByAlpha };
    if (!originalLabels) {
      originalLabels = {};
      for (var a in keyByAlpha) {
        if (!Object.prototype.hasOwnProperty.call(keyByAlpha, a)) {
          continue;
        }
        originalLabels[a] = keyByAlpha[a].textContent;
      }
    }
    return dom;
  }

  function renderKeyboardLabels(args) {
    ensureDomCache();
    var isEnglishLayout = !!(args && args.isEnglishLayout);
    var labels = (args && args.originalLabels) || originalLabels || {};
    for (var alpha in dom.keyByAlpha) {
      if (!Object.prototype.hasOwnProperty.call(dom.keyByAlpha, alpha))
        continue;
      var node = dom.keyByAlpha[alpha];
      var label = isEnglishLayout ? alpha.toUpperCase() : labels[alpha];
      if (typeof label === "string") node.textContent = label;
    }
    var toggleLayoutBtn = document.querySelector(
      constants.SELECTORS.toggleLayout
    );
    if (toggleLayoutBtn) {
      toggleLayoutBtn.textContent = isEnglishLayout ? "倉頡鍵盤" : "英文鍵盤";
      toggleLayoutBtn.setAttribute("aria-pressed", String(isEnglishLayout));
    }
  }

  function applyKeyStates(args) {
    ensureDomCache();
    var CL = constants.CLASSES;
    var TIMINGS = constants.TIMINGS || {};
    var hintKey = args && args.hintKey;
    var disabledKeys = (args && args.disabledKeys) || {};
    var pressedKey = args && args.pressedKey;

    for (var alpha in dom.keyByAlpha) {
      if (!Object.prototype.hasOwnProperty.call(dom.keyByAlpha, alpha))
        continue;
      var node = dom.keyByAlpha[alpha];
      node.classList.remove(CL.hint, CL.disabled);
      if (disabledKeys[alpha]) node.classList.add(CL.disabled);
    }

    if (hintKey && dom.keyByAlpha[hintKey])
      dom.keyByAlpha[hintKey].classList.add(CL.hint);

    // Timer-based press state for visual feedback when updates come from controller
    if (pressedKey && dom.keyByAlpha[pressedKey]) {
      var node = dom.keyByAlpha[pressedKey];
      node.classList.add(CL.press);
      if (pressTimers[pressedKey]) clearTimeout(pressTimers[pressedKey]);
      pressTimers[pressedKey] = setTimeout(
        function () {
          node.classList.remove(CL.press);
          pressTimers[pressedKey] = null;
        },
        typeof TIMINGS.pressMs === "number" ? TIMINGS.pressMs : 150
      );
    }
  }

  function alphaFromEvent(event) {
    if (!event || !event.key) return null;
    var keyName = event.key.toLowerCase();
    // limit to a-z
    if (keyName.length === 1 && keyName >= "a" && keyName <= "z")
      return keyName;
    return null;
  }

  function clearAllPressed() {
    ensureDomCache();
    var CL = constants.CLASSES;
    for (var alpha in pressedKeys) {
      if (!Object.prototype.hasOwnProperty.call(pressedKeys, alpha)) continue;
      if (pressedKeys[alpha] && dom.keyByAlpha[alpha])
        dom.keyByAlpha[alpha].classList.remove(CL.press);
      pressedKeys[alpha] = false;
    }
  }

  function bindKeyHoldHandlers() {
    if (listenersBound) return;
    ensureDomCache();
    var CL = constants.CLASSES;

    document.addEventListener(
      "keydown",
      function (event) {
        var alpha = alphaFromEvent(event);
        if (!alpha) return;
        if (pressedKeys[alpha]) return; // already pressed (handle auto-repeat)
        pressedKeys[alpha] = true;
        var node = dom.keyByAlpha[alpha];
        if (node) node.classList.add(CL.press);
      },
      true
    );

    document.addEventListener(
      "keyup",
      function (event) {
        var alpha = alphaFromEvent(event);
        if (!alpha) return;
        if (!pressedKeys[alpha]) return;
        pressedKeys[alpha] = false;
        var node = dom.keyByAlpha[alpha];
        if (node) node.classList.remove(CL.press);
      },
      true
    );

    // Prevent stuck keys when window loses focus or tab hidden
    window.addEventListener("blur", clearAllPressed);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) clearAllPressed();
    });

    listenersBound = true;
  }

  function getOriginalLabels() {
    ensureDomCache();
    return Object.assign({}, originalLabels || {});
  }

  root.CJL.keyboardView = {
    renderKeyboardLabels: renderKeyboardLabels,
    applyKeyStates: applyKeyStates,
    getOriginalLabels: getOriginalLabels,
    bindKeyHoldHandlers: bindKeyHoldHandlers,
  };
})();
