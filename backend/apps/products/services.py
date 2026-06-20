import re

import requests

_OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"
_USER_AGENT = "PJMidia/1.0 (contato@pjmidia.com.br)"

_CATEGORY_MAP: list[tuple[re.Pattern, str]] = [
    (re.compile(p, re.I), c) for p, c in [
        (r"arroz", "arroz"),
        (r"feij[aã]o", "feijao"),
        (r"a[cç][uú]car", "acucar"),
        (r"caf[eé]", "cafe"),
        (r"[oó]leo", "oleo"),
        (r"macarr[aã]o|massa|noodle", "macarrao"),
        (r"biscoito|bolacha|cookie", "biscoitos"),
        (r"refrigerante|soda|guaraná|coca.cola|pepsi", "refrigerantes"),
        (r"[aá]gua", "agua"),
        (r"cerveja|beer", "cervejas"),
        (r"carne|beef|bov", "carnes"),
        (r"frango|chicken|peru", "frango"),
        (r"frios|salsicha|presunto|mortadela", "frios"),
        (r"leite|milk", "leite"),
        (r"detergente|sabão.lavar|dish", "detergente"),
        (r"papel.higi[eê]nico|toilet", "papel-higienico"),
        (r"sabão|sabao|laundry", "sabao"),
        (r"copo.descart", "copos-descartaveis"),
        (r"prato.descart", "pratos-descartaveis"),
        (r"talher.descart", "talheres-descartaveis"),
        (r"saco.lixo|garbage", "sacos-lixo"),
    ]
]


def infer_category(name: str, category_tags: list[str]) -> str:
    haystack = name + " " + " ".join(category_tags)
    for pattern, cat in _CATEGORY_MAP:
        if pattern.search(haystack):
            return cat
    return "outros"


def search_off(query: str, limit: int = 8) -> list[dict]:
    query = query.strip()
    if len(query) < 2:
        return []

    params = {
        "search_terms": query,
        "action": "process",
        "json": "1",
        "cc": "br",
        "lc": "pt",
        "fields": "code,product_name,image_front_small_url,brands,categories_tags",
        "page_size": str(min(limit, 24)),
    }

    try:
        res = requests.get(
            _OFF_SEARCH_URL,
            params=params,
            headers={"User-Agent": _USER_AGENT},
            timeout=8,
        )
        if not res.ok:
            return []
        products = res.json().get("products", []) or []
    except (requests.RequestException, ValueError):
        return []

    result = []
    for p in products:
        name = (p.get("product_name") or "").strip()
        if not name:
            continue
        tags = p.get("categories_tags") or []
        result.append({
            "barcode": p.get("code") or "",
            "name": name,
            "brand": p.get("brands") or "",
            "category": infer_category(name, tags),
            "imageUrl": p.get("image_front_small_url") or None,
        })
    return result
