# Troubleshooting

Every helper error is one JSON object: `{"status": "failed", "code": "...", "message": "..."}`. Start from the code and message, and run commands in the project directory unless a command points at the repository. The `vvv` shorthand and `VVV_ROOT` come from [Getting started](getting-started.md); set them again in a new shell.

## `DEPENDENCY_MISSING`: the helper cannot import Pillow

Use the virtual environment where you installed `requirements.txt`, not an unrelated `python3`:

```sh
"$VVV_ROOT/.venv/bin/python" -m pip install -r "$VVV_ROOT/requirements.txt"
```

The message shows the install command for the Python that ran the helper; `--help` works without Pillow.

## `DESTINATION_EXISTS` during initialization

`init` never overwrites. Choose a new `--output`, or keep working on the existing project with `inspect`, `validate` and the render commands.

## `INSUFFICIENT_PHOTOS`, missing IDs or wrong photographs

`INSUFFICIENT_PHOTOS` names the template, the format and the photos it needs; every slot's minimum is met before any slot gets more. `vvv describe --kit KIT --template ID` lists each format's `minPhotos` and the slots. Supply more photos, adjust the mapping within the catalog's limits, or pass `--allow-repeat`. Album 16:9 needs 40 distinct story photos; its 9:16 short needs only an opening, an ending and one gallery photo. DV Story tokens must refer to known photo IDs.

Initial mappings follow import order and do not recognize people or events. Check `creative/contact-sheet.jpg` and replace the demo copy.

## A file is skipped during import

The helper imports decodable local still images and reports missing, unreadable, animated or unsupported files. HEIC/HEIF photos need the optional `pillow-heif` package; without it they are reported as `HEIC_UNSUPPORTED`. Install it into the helper's environment (`pip install pillow-heif`) or convert the photos to JPEG. Input symlinks are skipped; copy the actual files. A URL or video file passed to `--photos` does not add a clip.

## `INPUT_SCHEMA` or `INPUT_UNKNOWN_KEY` during validation

`INPUT_SCHEMA` means a prop in `inputs.json` has the wrong type or range, such as a number where copy is expected or `music.volume` above 1. The `location` names the field and the message quotes its description from `schema/props.schema.json`; the renderer would reject the same input. `INPUT_UNKNOWN_KEY` is a warning: a key in `props` that the template does not read, often a typo. `validate` lists only the checks that did not pass; add `--verbose` to see all of them.

## Remotion is missing or rendering cannot start

Run `npm ci` in the **initialized project**, not only in `kits/remotion/`, with Node.js 26. The first render may need network access to download Chrome Headless Shell; fonts are local. If you changed dependency versions, reproduce the problem with the locked versions first.

## The sample range is invalid

Sample times are seconds and `--to` is exclusive; the range must fit inside the main composition. DV Story's duration changes with its pages and music. `--scale` accepts values above 0 and up to 2.

## Text did not change, is cropped or looks wrong

Check whether the lettering is a text layer or part of an image; baked artwork must be replaced or rebuilt. For text layers, adjust width, size, line breaks or font in the template source, since longer copy can need a layout change even when the schema accepts it. Render the affected range again.

## The project is silent or music timing is off

If `validate` reports a download-only track as pending, run `npm run music` in the project. All templates require music; an empty `props.music.src` is invalid. For your own track, put it under `public/`, run `npm run beats -- public/music/<file>` and set `props.music.src`. Make sure the track lasts long enough. DV Story's beat map needs increasing timestamps; see its [timing notes](../kits/remotion/src/templates/dv-story/README.md).

## A report says the previous output is stale

Source, inputs or media changed after that render. Render the changed range again before using it as evidence.

## The agent sees the skill, but image generation fails

Discovery and generation are separate. Run the selected route's `doctor` from the [image generation reference](../skills/vvv/references/image-generation.md). Native generation needs a real tool in the session; c2c needs a local, signed-in Codex with image access; the API route needs explicit configuration. A login does not guarantee quota. Never paste credentials into an issue. VVV never retries through a paid API on its own.

## Reporting a problem

Include your OS, Python and Node versions, template, exact command, the error JSON and the smallest shareable example, without credentials or private media. See [contributing](../CONTRIBUTING.md).
