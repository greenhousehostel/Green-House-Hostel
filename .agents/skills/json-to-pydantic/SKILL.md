---
name: json-to-pydantic
description: Converts JSON payloads, API request bodies, and database structures into strict, type-safe Pydantic v2 / Python data models.
---
# JSON to Pydantic Skill
When converting JSON data to Python models:
1. **Type Safety**: Use exact types (str, int, loat, ool, datetime, Optional[...]).
2. **Pydantic v2 Syntax**: Use Field(description=...), @field_validator, and ConfigDict.
3. **Nesting**: Break complex nested JSON objects into modular child models.
