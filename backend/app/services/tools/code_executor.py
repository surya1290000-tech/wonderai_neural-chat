"""
Code Execution Tool - Safe Python Sandbox
Allows the AI to execute Python code to solve math problems,
analyze data, or demonstrate programming concepts.

Security: Uses RestrictedPython-style sandboxing with limited builtins,
no filesystem access, no network access, and execution timeouts.
"""

import sys
import io
import math
import json
import traceback
from typing import Dict, Any
from contextlib import redirect_stdout, redirect_stderr

from app.services.tools import Tool, ToolParameter, tool_registry

# Safe builtins — only math/logic/string operations, no I/O or OS access
SAFE_BUILTINS = {
    # Types
    "int": int, "float": float, "str": str, "bool": bool,
    "list": list, "dict": dict, "tuple": tuple, "set": set,
    "frozenset": frozenset, "bytes": bytes, "bytearray": bytearray,
    "complex": complex,
    
    # Constructors / converters
    "range": range, "enumerate": enumerate, "zip": zip,
    "map": map, "filter": filter, "reversed": reversed,
    "sorted": sorted, "min": min, "max": max,
    "sum": sum, "abs": abs, "round": round,
    "len": len, "type": type, "isinstance": isinstance,
    "issubclass": issubclass, "hasattr": hasattr, "getattr": getattr,
    
    # String
    "chr": chr, "ord": ord, "hex": hex, "oct": oct, "bin": bin,
    "format": format, "repr": repr, "ascii": ascii,
    
    # Math
    "pow": pow, "divmod": divmod,
    
    # Boolean
    "all": all, "any": any,
    
    # Print (captured)
    "print": print,
    
    # Iteration
    "iter": iter, "next": next,
    
    # Exceptions (for try/except)
    "Exception": Exception, "ValueError": ValueError,
    "TypeError": TypeError, "KeyError": KeyError,
    "IndexError": IndexError, "ZeroDivisionError": ZeroDivisionError,
    "StopIteration": StopIteration, "RuntimeError": RuntimeError,
    
    # None/True/False
    "None": None, "True": True, "False": False,
}

# Safe modules the code is allowed to import
SAFE_MODULES = {
    "math": math,
    "json": json,
    "statistics": None,  # will be lazily imported
    "datetime": None,
    "collections": None,
    "itertools": None,
    "functools": None,
    "re": None,
    "random": None,
    "string": None,
    "decimal": None,
    "fractions": None,
}

# Dangerous patterns to block
BLOCKED_PATTERNS = [
    "import os", "import sys", "import subprocess", "import shutil",
    "import socket", "import http", "import urllib", "import pty",
    "__import__", "exec(", "eval(", "exec ",
    "open(", "file(", "input(",
    "os.system", "os.popen", "os.exec",
    "subprocess.", "shutil.", "socket.",
    "__builtins__", "__globals__", "__subclasses__",
    "__class__", "__bases__", "__mro__", "__code__", "__closure__",
    "breakpoint(", "compile(",
]



def _safe_import(name, *args, **kwargs):
    """Restricted import that only allows safe modules."""
    if name in SAFE_MODULES:
        if SAFE_MODULES[name] is None:
            import importlib
            SAFE_MODULES[name] = importlib.import_module(name)
        return SAFE_MODULES[name]
    raise ImportError(f"Import of '{name}' is not allowed in the sandbox")


async def execute_code(code: str, timeout: int = 10) -> Dict[str, Any]:
    """Execute Python code in a restricted sandbox."""
    
    # Security: Check for dangerous patterns
    code_lower = code.lower()
    for pattern in BLOCKED_PATTERNS:
        if pattern.lower() in code_lower:
            return {
                "success": False,
                "error": f"Blocked: '{pattern}' is not allowed in the sandbox for security reasons.",
                "output": "",
                "code": code
            }
    
    # Prepare restricted globals
    restricted_globals = {"__builtins__": {**SAFE_BUILTINS, "__import__": _safe_import}}
    restricted_globals["math"] = math
    
    # Capture stdout/stderr
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()
    
    try:
        # Compile the code first to catch syntax errors
        compiled = compile(code, "<sandbox>", "exec")
        
        # Execute with captured output and timeout
        import asyncio
        
        def _run():
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                exec(compiled, restricted_globals)
        
        # Run in executor with timeout
        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(None, _run),
            timeout=timeout
        )
        
        output = stdout_capture.getvalue()
        errors = stderr_capture.getvalue()
        
        # Try to capture the last expression result (like a REPL)
        result_value = None
        lines = code.strip().split("\n")
        last_line = lines[-1].strip()
        if last_line and not last_line.startswith(("#", "print", "if ", "for ", "while ", "def ", "class ", "import ", "from ", "try:", "except", "with ", "return")):
            try:
                result_value = eval(last_line, restricted_globals)
            except Exception:
                pass
        
        final_output = output
        if result_value is not None and str(result_value) not in output:
            final_output += f"\n→ {result_value}" if output else f"→ {result_value}"
        if errors:
            final_output += f"\n[stderr] {errors}"
        
        return {
            "success": True,
            "output": final_output.strip() or "(No output)",
            "code": code,
        }
    
    except asyncio.TimeoutError:
        return {
            "success": False,
            "error": f"Execution timed out after {timeout} seconds.",
            "output": stdout_capture.getvalue(),
            "code": code,
        }
    except SyntaxError as e:
        return {
            "success": False,
            "error": f"Syntax Error: {e.msg} (line {e.lineno})",
            "output": "",
            "code": code,
        }
    except Exception as e:
        tb = traceback.format_exc()
        # Filter traceback to only show sandbox-relevant lines
        tb_lines = tb.split("\n")
        filtered = [l for l in tb_lines if "<sandbox>" in l or not l.startswith("  File")]
        
        return {
            "success": False,
            "error": f"{type(e).__name__}: {e}",
            "output": stdout_capture.getvalue(),
            "code": code,
        }


# Register the tool
code_execution_tool = Tool(
    name="run_code",
    description="Execute Python code to solve math problems, analyze data, demonstrate algorithms, or perform calculations. The code runs in a secure sandbox with access to math, statistics, datetime, collections, itertools, re, and random modules.",
    parameters=[
        ToolParameter(name="code", type="string", description="The Python code to execute"),
    ],
    execute=execute_code,
    icon="💻",
    category="code"
)

tool_registry.register(code_execution_tool)
