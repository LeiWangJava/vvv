# Changelog

## 0.1.0 — 2026-10-22

The first public release of Vibe Vision Video: build editable video templates once and reuse them across projects and coding agents.

- **Portable Agent Skill** (`skills/vvv`), tested in Claude Code and Codex and checked in WorkBuddy; 20+ other agents read the same `.agents/skills/` folder (untested). Install as a Claude Code plugin from the repository's marketplace (`/plugin install vvv --marketplace actionow-ai/vvv`, kit included), with `npx skills add actionow-ai/vvv`, by copying the directory, or as a ZIP built by `scripts/package-skill.py`. The helpers find the kit through `--kit`, `$VVV_KIT` or the `kits/remotion` beside the skill.
- **Five editable Remotion templates**, currently wedding films: Album (16:9 and 9:16), Comedy, Doodle, DV Story and Starter (16:9 and 9:16), plus the reusable `papercut-frame` effect. Fictional fixtures and checked preview excerpts with music.
- **Project helper** (`vvv.py`): `templates`, `describe`, `init` from local photos or the template's demo inputs (`--example`), validation of every prop against schemas generated from the renderer, samples from the main composition, full renders and stale-output detection. Errors are one JSON object with a stable code.
- **Render checks**: `vvv check` measures format, resolution, audio level, still stretches and beat alignment of a render or any video.
- **The `.vvv` package format 1.0** for templates, effects and finished projects, with per-file integrity and license records, previews and render evidence: `pack`, `verify`, `unpack`, `add`, `evidence`.
- **Reference-video recreation**: measure a reference's structure and beat rhythm with the media helper, the music analyzer and `vvv check`, then rebuild it as an editable project.
- **Image generation** through a native host tool, Codex's image generation from Claude Code via the bundled c2c bridge, or an explicitly configured Images API, never falling back to a paid route silently.
- **Media helper** for probing, clipping, audio extraction and frame sampling with FFmpeg.
- Music: a bundled public-domain track, a hash-verified downloader for Mixkit tracks that are not redistributed, and beat analysis for your own music.
