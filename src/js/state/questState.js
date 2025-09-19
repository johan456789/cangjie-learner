// Pure quest state and logic (no DOM). All functions are side-effect free.
(function () {
  const root = typeof window !== "undefined" ? window : globalThis;
  if (!root.CJL) root.CJL = {};

  /**
   * initializeState
   * @param {Object} args
   * @param {string[]} args.defaultCharacterArray - full list including sentinels
   * @param {Object} args.radicalPools - pools keyed by category
   * @returns {Object} state
   */
  function initializeState(args) {
    const defaultCharacterArray = (args && args.defaultCharacterArray) || [];
    const radicalPools = (args && args.radicalPools) || {};
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
    const start = 1;
    const end = state.characterArray.length - 2;
    const count = end - start + 1;
    let idx;
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
    const character = state.characterArray[idx];
    const next = Object.assign({}, state, { lastPickedCharacter: character });
    return { state: next, character: character };
  }

  /**
   * compareInput: index of first mismatch, or full length if equal
   * @param {Object} state
   * @param {string} input
   * @returns {number}
   */
  function compareInput(state, input) {
    const code = state.nowCharacter;
    for (let i = 0, l = code.length; i < l; i++) {
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
    const code = state.nowCharacter;
    const index = compareInput(state, input);
    const right = [];
    const wrong = [];
    // Cursor behavior:
    // - Normal mode: cursor moves to one position after current input.
    //   If input exceeds code length, do NOT clamp to the last slot, since that would
    //   visually override the wrong indicator. Instead, signal "no cursor" with -1.
    // - Radical mode: keep cursor at the first slot (like original behavior).
    let cursorIndex;
    if (state.isRadicalMode) {
      cursorIndex = Math.min(1, code.length);
    } else {
      const desired = (input ? input.length : 0) + 1;
      cursorIndex = desired > code.length ? -1 : desired;
    }
    let hintKey = null;
    let radicalWrong = false;

    if (!state.isRadicalMode) {
      for (let i = 0; i < index; i++) right.push(i);
      for (let j = index; j < input.length && j < code.length; j++)
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
    const isRadicalMode = !!(args && args.isRadicalMode);
    const categoryKey = (args && args.categoryKey) || "philosophy";
    const next = Object.assign({}, state, {
      isRadicalMode: isRadicalMode,
      activeCategoryKey: categoryKey,
      lastPickedCharacter: null,
    });
    if (isRadicalMode) {
      const pool =
        (state.radicalPools && state.radicalPools[categoryKey]) || [];
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
