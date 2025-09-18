// Global constants and selectors for Cangjie Learner (no side effects)
(function () {
  var root = typeof window !== "undefined" ? window : globalThis;
  if (!root.CJL) root.CJL = {};

  // Class names used across views
  var CLASSES = {
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
  var SELECTORS = {
    keyboardMap: "#keyboardMap",
    questAlphabet: "#questAlphabet",
    inputBar: "#inputBar",
    characterList: "#character",
    modeSelect: "#modeSelect",
    categorySelect: "#categorySelect",
  };

  // Valid key regex (only a..y)
  var INVALID_KEY_REGEX = /[^a-y]/;

  // Radical pools (kept identical to original logic)
  var RADICAL_POOLS = {
    philosophy: ["日a", "月b", "金c", "木d", "水e", "火f", "土g"],
    stroke: ["竹h", "戈i", "十j", "大k", "中l", "一m", "弓n"],
    human: ["人o", "心p", "手q", "口r"],
    shape: ["尸s", "廿t", "山u", "女v", "田w", "卜y"],
  };
  RADICAL_POOLS.all = []
    .concat(RADICAL_POOLS.philosophy)
    .concat(RADICAL_POOLS.stroke)
    .concat(RADICAL_POOLS.human)
    .concat(RADICAL_POOLS.shape)
    .concat(["難x"]);

  root.CJL.constants = {
    CLASSES: CLASSES,
    SELECTORS: SELECTORS,
    INVALID_KEY_REGEX: INVALID_KEY_REGEX,
    RADICAL_POOLS: RADICAL_POOLS,
  };
})();
