# Contributing

Vibe Vision Video keeps its portable agent skill in `skills/vvv`, the editable template kit in `kits/remotion`, and guides in `docs`. Start with the [README](README.md). Use [issues](https://github.com/actionow-ai/vvv/issues) for reproducible bugs and concrete feature requests, and pull requests for changes ready to review. Report vulnerabilities as described in [SECURITY.md](SECURITY.md). For anything else, write to [contact@vibevision.video](mailto:contact@vibevision.video).

## Development setup

Use Python 3.9 or 3.12 and Node.js 26.8.2 to match CI. From a Git checkout:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm --prefix kits/remotion ci
```

Media extraction also needs FFmpeg and FFprobe on PATH or passed explicitly. The Node version is pinned because the kit tests import TypeScript modules directly. When testing an agent integration, install the complete skill directory.

## Checks

Run from the repository root:

```sh
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python scripts/check-repository.py --portable
npm --prefix kits/remotion run check
```

The repository checker inspects tracked and non-ignored untracked files: local Markdown links and images, required release files, skill boundaries and metadata, pinned vendor hashes, and terms from an optional maintainer-local `.private-terms` denylist. `--portable` copies only the publishable skill files to a temporary directory and runs its CLIs. Remote URLs and heading anchors are not checked.

The kit check runs TypeScript, the Node tests and offline font-integrity checks. No check renders a full video, signs in to an agent or calls a generation service. Media tests use real FFmpeg/FFprobe with synthetic fixtures; set `VVV_TEST_FFMPEG` and `VVV_TEST_FFPROBE` to choose binaries. Skipped media tests are not validation.

`python3 scripts/package-skill.py --output .work/dist/vvv-skill.zip` builds the portable skill ZIP. It refuses uncommitted or untracked skill changes; pass `--allow-dirty` for a local test build. Releases follow [Preparing a release](docs/releasing.md).

For rendering or layout changes, render and watch a representative sample of the affected composition and say which range you reviewed. Use synthetic or fictional inputs for tests and examples; keep personal media and generated projects out of the repository.

## Changes and attribution

Keep fixes focused, keep machine-readable error behavior, and add a regression test for a behavioral change. Update the guides when a command or requirement changes. Keep skill links relative to the skill directory so copied installations stay complete.

Code is licensed under [MIT](LICENSE) by Vibe Vision Video contributors. Third-party code, fonts and media keep their own terms; see [third-party notices](THIRD_PARTY_NOTICES.md) and [media licensing](MEDIA_LICENSE.md). Include provenance and license information for new assets. Changes to vendored code must update its upstream metadata and integrity pins, with the source and reason in the pull request.
