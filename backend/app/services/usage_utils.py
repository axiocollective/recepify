from __future__ import annotations

from typing import Any, Dict, Optional


def extract_openai_usage(response: Any) -> Dict[str, int]:
    usage = getattr(response, "usage", None)
    if usage is None and isinstance(response, dict):
        usage = response.get("usage")

    input_tokens = 0
    output_tokens = 0
    total_tokens = 0

    if isinstance(usage, dict):
        input_tokens = int(usage.get("input_tokens") or 0)
        output_tokens = int(usage.get("output_tokens") or 0)
        total_tokens = int(usage.get("total_tokens") or 0)
    else:
        input_tokens = int(getattr(usage, "input_tokens", 0) or 0) if usage is not None else 0
        output_tokens = int(getattr(usage, "output_tokens", 0) or 0) if usage is not None else 0
        total_tokens = int(getattr(usage, "total_tokens", 0) or 0) if usage is not None else 0

    if total_tokens <= 0:
        total_tokens = max(0, input_tokens + output_tokens)

    return {
        "input_tokens": max(0, input_tokens),
        "output_tokens": max(0, output_tokens),
        "total_tokens": max(0, total_tokens),
    }


def build_usage_event(
    provider: str,
    *,
    model: Optional[str] = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    total_tokens: int = 0,
    stage: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    event: Dict[str, Any] = {
        "provider": provider,
        "model": model,
        "input_tokens": max(0, int(input_tokens)),
        "output_tokens": max(0, int(output_tokens)),
        "total_tokens": max(0, int(total_tokens)),
    }
    if stage:
        event["stage"] = stage
    if extra:
        event.update(extra)
    return event


def append_usage_event(metadata: Dict[str, Any], event: Dict[str, Any]) -> None:
    events = metadata.setdefault("usageEvents", [])
    if isinstance(events, list):
        events.append(event)
