// Pure quest state and logic (no DOM). All functions are side-effect free.

/**
 * initializeState
 * @param {Object} args
 * @param {string[]} args.defaultCharacterArray - full list including sentinels
 * @param {Object} args.radicalPools - pools keyed by category
 * @returns {Object} state
 */
export function initializeState(args) {
  const defaultCharacterArray = (args && args.defaultCharacterArray) || [];
  const radicalPools = (args && args.radicalPools) || {};
  return {
    defaultCharacterArray: defaultCharacterArray.slice(),
    characterArray: defaultCharacterArray.slice(),
    radicalPools: radicalPools,
    nowCharacter: "",
    // Unified mode: 'char' | 'radical' | 'aux'
    mode: "char",
    lastPickedCharacter: null,
    activeCategoryKey: "philosophy",
  };
}

/**
 * pickRandomCharacter
 * @param {Object} state
 * @returns {{state: Object, character: string}}
 */
export function pickRandomCharacter(state) {
  const start = 1;
  const end = state.characterArray.length - 2;
  const count = end - start + 1;
  let idx;
  if (count <= 0) return { state: state, character: state.characterArray[0] };
  if (
    state.mode !== "char" &&
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
export function compareInput(state, input) {
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
export function computeIndicators(state, input) {
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
  if (state.mode !== "char") {
    cursorIndex = Math.min(1, code.length);
  } else {
    const desired = (input ? input.length : 0) + 1;
    cursorIndex = desired > code.length ? -1 : desired;
  }
  let hintKey = null;
  let radicalWrong = false;

  if (state.mode === "char") {
    for (let i = 0; i < index; i++) right.push(i);
    for (let j = index; j < input.length && j < code.length; j++) wrong.push(j);
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
export function setMode(state, args) {
  const mode =
    (args && args.mode) || (args && args.isRadicalMode ? "radical" : "char");
  const categoryKey = (args && args.categoryKey) || "philosophy";
  const next = Object.assign({}, state, {
    mode: mode,
    activeCategoryKey: categoryKey,
    lastPickedCharacter: null,
  });
  if (mode === "radical") {
    const pool = (state.radicalPools && state.radicalPools[categoryKey]) || [];
    next.characterArray = [""].concat(pool).concat([""]);
    return { state: next, activePool: pool.slice() };
  } else if (mode === "char") {
    next.characterArray = state.defaultCharacterArray.slice();
    return { state: next, activePool: [] };
  } else {
    // 'aux' mode: state machine for characters is driven by controller; keep array untouched
    next.characterArray = state.defaultCharacterArray.slice();
    return { state: next, activePool: [] };
  }
}
