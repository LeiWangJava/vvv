# Troubleshooting

Start with `next` in the failure: it is the recovery step for that code. This page covers the causes behind the common codes, for when `next` alone is not enough. Fix things yourself; ask the user only for permission, missing material or facts, in one sentence and in their language.

## Setup

- **`DEPENDENCY_MISSING`** (Pillow): install [requirements.txt](../requirements.txt) into the Python that runs the helper. If pip refuses an externally managed Python, create a virtual environment and use its `python` for every later command. `doctor` and `--help` work without Pillow.
- **`KIT_REQUIRED` / `KIT_NOT_FOUND`**: no template kit. `doctor` gives a `git clone` command; afterwards pass `--kit <clone>/kits/remotion` or set `VVV_KIT`.
- **`NODE_MISSING`, a Node.js older than 22, or no npm**: a system install, so ask the user before installing. Renders are verified with Node.js 26.
- **`DEPENDENCIES_MISSING` or Remotion cannot start**: run `npm ci` in the initialized project, not in the source kit. The first render may download Chrome Headless Shell, which needs network access. Reproduce with the locked dependency versions before changing any.

## Photos and inputs

- **`INSUFFICIENT_PHOTOS`** names the template, format and photos needed; every slot's minimum is met before any slot gets more. `describe` lists each format's `minPhotos` and slots. Ask the user for more photos, choose a template that fits, or pass `--allow-repeat` when repeats are acceptable. Album 16:9 needs 40 distinct story photos; its 9:16 short needs an opening, an ending and one gallery photo.
- **A file is skipped on import**: only decodable local still images are imported. HEIC/HEIF needs the optional `pillow-heif` package (install it, or convert to JPEG); symlinks are skipped; a URL or a video file passed to `--photos` adds nothing.
- **Mappings follow import order** and do not recognize people or events. Check `creative/contact-sheet.jpg`, fix the slots in `inputs.json` and replace every line of demo copy.
- **`INPUT_SCHEMA`**: a prop has the wrong type or range; `location` names the field and the message quotes its description from `schema/props.schema.json`. **`INPUT_UNKNOWN_KEY`** (a warning) is a key the template does not read, usually a typo.
- **`DESTINATION_EXISTS`**: `init`, `pack` and `evidence` never overwrite. Choose a new path, or keep working on the existing project.

## Rendering

- **Invalid sample range**: times are seconds, `--to` is exclusive and the range must fit the composition; DV Story's length follows its pages and music. `--scale` is above 0 and at most 2.
- **Text did not change, is cropped or looks wrong**: check whether the lettering is a text layer or baked into an image (baked artwork must be replaced). For text layers, adjust width, size, breaks or font in the template source; longer copy can need a layout change even when the schema accepts it. Render the range again.
- **A report says the output is stale**: source, inputs or media changed after that render. Render again before using it.

## Music

- **`DOWNLOAD_PENDING` / `MUSIC_DOWNLOAD_PENDING`**: run `npm run music` in the project. Every template requires music; an empty `props.music.src` is invalid.
- **The download fails** (`MUSIC_*` from `npm run music`): retry once. If it fails again, ask the user for a track they have the rights to, put it under `public/music/`, run `npm run beats -- public/music/<file>` and set `props.music.src`. The track must be long enough; a new track can change timing, so review the transitions.

## Check failures

- **`CHECK_FAILED`**: fix the failed checks in the source or inputs, re-render the affected range and check again. [Craft](craft.md) covers still stretches and beat alignment.
- A beat-sync failure measured on the full film but not on a sample usually means the template's timing drifts later in the film; check the whole length.

## Image generation

Discovery and generation are separate. Run the chosen route's `doctor` from [image generation](image-generation.md). Native generation needs a real tool in the session, c2c a local signed-in Codex with image access, the API route explicit configuration. A login does not guarantee quota. Never retry through a paid API on your own.

## Reporting a problem

When something is a defect in VVV, report it at https://github.com/actionow-ai/vvv/issues with the OS, Python and Node versions, template, exact command, the error JSON and the smallest shareable example. Leave out credentials and the user's private media.
