"""
Tool Registry - Agentic Tool Framework
Provides a registry of tools that the AI can invoke during conversations.
Each tool has a name, description, parameter schema, and an async execute method.
"""

import json
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field


@dataclass
class ToolParameter:
    name: str
    type: str  # "string", "number", "boolean"
    description: str
    required: bool = True


@dataclass
class Tool:
    name: str
    description: str
    parameters: List[ToolParameter] = field(default_factory=list)
    execute: Optional[Callable] = None
    icon: str = "🔧"
    category: str = "general"


class ToolRegistry:
    """Central registry for all available agent tools."""
    
    def __init__(self):
        self._tools: Dict[str, Tool] = {}
    
    def register(self, tool: Tool):
        self._tools[tool.name] = tool
    
    def get(self, name: str) -> Optional[Tool]:
        return self._tools.get(name)
    
    def list_tools(self) -> List[Tool]:
        return list(self._tools.values())
    
    def get_tool_descriptions(self) -> str:
        """Generate a text description of all tools for the system prompt."""
        if not self._tools:
            return ""
        
        lines = ["You have access to the following tools. To use a tool, respond with a JSON block in this exact format:",
                 "",
                 '```tool',
                 '{"tool": "tool_name", "args": {"param1": "value1"}}',
                 '```',
                 "",
                 "IMPORTANT: Only use a tool when it would genuinely help answer the user's question.",
                 "After receiving tool results, incorporate them naturally into your response.",
                 "",
                 "Available tools:",
                 ""]
        
        for tool in self._tools.values():
            param_desc = ""
            if tool.parameters:
                params = []
                for p in tool.parameters:
                    req = " (required)" if p.required else " (optional)"
                    params.append(f"    - {p.name} ({p.type}): {p.description}{req}")
                param_desc = "\n" + "\n".join(params)
            
            lines.append(f"  {tool.icon} **{tool.name}**: {tool.description}{param_desc}")
            lines.append("")
        
        return "\n".join(lines)
    
    def parse_tool_calls(self, text: str) -> List[Dict[str, Any]]:
        """Extract tool call JSON blocks from AI response text."""
        calls = []
        
        # Look for ```tool ... ``` blocks
        parts = text.split("```tool")
        for i in range(1, len(parts)):
            block = parts[i].split("```")[0].strip()
            try:
                parsed = json.loads(block)
                if "tool" in parsed:
                    calls.append(parsed)
            except json.JSONDecodeError:
                continue
        
        # Also look for inline {"tool": ...} patterns (fallback)
        if not calls:
            import re
            pattern = r'\{"tool"\s*:\s*"[^"]+"\s*,\s*"args"\s*:\s*\{[^}]*\}\s*\}'
            matches = re.findall(pattern, text)
            for match in matches:
                try:
                    parsed = json.loads(match)
                    if "tool" in parsed:
                        calls.append(parsed)
                except json.JSONDecodeError:
                    continue
        
        return calls
    
    async def execute_tool(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool by name with the given arguments."""
        tool = self.get(name)
        if not tool:
            return {"error": f"Unknown tool: {name}"}
        if not tool.execute:
            return {"error": f"Tool '{name}' has no execute function"}
        
        try:
            result = await tool.execute(**args)
            return {"tool": name, "result": result, "icon": tool.icon}
        except Exception as e:
            return {"tool": name, "error": str(e), "icon": tool.icon}


# Global registry instance
tool_registry = ToolRegistry()
