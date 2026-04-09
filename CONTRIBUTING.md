# Contributing to ClawMaster

Thank you for your interest in contributing to ClawMaster! This guide will help you get started.

## Ways to Contribute

- **Bug reports**: Open an issue with steps to reproduce, expected vs actual behavior, and environment details.
- **Feature requests**: Describe the use case and proposed solution in an issue.
- **Code**: Fix bugs, implement features, or improve performance.
- **Documentation**: Improve README, inline docs, or this guide.
- **Translations**: Add or improve i18n strings in `packages/web/src/i18n/`.
- **Testing**: Add test cases or improve existing coverage.

## Development Setup

Prerequisites: **Node.js 20+** and npm.

```bash
git clone https://github.com/clawmaster-ai/clawmaster.git
cd clawmaster
npm install
npm run dev:web    # Starts backend (port 3001) + frontend (port 3000)
npm test           # Run all tests
```

For desktop (Tauri) development, see the Rust/Tauri section in `CLAUDE.md`.

## Branch and PR Workflow

1. **Fork** the repository and clone your fork.
2. Create a **feature branch** from `main`:
   ```bash
   git checkout -b feat/my-feature main
   ```
3. Make your changes, commit with conventional messages (see below), and push.
4. Open a **Pull Request** against `main` in the upstream repo.
5. Fill in the PR template. Link related issues with `Closes #123`.

Keep PRs focused -- one logical change per PR.

## Code Style

- **TypeScript** with strict mode enabled. No `any` unless absolutely necessary.
- **Tailwind CSS** for all styling. No custom CSS files.
- **Lucide React** for icons. No other icon libraries.
- New features should be built as **capability modules** in `packages/web/src/modules/` (see `CLAUDE.md` for the `ClawModule` pattern).
- Use split adapters in `shared/adapters/` and the `useAdapterCall` hook for data fetching.

## i18n Rules (internationalization / 国际化)

All user-facing UI text **must** go through the `t()` translation function. Hard-coded strings in components are not accepted.

- Add keys to all three locale files: `zh.json`, `en.json`, `ja.json` in `packages/web/src/i18n/`.
- Use nested keys that match the module structure: e.g., `observe.chart.title`.
- Chinese (`zh.json`) is the primary language. English and Japanese translations should also be provided.

<!-- 所有界面文字必须通过 t() 函数调用，不允许硬编码字符串。新增键值需同时添加到 zh.json、en.json 和 ja.json。 -->

## Commit Message Convention

Use [Conventional Commits](https://www.conventionalcommits.org/) prefixes:

| Prefix     | Usage                          |
|------------|--------------------------------|
| `feat:`    | New feature                    |
| `fix:`     | Bug fix                        |
| `refactor:`| Code restructuring (no behavior change) |
| `docs:`    | Documentation only             |
| `test:`    | Adding or updating tests       |
| `ci:`      | CI/CD changes                  |
| `chore:`   | Dependency updates, tooling    |

Example: `feat: add token usage chart to observe module`

## Review Process

1. All PRs require at least **one approving review** from a maintainer.
2. CI must pass (build succeeds, tests pass).
3. Reviewers may request changes -- please address feedback promptly.
4. Once approved, a maintainer will merge using **squash and merge**.

## Questions?

Open a [Discussion](https://github.com/clawmaster-ai/clawmaster/discussions) or reach out to the OpenClaw community.

<!-- 欢迎参与贡献！如有疑问，请在 GitHub Discussions 中提问。 -->
