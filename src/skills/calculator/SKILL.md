---
name: calculator
description: Perform mathematical calculations and evaluations. Use when you need to calculate expressions, evaluate formulas, or perform numeric computations.
license: Apache-2.0
metadata:
  author: keel-system
  version: "1.0"
tags:
  - math
  - calculation
  - utility
---

# Calculator Skill

Use this skill when you need to:
- Calculate mathematical expressions
- Evaluate formulas
- Perform numeric computations

Simply provide the expression to evaluate.

```python
# Calculator skill
import math
import numpy as np
import ast
import operator

expression = "{{expression}}"

# Safe mathematical expression evaluator
def safe_eval(expression: str):
    """
    Safely evaluate a mathematical expression using AST parsing.
    Only allows mathematical operations and functions.
    """
    try:
        # Parse the expression into an AST
        node = ast.parse(expression, mode='eval')
        
        # Define allowed operators
        operators = {
            ast.Add: operator.add,
            ast.Sub: operator.sub,
            ast.Mult: operator.mul,
            ast.Div: operator.truediv,
            ast.Pow: operator.pow,
            ast.Mod: operator.mod,
            ast.FloorDiv: operator.floordiv,
            ast.USub: operator.neg,
            ast.UAdd: operator.pos,
        }
        
        # Define allowed constants
        allowed_constants = {
            'pi': math.pi,
            'e': math.e,
            'tau': math.tau,
            'inf': math.inf,
            'nan': math.nan,
        }
        
        def _eval(node):
            if isinstance(node, ast.Expression):
                return _eval(node.body)
            elif isinstance(node, ast.Constant):
                if isinstance(node.value, (int, float, complex)):
                    return node.value
                else:
                    raise ValueError(f"Invalid constant: {node.value}")
            elif isinstance(node, ast.UnaryOp):
                if type(node.op) in operators:
                    return operators[type(node.op)](_eval(node.operand))
                else:
                    raise ValueError(f"Unsupported unary operator: {node.op}")
            elif isinstance(node, ast.BinOp):
                if type(node.op) in operators:
                    return operators[type(node.op)](_eval(node.left), _eval(node.right))
                else:
                    raise ValueError(f"Unsupported binary operator: {node.op}")
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    func_name = node.func.id
                    if func_name in allowed_constants:
                        return allowed_constants[func_name]
                    elif hasattr(math, func_name):
                        return getattr(math, func_name)(*[_eval(arg) for arg in node.args])
                    else:
                        raise ValueError(f"Unsupported function: {func_name}")
                else:
                    raise ValueError("Unsupported function call")
            elif isinstance(node, ast.Name):
                if node.id in allowed_constants:
                    return allowed_constants[node.id]
                else:
                    raise ValueError(f"Unsupported variable: {node.id}")
            else:
                raise ValueError(f"Unsupported node type: {type(node)}")
        
        result = _eval(node)
        return result
    except Exception as e:
        print(f"Error: {e}")
        return None

# Evaluate the expression
try:
    result = safe_eval(expression)
    if result is not None:
        print(f"Result: {result}")
    else:
        print("Failed to evaluate expression")
except Exception as e:
    print(f"Error: {e}")
```
