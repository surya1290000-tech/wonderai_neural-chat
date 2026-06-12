"""
Web Search Tool - DuckDuckGo Integration
Allows the AI to search the web for real-time information.
Uses the DuckDuckGo Instant Answer API (no API key required).
"""

import httpx
from typing import Dict, Any

from app.services.tools import Tool, ToolParameter, tool_registry


async def web_search(query: str, max_results: int = 5) -> Dict[str, Any]:
    """Search the web using DuckDuckGo and return formatted results."""
    
    # DuckDuckGo HTML search (lite version for scraping snippets)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    results = []
    
    # Method 1: DuckDuckGo Instant Answer API
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
                headers=headers
            )
            data = resp.json()
            
            # Abstract (main answer)
            if data.get("Abstract"):
                results.append({
                    "title": data.get("Heading", "Answer"),
                    "snippet": data["Abstract"],
                    "url": data.get("AbstractURL", ""),
                    "source": data.get("AbstractSource", "")
                })
            
            # Related topics
            for topic in data.get("RelatedTopics", [])[:max_results]:
                if isinstance(topic, dict) and "Text" in topic:
                    results.append({
                        "title": topic.get("Text", "")[:80],
                        "snippet": topic.get("Text", ""),
                        "url": topic.get("FirstURL", ""),
                        "source": "DuckDuckGo"
                    })
            
            # Infobox
            if data.get("Infobox", {}).get("content"):
                info_lines = []
                for item in data["Infobox"]["content"][:5]:
                    info_lines.append(f"{item.get('label', '')}: {item.get('value', '')}")
                if info_lines:
                    results.append({
                        "title": f"{data.get('Heading', 'Info')} — Facts",
                        "snippet": " | ".join(info_lines),
                        "url": data.get("AbstractURL", ""),
                        "source": "Infobox"
                    })
    except Exception as e:
        results.append({"title": "Search Error", "snippet": str(e), "url": "", "source": "error"})
    
    # Method 2: Fallback — if no results from Instant Answer, try the lite HTML
    if not results:
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(
                    "https://lite.duckduckgo.com/lite/",
                    params={"q": query},
                    headers=headers
                )
                # Simple extraction from the lite page
                from html.parser import HTMLParser
                
                class DDGParser(HTMLParser):
                    def __init__(self):
                        super().__init__()
                        self.results = []
                        self.in_snippet = False
                        self.current_snippet = ""
                        self.in_link = False
                        self.current_url = ""
                        self.current_title = ""
                    
                    def handle_starttag(self, tag, attrs):
                        attrs_dict = dict(attrs)
                        if tag == "a" and "class" in attrs_dict and "result-link" in attrs_dict.get("class", ""):
                            self.in_link = True
                            self.current_url = attrs_dict.get("href", "")
                        if tag == "td" and "class" in attrs_dict and "result-snippet" in attrs_dict.get("class", ""):
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
                                    "source": "DuckDuckGo"
                                })
                            self.current_title = ""
                            self.current_snippet = ""
                            self.current_url = ""
                
                parser = DDGParser()
                parser.feed(resp.text)
                results = parser.results[:max_results]
        except Exception:
            pass
    
    if not results:
        return {"query": query, "results": [], "summary": f"No results found for '{query}'."}
    
    # Format for AI consumption
    formatted = []
    for i, r in enumerate(results[:max_results], 1):
        formatted.append(f"[{i}] {r['title']}\n    {r['snippet']}\n    Source: {r.get('source', '')} | URL: {r.get('url', '')}")
    
    return {
        "query": query,
        "results": results[:max_results],
        "summary": "\n\n".join(formatted)
    }


# Register the tool
web_search_tool = Tool(
    name="web_search",
    description="Search the web for current information, news, facts, or any topic. Use this when the user asks about recent events, real-time data, or anything you're unsure about.",
    parameters=[
        ToolParameter(name="query", type="string", description="The search query"),
        ToolParameter(name="max_results", type="number", description="Maximum number of results to return (default: 5)", required=False),
    ],
    execute=web_search,
    icon="🔍",
    category="search"
)

tool_registry.register(web_search_tool)
