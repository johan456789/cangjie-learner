### ES6+ Plan 2 — Internal ES module migration (bridged, low risk)

Goal: Convert internal modules to ESM while preserving the existing runtime by bridging through `window.CJL` so that `questController` continues to work. No HTML changes yet; keep `<script defer>` order. This phase focuses on `src/js/constants.js` and `src/js/state/questState.js` first, then views.

#### Scope
- Files: `src/js/constants.js`, `src/js/state/questState.js`, `src/js/view/keyboardView.js`, `src/js/view/questBarView.js`.
- Keep `src/js/controller/questController.js` on `window.CJL` for now.

#### Objectives
- Replace IIFEs with ESM exports in the above files.
- Export named bindings and default‑free modules for clarity:
  - `constants.js`: `export const CLASSES`, `SELECTORS`, `INVALID_KEY_REGEX`, `TIMINGS`, `RADICAL_POOLS`.
  - `questState.js`: `export function initializeState`, `pickRandomCharacter`, `compareInput`, `computeIndicators`, `setMode`.
  - `keyboardView.js`: `export function renderKeyboardLabels`, `applyKeyStates`, `getOriginalLabels`, `bindKeyHoldHandlers`.
  - `questBarView.js`: `export function renderQuestCharacter`, `applyQuestIndicators`.
- At the bottom of each converted file, temporarily attach a compatibility shim to `window.CJL` if present (read‑only composition), e.g. `if (typeof window!=='undefined'){ window.CJL = window.CJL||{}; window.CJL.constants = { ... } }` so existing controller keeps working.

#### Step‑by‑step
1) Convert `constants.js` to ESM
   - Replace `var` with `const`/`let` (already enforced by Plan 1).
   - Export named constants.
   - Build `RADICAL_POOLS.all` via spread: `RADICAL_POOLS.all = [...RADICAL_POOLS.philosophy, ...RADICAL_POOLS.stroke, ...RADICAL_POOLS.human, ...RADICAL_POOLS.shape, '難x']`.
   - Add optional window shim for backward compatibility.

2) Convert `state/questState.js` to ESM
   - Export named functions.
   - Provide a `window.CJL.questState` shim that references the exported functions.

3) Convert views to ESM
   - `keyboardView.js` and `questBarView.js` export their functions.
   - Each file’s optional `window.CJL.*` shim composes the exported functions into the previous object shapes.

4) Validate with the unchanged controller
   - Because of the shims, the existing controller should continue to read from `window.CJL.*` and work as before.

#### Verification
- Reload and exercise both modes thoroughly (same checklist as Plan 1).
- Confirm no regressions: measure perceived timings, key press visuals, overlay behavior.
- Ensure the page still loads without `<script type="module">` changes yet (controller still uses globals).

#### Exit criteria
- `constants.js`, `questState.js`, `keyboardView.js`, `questBarView.js` are true ES modules exporting named APIs.
- Temporary compatibility shims keep `window.CJL.*` working for the legacy controller.

