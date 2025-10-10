import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
const suite = typeof document === "undefined" ? describe.skip : describe;
import {
  CLASSES,
  SELECTORS,
  TIMINGS,
  AUX_JSON_PATH,
} from "../../src/js/constants.js";

function buildFullFixture() {
  const keySpans = Array.from({ length: 26 }, (_, i) => {
    const alpha = String.fromCharCode(97 + i);
    const label = `原${alpha}`;
    return `<span id="key-${alpha}">${label}</span>`;
  }).join("");

  const container = document.createElement("div");
  container.innerHTML = `
    <div id="questAlphabet">
      <span></span>
      <span></span><span></span><span></span><span></span><span></span>
    </div>
    <section id="auxPanel" aria-live="polite">
      <div class="fuzhu-strip" aria-hidden="true"></div>
      <div class="explanation" aria-hidden="true"></div>
    </section>
    <textarea id="inputBar" placeholder="請在此輸入英文字母"></textarea>
    <div id="menu">
      <label for="modeSelect">模式：</label>
      <select id="modeSelect">
        <option value="char">單字</option>
        <option value="radical">字根</option>
        <option value="aux">輔助字形</option>
      </select>
      <label for="categorySelect">字根類別：</label>
      <select id="categorySelect" disabled>
        <option value="all">全部</option>
        <option value="philosophy">哲理類</option>
        <option value="stroke">筆畫類</option>
        <option value="human">人體類</option>
        <option value="shape">字形類</option>
      </select>
      <button id="toggleVisibilityBtn">隱藏鍵盤</button>
      <button id="toggleLayout">英文鍵盤</button>
    </div>
    <div id="keyboardMap">${keySpans}</div>
    <pre id="character">日a\n月b\n金c\n木d\n水e\n火f\n土g</pre>
  `;
  document.body.appendChild(container);
}

function focusInput() {
  const input = document.querySelector(SELECTORS.inputBar);
  input.focus();
  return input;
}

async function nextTick() {
  await new Promise((r) => setTimeout(r, 0));
}

async function waitFor(predicate, timeoutMs = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (predicate()) return;
    } catch {}
    await nextTick();
  }
  throw new Error("waitFor timeout");
}

suite("Integration Flows (User Scenarios)", () => {
  beforeAll(() => {
    buildFullFixture();
  });
  beforeEach(async () => {
    // Reset inputs and classes minimally
    const input = document.querySelector(SELECTORS.inputBar);
    if (input) input.value = "";
    // Force rAF to schedule via setTimeout for test determinism
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      return setTimeout(cb, 0);
    });
    // Import app entry once per test fresh by clearing module cache
    // but in Vitest browser environment, dynamic import should reuse; calling index.js is idempotent
    await import("../../src/js/index.js");
    await nextTick();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Sanity: Layout Toggle", async () => {
    const toggle = document.querySelector(SELECTORS.toggleLayout);
    toggle.click();
    // Keys should be A..Z
    for (let i = 0; i < 26; i++) {
      const alpha = String.fromCharCode(97 + i);
      expect(document.querySelector(`#key-${alpha}`).textContent).toBe(
        alpha.toUpperCase()
      );
    }
    expect(toggle.textContent).toBe("倉頡鍵盤");
    // flip back
    toggle.click();
    expect(document.querySelector("#key-a").textContent).toBe("原a");
  });

  it("Sanity: Mode Switch enables category", async () => {
    const modeSelect = document.querySelector(SELECTORS.modeSelect);
    const categorySelect = document.querySelector(SELECTORS.categorySelect);
    modeSelect.value = "radical";
    modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();
    await nextTick();
    expect(categorySelect.disabled).toBe(false);
    // Default selection is 'all' which includes all letters but 'z'
    expect(
      document.querySelector("#key-z").classList.contains(CLASSES.disabled)
    ).toBe(true);
    expect(
      document.querySelector("#key-a").classList.contains(CLASSES.disabled)
    ).toBe(false);
  });

  it("Sanity: Category Selection updates radical pool", async () => {
    const modeSelect = document.querySelector(SELECTORS.modeSelect);
    const categorySelect = document.querySelector(SELECTORS.categorySelect);
    modeSelect.value = "radical";
    modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();
    await nextTick();
    categorySelect.value = "shape"; // has letters s,t,u,v,w,y
    categorySelect.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();
    await nextTick();
    const allowed = new Set(["s", "t", "u", "v", "w", "y"]);
    await waitFor(() =>
      document.querySelector("#key-a").classList.contains(CLASSES.disabled)
    );
    for (let i = 0; i < 26; i++) {
      const a = String.fromCharCode(97 + i);
      const node = document.querySelector(`#key-${a}`);
      const disabled = node.classList.contains(CLASSES.disabled);
      expect(disabled).toBe(!allowed.has(a));
    }
  });

  it("Sanity: Typing Input in 單字 mode", async () => {
    // Ensure mode is char
    const modeSelect = document.querySelector(SELECTORS.modeSelect);
    modeSelect.value = "char";
    modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();
    await nextTick();

    // Overflow typing: use valid letters to avoid input validation; verify no cursor
    const quest = document.querySelector(SELECTORS.questAlphabet);
    const slots = quest.children;
    const input = focusInput();
    input.value = "aaaaaaaaaa";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    // Ensure no slot has cursor when overflowed
    let anyCursor = false;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i].classList.contains(CLASSES.cursor)) anyCursor = true;
    }
    expect(anyCursor).toBe(false);
  });

  it("Sanity: Keyboard Hints", async () => {
    // Char mode
    const modeSelect = document.querySelector(SELECTORS.modeSelect);
    modeSelect.value = "char";
    modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();
    await nextTick();
    // Check that some key is hinted
    const input = focusInput();
    input.value = ""; // partial (empty) should hint next expected
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await waitFor(() => {
      for (let i = 0; i < 26; i++) {
        const a = String.fromCharCode(97 + i);
        const node = document.querySelector(`#key-${a}`);
        if (node && node.classList.contains(CLASSES.hint)) return true;
      }
      return false;
    });

    // Radical mode wrong input shows radical hint and flags radicalWrong
    modeSelect.value = "radical";
    modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();
    await nextTick();
    // constrain category to philosophy (letters a..g)
    const categorySelect = document.querySelector(SELECTORS.categorySelect);
    categorySelect.value = "philosophy";
    categorySelect.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();
    await nextTick();
    const quest2 = document.querySelector(SELECTORS.questAlphabet);
    const radicalSlot = quest2.children[0];
    input.value = "h"; // wrong for philosophy category
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(radicalSlot.classList.contains(CLASSES.radicalWrong)).toBe(true);
  });

  it("Sanity: Aux Mode Panel", async () => {
    // Mock fetch for aux JSON
    const mockJson = {
      A: {
        cangjie_char: "日",
        rows: [
          {
            shuo_ming: "Example [[File:a.svg|22px]] <ref>drop</ref>",
            fuzhu_zixing: [
              { file: "a.svg", zili: [{ file: "a1.svg" }] },
              { file: "a2.svg", zili: [{ file: "a21.svg" }] },
            ],
          },
        ],
      },
    };
    globalThis.fetch = vi.fn(async (url) => {
      expect(String(url)).toContain(AUX_JSON_PATH);
      return {
        json: async () => mockJson,
      };
    });

    const modeSelect = document.querySelector(SELECTORS.modeSelect);
    const categorySelect = document.querySelector(SELECTORS.categorySelect);
    modeSelect.value = "aux";
    categorySelect.value = "philosophy";
    modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await nextTick();
    await nextTick();

    // Panel is shown but details hidden initially
    const panel = document.querySelector(SELECTORS.auxPanel);
    expect(panel.style.display).toBe("block");
    const strip = panel.querySelector(".fuzhu-strip");
    const explanation = panel.querySelector(".explanation");
    expect(strip.getAttribute("aria-hidden")).toBe("true");
    expect(explanation.getAttribute("aria-hidden")).toBe("true");

    // After wrong input, details appear (category philosophy => correct letter is 'a', so use 'b')
    const input = focusInput();
    input.value = "b"; // wrong
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await waitFor(() => strip.getAttribute("aria-hidden") === "false");
    expect(explanation.getAttribute("aria-hidden")).toBe("false");
  });
});
