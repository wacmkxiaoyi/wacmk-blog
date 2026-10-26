"""Boundary for keyword-search documents stored in ZincSearch.

Published resource text lives here; MySQL remains the source for resource
metadata, permissions, and relationships.
"""
import base64
import json
import logging
import re
from html import unescape
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.conf import settings


ARTICLE_INDEX = "wacmk_blog_article_keyword_v1"
BOOK_INDEX = "wacmk_blog_book_keyword_v1"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150
logger = logging.getLogger(__name__)


class ZincSearchError(RuntimeError):
    pass


def _url(path):
    return f"{settings.ZINC_SEARCH_API_ENDPOINT.rstrip('/')}/{path.lstrip('/')}"


def _request(method, path, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(_url(path), data=data, method=method)
    request.add_header("Accept", "application/json")
    if data:
        request.add_header("Content-Type", "application/json")
    token = base64.b64encode(f"{settings.ZINC_SEARCH_USERNAME}:{settings.ZINC_SEARCH_PASSWORD}".encode()).decode()
    request.add_header("Authorization", f"Basic {token}")
    try:
        with urlopen(request, timeout=10) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ZincSearchError(f"ZincSearch returned HTTP {exc.code}: {detail}") from exc
    except (URLError, OSError, ValueError) as exc:
        raise ZincSearchError(f"ZincSearch request failed: {exc}") from exc


def ensure_indexes():
    # ZincSearch accepts a basic index definition and infers field mappings.
    for index in (ARTICLE_INDEX, BOOK_INDEX):
        try:
            _request("POST", "/api/index", {"name": index})
        except ZincSearchError as exc:
            # ZincSearch reports an existing index as HTTP 400 rather than a
            # conflict response. Its message is the only stable distinction
            # from other invalid create-index requests.
            if "already exists" not in str(exc).lower():
                raise


def _display_name(user):
    return user.get_full_name() or user.username


def plain_text(content):
    text = re.sub(r"<[^>]+>", " ", content or "")
    text = re.sub(r"!?(?:\[[^\]]*\])\([^)]*\)", " ", text)
    text = re.sub(r"[`*_>#~]", " ", text)
    return re.sub(r"\s+", " ", unescape(text)).strip()


def content_chunks(content):
    text = plain_text(content)
    if not text:
        return []
    chunks, start = [], 0
    while start < len(text):
        end = min(len(text), start + CHUNK_SIZE)
        if end < len(text):
            boundary = max(text.rfind("\n", start, end), text.rfind("。", start, end), text.rfind(".", start, end), text.rfind(" ", start, end))
            if boundary > start + CHUNK_SIZE // 2:
                end = boundary + 1
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - CHUNK_OVERLAP, start + 1)
    return chunks


def get_article_document(article_id):
    hits = _search(ARTICLE_INDEX, "", [], article_id=article_id, document_type="metadata")
    if not hits:
        raise ZincSearchError(f"Article search document {article_id} is unavailable.")
    return hits[0].get("_source", {})


def get_book_document(book_id):
    result = _search(BOOK_INDEX, "", [], book_id=book_id)
    if not result:
        raise ZincSearchError(f"Book search document {book_id} is unavailable.")
    return result[0].get("_source", {})


def index_article(article, abstract, content):
    ensure_indexes()
    metadata_id = f"article-{article.pk}-metadata"
    tags = list(article.tags.values_list("name", flat=True))
    metadata = {"id": metadata_id, "document_type": "metadata", "article_id": article.pk, "title": article.title, "abstract": abstract or "", "tags": tags, "author_name": _display_name(article.author), "content": content or ""}
    _request("PUT", f"/api/{ARTICLE_INDEX}/_doc/{quote(metadata_id, safe='')}", metadata)
    # Chunks have deterministic IDs, so remove stale chunks before recreating them.
    previous = _search(ARTICLE_INDEX, "", [], article_id=article.pk, document_type="content_chunk")
    for hit in previous:
        _request("DELETE", f"/api/{ARTICLE_INDEX}/_doc/{quote(hit.get('_source', {}).get('id', hit.get('_id', '')), safe='')}")
    for index, chunk in enumerate(content_chunks(content)):
        document_id = f"article-{article.pk}-chunk-{index}"
        _request("PUT", f"/api/{ARTICLE_INDEX}/_doc/{quote(document_id, safe='')}", {"id": document_id, "document_type": "content_chunk", "article_id": article.pk, "chunk_index": index, "content": chunk})


def index_book(book, abstract):
    ensure_indexes()
    document_id = f"book-{book.pk}"
    _request("PUT", f"/api/{BOOK_INDEX}/_doc/{quote(document_id, safe='')}", {"id": document_id, "book_id": book.pk, "title": book.name, "abstract": abstract or "", "author_name": _display_name(book.created_by)})


def delete_article(article_id):
    for hit in _search(ARTICLE_INDEX, "", [], article_id=article_id):
        _request("DELETE", f"/api/{ARTICLE_INDEX}/_doc/{quote(hit.get('_source', {}).get('id', hit.get('_id', '')), safe='')}")


def delete_book(book_id):
    for hit in _search(BOOK_INDEX, "", [], book_id=book_id):
        _request("DELETE", f"/api/{BOOK_INDEX}/_doc/{quote(hit.get('_source', {}).get('id', hit.get('_id', '')), safe='')}")


def _search(index, query, fields, tag="", article_id=None, book_id=None, document_type=None):
    clauses = [{"multi_match": {"query": query, "fields": fields}}] if query else [{"match_all": {}}]
    if tag:
        clauses.append({"term": {"tags": tag}})
    if article_id is not None:
        clauses.append({"term": {"article_id": article_id}})
    if book_id is not None:
        clauses.append({"term": {"book_id": book_id}})
    if document_type:
        clauses.append({"term": {"document_type": document_type}})
    result = _request("POST", f"/es/{index}/_search", {"query": {"bool": {"must": clauses}}, "size": 10000}) or {}
    return result.get("hits", {}).get("hits", [])


def search_article_ids(query, tag=""):
    ensure_indexes()
    scores = {}
    for hit in _search(ARTICLE_INDEX, query, ["title^4", "abstract^3", "tags^2", "author_name", "content"], tag):
        source = hit.get("_source", {})
        article_id = source.get("article_id")
        if article_id:
            scores[article_id] = max(scores.get(article_id, float("-inf")), hit.get("_score", 0))
    return [article_id for article_id, _ in sorted(scores.items(), key=lambda item: item[1], reverse=True)]


def search_book_ids(query):
    ensure_indexes()
    return [hit.get("_source", {}).get("book_id") for hit in _search(BOOK_INDEX, query, ["title^4", "abstract^3", "author_name"]) if hit.get("_source", {}).get("book_id")]
