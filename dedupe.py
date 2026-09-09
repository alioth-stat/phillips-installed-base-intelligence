from rapidfuzz import fuzz


def _composite(row: dict) -> str:
    parts = [row.get(k) for k in ("customer", "city", "modality", "brand")]
    return " ".join(str(p).strip().lower() for p in parts if p)


def find_duplicate(candidate: dict, existing_rows: list[dict], threshold: float = 85.0) -> dict | None:
    if not existing_rows:
        return None
    cand_str = _composite(candidate)
    best_row, best_score = None, -1.0
    for row in existing_rows:
        score = fuzz.token_sort_ratio(cand_str, _composite(row))
        if score > best_score:
            best_row, best_score = row, score
    return best_row if best_score >= threshold else None
