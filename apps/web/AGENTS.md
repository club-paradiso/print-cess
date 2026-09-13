<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Korean language quality

Workspace-wide rules live in `~/.claude/CLAUDE.md` (= `~/.codex/AGENTS.md` =
`~/.gemini/GEMINI.md`). `CLAUDE.md` and `GEMINI.md` here point at this file.

Korean kiosk and hand-off copy is checked with `~/dev/korean-language-quality`:

```bash
node ~/dev/korean-language-quality/bin/kolint.mjs ../..
```

`.kolintrc.json` at the repository root sets the genre to `ux`. The check is
advisory tooling and is not part of the build. `docs/DOCUMENT_JOURNEY.md` remains
the design record for what the screens say; the lint does not override it.
