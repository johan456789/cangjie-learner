// Keyboard view: caches DOM and applies labels/states. No business logic.
(function () {
  const root = typeof window !== "undefined" ? window : globalThis;
  if (!root.CJL) root.CJL = {};
  const constants = root.CJL.constants || { CLASSES: {}, SELECTORS: {} };

  let dom = null;
  let originalLabels = null;
  let listenersBound = false;
  const pressedKeys = {};
  const pressTimers = {};

  function ensureDomCache() {
    if (dom) return dom;
    const keyboardEl = document.querySelector(constants.SELECTORS.keyboardMap);
    const keyNodes = keyboardEl
      ? keyboardEl.querySelectorAll('span[id^="key-"]')
      : [];
    const keyByAlpha = {};
    for (let i = 0; i < keyNodes.length; i++) {
      const node = keyNodes[i];
      const alpha = (node.id || "").slice(4);
      keyByAlpha[alpha] = node;
    }
    dom = { keyboardEl: keyboardEl, keyByAlpha: keyByAlpha };
    if (!originalLabels) {
      originalLabels = {};
      for (const a in keyByAlpha) {
        if (!Object.hasOwn(keyByAlpha, a)) {
          continue;
        }
        originalLabels[a] = keyByAlpha[a].textContent;
      }
    }
    return dom;
  }

  function renderKeyboardLabels(args) {
    ensureDomCache();
    const isEnglishLayout = !!(args && args.isEnglishLayout);
    const labels = (args && args.originalLabels) || originalLabels || {};
    for (const alpha in dom.keyByAlpha) {
      if (!Object.hasOwn(dom.keyByAlpha, alpha)) continue;
      const node = dom.keyByAlpha[alpha];
      const label = isEnglishLayout ? alpha.toUpperCase() : labels[alpha];
      if (typeof label === "string") node.textContent = label;
    }
    const toggleLayoutBtn = document.querySelector(
      constants.SELECTORS.toggleLayout
    );
    if (toggleLayoutBtn) {
      toggleLayoutBtn.textContent = isEnglishLayout ? "倉頡鍵盤" : "英文鍵盤";
      toggleLayoutBtn.setAttribute("aria-pressed", String(isEnglishLayout));
    }
  }

  function applyKeyStates(args) {
    ensureDomCache();
    const CL = constants.CLASSES;
    const TIMINGS = constants.TIMINGS || {};
    const hintKey = args && args.hintKey;
    const disabledKeys = (args && args.disabledKeys) || {};
    const pressedKey = args && args.pressedKey;

    for (const alpha in dom.keyByAlpha) {
      if (!Object.hasOwn(dom.keyByAlpha, alpha)) continue;
      const node = dom.keyByAlpha[alpha];
      node.classList.remove(CL.hint, CL.disabled);
      if (disabledKeys[alpha]) node.classList.add(CL.disabled);
    }

    if (hintKey && dom.keyByAlpha[hintKey])
      dom.keyByAlpha[hintKey].classList.add(CL.hint);

    // Timer-based press state for visual feedback when updates come from controller
    if (pressedKey && dom.keyByAlpha[pressedKey]) {
      const node = dom.keyByAlpha[pressedKey];
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
    const keyName = event.key.toLowerCase();
    // limit to a-z
    if (keyName.length === 1 && keyName >= "a" && keyName <= "z")
      return keyName;
    return null;
  }

  function clearAllPressed() {
    ensureDomCache();
    const CL = constants.CLASSES;
    for (const alpha in pressedKeys) {
      if (!Object.hasOwn(pressedKeys, alpha)) continue;
      if (pressedKeys[alpha] && dom.keyByAlpha[alpha])
        dom.keyByAlpha[alpha].classList.remove(CL.press);
      pressedKeys[alpha] = false;
    }
  }

  function bindKeyHoldHandlers() {
    if (listenersBound) return;
    ensureDomCache();
    const CL = constants.CLASSES;

    document.addEventListener(
      "keydown",
      function (event) {
        const alpha = alphaFromEvent(event);
        if (!alpha) return;
        if (pressedKeys[alpha]) return; // already pressed (handle auto-repeat)
        pressedKeys[alpha] = true;
        const node = dom.keyByAlpha[alpha];
        if (node) node.classList.add(CL.press);
      },
      true
    );

    document.addEventListener(
      "keyup",
      function (event) {
        const alpha = alphaFromEvent(event);
        if (!alpha) return;
        if (!pressedKeys[alpha]) return;
        pressedKeys[alpha] = false;
        const node = dom.keyByAlpha[alpha];
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
