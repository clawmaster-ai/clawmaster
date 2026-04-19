---
name: clawprobe-cost-digest
description: General-purpose ClawProbe spend digest skill for OpenClaw. Use when the user needs a daily, weekly, or monthly cost digest, top spenders, token totals, daily breakdowns, or previous-period comparisons based on local OpenClaw and clawprobe data. This skill is guidance plus a runnable Node script: read this file, then use exec with node to generate the digest.
metadata:
  openclaw:
    requires:
      anyBins:
        - node
        - clawprobe
---

# clawprobe-cost-digest

Use this skill when OpenClaw needs a real spend digest from local `clawprobe` data, not a guess from memory.

This skill reads the local OpenClaw session transcripts that `clawprobe` tracks, refreshes or reuses the shared `models.dev` pricing cache, and generates a structured digest with:

- total USD and token totals
- day-by-day breakdowns for weekly and monthly windows
- top sessions and top models
- previous-period comparison
- warnings for unpriced models

## Critical Rule

This skill is guidance plus a runnable script, not a callable tool name.

- Do not call `clawprobe-cost-digest` as if it were a built-in tool.
- First use `read` to load this `SKILL.md`.
- Then use `exec` to run the bundled Node script with `node`.
- If the user asks for a digest, actually run the script and use its output.

## Prerequisites

- `clawprobe` must be installed locally and able to read the user's OpenClaw sessions.
- The shared pricing cache lives at `~/.openclaw/cache/models-dev.json`.
- If the cache is stale or missing, this skill refreshes it from `https://models.dev/api.json`.

## Script Directory

Treat the directory containing this `SKILL.md` as `SKILL_DIR`, then use:

| Script | Purpose |
|---|---|
| `scripts/generate-digest.mjs` | Builds a daily, weekly, or monthly cost digest from local clawprobe/OpenClaw data |

## Default workflow

1. Pick the period: `day`, `week`, or `month`.
2. Run the digest script with `--period`.
3. Use `--summary` when you want channel-ready markdown text.
4. Use the JSON output when another workflow needs structured totals or breakdowns.

## Commands

```bash
# Daily digest as markdown
node ${SKILL_DIR}/scripts/generate-digest.mjs --period day --summary

# Weekly digest as JSON
node ${SKILL_DIR}/scripts/generate-digest.mjs --period week

# Monthly digest with a forced pricing refresh
node ${SKILL_DIR}/scripts/generate-digest.mjs --period month --refresh-pricing --summary
```

## Query flags

| Flag | Meaning |
|---|---|
| `--period <day|week|month>` | Required digest window |
| `--summary` | Print markdown summary instead of JSON |
| `--refresh-pricing` | Force-refresh the shared `models.dev` cache before pricing turns |
| `--max-age-ms <number>` | Override the pricing cache TTL |
| `--cache-path <path>` | Override the shared `models.dev` cache location |
| `--top <number>` | Number of top sessions and models to include |

## Response expectations

When you use this skill:

1. Say whether pricing came from cache or a fresh models.dev download.
2. Keep the final digest concise and operational.
3. Mention unpriced models explicitly instead of hiding them.
4. If `clawprobe` is unavailable, surface that as the blocker instead of improvising a digest.
