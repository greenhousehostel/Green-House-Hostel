---
name: auth-security-audit
description: Scans code for security vulnerabilities, plain-text passcodes, insecure session handling, missing input sanitization, and weak auth implementations.
---
# Auth & Security Audit Skill
When inspecting or writing authentication & backend logic:
1. **Credential Safety**: Flag and remove any hardcoded plain-text passwords or secret keys.
2. **Secure Passwords**: Enforce secure hashing (Argon2 / bcrypt) for stored credentials.
3. **Input Sanitization**: Protect all form inputs and query params against XSS and SQL injection.
4. **Session Security**: Enforce HTTP-only, Secure, SameSite cookies or short-lived JWT tokens.
