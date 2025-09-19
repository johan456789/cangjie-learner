#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = [
#   "requests",
#   "wikitextparser",
# ]
# ///
"""
Export the "輔助字形列表" wikitable from zh.wikibooks 倉頡輸入法/輔助字形
into a structured JSON file per the requested schema.

Output schema (example):
{
  "A": {
    "cangjie_char": "日",
    "rows": [
      {
        "fuzhu_zixing": [
          {
            "file": "cjrm-a0.svg",
            "zili": [
              {"file": "cjem-a0-1.svg", "label": "明"},
              {"file": "cjem-a0-2.svg", "label": "早"}
            ]
          },
          {
            "file": "cjrm-a1.svg",
            "zili": [
              {"file": "cjem-a1-1.svg", "label": "書"}
            ]
          }
        ],
        "shuo_ming": "<raw wikitext>"
      }
    ]
  },
  ...
}
"""

import json
import os
import re
import sys
from typing import Dict, List, Optional, Tuple

import requests
import wikitextparser as wtp

API_URL = "https://zh.wikibooks.org/w/api.php"
TITLE = "倉頡輸入法/輔助字形"
TARGET_TABLE_CAPTION = "輔助字形列表"
DEFAULT_OUTPUT = os.path.join(os.path.dirname(__file__), "auxiliary_forms.json")

# Canonical Cangjie letter → radical character mapping (Cangjie 5)
CANGJIE_KEY_TO_CHAR: Dict[str, str] = {
    "A": "日",
    "B": "月",
    "C": "金",
    "D": "木",
    "E": "水",
    "F": "火",
    "G": "土",
    "H": "竹",
    "I": "戈",
    "J": "十",
    "K": "大",
    "L": "中",
    "M": "一",
    "N": "弓",
    "O": "人",
    "P": "心",
    "Q": "手",
    "R": "口",
    "S": "尸",
    "T": "廿",
    "U": "山",
    "V": "女",
    "W": "田",
    "X": "難",
    "Y": "卜",
    "Z": "重",
}

# Match file links like [[File:xxx.svg|...]], including common Chinese aliases
# We will keep the FULL matched wikitext (group 0) to preserve alt text/labels, sizes, etc.
FILE_LINK_RE = re.compile(
    r"\[\[\s*(?:File|Image|檔案|文件|圖像|圖片)\s*:\s*([^|\]\n]+?\.(?:svg|SVG))\b[^\]]*\]\]",
    re.IGNORECASE,
)


def fetch_wikitext(title: str) -> str:
    params = {
        "action": "query",
        "format": "json",
        "titles": title,
        "prop": "revisions",
        "rvprop": "content",
        "rvslots": "main",
    }
    headers = {
        "User-Agent": (
            "cangjie-learner/0.1 (+https://github.com/; contact: local-script)"
        ),
        "Accept": "application/json",
    }
    resp = requests.get(API_URL, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    pages = data.get("query", {}).get("pages", {})
    if not pages:
        raise RuntimeError("No pages in API response")
    page = next(iter(pages.values()))
    revisions = page.get("revisions")
    if not revisions:
        raise RuntimeError("No revisions found for page")
    slots = revisions[0].get("slots", {})
    content = slots.get("main", {}).get("*") or slots.get("main", {}).get("content")
    if not content:
        content = revisions[0].get("*")
    if not content:
        raise RuntimeError("Failed to extract wikitext content from response")
    return content


def find_table_by_caption(parsed: wtp.WikiText, caption_contains: str) -> Optional[wtp.Table]:
    for table in parsed.tables:
        caption = getattr(table, "caption", None)
        caption_text = None
        if caption is not None:
            try:
                caption_text = (
                    caption.strip_code().strip()
                    if hasattr(caption, "strip_code")
                    else str(caption).strip()
                )
            except Exception:
                caption_text = str(caption).strip()
        haystack = (caption_text or table.string or "")
        if caption_contains in haystack:
            return table
    return None


def normalize_header(text: str) -> str:
    return re.sub(r"\s+", "", text or "").strip()


def extract_image_links(cell_wikitext: str) -> List[str]:
    if not cell_wikitext:
        return []
    # Use finditer so we can keep the entire wikitext match (group 0)
    seen: set = set()
    results: List[str] = []
    for m in FILE_LINK_RE.finditer(cell_wikitext):
        full = m.group(0).strip()
        if full not in seen:
            seen.add(full)
            results.append(full)
    return results


def _extract_label_from_file_link(full_wikitext: str) -> Optional[str]:
    # Extract the last non-empty, non-dimension parameter as label
    try:
        inner = full_wikitext.strip()[2:-2]  # strip [[ ]]
    except Exception:
        return None
    try:
        after_colon = inner.split(":", 1)[-1]
    except Exception:
        after_colon = inner
    parts = [p.strip() for p in after_colon.split("|")]
    # Skip filename (parts[0]); evaluate remaining params
    params = [p for p in parts[1:] if p]
    candidates: List[str] = []
    for p in params:
        if re.match(r"^\d+\s*px$", p, re.IGNORECASE):
            continue
        if "=" in p:
            continue
        candidates.append(p)
    return candidates[-1] if candidates else None


def sanitize_label(label: Optional[str]) -> str:
    """Remove MediaWiki variant markers like -{...}- and trim whitespace."""
    if not label:
        return ""
    text = str(label)
    # Replace all occurrences of -{ ... }- with inner content
    text = re.sub(r"-\{\s*(.*?)\s*\}-", r"\1", text)
    return text.strip()


def extract_files_with_labels(cell_wikitext: str) -> List[Tuple[str, Optional[str]]]:
    """Return list of (filename, optional_label) from a cell's wikitext."""
    if not cell_wikitext:
        return []
    seen: set = set()
    results: List[Tuple[str, Optional[str]]] = []
    for m in FILE_LINK_RE.finditer(cell_wikitext):
        full = m.group(0)
        filename = (m.group(1) or "").strip()
        if not filename:
            continue
        key = filename.lower()
        if key in seen:
            continue
        seen.add(key)
        label = sanitize_label(_extract_label_from_file_link(full))
        results.append((filename, label))
    return results


def _extract_group_token(filename: str) -> Optional[str]:
    """Extract grouping token like 'a0' from filenames such as 'cjrm-a0.svg' or 'cjem-a0-1.svg'."""
    m = re.search(r"-([a-z]\d+)(?:-|\.svg$)", filename, re.IGNORECASE)
    return m.group(1).lower() if m else None


def group_zili_by_fuzhu(fuzhu_files: List[str], zili_items: List[Tuple[str, Optional[str]]]) -> List[Dict[str, object]]:
    """Group zili items by matching token with each fuzhu file, preserving order.

    Returns list like [{"file": fuzhu_file, "zili": [{"file": z_file, "label": label}, ...]}, ...]
    """
    # Build token -> list of zili dicts
    token_to_zili: Dict[str, List[Dict[str, str]]] = {}
    for z_file, z_label in zili_items:
        token = _extract_group_token(z_file)
        if not token:
            continue
        token_to_zili.setdefault(token, []).append({
            "file": z_file,
            "label": (z_label or ""),
        })

    grouped: List[Dict[str, object]] = []
    for f_file in fuzhu_files:
        token = _extract_group_token(f_file)
        z_list = token_to_zili.get(token or "", [])
        grouped.append({
            "file": f_file,
            "zili": z_list,
        })
    return grouped


def locate_columns(header_row: List[str]) -> Tuple[int, Optional[int], Optional[int], Optional[int]]:
    # Return (label_idx, aux_idx, zili_idx, shuo_idx)
    header_norm = [normalize_header(h) for h in header_row]

    def find_one(candidates: List[str]) -> Optional[int]:
        for cand in candidates:
            if cand in header_norm:
                return header_norm.index(cand)
        return None

    label_idx = find_one(["按鍵", "鍵", "Key"])  # required
    aux_idx = find_one(["輔助字形", "辅助字形", "輔助", "辅助"])  # optional but expected
    zili_idx = find_one(["字例", "示例", "例子", "例", "字例（連結至SVG）"])  # optional
    shuo_idx = find_one(["說明", "说明", "備註", "备注", "註釋", "注釋", "註解"])  # optional

    if label_idx is None:
        raise RuntimeError("Could not locate '按鍵' column in header")
    return label_idx, aux_idx, zili_idx, shuo_idx


def build_output_structure(mat: List[List[str]]) -> Dict[str, Dict[str, object]]:
    if not mat or len(mat) < 2:
        raise RuntimeError("Table data is too short")

    header = mat[0]
    label_idx, aux_idx, zili_idx, shuo_idx = locate_columns(header)

    result: Dict[str, Dict[str, object]] = {}
    prev_label: Optional[str] = None

    for row in mat[1:]:  # Skip header per COUNTING_NOTES
        # Defensive: pad row to header length
        if len(row) < len(header):
            row = row + [""] * (len(header) - len(row))

        label_raw = (row[label_idx] if label_idx is not None and label_idx < len(row) else "").strip()
        label = label_raw or prev_label
        # Keep only single Latin letter A-Z for keys
        if label:
            m = re.match(r"\s*([A-Z])\s*", label)
            label = m.group(1) if m else label

        # Determine if row has any content outside the label column
        non_label_has_content = any(
            (c.strip() != "") for idx, c in enumerate(row) if idx != label_idx
        )
        if not label or not non_label_has_content:
            prev_label = label
            continue

        f_files_with_labels: List[Tuple[str, Optional[str]]] = (
            extract_files_with_labels(row[aux_idx])
            if aux_idx is not None and aux_idx < len(row)
            else []
        )
        # Only filenames for fuzhu list
        fuzhu_files: List[str] = [fname for fname, _ in f_files_with_labels]

        zili_with_labels: List[Tuple[str, Optional[str]]] = (
            extract_files_with_labels(row[zili_idx])
            if zili_idx is not None and zili_idx < len(row)
            else []
        )
        shuo_ming: str = (row[shuo_idx] if shuo_idx is not None and shuo_idx < len(row) else "").strip()

        # Build grouped structure
        grouped = group_zili_by_fuzhu(fuzhu_files, zili_with_labels)

        # Initialize bucket for this key
        key = label
        if key not in result:
            cangjie_char = CANGJIE_KEY_TO_CHAR.get(key)
            result[key] = {
                "cangjie_char": cangjie_char,
                "rows": [],
            }
        result[key]["rows"].append({
            "fuzhu_zixing": grouped,
            "shuo_ming": shuo_ming,
        })

        prev_label = label

    # Optionally, ensure keys appear in A..Z order
    ordered: Dict[str, Dict[str, object]] = {}
    for letter in [chr(c) for c in range(ord('A'), ord('Z') + 1)]:
        if letter in result:
            ordered[letter] = result[letter]
    # Append any unexpected keys at the end
    for k in result:
        if k not in ordered:
            ordered[k] = result[k]

    return ordered


def main(argv: List[str]) -> int:
    out_path = argv[1] if len(argv) > 1 else DEFAULT_OUTPUT

    try:
        wikitext = fetch_wikitext(TITLE)
    except Exception as exc:
        print(f"Error fetching wikitext: {exc}", file=sys.stderr)
        return 1

    parsed = wtp.parse(wikitext)
    table = find_table_by_caption(parsed, TARGET_TABLE_CAPTION)
    if table is None:
        print(
            f"Could not find table with caption containing '{TARGET_TABLE_CAPTION}'.",
            file=sys.stderr,
        )
        return 2

    # Use span=True per COUNTING_NOTES to expand rowspans
    mat = table.data(span=True)

    try:
        output = build_output_structure(mat)
    except Exception as exc:
        print(f"Error building output: {exc}", file=sys.stderr)
        return 3

    # Write JSON with Unicode preserved
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Wrote JSON to {out_path}")
    # Also print a small sample for sanity
    sample_key = next(iter(output)) if output else None
    if sample_key:
        sample_rows = output[sample_key]["rows"][:2]
        print(
            json.dumps(
                {
                    sample_key: {
                        "cangjie_char": output[sample_key]["cangjie_char"],
                        "rows": sample_rows,
                    }
                },
                ensure_ascii=False,
                indent=2,
            )
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
