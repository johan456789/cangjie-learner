import { describe, it, expect, vi } from "vitest";
import {
  registerCharacters,
  getWeight,
  adjustWeight,
  adjustByOutcome,
  getTotalWeight,
  weightedPickAvoidRepeat,
  pickWeightedCharacter,
  DEFAULTS,
} from "../src/js/state/questWeights.js";

// Helpers
function resetMode(mode, chars = []) {
  // Re-register with empty to clear list, then register provided chars (merge semantics)
  // To avoid cross-test leakage, prefer unique mode strings per test.
  registerCharacters(mode, []);
  registerCharacters(mode, chars);
}

let modeCounter = 0;
function newMode(prefix) {
  modeCounter += 1;
  return `${prefix}-${Date.now()}-${modeCounter}`;
}

describe("questWeights (weights and storage)", () => {
  it("registerCharacters adds unique sanitized characters and initializes weights", () => {
    const mode = newMode("register");
    const list = registerCharacters(mode, [" a ", "b", "", null, "b", "c"]);
    expect(new Set(list)).toEqual(new Set(["a", "b", "c"]));
    const total = getTotalWeight(mode);
    expect(total).toBe(3 * DEFAULTS.defaultWeight);
    expect(getWeight(mode, "a")).toBe(DEFAULTS.defaultWeight);
    expect(getWeight(mode, "b")).toBe(DEFAULTS.defaultWeight);
    expect(getWeight(mode, "c")).toBe(DEFAULTS.defaultWeight);
  });

  it("getWeight defaults and sanitization", () => {
    const mode = newMode("defaults");
    resetMode(mode, ["x"]);
    expect(getWeight(mode, " ")).toBe(DEFAULTS.defaultWeight);
    expect(getWeight(mode, null)).toBe(DEFAULTS.defaultWeight);
    const before = getWeight(mode, "x");
    expect(before).toBe(DEFAULTS.defaultWeight);
    const next = adjustWeight(mode, "x", -1000);
    expect(next).toBe(DEFAULTS.minWeight);
    expect(getWeight(mode, "x")).toBe(DEFAULTS.minWeight);
  });

  it("adjustWeight clamps to MIN and updates total", () => {
    const mode = newMode("adjust");
    resetMode(mode, ["a", "b"]);
    const initialTotal = getTotalWeight(mode);
    expect(initialTotal).toBe(2 * DEFAULTS.defaultWeight);
    const inc = adjustWeight(mode, "a", +7);
    expect(inc).toBe(DEFAULTS.defaultWeight + 7);
    const dec = adjustWeight(mode, "b", -1000);
    expect(dec).toBe(DEFAULTS.minWeight);
    const expectedTotal = DEFAULTS.defaultWeight + 7 + DEFAULTS.minWeight;
    expect(getTotalWeight(mode)).toBe(expectedTotal);
  });

  it("adjustByOutcome policy", () => {
    const mode = newMode("policy");
    resetMode(mode, ["z"]);
    const afterWrong = adjustByOutcome(mode, "z", "wrong");
    expect(afterWrong).toBe(DEFAULTS.defaultWeight + DEFAULTS.wrongDelta);
    const afterRight = adjustByOutcome(mode, "z", "right");
    expect(afterRight).toBe(afterWrong + DEFAULTS.rightDelta);
  });

  it("getTotalWeight recomputes when stored total is corrupt", () => {
    const mode = newMode("recompute");

    // Provide a fake localStorage so readRaw prefers it over in-memory store
    const store = new Map();
    const origWindow = global.window;
    // eslint-disable-next-line no-global-assign
    global.window = {
      localStorage: {
        getItem(key) {
          // Force corrupt (too low) total only for this mode's total key
          if (
            typeof key === "string" &&
            key.startsWith(`${mode}:`) &&
            key.endsWith("totalWeight")
          ) {
            return "0"; // below minTotal triggers recompute path
          }
          return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
          store.set(key, String(value));
        },
        removeItem(key) {
          store.delete(key);
        },
        clear() {
          store.clear();
        },
      },
    };

    try {
      // Write characters and correct total (which will be ignored by our getItem override for total)
      registerCharacters(mode, ["a", "b", "c"]);
      // Now getTotalWeight should detect corrupt stored total (0 < minTotal=3*1)
      // and recompute to the correct sum (3 * defaultWeight)
      const recomputed = getTotalWeight(mode);
      expect(recomputed).toBe(3 * DEFAULTS.defaultWeight);
    } finally {
      // eslint-disable-next-line no-global-assign
      global.window = origWindow;
    }
  });

  it("weightedPickAvoidRepeat excludes last when possible", () => {
    const mode = newMode("avoid");
    resetMode(mode, ["a", "b"]);
    adjustWeight(mode, "a", 0);
    adjustWeight(mode, "b", 0);
    const last = "a";
    for (let i = 0; i < 10; i++) {
      const pick = weightedPickAvoidRepeat(mode, ["a", "b"], last);
      expect(pick).toBe("b");
    }
  });

  it("pickWeightedCharacter honors weights and de-duplicates input", () => {
    const mode = newMode("pick");
    resetMode(mode, ["a", "b"]);
    adjustWeight(mode, "a", -DEFAULTS.defaultWeight + DEFAULTS.minWeight);
    adjustWeight(mode, "b", +50);
    const picks = [];
    const spy = vi.spyOn(Math, "random");
    spy
      .mockReturnValueOnce(0.0)
      .mockReturnValueOnce(0.9999)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.1);
    picks.push(pickWeightedCharacter(mode, ["a", "a", "b", "b"]));
    picks.push(pickWeightedCharacter(mode, ["a", "a", "b", "b"]));
    picks.push(pickWeightedCharacter(mode, ["a", "a", "b", "b"]));
    picks.push(pickWeightedCharacter(mode, ["a", "a", "b", "b"]));
    spy.mockRestore();
    expect(new Set(picks)).toEqual(new Set(["a", "b"]));
    const countB = picks.filter((x) => x === "b").length;
    expect(countB).toBeGreaterThanOrEqual(2);
  });

  it("memory fallback without localStorage", () => {
    const mode = newMode("mem");
    const origWindow = global.window;
    // eslint-disable-next-line no-global-assign
    global.window = {
      get localStorage() {
        throw new Error("denied");
      },
    };
    try {
      resetMode(mode, []);
      registerCharacters(mode, ["m", "n"]);
      const total = getTotalWeight(mode);
      expect(total).toBe(2 * DEFAULTS.defaultWeight);
      adjustWeight(mode, "m", +3);
      expect(getWeight(mode, "m")).toBe(DEFAULTS.defaultWeight + 3);
    } finally {
      // eslint-disable-next-line no-global-assign
      global.window = origWindow;
    }
  });
});
