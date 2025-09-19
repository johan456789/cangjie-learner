// Quest bar view: renders radical + mapped labels and applies indicators
(function () {
  var root = typeof window !== "undefined" ? window : globalThis;
  if (!root.CJL) root.CJL = {};
  var constants = root.CJL.constants || { CLASSES: {}, SELECTORS: {} };

  var dom = null;
  var prevState = {
    right: [],
    wrong: [],
    cursorIndex: null,
    radicalWrong: false,
  };
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

    // Reset previous indicator cache when a new character is rendered
    prevState.right = [];
    prevState.wrong = [];
    prevState.cursorIndex = null;
    prevState.radicalWrong = false;
  }

  /**
   * applyQuestIndicators
   * @param {{right:number[], wrong:number[], cursorIndex:number, radicalWrong:boolean}} data
   */
  function applyQuestIndicators(data) {
    ensureDomCache();
    var right = (data && data.right) || [];
    var wrong = (data && data.wrong) || [];
    var cursorIndex = data && data.cursorIndex;
    var radicalWrong = !!(data && data.radicalWrong);

    // Radical wrong diff
    var first = dom.slots && dom.slots[0];
    if (first) {
      if (prevState.radicalWrong && !radicalWrong)
        first.classList.remove(constants.CLASSES.radicalWrong);
      else if (!prevState.radicalWrong && radicalWrong)
        first.classList.add(constants.CLASSES.radicalWrong);
    }

    // Build sets for prev and next
    var prevRightSet = {};
    for (var pr = 0; pr < prevState.right.length; pr++)
      prevRightSet[prevState.right[pr]] = true;
    var prevWrongSet = {};
    for (var pw = 0; pw < prevState.wrong.length; pw++)
      prevWrongSet[prevState.wrong[pw]] = true;
    var nextRightSet = {};
    for (var nr = 0; nr < right.length; nr++) nextRightSet[right[nr]] = true;
    var nextWrongSet = {};
    for (var nw = 0; nw < wrong.length; nw++) nextWrongSet[wrong[nw]] = true;

    // Apply diffs for right/wrong
    for (var i = 1; i < dom.slots.length; i++) {
      var el = dom.slots[i];
      var codeIndex = i - 1;
      var hadRight = !!prevRightSet[codeIndex];
      var hasRight = !!nextRightSet[codeIndex];
      if (hadRight !== hasRight) {
        if (hasRight) el.classList.add(constants.CLASSES.right);
        else el.classList.remove(constants.CLASSES.right);
      }
      var hadWrong = !!prevWrongSet[codeIndex];
      var hasWrong = !!nextWrongSet[codeIndex];
      if (hadWrong !== hasWrong) {
        if (hasWrong) el.classList.add(constants.CLASSES.wrong);
        else el.classList.remove(constants.CLASSES.wrong);
      }
      // Cursor will be handled separately
      el.classList.remove(constants.CLASSES.cursor);
    }

    // Cursor diff
    var prevCursor = prevState.cursorIndex;
    if (prevCursor !== cursorIndex) {
      if (dom.slots[prevCursor])
        dom.slots[prevCursor].classList.remove(constants.CLASSES.cursor);
      if (dom.slots[cursorIndex])
        dom.slots[cursorIndex].classList.add(constants.CLASSES.cursor);
    } else if (dom.slots[cursorIndex]) {
      // Re-apply if same to ensure visibility
      dom.slots[cursorIndex].classList.add(constants.CLASSES.cursor);
    }

    // Save for next diff
    prevState.right = right.slice();
    prevState.wrong = wrong.slice();
    prevState.cursorIndex = cursorIndex;
    prevState.radicalWrong = radicalWrong;
  }

  root.CJL.questBarView = {
    renderQuestCharacter: renderQuestCharacter,
    applyQuestIndicators: applyQuestIndicators,
  };
})();
