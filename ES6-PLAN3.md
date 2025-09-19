### ES6+ Plan 3 — Controller migration and module entry

Goal: Switch runtime loading to proper ES modules and remove the remaining reliance on globals. Replace `<script defer>` tags with a single module entry. Keep behavior identical.

#### Scope
- Files: `src/js/controller/questController.js`, new `src/js/index.js`, `keyExercise.html`, and removal of temporary `window.CJL` shims where feasible.

#### Objectives
- Convert `questController.js` to ESM:
  - Import from `constants.js`, `state/questState.js`, `view/keyboardView.js`, `view/questBarView.js` using named imports.
  - Export a named `controller` with the same surface: `check`, `setMode`, `isRadical`, `toggleLayout`, `getOriginalLabels`, `setDebug`.
- Introduce `src/js/index.js` that:
  - Imports `controller` and performs the existing `init` + `wireEvents` logic on `DOMContentLoaded`.
  - Exposes no globals.
- Update `keyExercise.html`:
  - Replace multiple script tags with a single `<script type="module" src="src/js/index.js"></script>`.
  - Ensure the DOM structure and element IDs remain unchanged so selectors continue to work.
- Remove or narrow the temporary `window.CJL` shims in other modules once the controller no longer depends on them.

#### Step‑by‑step
1) Create `src/js/index.js`
   - Move the controller’s auto‑init and wiring code into this file; import `controller` and re‑use the same implementation.

2) Convert and export `questController.js`
   - Change to named imports; replace references to `root.CJL.*` with imported symbols.
   - Keep internal state shape and logic intact.

3) Swap HTML to module entry
   - Update `keyExercise.html` to load `index.js` as ESM.
   - Remove old `<script defer>` tags.

4) Remove `window.CJL` shims
   - After confirming everything works via ESM, delete the temporary shims from other modules.

#### Verification
- Full manual pass across both modes (same checklist as earlier plans).
- Confirm no globals are required; the app bootstraps via `index.js`.
- Confirm zero `var` remain (carryover invariant from Plan 1).

#### Exit criteria
- Application runs solely via ES modules with a single module entry.
- No lingering globals or `var` usages.

