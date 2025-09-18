#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = [
#   "requests",
#   "wikitextparser",
# ]
# ///
"""
Download all SVGs referenced in experiment/auxiliary_forms.json using the MediaWiki API
and save them to experiment/輔助字形.

The JSON stores wikitext-style links like [[Image:cjrm-a0.svg|30px|...]]. We parse
wikilinks with wikitextparser to extract file names, query API for direct URLs, and download.
"""

import concurrent.futures
import json
import os
import sys
from typing import Dict, Iterable, List, Optional, Set, Tuple, Union

import requests
import wikitextparser as wtp

API_URL = "https://zh.wikibooks.org/w/api.php"
WORKDIR = os.path.dirname(__file__)
JSON_PATH = os.path.join(WORKDIR, "auxiliary_forms.json")
OUTPUT_DIR = os.path.join(WORKDIR, "輔助字形")

FILE_NAMESPACES = {"file", "image", "檔案", "文件", "圖像", "圖片"}

HEADERS = {
    "User-Agent": "cangjie-learner/0.1 (+https://github.com/; contact: local-script)",
    "Accept": "application/json",
}


def ensure_output_dir() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def extract_svgs_from_wikitext(text: str) -> List[str]:
    if not text:
        return []
    result: List[str] = []
    try:
        parsed = wtp.parse(text)
    except Exception:
        return result
    for wl in parsed.wikilinks:
        target = (wl.target or "").strip()
        if not target or ":" not in target:
            continue
        ns, name = target.split(":", 1)
        if ns.strip().lower() not in FILE_NAMESPACES:
            continue
        name = name.strip()
        if name.lower().endswith(".svg"):
            result.append(name)
    return result


def extract_filenames_from_json(data: Dict[str, object]) -> List[str]:
    filenames: List[str] = []

    def add_from_list(items: Iterable[str]) -> None:
        for item in items:
            filenames.extend(extract_svgs_from_wikitext(item))

    for key, bucket in data.items():
        if not isinstance(bucket, dict):
            continue
        rows = bucket.get("rows", [])
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            add_from_list(row.get("fuzhu_zixing", []) or [])
            add_from_list(row.get("zili", []) or [])
            # also capture from shuo_ming
            shuo = row.get("shuo_ming", "") or ""
            if isinstance(shuo, str):
                filenames.extend(extract_svgs_from_wikitext(shuo))
    # normalize whitespace
    normalized = [name.strip() for name in filenames if name.strip()]
    return normalized


def unique_preserving_order(names: List[str]) -> List[str]:
    seen: Set[str] = set()
    result: List[str] = []
    for n in names:
        key = n.lower()
        if key not in seen:
            seen.add(key)
            result.append(n)
    return result


def canonical_api_title(filename: str) -> str:
    # No need to normalize; MediaWiki normalizes. Keeping as-is is fine.
    return filename


def _iter_pages(pages: Union[Dict[str, dict], List[dict]]):
    if isinstance(pages, dict):
        return pages.values()
    return pages or []


def query_file_urls(batch: List[str]) -> Dict[str, Optional[str]]:
    if not batch:
        return {}
    params = {
        "action": "query",
        "format": "json",
        "titles": build_titles_param(batch),
        "prop": "imageinfo",
        "iiprop": "url",
    }
    try:
        resp = requests.get(API_URL, params=params, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except Exception:
        return {name: None for name in batch}
    data = resp.json()
    pages = data.get("query", {}).get("pages", {})
    # Map lowercased original names -> original casing
    lower_to_original: Dict[str, str] = {name.lower(): name for name in batch}
    result: Dict[str, Optional[str]] = {name: None for name in batch}
    resolved = 0
    for page in _iter_pages(pages):
        title = page.get("title", "")  # e.g., File:Cjrm-a0.svg
        basename = title.split(":", 1)[-1]
        info = page.get("imageinfo")
        url = None
        if info and isinstance(info, list) and info:
            url = info[0].get("url")
        original = lower_to_original.get(basename.lower())
        if original is not None and url:
            result[original] = url
            resolved += 1
    # Debug summary per batch
    print(f"Resolved {resolved}/{len(batch)} via API", file=sys.stderr)
    return result


def build_titles_param(batch: List[str]) -> str:
    # Prepend File: for each
    return "|".join([f"File:{canonical_api_title(name)}" for name in batch])


def download_file(session: requests.Session, name: str, url: str) -> Tuple[str, bool, Optional[str]]:
    out_path = os.path.join(OUTPUT_DIR, name)
    # Skip if already exists
    if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
        return (name, True, None)
    try:
        with session.get(url, headers=HEADERS, timeout=60, stream=True) as r:
            r.raise_for_status()
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            with open(out_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=65536):
                    if chunk:
                        f.write(chunk)
        return (name, True, None)
    except Exception as e:
        return (name, False, str(e))


def main(argv: List[str]) -> int:
    ensure_output_dir()
    # Load JSON
    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Failed to load JSON: {e}", file=sys.stderr)
        return 1

    names_all = extract_filenames_from_json(data)
    names_unique = unique_preserving_order(names_all)

    # Query in batches of 50
    batch_size = 50
    url_map: Dict[str, Optional[str]] = {}
    for i in range(0, len(names_unique), batch_size):
        batch = names_unique[i:i+batch_size]
        partial = query_file_urls(batch)
        url_map.update(partial)

    missing = [n for n, u in url_map.items() if not u]
    if missing:
        preview = ", ".join(missing[:5])
        suffix = "..." if len(missing) > 5 else ""
        print(
            f"Warning: {len(missing)} files had no URL from API (will skip): {preview}{suffix}",
            file=sys.stderr,
        )

    # Download in parallel
    ok = 0
    fail = 0
    session = requests.Session()
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        futures = []
        for name, url in url_map.items():
            if not url:
                continue
            futures.append(ex.submit(download_file, session, name, url))
        for fut in concurrent.futures.as_completed(futures):
            name, success, err = fut.result()
            if success:
                ok += 1
            else:
                fail += 1
                print(f"Failed: {name}: {err}", file=sys.stderr)

    print(f"Discovered {len(names_unique)} unique SVG references.")
    print(f"Downloaded {ok} files to {OUTPUT_DIR}.")
    if missing:
        print(f"Missing (no URL): {len(missing)}")
    if fail:
        print(f"Download errors: {fail}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
