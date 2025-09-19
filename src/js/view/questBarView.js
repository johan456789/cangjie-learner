// Quest bar view: renders radical + mapped labels and applies indicators

import { CLASSES, SELECTORS } from "../constants.js";

let dom = null;
const prevState = {
  right: [],
  wrong: [],
  cursorIndex: null,
  radicalWrong: false,
};
function ensureDomCache() {
  if (dom) return dom;
  const container = document.querySelector(SELECTORS.questAlphabet);
  const children = container ? container.children : [];
  dom = { container: container, slots: children };
  return dom;
}

/**
 * renderQuestCharacter
 * @param {{radical:string, mappedLabels:string[], isRadicalMode:boolean}} args
 */
export function renderQuestCharacter(args) {
  ensureDomCache();
  const radical = (args && args.radical) || "";
  const mappedLabels = (args && args.mappedLabels) || [];
  const isRadicalMode = !!(args && args.isRadicalMode);

  if (!dom.container || !dom.slots || dom.slots.length === 0) return;
  if (dom.slots[0]) {
    dom.slots[0].textContent = radical;
    // Always clear radical-wrong state when a new character is rendered
    dom.slots[0].classList.remove(CLASSES.radicalWrong);
  }

  for (let i = 1; i < dom.slots.length; i++) {
    const el = dom.slots[i];
    el.classList.remove(CLASSES.right, CLASSES.wrong, CLASSES.cursor);
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
export function applyQuestIndicators(data) {
  ensureDomCache();
  const right = (data && data.right) || [];
  const wrong = (data && data.wrong) || [];
  const cursorIndex = data && data.cursorIndex;
  const radicalWrong = !!(data && data.radicalWrong);

  // Radical wrong diff
  const first = dom.slots && dom.slots[0];
  if (first) {
    if (prevState.radicalWrong && !radicalWrong)
      first.classList.remove(CLASSES.radicalWrong);
    else if (!prevState.radicalWrong && radicalWrong)
      first.classList.add(CLASSES.radicalWrong);
  }

  // Build sets for prev and next
  const prevRightSet = {};
  for (let pr = 0; pr < prevState.right.length; pr++)
    prevRightSet[prevState.right[pr]] = true;
  const prevWrongSet = {};
  for (let pw = 0; pw < prevState.wrong.length; pw++)
    prevWrongSet[prevState.wrong[pw]] = true;
  const nextRightSet = {};
  for (let nr = 0; nr < right.length; nr++) nextRightSet[right[nr]] = true;
  const nextWrongSet = {};
  for (let nw = 0; nw < wrong.length; nw++) nextWrongSet[wrong[nw]] = true;

  // Apply diffs for right/wrong
  for (let i = 1; i < dom.slots.length; i++) {
    const el = dom.slots[i];
    const codeIndex = i - 1;
    const hadRight = !!prevRightSet[codeIndex];
    const hasRight = !!nextRightSet[codeIndex];
    if (hadRight !== hasRight) {
      if (hasRight) el.classList.add(CLASSES.right);
      else el.classList.remove(CLASSES.right);
    }
    const hadWrong = !!prevWrongSet[codeIndex];
    const hasWrong = !!nextWrongSet[codeIndex];
    if (hadWrong !== hasWrong) {
      if (hasWrong) el.classList.add(CLASSES.wrong);
      else el.classList.remove(CLASSES.wrong);
    }
    // Cursor will be handled separately
    el.classList.remove(CLASSES.cursor);
  }

  // Cursor diff
  const prevCursor = prevState.cursorIndex;
  if (prevCursor !== cursorIndex) {
    if (dom.slots[prevCursor])
      dom.slots[prevCursor].classList.remove(CLASSES.cursor);
    if (dom.slots[cursorIndex])
      dom.slots[cursorIndex].classList.add(CLASSES.cursor);
  } else if (dom.slots[cursorIndex]) {
    // Re-apply if same to ensure visibility
    dom.slots[cursorIndex].classList.add(CLASSES.cursor);
  }

  // Save for next diff
  prevState.right = right.slice();
  prevState.wrong = wrong.slice();
  prevState.cursorIndex = cursorIndex;
  prevState.radicalWrong = radicalWrong;
}

// Backward-compatibility shim
if (typeof window !== "undefined") {
  window.CJL = window.CJL || {};
  window.CJL.questBarView = {
    renderQuestCharacter: renderQuestCharacter,
    applyQuestIndicators: applyQuestIndicators,
  };
}
