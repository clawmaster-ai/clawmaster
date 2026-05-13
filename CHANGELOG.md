# Changelog

This repository keeps the in-tree changelog intentionally brief.

- `## [Unreleased]` is for short upgrade or migration notes that matter before the next tag.
- Canonical per-release notes live in [GitHub Releases](https://github.com/openmaster-ai/clawmaster/releases).
- Desktop installer details, checksums, and shipped artifacts are published from CI with each release.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

- See the open pull requests and merged changes on GitHub for work not yet released.

## [0.4.0] - 2025-05-13

### Added

- **Wiki / LLM Knowledge Base**: workspace module, knowledge service backend, and PowerMem integration for wiki recall and link ingest
- **Gateway-backed Wiki LLM workflows**: gateway-proxied LLM calls for wiki operations
- **GLM provider**: native GLM model support and integration guidance
- **Baidu Qianfan Coding Plan provider**: new provider for Baidu Qianfan coding models
- **Gateway watchdog**: health monitor for ClawMaster service mode
- **Package download tracker**: skill for tracking package download progress
- **Latest session cost on Observe**: show most recent session cost in the Observe dashboard
- **ClawMaster release notifications**: notify users of new releases

### Fixed

- **Windows process management**: use `taskkill` for process tree cleanup on Windows; resolve ENOENT for npm-installed CLI tools (`openclaw`, `clawprobe`, `npm`)
- **SIGTERM→SIGKILL grace period**: restore grace period on non-Windows timeout
- **WeChat QR login**: fix cancellation and recovery flow
- **PaddleOCR OCR configuration UX**: clarify configuration surface
- **Settings update section**: improve settings update UI
- **Security audit advisories**: remediate reported vulnerabilities
- **Windows WSL**: fix workspace path and Vitest workers for WSL environments

### Changed

- **Wiki module repositioned**: wiki module is now positioned as LLM knowledge base with consolidated PowerMem integration
- **Release workflow**: use release-action for GitHub releases
