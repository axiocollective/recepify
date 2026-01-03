from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from .import_utils import (
    ImportedRecipe,
    ensure_domain,
    extract_json_ld_blocks,
    extract_og_image,
    fetch_html,
    find_recipe_nodes,
    ingredients_from_strings,
    instructions_from_strings,
    pick_best_recipe,
    resolve_schema_image,
    sync_recipe_media_to_supabase,
)
from .import_web import _openai_from_page, _openai_from_pages, _schema_to_recipe


VISIT_SITE_PATTERNS = [
    "website besuchen",
    "webseite besuchen",
    "visit website",
    "visit site",
    "zur website",
    "zur webseite",
    "open website",
    "open site",
]

logger = logging.getLogger(__name__)

URL_KEYS = {
    "link",
    "url",
    "destination",
    "destination_url",
    "destinationurl",
    "canonical_url",
    "canonicalurl",
    "href",
    "redirect_url",
    "redirecturl",
}


def _clean_ws(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _normalize_url(url: str) -> str:
    url = (url or "").strip()
    if url.startswith("//"):
        return "https:" + url
    return url


def _is_http_url(url: Optional[str]) -> bool:
    if not url:
        return False
    try:
        return urlparse(url).scheme in ("http", "https")
    except Exception:
        return False


def _is_external_non_pinterest(url: str) -> bool:
    host = urlparse(url).netloc.lower()
    return host and "pinterest." not in host and "pinimg." not in host and "pin.it" not in host


def _extract_og_url(html: str) -> Optional[str]:
    soup = BeautifulSoup(html, "html.parser")
    og = soup.find("meta", attrs={"property": "og:url"})
    if og and og.get("content"):
        return og["content"].strip()
    return None


def _extract_og_title(html: str) -> Optional[str]:
    soup = BeautifulSoup(html, "html.parser")
    og = soup.find("meta", attrs={"property": "og:title"})
    if og and og.get("content"):
        return _clean_ws(og["content"])
    return None


def _extract_og_description(html: str) -> Optional[str]:
    soup = BeautifulSoup(html, "html.parser")
    og = soup.find("meta", attrs={"property": "og:description"})
    if og and og.get("content"):
        return _clean_ws(og["content"])
    return None


def _extract_canonical_url(html: str, base_url: str) -> Optional[str]:
    soup = BeautifulSoup(html, "html.parser")
    link = soup.find("link", attrs={"rel": re.compile(r"\\bcanonical\\b", re.I)})
    if link and link.get("href"):
        return urljoin(base_url, link["href"].strip())
    return None


def _extract_outgoing_url(url: str) -> Optional[str]:
    if "outgoing" not in url or "url=" not in url:
        return None
    qs = parse_qs(urlparse(url).query)
    if "url" in qs and qs["url"]:
        return unquote(qs["url"][0])
    return None


def _decode_escaped_url(url: str) -> str:
    cleaned = url.replace("\\/", "/")
    if "\\u" in cleaned:
        try:
            return cleaned.encode("utf-8").decode("unicode_escape")
        except UnicodeDecodeError:
            return cleaned
    return cleaned


def _extract_url_from_raw_json(raw: str) -> Optional[str]:
    patterns = [
        r'"tracked_link"\s*:\s*"(?P<url>[^"]+)"',
        r'"link"\s*:\s*"(?P<url>[^"]+)"',
        r'"url"\s*:\s*"(?P<url>[^"]+)"',
    ]
    for pattern in patterns:
        match = re.search(pattern, raw)
        if not match:
            continue
        candidate = _decode_escaped_url(match.group("url"))
        if _is_http_url(candidate) and _is_external_non_pinterest(candidate):
            return candidate
    return None


def _extract_json_blob(text: str, start_index: int) -> Optional[str]:
    opener = text[start_index]
    if opener not in "{[":
        return None
    closer = "}" if opener == "{" else "]"
    depth = 0
    in_string = False
    escape = False
    for idx in range(start_index, len(text)):
        ch = text[idx]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            continue
        if ch == opener:
            depth += 1
        elif ch == closer:
            depth -= 1
            if depth == 0:
                return text[start_index : idx + 1]
    return None


def _extract_json_from_script(raw: str) -> List[Any]:
    raw = (raw or "").strip()
    if not raw:
        return []
    try:
        return [json.loads(raw)]
    except json.JSONDecodeError:
        pass

    for marker in ("__PWS_DATA__", "__PWS_INITIAL_PROPS__", "__PWS_INITIAL_STATE__"):
        marker_index = raw.find(marker)
        if marker_index == -1:
            continue
        brace_index = raw.find("{", marker_index)
        array_index = raw.find("[", marker_index)
        start_index = min(
            idx for idx in (brace_index, array_index) if idx != -1
        ) if brace_index != -1 or array_index != -1 else -1
        if start_index == -1:
            continue
        blob = _extract_json_blob(raw, start_index)
        if not blob:
            continue
        try:
            return [json.loads(blob)]
        except json.JSONDecodeError:
            continue

    first_brace = raw.find("{")
    first_bracket = raw.find("[")
    start_index = min(
        idx for idx in (first_brace, first_bracket) if idx != -1
    ) if first_brace != -1 or first_bracket != -1 else -1
    if start_index != -1:
        blob = _extract_json_blob(raw, start_index)
        if blob:
            try:
                return [json.loads(blob)]
            except json.JSONDecodeError:
                pass
    return []


def _collect_external_urls(value: Any) -> List[str]:
    urls: List[str] = []
    preferred_keys = {
        "link",
        "url",
        "destinationUrl",
        "destination_url",
        "canonicalUrl",
        "canonical_url",
        "siteUrl",
        "externalUrl",
        "external_url",
        "targetUrl",
        "target_url",
    }

    if isinstance(value, dict):
        for key in preferred_keys:
            if key in value:
                urls.extend(_collect_external_urls(value[key]))
        for item in value.values():
            urls.extend(_collect_external_urls(item))
        return urls
    if isinstance(value, list):
        for item in value:
            urls.extend(_collect_external_urls(item))
        return urls
    if isinstance(value, str):
        candidate = _normalize_url(value)
        outgoing = _extract_outgoing_url(candidate)
        if outgoing:
            urls.append(outgoing)
            return urls
        if candidate.startswith("http") and _is_external_non_pinterest(candidate):
            urls.append(candidate)
        return urls
    return urls


def _deep_find_external_url(value: Any) -> Optional[str]:
    if isinstance(value, dict):
        for key, item in value.items():
            key_lower = str(key).lower()
            if key_lower in URL_KEYS and isinstance(item, str):
                candidate = _decode_escaped_url(item)
                candidate = _normalize_url(candidate)
                outgoing = _extract_outgoing_url(candidate)
                if outgoing:
                    candidate = outgoing
                if _is_http_url(candidate) and _is_external_non_pinterest(candidate):
                    return candidate
            found = _deep_find_external_url(item)
            if found:
                return found
    elif isinstance(value, list):
        for item in value:
            found = _deep_find_external_url(item)
            if found:
                return found
    return None


def _sniff_pin_destination_with_playwright(pin_url: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        logger.info("Playwright is not available; skipping Pinterest sniff.")
        return None, None, None

    dest_candidates: List[str] = []
    rendered_html: Optional[str] = None
    og_image: Optional[str] = None

    def add_candidate(candidate: str) -> None:
        normalized = _normalize_url(candidate)
        outgoing = _extract_outgoing_url(normalized)
        if outgoing:
            normalized = outgoing
        if _is_http_url(normalized) and _is_external_non_pinterest(normalized):
            if normalized not in dest_candidates:
                dest_candidates.append(normalized)

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                locale="de-DE",
                viewport={"width": 1280, "height": 800},
            )
            page = context.new_page()

            def handle_response(response) -> None:
                try:
                    content_type = (response.headers.get("content-type") or "").lower()
                    if "application/json" not in content_type and "text/json" not in content_type:
                        return
                    if response.request.resource_type not in ("xhr", "fetch"):
                        return
                    data = response.json()
                    found = _deep_find_external_url(data)
                    if found:
                        add_candidate(found)
                except Exception:
                    return

            page.on("response", handle_response)
            page.goto(pin_url, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(2500)

            for selector in (
                "button:has-text('Alle akzeptieren')",
                "button:has-text('Akzeptieren')",
                "button:has-text('Ich stimme zu')",
                "button:has-text('Accept all')",
                "button:has-text('Accept')",
            ):
                try:
                    locator = page.locator(selector).first
                    if locator.is_visible(timeout=1200):
                        locator.click(timeout=1200)
                        page.wait_for_timeout(1500)
                        break
                except Exception:
                    continue

            page.wait_for_timeout(4000)
            rendered_html = page.content()
            if rendered_html:
                og_image = extract_og_image(rendered_html)

            context.close()
            browser.close()
    except Exception as exc:
        logger.warning("Pinterest Playwright sniff failed: %s", exc)
        return None, None, None

    if dest_candidates:
        return rendered_html, dest_candidates[0], og_image
    return rendered_html, None, og_image


def _try_json_load(raw: str) -> Optional[Any]:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        match = re.search(r"(\\{.*\\}|\\[.*\\])", raw, flags=re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except Exception:
                return None
    return None


def _collect_json_blobs_from_html(html: str) -> List[Any]:
    soup = BeautifulSoup(html, "html.parser")
    blobs: List[Any] = []
    pws = soup.find("script", attrs={"id": "__PWS_DATA__"})
    if pws:
        data = _try_json_load(pws.string or pws.get_text())
        if data is not None:
            blobs.append(data)
    return blobs


def _find_recipe_like_nodes(value: Any) -> List[dict[str, Any]]:
    nodes: List[dict[str, Any]] = []

    def walk(item: Any) -> None:
        if isinstance(item, dict):
            node_type = item.get("@type")
            if isinstance(node_type, str) and node_type.lower() == "recipe":
                nodes.append(item)
            elif isinstance(node_type, list) and any(
                isinstance(entry, str) and entry.lower() == "recipe" for entry in node_type
            ):
                nodes.append(item)

            has_ingredients = "recipeIngredient" in item or "ingredients" in item
            has_instructions = "recipeInstructions" in item or "instructions" in item
            has_title = "name" in item or "title" in item
            if (has_ingredients or has_instructions) and has_title:
                nodes.append(item)

            for child in item.values():
                walk(child)
        elif isinstance(item, list):
            for child in item:
                walk(child)

    walk(value)
    return nodes


def _pinterest_node_score(node: dict[str, Any]) -> int:
    score = 0
    if node.get("name") or node.get("title"):
        score += 3
    if node.get("description"):
        score += 1
    if node.get("recipeIngredient") or node.get("ingredients"):
        score += 4
    if node.get("recipeInstructions") or node.get("instructions"):
        score += 4
    if node.get("prepTime") or node.get("cookTime") or node.get("totalTime"):
        score += 1
    if node.get("recipeYield") or node.get("yield"):
        score += 1
    return score


def _extract_instructions_from_any(value: Any) -> List[str]:
    items: List[str] = []
    for entry in value if isinstance(value, list) else [value]:
        if isinstance(entry, str):
            cleaned = _clean_ws(entry)
            if cleaned:
                items.append(cleaned)
        elif isinstance(entry, dict):
            if entry.get("text"):
                cleaned = _clean_ws(str(entry["text"]))
                if cleaned:
                    items.append(cleaned)
            elif entry.get("itemListElement"):
                for item in entry.get("itemListElement") or []:
                    if isinstance(item, dict) and item.get("text"):
                        cleaned = _clean_ws(str(item["text"]))
                        if cleaned:
                            items.append(cleaned)
                    elif isinstance(item, str):
                        cleaned = _clean_ws(item)
                        if cleaned:
                            items.append(cleaned)
    return items


def _pinterest_extract_recipe(pin_html: str, pin_url: str, pin_image: Optional[str]) -> ImportedRecipe:
    title = _extract_og_title(pin_html) or "Imported Recipe"
    description = _extract_og_description(pin_html)

    recipe = ImportedRecipe(
        title=title,
        description=description,
        sourcePlatform="pinterest",
        sourceUrl=pin_url,
        sourceDomain=ensure_domain(pin_url),
        extractedVia="pinterest_og_only",
        mediaImageUrl=pin_image,
        ingredients=[],
        instructions=[],
    )

    best_node: Optional[dict[str, Any]] = None
    for blob in _collect_json_blobs_from_html(pin_html):
        nodes = _find_recipe_like_nodes(blob)
        if nodes:
            best_node = sorted(nodes, key=_pinterest_node_score, reverse=True)[0]
            break

    if not best_node:
        recipe.extracted_via = "pinterest_dom_fallback"
        return recipe

    raw_title = best_node.get("name") or best_node.get("title")
    raw_description = best_node.get("description")
    recipe.title = _clean_ws(str(raw_title)) if raw_title else recipe.title
    recipe.description = _clean_ws(str(raw_description)) if raw_description else recipe.description
    recipe.prep_time = _clean_ws(str(best_node.get("prepTime"))) if best_node.get("prepTime") else recipe.prep_time
    recipe.cook_time = _clean_ws(str(best_node.get("cookTime"))) if best_node.get("cookTime") else recipe.cook_time
    recipe.total_time = _clean_ws(str(best_node.get("totalTime"))) if best_node.get("totalTime") else recipe.total_time

    servings = best_node.get("recipeYield") or best_node.get("yield")
    if isinstance(servings, list) and servings:
        servings = servings[0]
    recipe.servings = _clean_ws(str(servings)) if servings else recipe.servings

    ingredients = best_node.get("recipeIngredient") or best_node.get("ingredients")
    if ingredients:
        recipe.ingredients = ingredients_from_strings(ingredients)

    instructions = best_node.get("recipeInstructions") or best_node.get("instructions")
    if instructions:
        recipe.instructions = instructions_from_strings(_extract_instructions_from_any(instructions))

    recipe.extracted_via = "pinterest_pin_json"
    return recipe


def _enrich_pinterest_with_openai_if_needed(
    base_recipe: ImportedRecipe,
    pin_url: str,
    pin_html: str,
    pin_image: Optional[str],
) -> ImportedRecipe:
    thin = len(base_recipe.instructions) == 0 and len(base_recipe.ingredients) < 5
    if not thin:
        return base_recipe

    ai_recipe = _openai_from_page(
        url=pin_url,
        html=pin_html,
        image_url=pin_image,
        platform="pinterest",
        extracted_via_label="openai_from_pinterest_pin",
    )

    merged = base_recipe.model_copy(deep=True)
    for field in ("title", "description", "prep_time", "cook_time", "total_time", "servings"):
        if not getattr(merged, field) and getattr(ai_recipe, field):
            setattr(merged, field, getattr(ai_recipe, field))

    if not merged.ingredients and ai_recipe.ingredients:
        merged.ingredients = ai_recipe.ingredients
    if not merged.instructions and ai_recipe.instructions:
        merged.instructions = ai_recipe.instructions

    merged.extracted_via = f"{merged.extracted_via}+openai_enrich"
    merged.media_image_url = merged.media_image_url or ai_recipe.media_image_url or pin_image
    return merged


def _extract_destination_url_from_json(pin_html: str) -> Optional[str]:
    soup = BeautifulSoup(pin_html, "html.parser")
    for script in soup.find_all("script"):
        if script.get("type") and not re.search(r"json", script["type"], re.I):
            continue
        raw = script.string or script.get_text()
        if not raw:
            continue
        for parsed in _extract_json_from_script(raw):
            for url in _collect_external_urls(parsed):
                if _is_http_url(url) and _is_external_non_pinterest(url):
                    return url
    return None


def _extract_pin_id(url: str) -> Optional[str]:
    match = re.search(r"/pin/(\d+)", url)
    if match:
        return match.group(1)
    return None


def _find_pin_payload(data: Any, pin_id: str) -> Optional[dict[str, Any]]:
    if isinstance(data, dict):
        if pin_id in data and isinstance(data.get(pin_id), dict):
            return data.get(pin_id)
        for value in data.values():
            found = _find_pin_payload(value, pin_id)
            if found:
                return found
    elif isinstance(data, list):
        for item in data:
            found = _find_pin_payload(item, pin_id)
            if found:
                return found
    return None


def _extract_destination_url_from_pws_props(pin_html: str, pin_id: str) -> Optional[str]:
    soup = BeautifulSoup(pin_html, "html.parser")
    script = soup.find("script", attrs={"id": "__PWS_INITIAL_PROPS__"})
    if not script:
        return None
    raw = script.string or script.get_text()
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return _extract_url_from_raw_json(raw)

    state = data.get("initialReduxState") if isinstance(data, dict) else None
    pin_payload = None
    if isinstance(state, dict):
        pins = state.get("pins")
        if isinstance(pins, dict) and pin_id in pins and isinstance(pins[pin_id], dict):
            pin_payload = pins[pin_id]
        if not pin_payload:
            pin_payload = _find_pin_payload(state, pin_id)

    if not isinstance(pin_payload, dict):
        return None

    for key in ("tracked_link", "link"):
        candidate = pin_payload.get(key)
        if isinstance(candidate, str):
            candidate = _decode_escaped_url(candidate)
            if _is_http_url(candidate) and _is_external_non_pinterest(candidate):
                return candidate

    rich_metadata = pin_payload.get("rich_metadata")
    if isinstance(rich_metadata, dict):
        candidate = rich_metadata.get("url")
        if isinstance(candidate, str):
            candidate = _decode_escaped_url(candidate)
            if _is_http_url(candidate) and _is_external_non_pinterest(candidate):
                return candidate

    rich_summary = pin_payload.get("rich_summary")
    if isinstance(rich_summary, dict):
        candidate = rich_summary.get("url")
        if isinstance(candidate, str):
            candidate = _decode_escaped_url(candidate)
            if _is_http_url(candidate) and _is_external_non_pinterest(candidate):
                return candidate

    return None


def _extract_url_from_pin_payload(payload: dict[str, Any]) -> Optional[str]:
    for key in ("tracked_link", "link"):
        candidate = payload.get(key)
        if isinstance(candidate, str):
            candidate = _decode_escaped_url(candidate)
            if _is_http_url(candidate) and _is_external_non_pinterest(candidate):
                return candidate

    for container_key in ("rich_metadata", "rich_summary"):
        container = payload.get(container_key)
        if isinstance(container, dict):
            candidate = container.get("url")
            if isinstance(candidate, str):
                candidate = _decode_escaped_url(candidate)
                if _is_http_url(candidate) and _is_external_non_pinterest(candidate):
                    return candidate
    return None


def _fetch_pin_resource_url(pin_id: str) -> Optional[str]:
    endpoint = "https://www.pinterest.com/resource/PinResource/get/"
    data = {
        "options": {"id": pin_id, "field_set_key": "unauth_web_main_pin"},
        "context": {},
    }
    params = {
        "source_url": f"/pin/{pin_id}/",
        "data": json.dumps(data, separators=(",", ":")),
    }
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "de,en;q=0.8",
    }
    try:
        with httpx.Client(headers=headers, timeout=30.0, follow_redirects=True) as client:
            response = client.get(endpoint, params=params)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, json.JSONDecodeError):
        return None

    data_payload = None
    if isinstance(payload, dict):
        resource = payload.get("resource_response")
        if isinstance(resource, dict):
            data_payload = resource.get("data")
        if data_payload is None:
            data_payload = payload.get("data")

    if isinstance(data_payload, dict):
        return _extract_url_from_pin_payload(data_payload)
    return None


def _extract_destination_url_from_pin_window(pin_html: str, pin_id: str) -> Optional[str]:
    index = pin_html.find(pin_id)
    if index == -1:
        return None
    start = max(0, index - 20000)
    end = min(len(pin_html), index + 20000)
    window = pin_html[start:end]
    return _extract_url_from_raw_json(window)


def _extract_destination_url(pin_html: str, pin_id: Optional[str] = None) -> Optional[str]:
    soup = BeautifulSoup(pin_html, "html.parser")
    for link in soup.find_all("a", href=True):
        text = _clean_ws(link.get_text(" ", strip=True)).lower()
        if any(pattern in text for pattern in VISIT_SITE_PATTERNS):
            href = _normalize_url(link["href"])
            if _is_http_url(href) and _is_external_non_pinterest(href):
                return href
    for link in soup.find_all("a", href=True):
        href = link["href"]
        outgoing = _extract_outgoing_url(href)
        if outgoing:
            return outgoing

    json_candidate = _extract_destination_url_from_json(pin_html)
    if json_candidate:
        return json_candidate

    if pin_id:
        pin_candidate = _extract_destination_url_from_pws_props(pin_html, pin_id)
        if pin_candidate:
            return pin_candidate
        window_candidate = _extract_destination_url_from_pin_window(pin_html, pin_id)
        if window_candidate:
            return window_candidate

    raw_candidate = _extract_url_from_raw_json(pin_html)
    if raw_candidate:
        return raw_candidate

    for match in re.finditer(r"https?://[^\\s'\\\"]+", pin_html):
        outgoing = _extract_outgoing_url(match.group(0))
        if outgoing:
            return outgoing

    external_links: List[str] = []
    for link in soup.find_all("a", href=True):
        href = _normalize_url(link["href"])
        if href.startswith("http") and _is_external_non_pinterest(href):
            external_links.append(href)
    return external_links[0] if external_links else None


def _extract_visit_website_url(dest_html: str, dest_url: str) -> Optional[str]:
    soup = BeautifulSoup(dest_html, "html.parser")

    container = soup.find(attrs={"data-test-id": "visit-site-button"})
    if container:
        anchor = container.find("a", href=True)
        if anchor and anchor.get("href"):
            href = urljoin(dest_url, _normalize_url(anchor["href"]))
            if _is_http_url(href) and _is_external_non_pinterest(href):
                return href

    for anchor in soup.find_all(["a", "button"], href=True):
        text = _clean_ws(anchor.get_text(" ", strip=True)).lower()
        if any(pattern in text for pattern in VISIT_SITE_PATTERNS):
            href = urljoin(dest_url, _normalize_url(anchor["href"]))
            if _is_http_url(href) and _is_external_non_pinterest(href):
                return href

    canon = _extract_canonical_url(dest_html, dest_url)
    if canon and _is_http_url(canon) and _is_external_non_pinterest(canon):
        return canon

    og_url = _extract_og_url(dest_html)
    if og_url:
        candidate = urljoin(dest_url, og_url)
        if _is_http_url(candidate) and _is_external_non_pinterest(candidate):
            return candidate

    dest_host = urlparse(dest_url).netloc.lower()
    for anchor in soup.find_all("a", href=True):
        href = urljoin(dest_url, _normalize_url(anchor["href"]))
        if not _is_http_url(href) or not _is_external_non_pinterest(href):
            continue
        host = urlparse(href).netloc.lower()
        if host and host != dest_host:
            return href

    return None


def _recipe_quality_score(recipe: ImportedRecipe) -> int:
    score = 0
    if recipe.title:
        score += 3
    if recipe.description:
        score += 1
    if recipe.servings:
        score += 1
    if recipe.prep_time or recipe.cook_time or recipe.total_time:
        score += 1
    score += min(len(recipe.ingredients), 50)
    score += min(len(recipe.instructions), 80)
    return score


def _scrape_recipe_page(
    url: str,
    html: str,
    image_url: Optional[str],
    *,
    platform: str,
    extracted_via_schema: str,
    extracted_via_openai: str,
) -> ImportedRecipe:
    schema_nodes: List[dict[str, Any]] = []
    for block in extract_json_ld_blocks(html):
        schema_nodes.extend(find_recipe_nodes(block))

    best_node = pick_best_recipe(schema_nodes)
    if best_node:
        image = resolve_schema_image(best_node) or image_url
        return _schema_to_recipe(
            best_node,
            url=url,
            image_url=image,
            platform=platform,
            extracted_via=extracted_via_schema,
        )

    return _openai_from_page(
        url=url,
        html=html,
        image_url=image_url,
        platform=platform,
        extracted_via_label=extracted_via_openai,
    )


def import_pinterest(url: str) -> Dict[str, Any]:
    pin_html, destination_url, pin_image = _sniff_pin_destination_with_playwright(url)
    if not pin_html:
        pin_html = fetch_html(url)
    if not pin_image and pin_html:
        pin_image = extract_og_image(pin_html)
    pin_id = _extract_pin_id(url)
    if not destination_url:
        destination_url = _extract_destination_url(pin_html, pin_id=pin_id)
    pin_recipe = _pinterest_extract_recipe(pin_html, url, pin_image)
    pin_recipe = _enrich_pinterest_with_openai_if_needed(pin_recipe, url, pin_html, pin_image)
    if not destination_url and pin_id:
        destination_url = _fetch_pin_resource_url(pin_id)
        if destination_url:
            logger.info("Pinterest destination URL resolved via API: %s", destination_url)
    if destination_url:
        logger.info("Pinterest destination URL resolved: %s", destination_url)
    else:
        logger.info("Pinterest destination URL not found for pin %s", pin_id or "unknown")

    recipe: ImportedRecipe
    if not destination_url:
        recipe = pin_recipe
    else:
        destination_url = _normalize_url(destination_url)
        try:
            dest_html = fetch_html(destination_url)
        except httpx.HTTPError as exc:
            logger.info("Pinterest destination fetch failed: %s", exc)
            destination_url = None
            dest_html = None

        if not destination_url or not dest_html:
            recipe = pin_recipe
        else:
            dest_image = extract_og_image(dest_html) or pin_image
            visit_url = _extract_visit_website_url(dest_html, destination_url)

            candidates: List[Tuple[str, ImportedRecipe, str, Optional[str]]] = []
            dest_recipe = _scrape_recipe_page(
                destination_url,
                dest_html,
                dest_image,
                platform="pinterest",
                extracted_via_schema="pinterest_destination_schema",
                extracted_via_openai="pinterest_destination_openai",
            )
            candidates.append((destination_url, dest_recipe, dest_html, dest_image))

            if visit_url and _normalize_url(visit_url) != _normalize_url(destination_url):
                try:
                    visit_html = fetch_html(visit_url)
                    visit_img = extract_og_image(visit_html) or dest_image
                    visit_recipe = _scrape_recipe_page(
                        visit_url,
                        visit_html,
                        visit_img,
                        platform="pinterest",
                        extracted_via_schema="pinterest_website_schema",
                        extracted_via_openai="pinterest_website_openai",
                    )
                    candidates.append((visit_url, visit_recipe, visit_html, visit_img))
                except httpx.HTTPError as exc:
                    logger.info("Pinterest website fetch failed: %s", exc)
                    visit_url = None

            candidates.append((url, pin_recipe, pin_html, pin_image))

            best_url, best_recipe, best_html, best_img = sorted(
                candidates, key=lambda item: _recipe_quality_score(item[1]), reverse=True
            )[0]

            if best_recipe.extracted_via and best_recipe.extracted_via.startswith("openai") and len(candidates) > 1:
                primary, secondary = candidates[0], candidates[1]
                if _recipe_quality_score(primary[1]) < _recipe_quality_score(secondary[1]):
                    primary, secondary = secondary, primary
                combined = _openai_from_pages(
                    primary_url=primary[0],
                    primary_html=primary[2],
                    secondary_url=secondary[0],
                    secondary_html=secondary[2],
                    image_url=best_img,
                    platform="pinterest",
                    extracted_via_label="pinterest_openai_with_secondary_context",
                )
                if _recipe_quality_score(combined) > _recipe_quality_score(best_recipe):
                    best_recipe = combined
                    best_url = primary[0]
                    best_img = best_img or combined.media_image_url

            extracted_label = (
                "pinterest_destination_schema"
                if best_recipe.extracted_via == "pinterest_destination_schema" and best_url == destination_url
                else "pinterest_website_schema"
                if best_recipe.extracted_via == "pinterest_website_schema" and visit_url and best_url != destination_url
                else "pinterest_destination_openai"
                if best_url == destination_url
                else "pinterest_website_openai"
            )

            recipe = best_recipe
            if best_url == url:
                recipe.extracted_via = recipe.extracted_via or "pinterest_pin"
            else:
                recipe.extracted_via = extracted_label
            recipe.media_image_url = best_img or pin_image or recipe.media_image_url
            recipe.source_url = best_url
            recipe.source_domain = ensure_domain(best_url)
            recipe.source_platform = "pinterest"
            recipe.metadata["destinationUrl"] = destination_url
            recipe.metadata["destinationDomain"] = ensure_domain(destination_url)
            if visit_url:
                recipe.metadata["websiteUrl"] = visit_url
                recipe.metadata["websiteDomain"] = ensure_domain(visit_url)
    recipe.source_platform = "pinterest"
    recipe.metadata["pinterestUrl"] = url

    sync_recipe_media_to_supabase(recipe)
    recipe.tags = []
    data = recipe.model_dump_recipe()
    data.setdefault("tags", [])
    return data
