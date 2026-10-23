# Roadmap

Vibe Vision Video builds editable video templates once and reuses them across projects and coding agents, to cut the tokens spent repeating the same design and implementation work. Version 0.1 ships a portable skill, shared project tools, five templates (currently wedding films) and one effect; [vibevision.video](https://vibevision.video) hosts the template gallery, community submissions with owner review, and an MCP server. These are priorities, not dated commitments.

Throughout, the user briefs, watches samples and gives feedback; setup, commands and recovery are the agent's job, so every helper is built for the agent to run and act on.

## Measure reuse and token cost

- Compare authoring from scratch with template reuse for the same brief, assets and acceptance criteria, reporting first-template cost separately from later reuse and including failed attempts and corrections.
- Record input, output and cached tokens where the host exposes them, with agent and model versions; compare only within a consistent setup.
- Judge success by accepted films, output quality, human corrections and token cost per accepted film before growing the template count.

## One contract across agents

- Let any agent set up and finish a film on Linux and Windows as well as macOS, with a rendering check in CI.
- Keep templates, manifests, schemas and CLI commands shared; keep host-specific discovery and tool routing in guidance.
- Run the same template with different photos and copy across Claude Code, Codex and WorkBuddy, tracking discovery, project operations, rendering and review separately.
- Verify a complete WorkBuddy session and extend rendering checks beyond macOS ARM64.

## Better everyday creation

- Easier photo assignment and missing-content review, with explicit source records.
- Clearer diagnostics for music duration, story timing and stale samples.
- Scene detection, richer preview sheets and proxy workflows in the media helper, once their outputs can be verified.
- Transcription, voice and sound-processing integrations, and a video-generation adapter following the documented contract.

## A broader template library

- More wedding templates first (invitations, reception films, photo reels, ceremony and venue screens), then nearby occasions such as birthdays, baby celebrations and graduations, each with an input contract, fixtures, full-film render evidence and a human review.
- A scaffold and checklist that takes a new template from brief through beat calibration, full render, `vvv check` and review to a package.
- Shared scene building blocks, more fictional demo photo sets and redistributable music, so new templates cost less.
- English copy and fonts for every template.
- Video clips with their own sound as template inputs, alongside photos.
- A documented path for turning a recreated reference into a reusable template.
- `.vvv` packages for every template and effect with each release.

## Community templates

Anyone signed in with GitHub or Linux.do can submit a `.vvv` template on [vibevision.video](https://vibevision.video/community/); automated checks run first and the owner reviews every package before it is published there and in the MCP server. Next: template versions, author pages, filtering by occasion and format, and installing community templates through MCP.

See the [current capabilities](docs/capabilities.md), [verification limits](docs/verification.md) and [contribution guide](CONTRIBUTING.md).
