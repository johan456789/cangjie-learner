// Auxiliary view: renders panel with fuzhu strip and explanation

import {
  SELECTORS,
  CLASSES,
  AUX_BASE_PATH,
  SIMILAR_FORMS_TEXT,
} from "../constants.js";

let dom = null;

function ensureDom() {
  if (dom) return dom;
  const panel = document.querySelector(SELECTORS.auxPanel);
  const strip = panel ? panel.querySelector(".fuzhu-strip") : null;
  const explanation = panel ? panel.querySelector(".explanation") : null;
  const similarForms = panel
    ? panel.querySelector(SELECTORS.auxSimilarForms)
    : null;
  dom = {
    panel: panel,
    strip: strip,
    explanation: explanation,
    similarForms: similarForms,
  };
  if (dom.strip) dom.strip.setAttribute("aria-hidden", "true");
  if (dom.explanation) dom.explanation.setAttribute("aria-hidden", "true");
  if (dom.similarForms) dom.similarForms.setAttribute("aria-hidden", "true");
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
 * Convert a subset of MediaWiki wikitext embedded in shuo_ming into DOM nodes.
 * - Replaces [[Image:*.svg|22px]] (and localized File namespaces) with inline <img>
 * - Strips <ref>...</ref> blocks (and self-closing variants)
 *
 * @param {HTMLElement} container
 * @param {string} wikitext
 * @param {string} basePath
 */
function renderShuoMingWikitext(container, wikitext, basePath) {
  if (!container) return;
  const text = typeof wikitext === "string" ? wikitext : "";

  // Strip <ref> ... </ref> (including attributes) and self-closing <ref/>
  const withoutRefs = text
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "");

  // Build a fragment by scanning for [[File:...]] style inclusions
  const frag = document.createDocumentFragment();
  const fileNamespaces = "File|Image|檔案|文件|圖像|圖片";
  const re = new RegExp(
    "\\[\\[\\s*(?:(?:" +
      fileNamespaces +
      "))\\s*:\\s*([^|\\]]+)\\s*(?:\\|([^\\]]*))?\\]\\]",
    "gi"
  );

  let lastIndex = 0;
  let match;
  while ((match = re.exec(withoutRefs))) {
    const preceding = withoutRefs.slice(lastIndex, match.index);
    if (preceding) frag.appendChild(document.createTextNode(preceding));

    const fileName = (match[1] || "").trim();
    const options = (match[2] || "").trim();

    const img = document.createElement("img");
    img.className = CLASSES.inlineSvg;
    img.alt = fileName || "svg";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.src = (basePath || "") + fileName;

    // Try to read a size like 22px from options; default to 1em height
    let heightPx = null;
    const sizeMatch = /([0-9]{1,3})\s*px/i.exec(options);
    if (sizeMatch) {
      heightPx = parseInt(sizeMatch[1], 10);
    }
    if (heightPx && Number.isFinite(heightPx))
      img.style.height = heightPx + "px";

    frag.appendChild(img);
    lastIndex = re.lastIndex;
  }
  const tail = withoutRefs.slice(lastIndex);
  if (tail) frag.appendChild(document.createTextNode(tail));

  // Replace container content safely
  container.textContent = "";
  container.appendChild(frag);
}

/**
 * Render the 相近字形辨析 comparison: the correct form first, then the
 * look-alike form(s) whose key was pressed, each with its distinguishing note.
 *
 * @param {HTMLElement} container
 * @param {Array<{shape:{type:string, file?:string, text?:string}, codeLabel:string, shuoMing:string, isTarget:boolean}>} rows
 */
function renderSimilarForms(container, rows) {
  container.textContent = "";
  if (rows.length === 0) return;

  const title = document.createElement("h2");
  title.className = CLASSES.similarFormsTitle;
  title.textContent = SIMILAR_FORMS_TEXT.title;
  container.appendChild(title);

  for (const row of rows) {
    const item = document.createElement("div");
    item.className = CLASSES.similarForm;
    item.classList.toggle(CLASSES.similarFormTarget, !!row.isTarget);

    const shape = document.createElement("div");
    shape.className = CLASSES.similarFormShape;
    if (row.shape?.type === "image") {
      const img = document.createElement("img");
      img.alt = row.shape.file;
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.src = AUX_BASE_PATH + row.shape.file;
      shape.appendChild(img);
    } else {
      shape.textContent = row.shape?.text ?? "";
    }

    const role = document.createElement("div");
    role.className = CLASSES.similarFormRole;
    const roleText = row.isTarget
      ? SIMILAR_FORMS_TEXT.targetRole
      : SIMILAR_FORMS_TEXT.confusedRole;
    role.textContent = `${roleText}：${row.codeLabel}`;

    const note = document.createElement("div");
    note.className = CLASSES.similarFormNote;
    renderShuoMingWikitext(note, row.shuoMing, AUX_BASE_PATH);

    item.append(shape, role, note);
    container.appendChild(item);
  }
}

/**
 * applyAuxDetails
 * @param {{show:boolean, fuzhuFiles:string[], currentFuzhuIndex:number, shuoMingHtml:string, similarForms?:Array}} args
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
    renderShuoMingWikitext(dom.explanation, html, AUX_BASE_PATH);
  }

  if (dom.similarForms) {
    const rows = (show && args.similarForms) || [];
    renderSimilarForms(dom.similarForms, rows);
    dom.similarForms.setAttribute("aria-hidden", String(rows.length === 0));
  }

  // Toggle visibility cues without layout shift
  if (dom.strip) dom.strip.setAttribute("aria-hidden", String(!show));
  if (dom.explanation)
    dom.explanation.setAttribute("aria-hidden", String(!show));
}
