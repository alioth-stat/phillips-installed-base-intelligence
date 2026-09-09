REQUIRED_FIELDS = ["customer", "city", "country", "modality", "brand", "model"]


def compute_confidence(fields: dict, corroboration_count: int = 1) -> tuple[float, str]:
    completeness = sum(1 for k in REQUIRED_FIELDS if fields.get(k)) / len(REQUIRED_FIELDS)
    corroboration_bonus = min(1.0, corroboration_count / 3)
    score = round(0.7 * completeness + 0.3 * corroboration_bonus, 2)

    if score >= 0.85 and corroboration_count >= 2:
        status = "confirmed"
    elif completeness >= 0.6:
        status = "reported"
    elif completeness > 0:
        status = "estimated"
    else:
        status = "unknown"

    return score, status
