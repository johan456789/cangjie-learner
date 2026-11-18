#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = [
#   "requests",
#   "wikitextparser",
# ]
# ///
"""
Export the "相近字形辨析" section of zh.wikibooks 倉頡輸入法/輔助字形 into JSON.

Every wikitable in that section is one group of easily confused shapes. Each
row is one shape plus the note that tells it apart from the others.

Output schema (example):
[
  {
    "forms": [
      {
        "shape": {"type": "image", "file": "cjrm-j2.svg"},
        "code": "j",
        "shuo_ming": "「十」的輔助字形，頂上有直點。如：寇、空、挖。"
      },
      {
        "shape": {"type": "text", "text": "巳"},
        "code": "ru",
        "shuo_ming": "「口山」（[[Image:cjrm-r0.svg|18px]]...）組合，如：汜、包、起。"
      }
    ]
  }
]

`code` is the Cangjie key sequence of the shape: one letter for an auxiliary
form (cjrm-*), several for a combination of forms (cjwm-* or a whole character).
`shuo_ming` keeps [[Image:...]] links as wikitext; templates, language-variant
markers and <ref> footnotes are flattened to plain text.
"""

import json
import os
import re
import sys
from typing import Dict, List, Optional

import wikitextparser as wtp

from export_auxiliary_forms_json import CANGJIE_KEY_TO_CHAR, TITLE, fetch_wikitext

SECTION_TITLE = "相近字形辨析"
DEFAULT_OUTPUT = os.path.join(os.path.dirname(__file__), "similar_forms.json")

CANGJIE_CHAR_TO_KEY: Dict[str, str] = {
    char: key.lower() for key, char in CANGJIE_KEY_TO_CHAR.items()
}

FILE_LINK_RE = re.compile(
    r"\[\[\s*(?:File|Image|檔案|文件|圖像|圖片)\s*:\s*([^|\]\n]+?\.svg)\b[^\]]*\]\]",
    re.IGNORECASE,
)
REF_RE = re.compile(r"<ref[^>]*>.*?</ref>|<ref[^>]*/>", re.IGNORECASE | re.DOTALL)
# {{:倉頡輸入法/S30S|品}} renders the character 品 in a large font
CHARACTER_TEMPLATE_RE = re.compile(r"\{\{:[^|{}]*\|([^{}]*)\}\}")
VARIANT_MARKER_RE = re.compile(r"-\{\s*(.*?)\s*\}-")
AUXILIARY_FORM_FILE_RE = re.compile(r"^cjr\d*m-([a-z])\d*\.svg$", re.IGNORECASE)
COMBINATION_FILE_RE = re.compile(r"^cjwm-([a-z]+)\d*\.svg$", re.IGNORECASE)
LEADING_QUOTE_RE = re.compile(r"^「([^」]+)」")


def clean_wikitext(text: str) -> str:
    """Flatten footnotes, character templates and variant markers to plain text."""
    text = REF_RE.sub("", text or "")
    text = CHARACTER_TEMPLATE_RE.sub(r"\1", text)
    text = VARIANT_MARKER_RE.sub(r"\1", text)
    return text.strip()


def code_from_quote(shuo_ming: str) -> Optional[str]:
    """Read the code from a note that starts with e.g. 「口山」."""
    match = LEADING_QUOTE_RE.match(shuo_ming)
    if not match:
        return None
    keys = [CANGJIE_CHAR_TO_KEY.get(char) for char in match.group(1)]
    return "".join(keys) if all(keys) else None


def build_form(shape_wikitext: str, shuo_ming_wikitext: str) -> Dict[str, object]:
    shuo_ming = clean_wikitext(shuo_ming_wikitext)
    file_match = FILE_LINK_RE.search(shape_wikitext)
    if file_match:
        file_name = file_match.group(1).strip()
        shape: Dict[str, str] = {"type": "image", "file": file_name}
        auxiliary = AUXILIARY_FORM_FILE_RE.match(file_name)
        combination = COMBINATION_FILE_RE.match(file_name)
        if auxiliary:
            code = auxiliary.group(1).lower()
        elif combination:
            code = combination.group(1).lower()
        else:
            code = code_from_quote(shuo_ming)
    else:
        shape = {"type": "text", "text": clean_wikitext(shape_wikitext)}
        code = code_from_quote(shuo_ming)
    if not code:
        raise RuntimeError(f"Could not determine the code of shape: {shape_wikitext!r}")
    return {"shape": shape, "code": code, "shuo_ming": shuo_ming}


def build_output_structure(wikitext: str) -> List[Dict[str, object]]:
    parsed = wtp.parse(wikitext)
    section = next(
        (s for s in parsed.sections if (s.title or "").strip() == SECTION_TITLE),
        None,
    )
    if section is None:
        raise RuntimeError(f"Could not find section '{SECTION_TITLE}'")

    groups: List[Dict[str, object]] = []
    for table in section.tables:
        forms = [
            build_form(row[0], row[1])
            for row in table.data()[1:]  # skip the header row
            if len(row) >= 2 and (row[0] or "").strip()
        ]
        if forms:
            groups.append({"forms": forms})
    return groups


def main(argv: List[str]) -> int:
    out_path = argv[1] if len(argv) > 1 else DEFAULT_OUTPUT
    try:
        groups = build_output_structure(fetch_wikitext(TITLE))
    except Exception as exc:
        print(f"Error exporting similar forms: {exc}", file=sys.stderr)
        return 1
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(groups, f, ensure_ascii=False, indent=2)
        f.write("\n")
    form_count = sum(len(group["forms"]) for group in groups)
    print(f"Wrote {len(groups)} groups ({form_count} forms) to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
