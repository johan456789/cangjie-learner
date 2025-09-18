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
    "倉頡字母": "日",
    "rows": [
      {
        "輔助字形": ["[[Image:foo.svg|30px|中文名]]", "[[Image:bar.svg|30px|別名]]"],
        "字例": ["[[Image:baz.svg|30px|範例]]"],
        "說明": "<raw wikitext>"
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

        aux_files: List[str] = (
            extract_image_links(row[aux_idx])
            if aux_idx is not None and aux_idx < len(row)
            else []
        )
        zili_files: List[str] = (
            extract_image_links(row[zili_idx])
            if zili_idx is not None and zili_idx < len(row)
            else []
        )
        shuo_ming: str = (row[shuo_idx] if shuo_idx is not None and shuo_idx < len(row) else "").strip()

        # Initialize bucket for this key
        key = label
        if key not in result:
            cangjie_char = CANGJIE_KEY_TO_CHAR.get(key)
            result[key] = {
                "倉頡字母": cangjie_char,
                "rows": [],
            }
        result[key]["rows"].append(
            {
                "輔助字形": aux_files,
                "字例": zili_files,
                "說明": shuo_ming,
            }
        )

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
                        "倉頡字母": output[sample_key]["倉頡字母"],
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
