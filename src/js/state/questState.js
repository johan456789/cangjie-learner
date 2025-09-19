// Pure quest state and logic (no DOM). All functions are side-effect free.
(function () {
  var root = typeof window !== "undefined" ? window : globalThis;
  if (!root.CJL) root.CJL = {};

  /**
   * initializeState
   * @param {Object} args
   * @param {string[]} args.defaultCharacterArray - full list including sentinels
   * @param {Object} args.radicalPools - pools keyed by category
   * @returns {Object} state
   */
  function initializeState(args) {
    var defaultCharacterArray = (args && args.defaultCharacterArray) || [];
    var radicalPools = (args && args.radicalPools) || {};
    return {
      defaultCharacterArray: defaultCharacterArray.slice(),
      characterArray: defaultCharacterArray.slice(),
      radicalPools: radicalPools,
      nowCharacter: "",
      isRadicalMode: false,
      lastPickedCharacter: null,
      activeCategoryKey: "philosophy",
    };
  }

  /**
   * pickRandomCharacter
   * @param {Object} state
   * @returns {{state: Object, character: string}}
   */
  function pickRandomCharacter(state) {
    var start = 1;
    var end = state.characterArray.length - 2;
    var count = end - start + 1;
    var idx;
    if (count <= 0) return { state: state, character: state.characterArray[0] };
    if (
      state.isRadicalMode &&
      count > 1 &&
      state.lastPickedCharacter !== null
    ) {
      do {
        idx = Math.floor(Math.random() * count) + start;
      } while (state.characterArray[idx] === state.lastPickedCharacter);
    } else {
      idx = Math.floor(Math.random() * count) + start;
    }
    var character = state.characterArray[idx];
    var next = Object.assign({}, state, { lastPickedCharacter: character });
    return { state: next, character: character };
  }

  /**
   * compareInput: index of first mismatch, or full length if equal
   * @param {Object} state
   * @param {string} input
   * @returns {number}
   */
  function compareInput(state, input) {
    var code = state.nowCharacter;
    for (var i = 0, l = code.length; i < l; i++) {
      if (input.charAt(i) !== code.charAt(i)) return i;
    }
    return code.length;
  }

  /**
   * computeIndicators
   * @param {Object} state
   * @param {string} input
   * @returns {{right:number[], wrong:number[], cursorIndex:number, hintKey:string|null, radicalWrong:boolean}}
   */
  function computeIndicators(state, input) {
    var code = state.nowCharacter;
    var index = compareInput(state, input);
    var right = [];
    var wrong = [];
    // Cursor behavior:
    // - Normal mode: cursor moves to one position after current input.
    //   If input exceeds code length, do NOT clamp to the last slot, since that would
    //   visually override the wrong indicator. Instead, signal "no cursor" with -1.
    // - Radical mode: keep cursor at the first slot (like original behavior).
    var cursorIndex;
    if (state.isRadicalMode) {
      cursorIndex = Math.min(1, code.length);
    } else {
      var desired = (input ? input.length : 0) + 1;
      cursorIndex = desired > code.length ? -1 : desired;
    }
    var hintKey = null;
    var radicalWrong = false;

    if (!state.isRadicalMode) {
      for (var i = 0; i < index; i++) right.push(i);
      for (var j = index; j < input.length && j < code.length; j++)
        wrong.push(j);
      hintKey = code.charAt(index) || null;
    } else {
      // Radical mode: highlight only when wrong, and show the radical hint
      if (input && input.length > index) {
        radicalWrong = true;
        hintKey = code.charAt(0) || null;
      } else if (!input) {
        radicalWrong = false;
        hintKey = null;
      }
      // right/wrong arrays unused by view in radical mode but keep shape
    }

    return {
      right: right,
      wrong: wrong,
      cursorIndex: cursorIndex,
      hintKey: hintKey,
      radicalWrong: radicalWrong,
    };
  }

  /**
   * setMode
   * @param {Object} state
   * @param {{isRadicalMode:boolean, categoryKey:string}} args
   * @returns {{state:Object, activePool:string[]}}
   */
  function setMode(state, args) {
    var isRadicalMode = !!(args && args.isRadicalMode);
    var categoryKey = (args && args.categoryKey) || "philosophy";
    var next = Object.assign({}, state, {
      isRadicalMode: isRadicalMode,
      activeCategoryKey: categoryKey,
      lastPickedCharacter: null,
    });
    if (isRadicalMode) {
      var pool = (state.radicalPools && state.radicalPools[categoryKey]) || [];
      next.characterArray = [""].concat(pool).concat([""]);
      return { state: next, activePool: pool.slice() };
    } else {
      next.characterArray = state.defaultCharacterArray.slice();
      return { state: next, activePool: [] };
    }
  }

  root.CJL.questState = {
    initializeState: initializeState,
    pickRandomCharacter: pickRandomCharacter,
    compareInput: compareInput,
    computeIndicators: computeIndicators,
    setMode: setMode,
  };
})();
