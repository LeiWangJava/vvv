# Inspect, extract and rework a video

This walkthrough uses the checked-in DV Story wedding preview. It requires the Skill's Python dependencies and compatible local FFmpeg/FFprobe binaries. It makes local derivatives without calling an image or video service.

From the repository root, use a prepared Python environment and a new local work directory:

```sh
VVV_ROOT="$PWD"
VVV_MEDIA_PROJECT="$VVV_ROOT/.work/media-example"
mkdir -p "$VVV_MEDIA_PROJECT"
python3 "$VVV_ROOT/skills/vvv/scripts/vvv_media.py" doctor --project "$VVV_MEDIA_PROJECT"
```

If FFmpeg is not on PATH, append `--ffmpeg /absolute/path/to/ffmpeg --ffprobe /absolute/path/to/ffprobe` to each command. The helper also checks the selected project's installed Remotion compositor; this newly created empty folder has no such dependency installation. Use the paths from an existing compatible installation instead of assuming the repository kit's dependencies are inside this folder.

## Inspect and select

```sh
python3 "$VVV_ROOT/skills/vvv/scripts/vvv_media.py" probe \
  --project "$VVV_MEDIA_PROJECT" \
  --source "$VVV_ROOT/docs/assets/dv-story.mp4"

python3 "$VVV_ROOT/skills/vvv/scripts/vvv_media.py" frames \
  --project "$VVV_MEDIA_PROJECT" \
  --source "$VVV_ROOT/docs/assets/dv-story.mp4" \
  --at 4 --at 7 --at 10
```

Open the actual reported PNG files. Note which screen is visible and what remains uninspected between frames. Play the relevant source range before describing its motion. The preview is a wedding photo story; it is not a screen recording.

## Cut the selected range

```sh
python3 "$VVV_ROOT/skills/vvv/scripts/vvv_media.py" clip \
  --project "$VVV_MEDIA_PROJECT" \
  --source "$VVV_ROOT/docs/assets/dv-story.mp4" \
  --from 4 --to 11
```

This selects seven seconds of source time. Use the returned MP4 path and actual stream metadata. The helper does not add the clip to a Remotion composition automatically. Copy or keep it within the intended editable project's public assets, add a video layer, and preserve its source mapping in scene notes.

The preview carries a Mixkit track that is licensed for use in that video, not for reuse on its own, so extract audio only from a recording you have the rights to:

```sh
python3 "$VVV_ROOT/skills/vvv/scripts/vvv_media.py" audio \
  --project "$VVV_MEDIA_PROJECT" \
  --source /absolute/path/to/recording-with-audio.mp4 \
  --from 4 --to 11 --audio-stream 0
```

Review the chosen track and its boundaries before using it. A second track can be selected with `--audio-stream 1`; this is not a request to isolate vocals from a mixed track.

## Rework a visual and build a scene

Use the [VVV image workflow](../skills/vvv/references/image-generation.md) when a selected frame needs an image edit or should guide new artwork. That image helper requires an initialized VVV project with `vvv.json`; use an existing project or initialize one with the documented kit workflow before using its image commands. A generic media-extraction directory does not become a VVV image project automatically.

Give the Agent a concrete brief, for example:

> Use VVV to inspect the selected wedding frames and the 4–11 second clip. Preserve the couple's story, redraw the editable photo and caption treatment in a new composition, and use my visual reference for its palette. Generate background artwork only if a suitable authorized image tool is available. Keep typography editable. Show a representative main-timeline sample with the new layout and a transition, then deliver the source and selected local assets.

Follow the [story/editing reference](../skills/vvv/references/story-editing.md) for shot decisions, text, sound and format variants. The extractor's job records remain evidence of media processing, not user approval or proof of successful visual recreation.
