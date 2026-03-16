# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Send a report to: **security@raloonsoc.dev** (or open a [GitHub Security Advisory](https://github.com/raloonsoc/velvet-auth/security/advisories/new))

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive a response within **48 hours**. If the issue is confirmed, a patch will be released as soon as possible.

## Scope

Issues considered in scope:
- Authentication bypass
- JWT validation flaws
- Redis session hijacking
- Password hashing weaknesses
- Insecure default configuration

Out of scope:
- Vulnerabilities in peer dependencies (report to their maintainers)
- Issues requiring physical access to the server
- Social engineering attacks
