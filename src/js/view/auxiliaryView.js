// Auxiliary view: renders panel with fuzhu strip and explanation

import { SELECTORS, AUX_BASE_PATH } from "../constants.js";

let dom = null;

function ensureDom() {
  if (dom) return dom;
  const panel = document.querySelector(SELECTORS.auxPanel);
  const strip = panel ? panel.querySelector(".fuzhu-strip") : null;
  const explanation = panel ? panel.querySelector(".explanation") : null;
  dom = { panel: panel, strip: strip, explanation: explanation };
  if (dom.strip) dom.strip.setAttribute("aria-hidden", "true");
  if (dom.explanation) dom.explanation.setAttribute("aria-hidden", "true");
  return dom;
}

export function renderAuxPanel() {
  ensureDom();
  return dom;
}

/**
 * setAuxPanelVisible
 * Ensure the aux panel does not take layout space when hidden.
 * @param {boolean} show
 */
export function setAuxPanelVisible(show) {
  ensureDom();
  if (!dom || !dom.panel) return;
  dom.panel.style.display = show ? "block" : "none";
}

/**
 * applyAuxDetails
 * @param {{show:boolean, fuzhuFiles:string[], currentFuzhuIndex:number, shuoMingHtml:string}} args
 */
export function applyAuxDetails(args) {
  ensureDom();
  if (!dom.panel) return;
  const show = !!(args && args.show);
  const files = (args && args.fuzhuFiles) || [];
  const currentIndex =
    typeof args.currentFuzhuIndex === "number" ? args.currentFuzhuIndex : -1;
  const html = (args && args.shuoMingHtml) || "";

  if (dom.strip) {
    // Rebuild strip
    dom.strip.textContent = "";
    for (let i = 0; i < files.length; i++) {
      const wrapper = document.createElement("span");
      wrapper.className = "fuzhu-item" + (i === currentIndex ? " current" : "");
      const img = document.createElement("img");
      img.alt = files[i];
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.src = AUX_BASE_PATH + files[i];
      wrapper.appendChild(img);
      dom.strip.appendChild(wrapper);
    }
  }

  if (dom.explanation) {
    dom.explanation.innerHTML = html;
  }

  // Toggle visibility cues without layout shift
  if (dom.strip) dom.strip.setAttribute("aria-hidden", String(!show));
  if (dom.explanation)
    dom.explanation.setAttribute("aria-hidden", String(!show));
}
