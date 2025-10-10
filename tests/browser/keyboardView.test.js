import { describe, it, expect, beforeAll, beforeEach } from "vitest";
const suite = typeof document === "undefined" ? describe.skip : describe;
import { CLASSES, SELECTORS } from "../../src/js/constants.js";
import {
  renderKeyboardLabels,
  applyKeyStates,
  bindKeyHoldHandlers,
} from "../../src/js/view/keyboardView.js";

function buildKeyboardFixture() {
  const keySpans = Array.from({ length: 26 }, (_, i) => {
    const alpha = String.fromCharCode(97 + i);
    // give non-English original labels to verify restoration
    const label = `原${alpha}`;
    return `<span id="key-${alpha}">${label}</span>`;
  }).join("");
  const container = document.createElement("div");
  container.innerHTML = `
    <button id="toggleLayout">英文鍵盤</button>
    <div id="keyboardMap">${keySpans}</div>
  `;
  document.body.appendChild(container);
}

function resetKeyboardState() {
  // Restore labels and remove classes without replacing nodes (module caches DOM)
  for (let i = 0; i < 26; i++) {
    const alpha = String.fromCharCode(97 + i);
    const node = document.querySelector(`#key-${alpha}`);
    if (node) {
      node.textContent = `原${alpha}`;
      node.className = node.className
        .split(" ")
        .filter(
          (c) =>
            c &&
            c !== CLASSES.hint &&
            c !== CLASSES.disabled &&
            c !== CLASSES.press
        )
        .join(" ");
    }
  }
  const toggle = document.querySelector(SELECTORS.toggleLayout);
  if (toggle) {
    toggle.textContent = "英文鍵盤";
    toggle.setAttribute("aria-pressed", "false");
  }
}

suite("keyboardView", () => {
  beforeAll(() => {
    buildKeyboardFixture();
  });
  beforeEach(() => {
    resetKeyboardState();
  });

  it("renderKeyboardLabels switches labels and button state", () => {
    // First switch to English layout
    renderKeyboardLabels({ isEnglishLayout: true });

    // All keys should be A..Z
    for (let i = 0; i < 26; i++) {
      const alpha = String.fromCharCode(97 + i);
      const node = document.querySelector(`#key-${alpha}`);
      expect(node).toBeTruthy();
      expect(node.textContent).toBe(alpha.toUpperCase());
    }

    const toggle = document.querySelector(SELECTORS.toggleLayout);
    expect(toggle.textContent).toBe("倉頡鍵盤");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    // Then restore to original labels
    renderKeyboardLabels({ isEnglishLayout: false });
    for (let i = 0; i < 26; i++) {
      const alpha = String.fromCharCode(97 + i);
      const node = document.querySelector(`#key-${alpha}`);
      expect(node.textContent).toBe(`原${alpha}`);
    }
    expect(toggle.textContent).toBe("英文鍵盤");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("applyKeyStates applies hint and disabled classes", () => {
    applyKeyStates({
      hintKey: "a",
      disabledKeys: { b: true, c: true },
    });

    const a = document.querySelector("#key-a");
    const b = document.querySelector("#key-b");
    const c = document.querySelector("#key-c");
    const d = document.querySelector("#key-d");

    expect(a.classList.contains(CLASSES.hint)).toBe(true);
    expect(b.classList.contains(CLASSES.disabled)).toBe(true);
    expect(c.classList.contains(CLASSES.disabled)).toBe(true);
    expect(d.classList.contains(CLASSES.disabled)).toBe(false);
  });

  it("bindKeyHoldHandlers toggles press class and clears on blur/visibilitychange", async () => {
    bindKeyHoldHandlers();

    const a = document.querySelector("#key-a");
    const b = document.querySelector("#key-b");

    // Press and release "a"
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", bubbles: true })
    );
    expect(a.classList.contains(CLASSES.press)).toBe(true);
    document.dispatchEvent(
      new KeyboardEvent("keyup", { key: "a", bubbles: true })
    );
    expect(a.classList.contains(CLASSES.press)).toBe(false);

    // Press "b" and simulate window blur to clear stuck key
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "b", bubbles: true })
    );
    expect(b.classList.contains(CLASSES.press)).toBe(true);
    window.dispatchEvent(new Event("blur"));
    expect(b.classList.contains(CLASSES.press)).toBe(false);

    // Try visibilitychange path: press again, flag document.hidden, dispatch event
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "b", bubbles: true })
    );
    expect(b.classList.contains(CLASSES.press)).toBe(true);
    try {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
    } catch {}
    document.dispatchEvent(new Event("visibilitychange"));
    expect(b.classList.contains(CLASSES.press)).toBe(false);
  });
});
