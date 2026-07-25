"""
Web Search Tool - Perplexity-Style Deep Web Search
Multi-engine search with Google Custom Search API + DuckDuckGo fallback.
Scrapes page content for deep context, returns structured sources for
inline citation rendering on the frontend.
"""

import httpx
import re
import asyncio
from typing import Dict, Any, List
from urllib.parse import urlparse
from html.parser import HTMLParser

from app.config import settings
from app.services.tools import Tool, ToolParameter, tool_registry


# ──────────────────────────────────────────────
# HTML → Plain Text Extractor
# ──────────────────────────────────────────────
class _TextExtractor(HTMLParser):
    """Minimal HTML tag stripper that extracts visible text."""
    _skip = {"script", "style", "noscript", "svg", "head", "nav", "footer", "header"}

    def __init__(self):
        super().__init__()
        self._parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self._skip:
            self._skip_depth += 1
        if tag in ("p", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6", "div", "td"):
            self._parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self._skip and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data):
        if self._skip_depth == 0:
            self._parts.append(data)

    def get_text(self) -> str:
        raw = "".join(self._parts)
        # Collapse whitespace
        raw = re.sub(r"[ \t]+", " ", raw)
        raw = re.sub(r"\n{3,}", "\n\n", raw)
        return raw.strip()


def _extract_text(html: str) -> str:
    parser = _TextExtractor()
    try:
        parser.feed(html)
    except Exception:
        pass
    return parser.get_text()


def _get_favicon(url: str) -> str:
    """Return a Google-hosted favicon URL for a domain."""
    try:
        domain = urlparse(url).netloc
        return f"https://www.google.com/s2/favicons?domain={domain}&sz=32"
    except Exception:
        return ""


def _get_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return url


# ──────────────────────────────────────────────
# Search Engines
# ──────────────────────────────────────────────
async def _google_search(query: str, max_results: int) -> List[Dict]:
    """Google Custom Search JSON API."""
    if not settings.GOOGLE_SEARCH_API_KEY or not settings.GOOGLE_SEARCH_CX:
        return []
    results = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://www.googleapis.com/customsearch/v1",
                params={
                    "key": settings.GOOGLE_SEARCH_API_KEY,
                    "cx": settings.GOOGLE_SEARCH_CX,
                    "q": query,
                    "num": min(max_results, 10),
                },
            )
            data = resp.json()
            for item in data.get("items", [])[:max_results]:
                results.append({
                    "title": item.get("title", ""),
                    "snippet": item.get("snippet", ""),
                    "url": item.get("link", ""),
                    "domain": _get_domain(item.get("link", "")),
                    "favicon": _get_favicon(item.get("link", "")),
                    "source": "Google",
                    "content": "",  # filled by scraper
                })
    except Exception as e:
        print(f"DEBUG: Google search error: {e}")
    return results


async def _duckduckgo_search(query: str, max_results: int) -> List[Dict]:
    """DuckDuckGo Instant Answer API + lite HTML fallback."""
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    results = []

    # Method 1: Instant Answer API
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
                headers=headers,
            )
            data = resp.json()

            if data.get("Abstract"):
                results.append({
                    "title": data.get("Heading", "Answer"),
                    "snippet": data["Abstract"],
                    "url": data.get("AbstractURL", ""),
                    "domain": _get_domain(data.get("AbstractURL", "")),
                    "favicon": _get_favicon(data.get("AbstractURL", "")),
                    "source": data.get("AbstractSource", "DuckDuckGo"),
                    "content": data["Abstract"],
                })

            for topic in data.get("RelatedTopics", [])[:max_results]:
                if isinstance(topic, dict) and "Text" in topic:
                    url = topic.get("FirstURL", "")
                    results.append({
                        "title": topic.get("Text", "")[:100],
                        "snippet": topic.get("Text", ""),
                        "url": url,
                        "domain": _get_domain(url),
                        "favicon": _get_favicon(url),
                        "source": "DuckDuckGo",
                        "content": "",
                    })
    except Exception as e:
        print(f"DEBUG: DDG instant answer error: {e}")

    # Method 2: Lite HTML scraping fallback
    if len(results) < 2:
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(
                    "https://lite.duckduckgo.com/lite/",
                    params={"q": query},
                    headers=headers,
                )

                class _DDGParser(HTMLParser):
                    def __init__(self):
                        super().__init__()
                        self.results = []
                        self.in_snippet = False
                        self.current_snippet = ""
                        self.in_link = False
                        self.current_url = ""
                        self.current_title = ""

                    def handle_starttag(self, tag, attrs):
                        d = dict(attrs)
                        if tag == "a" and "result-link" in d.get("class", ""):
                            self.in_link = True
                            self.current_url = d.get("href", "")
                        if tag == "td" and "result-snippet" in d.get("class", ""):
                            self.in_snippet = True

                    def handle_data(self, data):
                        if self.in_link:
                            self.current_title += data
                        if self.in_snippet:
                            self.current_snippet += data

                    def handle_endtag(self, tag):
                        if tag == "a" and self.in_link:
                            self.in_link = False
                        if tag == "td" and self.in_snippet:
                            self.in_snippet = False
                            if self.current_title.strip() and self.current_snippet.strip():
                                self.results.append({
                                    "title": self.current_title.strip(),
                                    "snippet": self.current_snippet.strip(),
                                    "url": self.current_url,
                                    "domain": _get_domain(self.current_url),
                                    "favicon": _get_favicon(self.current_url),
                                    "source": "DuckDuckGo",
                                    "content": "",
                                })
                            self.current_title = ""
                            self.current_snippet = ""
                            self.current_url = ""

                p = _DDGParser()
                p.feed(resp.text)
                results.extend(p.results[:max_results])
        except Exception:
            pass

    return results[:max_results]


# ──────────────────────────────────────────────
# Page Content Scraper
# ──────────────────────────────────────────────
async def _scrape_page(url: str, timeout: float = 6.0) -> str:
    """Fetch a page and return its cleaned text (max ~2000 chars)."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
    }
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if "text/html" not in resp.headers.get("content-type", ""):
                return ""
            text = _extract_text(resp.text)
            # Truncate to ~2000 chars for context efficiency
            return text[:2000]
    except Exception:
        return ""


async def _scrape_top_pages(results: List[Dict], max_pages: int = 3) -> List[Dict]:
    """Concurrently scrape the top N result pages and attach content."""
    if not settings.WEB_SEARCH_SCRAPE_CONTENT:
        return results

    tasks = []
    for i, r in enumerate(results[:max_pages]):
        if r.get("url"):
            tasks.append((i, _scrape_page(r["url"])))

    scraped = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)

    for (idx, _), content in zip(tasks, scraped):
        if isinstance(content, str) and content:
            results[idx]["content"] = content
        elif not results[idx].get("content"):
            results[idx]["content"] = results[idx].get("snippet", "")

    # Ensure remaining results at least have snippet as content
    for r in results:
        if not r.get("content"):
            r["content"] = r.get("snippet", "")

    return results


# ──────────────────────────────────────────────
# Main Search Function
# ──────────────────────────────────────────────
async def web_search(query: str, max_results: int = 5) -> Dict[str, Any]:
    """
    Perplexity-style deep web search.
    1. Search via Google CSE (if configured) or DuckDuckGo
    2. Scrape top page content for deep context
    3. Return structured results with source metadata for citation rendering
    """
    max_results = min(max_results, settings.WEB_SEARCH_MAX_RESULTS)

    # Try Google first, fall back to DuckDuckGo
    results = await _google_search(query, max_results)
    if len(results) < 2:
        ddg_results = await _duckduckgo_search(query, max_results)
        # Merge, avoiding duplicate URLs
        seen_urls = {r["url"] for r in results}
        for r in ddg_results:
            if r["url"] not in seen_urls:
                results.append(r)
                seen_urls.add(r["url"])

    results = results[:max_results]

    if not results:
        return {
            "query": query,
            "results": [],
            "sources": [],
            "context": f"No web results found for '{query}'.",
            "summary": f"No results found for '{query}'.",
        }

    # Scrape top pages for deep content
    results = await _scrape_top_pages(results, max_pages=3)

    # Assign citation indices [1], [2], etc.
    sources = []
    for i, r in enumerate(results, 1):
        r["index"] = i
        sources.append({
            "index": i,
            "title": r["title"],
            "url": r["url"],
            "domain": r["domain"],
            "favicon": r["favicon"],
            "snippet": r["snippet"][:200],
        })

    # Build context block for the AI with numbered sources
    context_lines = [
        f"WEB SEARCH RESULTS for \"{query}\":\n",
        "Use these sources to answer. Cite them using inline numbers like [1], [2], etc.\n",
    ]
    for r in results:
        content_preview = r.get("content", r.get("snippet", ""))[:1500]
        context_lines.append(
            f"[{r['index']}] {r['title']}\n"
            f"    URL: {r['url']}\n"
            f"    Content: {content_preview}\n"
        )

    # Formatted summary (legacy compat)
    formatted = []
    for r in results:
        formatted.append(f"[{r['index']}] {r['title']}\n    {r['snippet']}\n    URL: {r['url']}")

    return {
        "query": query,
        "results": results,
        "sources": sources,
        "context": "\n".join(context_lines),
        "summary": "\n\n".join(formatted),
    }


# ──────────────────────────────────────────────
# Register Tool
# ──────────────────────────────────────────────
web_search_tool = Tool(
    name="web_search",
    description=(
        "Search the web for current information, news, facts, or any topic. "
        "Use this when the user asks about recent events, real-time data, latest news, "
        "current prices, sports scores, weather, or anything you're unsure about. "
        "IMPORTANT: When using search results, always cite sources using inline numbers "
        "like [1], [2] in your response."
    ),
    parameters=[
        ToolParameter(name="query", type="string", description="The search query"),
        ToolParameter(
            name="max_results",
            type="number",
            description="Maximum number of results to return (default: 5)",
            required=False,
        ),
    ],
    execute=web_search,
    icon="🔍",
    category="search",
)

tool_registry.register(web_search_tool)
