# Verification and limits

## Automated checks

Run from the repository root (see [CONTRIBUTING](../CONTRIBUTING.md) for setup):

```sh
python3 -m unittest discover -s tests -v
python3 scripts/check-repository.py --portable
npm --prefix kits/remotion run check
```

The Python suite covers the project helper (template discovery, `init`, validation against generated props schemas, sampling reports), `vvv check`, `.vvv` packing and verification (manifest schema, per-file integrity and license records, evidence, safe ZIP extraction, malformed or corrupted members), the media helper, the image routes against local fixtures, and the skill packager. Set `VVV_TEST_FFMPEG` and `VVV_TEST_FFPROBE` to run the media tests with specific binaries; skipped media tests are not evidence. The kit check runs TypeScript, the Node tests (registry and catalog agreement, schema freshness, fixtures) and offline integrity checks of the bundled fonts. The repository checker validates the publication candidate, local Markdown links, required files, skill metadata and vendor hashes; `--portable` also smoke-tests a standalone copy of the skill.

These checks pass on macOS ARM64 with Python 3.9 and Node.js 26.8.2 and the Remotion version in the lock file. They make no generation calls and use no account quota. They do not render a full film and do not establish visual approval, listening review or user acceptance.

Packaging was also exercised end to end: all five templates and `papercut-frame` were packed, verified and unpacked without warnings. Unpacked projects report download-only soundtracks as pending until `npm run music` fetches them.

The portable skill has been copied into isolated Claude Code, Codex and WorkBuddy layouts and checked byte for byte; that covers discovery files, helper CLIs, the pinned c2c bridge and packaging, not a complete desktop creative session.

## Preview review

The six published previews were rendered on 2026-10-21 from the current compositions at 1920 × 1080 (1080 × 1920 for 9:16), measured with `vvv check`, and encoded for the gallery at 1280 × 720 (720 × 1280), which produces an expected resolution warning against the 1080p target. The [validation record](assets/preview-validation-2026-10-21.json) covers format, audio, still stretches, beat alignment, full-stream decode, metadata, frame samples and source fingerprints; [previews.json](assets/previews.json) holds hashes, encode settings and stream metadata.

| Preview | Source range | Review focus | Finding |
|---|---:|---|---|
| Doodle | 1.5–24.5 s | Heart and "We're married!", record card, avatars, first photo pair | Opens on the blooming heart. The avatar-to-photo handover leaves near-empty paper for about 0.9 s (about 18.6–19.5 s into the excerpt); faint labels remain, no fully blank frame |
| Album 16:9 | 3–26.733 s | Wide title, portraits, story spreads, Chinese-outfit page | Readable; faces stay inside their crops |
| Album 9:16 | 26–48.6 s of 49.8 s | Chapel title, portrait layouts, set titles, closing card | Ends on the complete closing card; the 远方 and 夜色 titles now read against their backgrounds. Ending before the film's own fade keeps beat alignment within the check (50 ms mean) |
| DV Story | 70–90 s | Typed lines, first-chat card, first photo pages | Starts on typing, ends on the complete birthday page |
| Comedy | 62.6–76.9 s | Groom introduction, childhood-photo gag, name reveal | Captions readable; ends on the landed nameplate before the bride card begins |
| Starter | 0–34.9 s (full reel) | Names card, beat-cut gallery, closing card | Complete film; photo visible from 0.2 s |

Frames were reviewed as tiled sheets at whole-second intervals and around each transition and range boundary. The criteria: visible cause and result, one reading task at a time, stable spatial identity, captions that match their images. The Doodle handover above is an open refinement item in the template timing.

## What remains outside these claims

- Full-length Doodle, Album, DV Story and Comedy timelines have not been watched in continuous playback, and no listening review or aesthetic approval is claimed.
- Rendering is verified on macOS ARM64 only. WorkBuddy and other hosts have documented routes but no complete verified creation session.
- Photo assignment is provisional: names, dates, crops, identity and scene meaning need review against the user's material.
- URL ingestion, arbitrary footage editing, voice generation and exact reproduction of a reference are not covered.
- Render reports keep `visualReview: not-reviewed`. A successful render, a current fingerprint or a passing test suite does not replace watching the video.
