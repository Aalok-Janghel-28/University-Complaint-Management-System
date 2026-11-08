import re

STOP_WORDS = {
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'with', 'by',
    'from', 'this', 'that', 'it', 'as', 'not', 'no', 'please', 'help',
}


def normalize_text(text: str) -> str:
    if not text:
        return ''
    cleaned = text.lower().strip()
    cleaned = re.sub(r'http\S+', ' ', cleaned)
    cleaned = re.sub(r'[^a-z0-9\s]', ' ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned)
    return cleaned.strip()


def tokenize(text: str) -> list[str]:
    normalized = normalize_text(text)
    if not normalized:
        return []
    return [token for token in normalized.split() if token not in STOP_WORDS and len(token) > 1]


def build_document(*parts: str) -> str:
    return normalize_text(' '.join(part for part in parts if part))
