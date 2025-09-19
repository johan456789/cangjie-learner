// Global constants and selectors for Cangjie Learner (ES module)

// Class names used across views
export const CLASSES = {
  press: "press",
  hint: "hint",
  disabled: "disabled",
  right: "right",
  wrong: "wrong",
  cursor: "cursor",
  radicalWrong: "radical-wrong",
  hidden: "hidden",
  noFocus: "no-focus",
};

// DOM selectors used by views/controllers
export const SELECTORS = {
  keyboardMap: "#keyboardMap",
  questAlphabet: "#questAlphabet",
  inputBar: "#inputBar",
  characterList: "#character",
  modeSelect: "#modeSelect",
  categorySelect: "#categorySelect",
  toggleLayout: "#toggleLayout",
  toggleVisibilityBtn: "#toggleVisibilityBtn",
};

// Valid key regex (only a..y)
export const INVALID_KEY_REGEX = /[^a-y]/;

// Timings (ms)
export const TIMINGS = {
  pressMs: 150,
  overlayDelayMs: 200,
};

// Radical pools (kept identical to original logic)
export const RADICAL_POOLS = {
  philosophy: ["日a", "月b", "金c", "木d", "水e", "火f", "土g"],
  stroke: ["竹h", "戈i", "十j", "大k", "中l", "一m", "弓n"],
  human: ["人o", "心p", "手q", "口r"],
  shape: ["尸s", "廿t", "山u", "女v", "田w", "卜y"],
};
RADICAL_POOLS.all = [
  ...RADICAL_POOLS.philosophy,
  ...RADICAL_POOLS.stroke,
  ...RADICAL_POOLS.human,
  ...RADICAL_POOLS.shape,
  "難x",
];
