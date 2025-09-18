### PLAN 2 — Naming, constants, and data shape normalization (high priority)

**Why this matters**
- **Inconsistent, ambiguous naming** reduces readability and makes onboarding difficult. Examples: `key`, `mapper`, `nowCharacter`, `questCheck` as both data and behavior, `isRoot` meaning radical mode.
- **Magic strings and IDs** are scattered: element IDs (`keyboardMap`, `inputBar`, `questAlphabet`), class names (`press`, `hint`, `right`, `wrong`, `cursor`, `disabled`), and regex `/[^a-y]/` live inline, making changes risky.
- **Divergent JSON field names** between `export_auxiliary_forms_json.py` and `download_auxiliary_svgs.py` (`輔助字形` vs `fuzhu_zixing`, `字例` vs `zili`, `說明` vs `shuo_ming`) force fragile adapters.

**Goals**
- Introduce a consistent, descriptive naming scheme for variables, functions, and flags.
- Centralize all selectors, class names, and constants.
- Align JSON schema and accessors across scripts to remove implicit knowledge and hand-written mappings.

---

**Scope**
- No behavior change. Only naming, constant extraction, and data shape normalization. Minor adapters allowed to maintain backward compatibility.

**Staged steps**
1) Define naming guidelines and apply to JS
   - Variables: prefer full words (`currentCharacter` over `nowCharacter`, `keyboardElementMap` over `key`).
   - Boolean flags: positive phrasing (`isRadicalMode` already ok; rename `isRoot` → `isRadicalModeSelected`).
   - Functions: verb phrases (`computeIndicators`, `renderKeyboardLabels`).
   - Update JSDoc annotations accordingly.

2) Centralize constants
   - Add `src/js/constants.js` (or reuse from Plan 1) with:
     - DOM IDs: `ID_INPUT_BAR`, `ID_KEYBOARD_MAP`, `ID_QUEST_ALPHABET`, etc.
     - CSS class tokens: `CLASS_PRESS`, `CLASS_HINT`, `CLASS_DISABLED`, `CLASS_RIGHT`, `CLASS_WRONG`, `CLASS_CURSOR`, `CLASS_RADICAL_WRONG`.
     - Regex patterns: `PATTERN_ALLOWED_KEYS` for `/^[a-y]+$/`.
     - Timings: key press timeout `PRESS_MS = 150`, overlay delay `OVERLAY_DELAY_MS = 200`.
   - Replace inline strings with imports from constants.

3) Normalize data shapes between Python scripts
   - Define a single schema document `experiment/auxiliary_forms.schema.md` describing keys in English identifiers alongside Chinese labels, e.g.:
     - `key_letter` (A–Z), `cangjie_radical`, `auxiliary_forms` (list of wikilinks), `examples` (list of wikilinks), `notes` (wikitext string).
   - Update `export_auxiliary_forms_json.py` to emit both Chinese and English keys (backward compatible), e.g. keep `"輔助字形"` and also include `"auxiliary_forms"`.
   - Update `download_auxiliary_svgs.py` to read the new English keys primarily, with fallback to old Chinese keys for compatibility.

4) Add lightweight validation
   - Add `experiment/validate_auxiliary_forms.py` to assert schema correctness (keys present, lists of strings, A–Z ordering) and report mismatches.
   - Run via `uv run` as part of a simple preflight.

5) Document conventions
   - Create `CONTRIBUTING.md` section listing naming rules and constants guidelines.

---

**Deliverables**
- `src/js/constants.js` and refactor of references in JS files.
- `experiment/auxiliary_forms.schema.md` describing the shared JSON structure.
- Adjusted `export_auxiliary_forms_json.py` and `download_auxiliary_svgs.py` to support the standardized keys (additive, no breaking change).
- `experiment/validate_auxiliary_forms.py` for schema checks.

**Acceptance criteria**
- No inline magic strings remain for IDs, class names, regexes, or timings in JS.
- Variable and function names reflect their purpose clearly; lints or code search show consistent naming.
- Python scripts successfully process existing JSON and new JSON without code changes elsewhere; downloading still works and paths remain unchanged.
- Validation script passes on the current `experiment/auxiliary_forms.json`.

**Risks and mitigations**
- Risk: Missed references when centralizing constants. Mitigation: search-based replacement and smoke test all UI flows.
- Risk: Confusion during transition to new schema. Mitigation: dual-key emission (Chinese + English) and clear docs.

**Rollback plan**
- Keep a branch with only docs and constants. If issues arise, revert Python script changes to previous version; JS can continue using old strings until fixed.


