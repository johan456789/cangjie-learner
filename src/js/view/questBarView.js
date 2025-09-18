// Quest bar view: renders radical + mapped labels and applies indicators
(function () {
  var root = typeof window !== "undefined" ? window : globalThis;
  if (!root.CJL) root.CJL = {};
  var constants = root.CJL.constants || { CLASSES: {}, SELECTORS: {} };

  var dom = null;
  function ensureDomCache() {
    if (dom) return dom;
    var container = document.querySelector(constants.SELECTORS.questAlphabet);
    var children = container ? container.children : [];
    dom = { container: container, slots: children };
    return dom;
  }

  /**
   * renderQuestCharacter
   * @param {{radical:string, mappedLabels:string[], isRadicalMode:boolean}} args
   */
  function renderQuestCharacter(args) {
    ensureDomCache();
    var radical = (args && args.radical) || "";
    var mappedLabels = (args && args.mappedLabels) || [];
    var isRadicalMode = !!(args && args.isRadicalMode);

    if (!dom.container || !dom.slots || dom.slots.length === 0) return;
    if (dom.slots[0]) dom.slots[0].textContent = radical;

    for (var i = 1; i < dom.slots.length; i++) {
      var el = dom.slots[i];
      el.classList.remove(
        constants.CLASSES.right,
        constants.CLASSES.wrong,
        constants.CLASSES.cursor
      );
      el.textContent = isRadicalMode ? "" : mappedLabels[i - 1] || "";
    }
  }

  /**
   * applyQuestIndicators
   * @param {{right:number[], wrong:number[], cursorIndex:number, radicalWrong:boolean}} data
   */
  function applyQuestIndicators(data) {
    ensureDomCache();
    var right = (data && data.right) || [];
    var wrong = (data && data.wrong) || [];
    var cursorIndex = (data && data.cursorIndex) || 0;
    var radicalWrong = !!(data && data.radicalWrong);

    // Reset radical wrong status
    var first = dom.slots && dom.slots[0];
    if (first) first.classList.remove(constants.CLASSES.radicalWrong);
    if (radicalWrong && first)
      first.classList.add(constants.CLASSES.radicalWrong);

    // Clear all
    for (var i = 1; i < dom.slots.length; i++) {
      var el = dom.slots[i];
      el.classList.remove(
        constants.CLASSES.right,
        constants.CLASSES.wrong,
        constants.CLASSES.cursor
      );
    }

    // Apply right and wrong
    for (var r = 0; r < right.length; r++) {
      var ri = right[r] + 1;
      if (dom.slots[ri]) dom.slots[ri].classList.add(constants.CLASSES.right);
    }
    for (var w = 0; w < wrong.length; w++) {
      var wi = wrong[w] + 1;
      if (dom.slots[wi]) dom.slots[wi].classList.add(constants.CLASSES.wrong);
    }

    // Cursor
    var ci = cursorIndex;
    if (dom.slots[ci]) dom.slots[ci].classList.add(constants.CLASSES.cursor);
  }

  root.CJL.questBarView = {
    renderQuestCharacter: renderQuestCharacter,
    applyQuestIndicators: applyQuestIndicators,
  };
})();
