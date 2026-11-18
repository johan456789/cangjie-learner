import { describe, it, expect, beforeAll, beforeEach } from "vitest";
const suite = typeof document === "undefined" ? describe.skip : describe;
import { SELECTORS, CLASSES, SIMILAR_FORMS_TEXT } from "../../src/js/constants.js";
import {
  renderAuxPanel,
  setAuxPanelVisible,
  applyAuxDetails,
} from "../../src/js/view/auxiliaryView.js";

function buildAuxFixture() {
  const container = document.createElement("div");
  container.innerHTML = `
    <div id="auxPanel">
      <div class="fuzhu-strip"></div>
      <div class="explanation"></div>
      <div class="similar-forms"></div>
    </div>
  `;
  document.body.appendChild(container);
}

function resetAuxView() {
  const panel = document.querySelector(SELECTORS.auxPanel);
  if (!panel) return;
  const strip = panel.querySelector(".fuzhu-strip");
  const explanation = panel.querySelector(".explanation");
  if (strip) {
    strip.textContent = "";
    strip.setAttribute("aria-hidden", "true");
  }
  if (explanation) {
    explanation.textContent = "";
    explanation.setAttribute("aria-hidden", "true");
  }
  const similarForms = panel.querySelector(SELECTORS.auxSimilarForms);
  if (similarForms) {
    similarForms.textContent = "";
    similarForms.setAttribute("aria-hidden", "true");
  }
  panel.style.display = "";
}

suite("auxiliaryView", () => {
  beforeAll(() => {
    buildAuxFixture();
    renderAuxPanel();
  });
  beforeEach(() => {
    resetAuxView();
  });

  it("setAuxPanelVisible toggles layout display", () => {
    const panel = document.querySelector(SELECTORS.auxPanel);
    setAuxPanelVisible(true);
    expect(panel.style.display).toBe("block");
    setAuxPanelVisible(false);
    expect(panel.style.display).toBe("none");
  });

  it("applyAuxDetails rebuilds strip and explanation and toggles aria-hidden", () => {
    const files = ["a.svg", "b.svg", "c.svg"];
    applyAuxDetails({
      show: true,
      fuzhuFiles: files,
      currentFuzhuIndex: 1,
      shuoMingHtml: "See [[File:x.svg|22px]] and text <ref>ignore</ref>",
    });

    const strip = document.querySelector(`${SELECTORS.auxPanel} .fuzhu-strip`);
    const items = strip.querySelectorAll(".fuzhu-item");
    expect(items.length).toBe(3);
    expect(items[1].classList.contains("current")).toBe(true);
    // imgs use AUX_BASE_PATH + file; just assert alt attribute and src suffix
    const img0 = items[0].querySelector("img");
    expect(img0.getAttribute("alt")).toBe("a.svg");
    expect(img0.getAttribute("src")).toMatch(/a\.svg$/);

    const explanation = document.querySelector(
      `${SELECTORS.auxPanel} .explanation`
    );
    // should contain an inline image and stripped ref text
    const inlineImg = explanation.querySelector("img.inline-svg");
    expect(inlineImg).toBeTruthy();
    expect(inlineImg.getAttribute("src")).toMatch(/x\.svg$/);
    // ensure ref content removed
    expect(explanation.textContent).not.toMatch(/ignore/);

    // aria-hidden toggled off when show=true
    expect(strip.getAttribute("aria-hidden")).toBe("false");
    expect(explanation.getAttribute("aria-hidden")).toBe("false");

    // Hide details
    applyAuxDetails({
      show: false,
      fuzhuFiles: [],
      currentFuzhuIndex: -1,
      shuoMingHtml: "",
    });
    expect(strip.getAttribute("aria-hidden")).toBe("true");
    expect(explanation.getAttribute("aria-hidden")).toBe("true");
  });

  it("applyAuxDetails renders 相近字形辨析 rows only while shown", () => {
    const similarForms = document.querySelector(
      `${SELECTORS.auxPanel} ${SELECTORS.auxSimilarForms}`
    );
    const rows = [
      {
        shape: { type: "image", file: "cjrm-j2.svg" },
        codeLabel: "十",
        shuoMing: "頂上有直點 [[Image:x.svg|18px]] <ref>ignore</ref>",
        isTarget: true,
      },
      {
        shape: { type: "text", text: "巳" },
        codeLabel: "口山",
        shuoMing: "頂上無點",
        isTarget: false,
      },
    ];
    const details = {
      fuzhuFiles: [],
      currentFuzhuIndex: -1,
      shuoMingHtml: "",
    };

    applyAuxDetails({ ...details, show: true, similarForms: rows });
    expect(similarForms.getAttribute("aria-hidden")).toBe("false");
    expect(
      similarForms.querySelector(`.${CLASSES.similarFormsTitle}`).textContent
    ).toBe(SIMILAR_FORMS_TEXT.title);
    const items = similarForms.querySelectorAll(`.${CLASSES.similarForm}`);
    expect(items.length).toBe(2);

    expect(items[0].classList.contains(CLASSES.similarFormTarget)).toBe(true);
    expect(
      items[0]
        .querySelector(`.${CLASSES.similarFormShape} img`)
        .getAttribute("src")
    ).toMatch(/cjrm-j2\.svg$/);
    expect(
      items[0].querySelector(`.${CLASSES.similarFormRole}`).textContent
    ).toBe(`${SIMILAR_FORMS_TEXT.targetRole}：十`);
    const note = items[0].querySelector(`.${CLASSES.similarFormNote}`);
    expect(note.querySelector(`img.${CLASSES.inlineSvg}`)).toBeTruthy();
    expect(note.textContent).toContain("頂上有直點");
    expect(note.textContent).not.toMatch(/ignore/);

    expect(items[1].classList.contains(CLASSES.similarFormTarget)).toBe(false);
    expect(
      items[1].querySelector(`.${CLASSES.similarFormShape}`).textContent
    ).toBe("巳");
    expect(
      items[1].querySelector(`.${CLASSES.similarFormRole}`).textContent
    ).toBe(`${SIMILAR_FORMS_TEXT.confusedRole}：口山`);

    // Rows are dropped when details are hidden or there is no comparison
    applyAuxDetails({ ...details, show: false, similarForms: rows });
    expect(similarForms.getAttribute("aria-hidden")).toBe("true");
    expect(similarForms.children.length).toBe(0);
    applyAuxDetails({ ...details, show: true });
    expect(similarForms.getAttribute("aria-hidden")).toBe("true");
  });
});
