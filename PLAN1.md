### PLAN 1 — Frontend modularization: separate State, View, and Controller (highest priority)

**Why this matters**
- **Tight coupling**: `keyExercise.js` mixes state, DOM reads/writes, and event wiring inside IIFEs. Functions like `indicate`, `setNewCharacter`, and `setMode` interleave logic with DOM mutation, making the code hard to test and reason about.
- **Ambiguous naming and implicit data flow**: Variables like `key`, `mapper`, `nowCharacter`, and the reliance on DOM order (`keyboard.children[i].children`) create fragile dependencies.
- **Un-testable core logic**: Picking characters, comparing input, and computing UI indicators are not isolated from the DOM, preventing unit testing and leading to regressions when making changes.

**Goals**
- **Isolate pure logic** (state transitions, comparisons, hint computation) from **imperative DOM updates**.
- Introduce a **thin View layer** that receives declarative instructions (e.g., set of classes to apply) rather than computing them inline.
- Keep existing behavior and UI intact while enabling **incremental migration** and **unit testing** of the core logic.

---

**Scope (no functional changes, structure only)**
- Extract pure state and logic into a new module.
- Extract DOM rendering into a view module with a minimal API.
- Introduce a controller that connects inputs to state and view.
- Preserve `keyExercise.html` and CSS behavior. No visual changes.

**Non-goals (for this plan)**
- Rewriting HTML/CSS or introducing a build system.
- Changing feature behavior (radical mode, layout toggle, visibility toggle remain the same).

---

**Staged steps**
1) Establish module boundaries
   - Create `src/js/state/questState.js` with:
     - `initializeState({ defaultCharacterArray, radicalPools })`
     - `pickRandomCharacter(state)`
     - `compareInput(state, input)` → returns index of first mismatch or length
     - `computeIndicators(state, input)` → returns a structure describing which positions are right/wrong/cursor and which keyboard hint to show
     - `setMode(state, { isRadicalMode, categoryKey })` → returns new state plus the active pool
   - All functions are pure and side-effect free.

2) Build a declarative View layer
   - Create `src/js/view/keyboardView.js` with:
     - `renderKeyboardLabels({ isEnglishLayout, originalLabels })`
     - `applyKeyStates({ hintKey, pressedKey, disabledKeys })`
   - Create `src/js/view/questBarView.js` with:
     - `renderQuestCharacter({ radical, mappedLabels })`
     - `applyQuestIndicators({ right, wrong, cursorIndex, radicalWrong })`
   - Keep DOM queries inside the view modules and cache references. Avoid re-querying per keystroke.

3) Introduce a controller
   - Create `src/js/controller/questController.js` that:
     - Listens to input events and mode/category changes.
     - Calls state methods and instructs views using the returned declarative data.
     - Adapts to existing `keyExercise.html` without structural changes.

4) Strangler adapter over current globals
   - Keep current `keyboard` and `questCheck` IIFEs as wrappers that delegate to the controller.
   - Preserve the current public API surface (`press`, `hint`, `check`, `setMode`, `isRadical`) during migration, so the rest of the file keeps working.

5) Extract constants and selectors
   - Move hard-coded IDs and magic strings to `src/js/constants.js` (e.g., IDs like `keyboardMap`, classes `press`, `hint`, `disabled`, and regex `/[^a-y]/`).
   - Define `RADICAL_POOLS` centrally and pass to state initialization.

6) Unit tests for core logic
   - Add minimal tests for `pickRandomCharacter`, `compareInput`, and `computeIndicators` using a zero-config runner (e.g., `uvu` or a tiny custom harness run via `node`).
   - Keep tests out of the critical path; they run locally and in CI later.

7) Incremental cutover
   - Replace calls in `keyExercise.js` to use the controller; keep function signatures stable.
   - Once stable, remove redundant logic from the old IIFEs and keep the wrappers thin.

---

**Deliverables**
- `src/js/state/questState.js` (pure logic)
- `src/js/view/keyboardView.js`, `src/js/view/questBarView.js` (DOM only)
- `src/js/controller/questController.js` (wires events to state and view)
- `src/js/constants.js` (selectors, class names, regexes, radical pools)
- Minimal unit tests for state functions

**Acceptance criteria**
- All existing features behave identically (manual check):
  - Single-character mode hints advance correctly.
  - Radical mode disables non-pool keys and only highlights on mistakes.
  - Visibility toggle and layout toggle still work as before.
- No direct DOM manipulation remains inside state functions.
- `computeIndicators` returns a deterministic structure that the view applies without branching on business rules.
- Core state functions covered by tests (happy path + edge cases), and tests pass.

**Risks and mitigations**
- Risk: Unintended behavior changes during split. Mitigation: strangler wrappers, side-by-side manual verification.
- Risk: Performance regressions. Mitigation: cache DOM references in view; batch classList changes.

**Rollback plan**
- The old IIFEs remain as adapters until all features are validated. Revert controller wiring to return to current behavior in one commit if needed.


