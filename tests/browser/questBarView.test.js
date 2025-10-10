import { describe, it, expect, beforeAll, beforeEach } from "vitest";
const suite = typeof document === "undefined" ? describe.skip : describe;
import { CLASSES, SELECTORS } from "../../src/js/constants.js";
import {
  renderQuestCharacter,
  applyQuestIndicators,
} from "../../src/js/view/questBarView.js";

function buildQuestFixture(slotCount = 6) {
  const slots = Array.from({ length: slotCount }, () => `<span></span>`).join(
    ""
  );
  const container = document.createElement("div");
  container.innerHTML = `<div id="questAlphabet">${slots}</div>`;
  document.body.appendChild(container);
}

function resetQuestView() {
  const container = document.querySelector(SELECTORS.questAlphabet);
  if (!container) return;
  const slots = container.children;
  if (slots[0]) {
    slots[0].textContent = "";
    slots[0].classList.remove(CLASSES.radicalWrong);
  }
  for (let i = 1; i < slots.length; i++) {
    slots[i].textContent = "";
    slots[i].classList.remove(CLASSES.right, CLASSES.wrong, CLASSES.cursor);
  }
}

suite("questBarView", () => {
  beforeAll(() => {
    buildQuestFixture(6); // 1 radical + 5 code slots
  });
  beforeEach(() => {
    resetQuestView();
  });

  it("renderQuestCharacter non-aux renders radical and clears indicators", () => {
    const radical = "日";
    const mappedLabels = ["a", "b", "c", "d", "e"];
    renderQuestCharacter({ radical, mappedLabels, isRadicalMode: false });

    const container = document.querySelector(SELECTORS.questAlphabet);
    const slots = container.children;

    // slot[0] has radical text node and no radicalWrong class
    expect(slots[0].textContent).toBe(radical);
    expect(slots[0].classList.contains(CLASSES.radicalWrong)).toBe(false);

    // label slots filled for non-radical mode
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].textContent).toBe(mappedLabels[i - 1] || "");
      expect(slots[i].classList.contains(CLASSES.right)).toBe(false);
      expect(slots[i].classList.contains(CLASSES.wrong)).toBe(false);
      expect(slots[i].classList.contains(CLASSES.cursor)).toBe(false);
    }
  });

  it("renderQuestCharacter aux mode renders image", () => {
    const file = "aux.svg";
    const base = "base/";
    renderQuestCharacter({
      isAuxMode: true,
      auxZiliFile: file,
      auxBasePath: base,
    });

    const first = document.querySelector(SELECTORS.questAlphabet).children[0];
    const img = first.querySelector("img");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe(base + file);
    expect(img.getAttribute("alt")).toBe(file);
  });

  it("applyQuestIndicators diffs classes and updates cursor", () => {
    // Initial render
    const mappedLabels = ["a", "b", "c", "d", "e"];
    renderQuestCharacter({ radical: "日", mappedLabels, isRadicalMode: false });

    const container = document.querySelector(SELECTORS.questAlphabet);
    const slots = container.children;

    // First state: right=[0,1], wrong=[3], cursorIndex=3
    applyQuestIndicators({
      right: [0, 1],
      wrong: [3],
      cursorIndex: 3,
      radicalWrong: false,
    });
    expect(slots[1].classList.contains(CLASSES.right)).toBe(true);
    expect(slots[2].classList.contains(CLASSES.right)).toBe(true);
    expect(slots[4].classList.contains(CLASSES.wrong)).toBe(true);
    expect(slots[3].classList.contains(CLASSES.cursor)).toBe(true);

    // Second state: move cursor, switch wrong to index 2, drop right index 1
    applyQuestIndicators({
      right: [0],
      wrong: [2],
      cursorIndex: 2,
      radicalWrong: true,
    });

    // right index 1 should be removed, only index 0 remains
    expect(slots[1].classList.contains(CLASSES.right)).toBe(true); // code index 0
    expect(slots[2].classList.contains(CLASSES.right)).toBe(false); // code index 1 cleared
    expect(slots[3].classList.contains(CLASSES.wrong)).toBe(true); // code index 2

    // cursor moved from slot[3] to slot[2]
    expect(slots[3].classList.contains(CLASSES.cursor)).toBe(false);
    expect(slots[2].classList.contains(CLASSES.cursor)).toBe(true);

    // radicalWrong toggled
    expect(slots[0].classList.contains(CLASSES.radicalWrong)).toBe(true);
  });
});
