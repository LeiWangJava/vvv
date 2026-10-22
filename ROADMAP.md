# Roadmap

Vibe Vision Video builds editable video templates once and reuses them across projects and coding agents, to cut the tokens spent repeating the same design and implementation work. Version 0.1 ships a portable skill, shared project tools, five templates (currently wedding films) and one effect. These are priorities, not dated commitments.

## Measure reuse and token cost

- Compare authoring from scratch with template reuse for the same brief, assets and acceptance criteria, reporting first-template cost separately from later reuse and including failed attempts and corrections.
- Record input, output and cached tokens where the host exposes them, with agent and model versions; compare only within a consistent setup.
- Judge success by accepted films, output quality, human corrections and token cost per accepted film before growing the template count.

## One contract across agents

- Keep templates, manifests, schemas and CLI commands shared; keep host-specific discovery and tool routing in guidance.
- Run the same template with different photos and copy across Claude Code, Codex and WorkBuddy, tracking discovery, project operations, rendering and review separately.
- Verify a complete WorkBuddy session and extend rendering checks beyond macOS ARM64.

## Better everyday creation

- Easier photo assignment and missing-content review, with explicit source records.
- Clearer diagnostics for music duration, story timing and stale samples.
- Scene detection, richer preview sheets and proxy workflows in the media helper, once their outputs can be verified.
- Transcription, voice and sound-processing integrations, and a video-generation adapter following the documented contract.

## A broader template library

- Templates beyond weddings, each with an input contract, fixtures, sample range and render evidence.
- A documented path for turning a recreated reference into a reusable template.
- `.vvv` packages for every template and effect with each release.

## A separate community home

A future community repository can collect templates, examples, reference breakdowns and discussion. It will be separate from this repository; no community service, marketplace or hosted renderer exists yet.

See the [current capabilities](README.md#what-you-can-do), [verification limits](docs/verification.md) and [contribution guide](CONTRIBUTING.md).
