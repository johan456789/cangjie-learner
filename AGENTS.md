# README for agents

Use uv to manage dependencies.

Also use uv to run scripts.

For example, to run `download_auxiliary_svgs.py`, use:

```sh
uv run experiment/download_auxiliary_svgs.py
```

## Web

Use modern JS. If you see legacy code, try to rewrite it if it's not too complex.

### Naming and constants guidelines

- Prefer descriptive names:
  - Variables: `currentCharacter`, `keyboardElementMap`.
  - Booleans: positive phrasing `isRadicalModeSelected`, `isEnglishLayout`.
  - Functions: verb phrases `computeIndicators`, `renderKeyboardLabels`.
- Centralize magic strings in `src/js/constants.js`:
  - Selectors: `SELECTORS.inputBar`, `SELECTORS.keyboardMap`, `SELECTORS.toggleLayout`, etc.
  - Classes: `CLASSES.press`, `CLASSES.hint`, `CLASSES.hidden`, `CLASSES.noFocus`, etc.
  - Regex: `INVALID_KEY_REGEX` for allowed input.
  - Timings: `TIMINGS.pressMs`, `TIMINGS.overlayDelayMs`.
- Do not hardcode IDs/class names in components; import from `CJL.constants`.
