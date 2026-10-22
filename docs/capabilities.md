# What VVV can do

VVV turns photos, footage, a brief or a reference video into an editable video through **analysis, material preparation, scene design, composition and review**. The skill coordinates the work in Claude Code, Codex or WorkBuddy; concrete operations depend on the local tools and services available.

## The creative workflow

| Capability | What the agent does | Implementation or boundary |
|---|---|---|
| Understand inputs | Classifies photos, footage, sound, text and references; records what was inspected | Host perception tools plus local media metadata; nothing is claimed about uninspected content |
| Extract material | Cuts video ranges, extracts an audio track and samples frames without changing the original | The local `vvv_media.py` FFmpeg/FFprobe helper |
| Select shots | Chooses useful ranges and notes their role in the story | Timed selections from actual inspection, not automatic shot detection |
| Plan the story | Defines audience, message and duration; builds a scene plan and missing-asset list | Decisions recorded in the editable project |
| Fill a template | Reads the template's slots, copy fields and photo needs, then maps the inputs | `vvv.py describe`, `init` and `validate` |
| Create visuals | Reuses photos and footage, draws editable graphics in code, generates or edits raster images | Remotion source plus the native, c2c or API image routes |
| Edit picture, sound and text | Builds scenes, cuts, motion, transitions, captions, music and effects | Remotion source; transcription, voice and stem separation need extra tools |
| Adapt formats | Recomposes the film for 16:9 or 9:16 | A separate layout per format, not a resize |
| Review and deliver | Measures renders, applies feedback, keeps source, assets, locks and evidence | `vvv check`, samples of the main composition, editable handoff and `.vvv` packages |

These stages do not require a separate document each. Small changes start from the current project; a new film usually needs a short brief, a source inventory and a storyboard. The [production guide](../skills/vvv/references/production.md) keeps decisions across sessions, and the [craft guide](../skills/vvv/references/craft.md) turns feedback such as "too generic" into concrete changes.

## Recreate a reference video

The user gives a reference video plus attachments: photos, logos, copy and music. The agent then:

1. Inspects the reference with `vvv_media.py` (duration, frame rate, audio, frames sampled across the film and around each transition).
2. Measures its rhythm: `analyze-music` writes a beat map of the soundtrack, and `vvv.py check --video REF --beats MAP` reports its still stretches, still share and beat alignment.
3. Writes its structure in beats and decides what carries over (section order, motion, layout ideas) and what is replaced (people, footage, names, music without rights).
4. Rebuilds it as an editable project on the closest template or a new composition, and generates missing artwork through an available image route.
5. Renders the most characteristic section, compares frames and `check` numbers with the reference, then finishes the film.

The reference is studied, never shipped: its footage, photos, voices, branding and unlicensed music stay out of the project. An agent with image generation works best. With both Claude Code and Codex installed locally, Claude Code can use Codex's image generation through the bundled bridge (the `c2c` route, which needs a local Codex login with image access). The bridge makes still images only; it does not generate video or voice. Exact reproduction is not promised. Details: [recreation reference](../skills/vvv/references/recreation.md).

## Extract material from footage

The [media-processing reference](../skills/vvv/references/media-processing.md) documents `doctor`, `probe`, `clip`, `audio` and `frames`. Sources are local files; each extraction records source and output hashes, the requested range and actual metadata, and leaves the original unchanged. A video without audio cannot produce a soundtrack, and extracting audio does not separate speech from music or transcribe it. See the [walkthrough](../examples/media-workflow.md).

## Music and beats

The kit bundles one public-domain track and fetches licensed Mixkit tracks with `npm run music`. `npm run beats -- public/music/<file>` measures tempo, beats and downbeats for any supplied track, and templates place their cuts on that map.

## External and future capabilities

URL retrieval, OCR, speech recognition, text-to-speech, stem separation and video generation are **not bundled**. The agent may use a host tool that is actually available and authorized, and records unavailable operations rather than inventing results. The [video-generation reference](../skills/vvv/references/video-generation.md) describes a workflow reserved for a future provider; there is no video-generation adapter today.

See [verification](verification.md) for what has been tested and the [roadmap](../ROADMAP.md) for planned work.
