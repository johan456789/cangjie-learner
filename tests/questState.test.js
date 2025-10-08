import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initializeState,
  pickRandomCharacter,
  compareInput,
  computeIndicators,
  setMode,
} from "../src/js/state/questState.js";

describe("questState (pure state)", () => {
  const defaultCharacterArray = ["abc", "xyz", "foo"];
  const radicalPools = {
    philosophy: ["a", "b", "c"],
    animals: ["d", "e"],
  };

  let state;
  beforeEach(() => {
    state = initializeState({ defaultCharacterArray, radicalPools });
  });

  it("initializeState returns expected defaults", () => {
    expect(state.defaultCharacterArray).toEqual(defaultCharacterArray);
    expect(state.characterArray).toEqual(defaultCharacterArray);
    expect(state.radicalPools).toBe(radicalPools);
    expect(state.mode).toBe("char");
    expect(state.activeCategoryKey).toBe("philosophy");
    expect(state.lastPickedCharacter).toBeNull();
  });

  it("pickRandomCharacter picks within bounds and updates lastPickedCharacter", () => {
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      const { state: next, character } = pickRandomCharacter(state);
      state = next;
      expect(defaultCharacterArray).toContain(character);
      seen.add(character);
    }
    expect(defaultCharacterArray).toContain(state.lastPickedCharacter);

    // Avoid immediate repeat when possible
    state.lastPickedCharacter = "abc";
    const spy = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0) // first index -> 'abc'
      .mockReturnValueOnce(0.9); // pick another
    const { character: picked2 } = pickRandomCharacter(state);
    expect(picked2).not.toBe("abc");
    spy.mockRestore();
  });

  describe("compareInput computes first mismatch index", () => {
    beforeEach(() => {
      state.nowCharacter = "abcd";
    });

    it("exact match returns full length", () => {
      expect(compareInput(state, "abcd")).toBe(4);
    });

    it("early mismatch returns index", () => {
      expect(compareInput(state, "abXd")).toBe(2);
    });

    it("empty input returns 0", () => {
      expect(compareInput(state, "")).toBe(0);
    });

    it("input longer than code returns full code length", () => {
      expect(compareInput(state, "abcdef")).toBe(4);
    });
  });

  describe("computeIndicators in char mode", () => {
    beforeEach(() => {
      state.mode = "char";
      state.nowCharacter = "abcd";
    });

    it("cursor index equals input.length + 1, becomes -1 when input exceeds code length", () => {
      expect(computeIndicators(state, "").cursorIndex).toBe(1);
      expect(computeIndicators(state, "a").cursorIndex).toBe(2);
      expect(computeIndicators(state, "abc").cursorIndex).toBe(4);
      expect(computeIndicators(state, "abcde").cursorIndex).toBe(-1);
    });

    it("right indices fill to first mismatch, wrong marks mismatched positions only, hintKey next expected", () => {
      let res = computeIndicators(state, "ab");
      expect(res.right).toEqual([0, 1]);
      expect(res.wrong).toEqual([]);
      expect(res.hintKey).toBe("c");

      res = computeIndicators(state, "abX");
      expect(res.right).toEqual([0, 1]);
      expect(res.wrong).toEqual([2]);
      expect(res.hintKey).toBe("c");

      res = computeIndicators(state, "abcdef");
      expect(res.right).toEqual([0, 1, 2, 3]);
      expect(res.wrong).toEqual([]); // extra beyond code length ignored for wrong array
      expect(res.hintKey).toBe(null); // past end
    });
  });

  describe("computeIndicators in radical mode", () => {
    beforeEach(() => {
      state.mode = "radical";
      state.nowCharacter = "pqrs";
    });

    it("cursor index clamps to first slot (1 or code length min)", () => {
      expect(computeIndicators(state, "").cursorIndex).toBe(1);
      expect(computeIndicators(state, "p").cursorIndex).toBe(1);
      expect(computeIndicators(state, "long input").cursorIndex).toBe(1);
    });

    it("with wrong input sets radicalWrong and hintKey to first letter", () => {
      const res = computeIndicators(state, "x");
      expect(res.radicalWrong).toBe(true);
      expect(res.hintKey).toBe("p");
    });

    it("with empty input, radicalWrong false and hintKey null", () => {
      const res = computeIndicators(state, "");
      expect(res.radicalWrong).toBe(false);
      expect(res.hintKey).toBeNull();
    });
  });

  describe("setMode transitions", () => {
    it("char → radical updates array to pool copy and resets lastPickedCharacter", () => {
      const { state: next, activePool } = setMode(state, {
        isRadicalMode: true,
        categoryKey: "philosophy",
      });
      expect(next.mode).toBe("radical");
      expect(next.activeCategoryKey).toBe("philosophy");
      expect(next.lastPickedCharacter).toBeNull();
      expect(next.characterArray).toEqual(radicalPools.philosophy);
      expect(activePool).toEqual(radicalPools.philosophy);
    });

    it("radical → char resets characterArray to defaults and clears pool", () => {
      let res = setMode(state, { isRadicalMode: true, categoryKey: "animals" });
      state = res.state;
      const back = setMode(state, { isRadicalMode: false });
      expect(back.state.mode).toBe("char");
      expect(back.state.characterArray).toEqual(defaultCharacterArray);
      expect(back.activePool).toEqual([]);
    });

    it("'aux' mode leaves characterArray as default list", () => {
      const { state: next, activePool } = setMode(state, { mode: "aux" });
      expect(next.mode).toBe("aux");
      expect(next.characterArray).toEqual(defaultCharacterArray);
      expect(activePool).toEqual([]);
    });
  });
});
