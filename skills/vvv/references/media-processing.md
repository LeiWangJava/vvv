# Local media analysis and extraction

Use [scripts/vvv_media.py](../scripts/vvv_media.py) to inspect local media, cut a video range, extract an audio track or save frames. Run it with the Python environment containing this skill's [requirements.txt](../requirements.txt). The project may be any existing local video-work directory; unlike the kit project helper, this tool does not require `vvv.json`.

It uses FFmpeg and FFprobe from explicit `--ffmpeg` / `--ffprobe` paths, the current PATH, or the project's installed Remotion compositor package. It does not download binaries. The selected build must support the required decoder, encoder and output format; Remotion's bundled build is intentionally smaller than a full FFmpeg distribution.

## Check tools and source

Replace the absolute paths and resolve the installed skill directory before invoking these commands:

```sh
python /absolute/path/to/vvv/scripts/vvv_media.py doctor --project /absolute/path/to/project
python /absolute/path/to/vvv/scripts/vvv_media.py probe --project /absolute/path/to/project --source /absolute/path/to/source.mp4
```

Each command accepts `--ffmpeg /path/to/ffmpeg --ffprobe /path/to/ffprobe` if discovery is insufficient. Read the returned diagnostics and operation capabilities. Version discovery does not establish support for every codec or source file.

Inputs must be actual local regular files. The tool does not fetch URLs, follow source symlinks, open a host attachment by a guessed path, or transcribe audio. Input protocol restrictions also prevent a local playlist from fetching network resources. Retrieve remote content through the host's authorized access tools first. Inspect stream metadata, including missing duration, audio presence, rotation and pixel/display aspect ratios, before deciding how to use the source. Metadata is technical evidence, not semantic understanding.

## Extract the required material

All times are finite seconds from the beginning of the source. Video/audio intervals are `[from, to)`: start included, end excluded. Probe can report an unknown duration; extraction requires a duration against which to validate its range. A request beyond that duration fails rather than silently shortening the selection.

```sh
# Re-encode seconds 2–6 as an editable MP4 insert, retaining the first audio track if present.
python /absolute/path/to/vvv/scripts/vvv_media.py clip --project /absolute/path/to/project --source /absolute/path/to/source.mp4 --from 2 --to 6

# Extract seconds 2–6 of the first audio track as PCM WAV.
python /absolute/path/to/vvv/scripts/vvv_media.py audio --project /absolute/path/to/project --source /absolute/path/to/source.mp4 --from 2 --to 6

# Save specified frames for visual inspection or later image editing.
python /absolute/path/to/vvv/scripts/vvv_media.py frames --project /absolute/path/to/project --source /absolute/path/to/source.mp4 --at 2 --at 3.5 --at 5
```

For `clip`, use `--mute` to omit sound deliberately. `--audio-stream 1` selects the second audio track, not the global stream with index 1. A silent source can produce a video clip; audio extraction must report that there is no audio stream. With `audio`, omitting the range extracts the selected track over the available source duration.

Clip output is re-encoded with H.264/AAC rather than stream-copied at keyframe boundaries. Codec support, variable frame rate and source timestamps affect received boundaries; inspect actual duration and boundary frames instead of promising millisecond-exact cuts. No crop or resize is requested, but FFmpeg's default autorotation applies the source's display orientation and may exchange output width and height. Frame requests are limited to 24 timestamps per call; timestamps describe requested sampling positions, not independently measured exact frame presentation times.

The underlying stream selection and seeking behavior is described in the official [FFmpeg manual](https://ffmpeg.org/ffmpeg.html); metadata fields come from [FFprobe](https://ffmpeg.org/ffprobe.html). Treat the local output as the evidence for the actual source and binary build.

## Retain and use the result

Successful extraction publishes a fresh directory under `public/derived/<job-id>/`. Follow the reported paths; never assume a generated ID. The source remains unchanged. Each operation records its source hash, request, extraction method, tool evidence and actual output metadata/hashes in `creative/media-jobs/<job-id>/job.json`. Once a job record exists, processing failures are recorded there and do not publish partial output as a successful asset. Invalid arguments or an unavailable project may fail before a record can be created.

Video/audio outputs are checked with the media tools; frame outputs are decoded as images. These checks do not confirm the intended subject, style, dialogue or emotional rhythm. Record visual/listening observations separately; `visualReview: not-reviewed` is deliberate.

Use video/audio files in real scene and sound layers. The tool does not automatically add photo IDs to `assets.json`, change a template slot or insert a timeline clip. Map selected local ranges back to source time in your scene notes. When a still is used for image recreation, inspect it and supply it as an actual reference through the [image workflow](image-generation.md), then check the new asset in a render.

Use [intake](intake.md) for input roles and observed coverage, [story and editing](story-editing.md) for selections and timeline decisions, and [review](review-handoff.md) before delivery.
