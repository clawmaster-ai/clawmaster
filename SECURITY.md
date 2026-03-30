# Security Policy

## Supported Versions

Only the **latest release** of ClawMaster receives security updates. Please ensure you are running the most recent version before reporting.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, send an email to **security@openclaw.dev** with the following details:

- Description of the vulnerability
- Steps to reproduce
- Affected version(s) and platform (Web / Desktop / both)
- Potential impact assessment
- Any suggested fix (optional)

## Response Timeline

- **72 hours**: Initial acknowledgment of your report.
- **7 days**: Assessment and triage completed; you will receive a status update.
- **30 days**: Target for releasing a fix for confirmed vulnerabilities.

We will coordinate disclosure timing with you. Credit will be given to reporters unless anonymity is requested.

## Scope

The following are considered in-scope vulnerabilities:

- Remote code execution
- Authentication or authorization bypass
- Sensitive data exposure (API keys, tokens, credentials)
- Cross-site scripting (XSS) in the web interface
- Path traversal or arbitrary file access
- Dependency vulnerabilities with a viable exploit path

Out of scope: denial-of-service against local-only services, issues requiring physical access.

## Data Handling Note

ClawMaster stores API keys and configuration locally in `~/.openclaw/openclaw.json`. These credentials are **never transmitted to ClawMaster servers**. All CLI operations execute locally on the user's machine.
