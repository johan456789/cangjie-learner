// Quest weight storage with localStorage backing and in-memory fallback.
// Designed for reuse across modes; currently used for auxiliary mode biasing.

import { STORAGE_KEYS } from "../constants.js";

const DEFAULT_WEIGHT = 20;
const MIN_WEIGHT = 1;
const CHAR_LIST_SUFFIX = STORAGE_KEYS.characterListSuffix;
const TOTAL_SUFFIX = STORAGE_KEYS.totalWeightSuffix;

const memoryStore = Object.create(null);

function safeMode(mode) {
  return typeof mode === "string" && mode ? mode : "default";
}

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    if (window.localStorage) return window.localStorage;
  } catch (e) {}
  return null;
}

function readRaw(key) {
  if (!key) return null;
  const storage = getStorage();
  if (storage) {
    try {
      const value = storage.getItem(key);
      if (value !== null && value !== undefined) {
        memoryStore[key] = value;
        return value;
      }
    } catch (e) {}
  }
  if (Object.prototype.hasOwnProperty.call(memoryStore, key)) {
    return memoryStore[key];
  }
  return null;
}

function writeRaw(key, value) {
  if (!key) return;
  const stringValue = value == null ? "" : String(value);
  memoryStore[key] = stringValue;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(key, stringValue);
    } catch (e) {}
  }
}

function readNumber(key) {
  const raw = readRaw(key);
  if (raw === null || raw === undefined || raw === "") return NaN;
  const num = Number(raw);
  return Number.isFinite(num) ? num : NaN;
}

function writeNumber(key, value) {
  if (!key) return;
  const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  writeRaw(key, String(safe));
}

function readJsonArray(key) {
  const raw = readRaw(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const result = [];
      for (let i = 0; i < parsed.length; i++) {
        const item = typeof parsed[i] === "string" ? parsed[i] : "";
        if (item) result.push(item);
      }
      return result;
    }
  } catch (e) {}
  return [];
}

function writeJsonArray(key, arr) {
  if (!key) return;
  const payload = Array.isArray(arr) ? arr : [];
  writeRaw(key, JSON.stringify(payload));
}

function sanitizeChar(char) {
  if (typeof char !== "string") return "";
  const trimmed = char.trim();
  return trimmed ? trimmed : "";
}

function weightKey(mode, char) {
  return safeMode(mode) + ":" + char;
}

function charactersKey(mode) {
  return safeMode(mode) + ":" + CHAR_LIST_SUFFIX;
}

function totalKey(mode) {
  return safeMode(mode) + ":" + TOTAL_SUFFIX;
}

function ensureWeightRecord(mode, char) {
  const key = weightKey(mode, char);
  let weight = readNumber(key);
  if (!Number.isFinite(weight) || weight < MIN_WEIGHT) {
    weight = DEFAULT_WEIGHT;
  } else {
    weight = Math.max(MIN_WEIGHT, Math.floor(weight));
  }
  writeNumber(key, weight);
  return weight;
}

function getCharacterList(mode) {
  if (!mode) return [];
  return readJsonArray(charactersKey(mode));
}

function recomputeTotal(mode) {
  const chars = getCharacterList(mode);
  if (chars.length === 0) {
    writeNumber(totalKey(mode), 0);
    return 0;
  }
  let total = 0;
  for (let i = 0; i < chars.length; i++) {
    total += ensureWeightRecord(mode, chars[i]);
  }
  writeNumber(totalKey(mode), total);
  return total;
}

export function registerCharacters(mode, characters) {
  if (!mode) return [];
  const existing = new Set(getCharacterList(mode));
  const incoming = Array.isArray(characters) ? characters : [];
  for (let i = 0; i < incoming.length; i++) {
    const char = sanitizeChar(incoming[i]);
    if (char) existing.add(char);
  }
  const merged = Array.from(existing);
  writeJsonArray(charactersKey(mode), merged);
  let total = 0;
  for (let i = 0; i < merged.length; i++) {
    total += ensureWeightRecord(mode, merged[i]);
  }
  writeNumber(totalKey(mode), total);
  return merged;
}

export function getWeight(mode, character) {
  if (!mode) return DEFAULT_WEIGHT;
  const char = sanitizeChar(character);
  if (!char) return DEFAULT_WEIGHT;
  const key = weightKey(mode, char);
  const weight = readNumber(key);
  if (!Number.isFinite(weight) || weight < MIN_WEIGHT) return DEFAULT_WEIGHT;
  return Math.floor(weight);
}

export function getTotalWeight(mode) {
  if (!mode) return 0;
  const chars = getCharacterList(mode);
  const minTotal = chars.length * MIN_WEIGHT;
  const total = readNumber(totalKey(mode));
  if (Number.isFinite(total) && total >= minTotal) {
    return Math.floor(total);
  }
  return recomputeTotal(mode);
}

export function adjustWeight(mode, character, delta) {
  if (!mode) return DEFAULT_WEIGHT;
  const char = sanitizeChar(character);
  if (!char) return DEFAULT_WEIGHT;
  const deltaValue = Number(delta);
  if (!Number.isFinite(deltaValue) || deltaValue === 0) {
    return getWeight(mode, char);
  }

  registerCharacters(mode, [char]);
  const current = getWeight(mode, char);
  const next = Math.max(MIN_WEIGHT, Math.floor(current + deltaValue));
  if (next === current) return next;

  writeNumber(weightKey(mode, char), next);

  const totalBefore = getTotalWeight(mode);
  const totalAfter = Math.max(0, totalBefore + (next - current));
  writeNumber(totalKey(mode), totalAfter);

  return next;
}

export function pickWeightedCharacter(mode, characters) {
  if (!mode) return null;
  const list = Array.isArray(characters) ? characters : [];
  const ordered = [];
  const seen = Object.create(null);
  for (let i = 0; i < list.length; i++) {
    const char = sanitizeChar(list[i]);
    if (!char || seen[char]) continue;
    seen[char] = true;
    ordered.push(char);
  }
  if (ordered.length === 0) return null;

  registerCharacters(mode, ordered);

  let total = 0;
  const weights = new Array(ordered.length);
  for (let i = 0; i < ordered.length; i++) {
    const weight = getWeight(mode, ordered[i]);
    weights[i] = weight;
    total += weight;
  }
  if (total <= 0) {
    return ordered[Math.floor(Math.random() * ordered.length)];
  }

  let threshold = Math.random() * total;
  for (let i = 0; i < ordered.length; i++) {
    threshold -= weights[i];
    if (threshold <= 0) return ordered[i];
  }
  return ordered[ordered.length - 1];
}
