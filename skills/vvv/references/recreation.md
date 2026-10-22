# Recreation (复刻)

Use this when the user points at a wedding film and asks for one like it: "this wedding opener, with our photos", "this couple's story, with our memories". A recreation keeps what makes the reference work (its structure, rhythm and layout ideas) and replaces everything that belongs to someone else.

The kit's Album, Doodle, DV Story and Comedy templates were made this way from earlier films. Measuring those originals showed where they went wrong: the original Doodle was still for 66% of its frames and its cuts sat 106 ms off the beat. The rebuild measures 21% and 40 ms. Measure the reference first, so you know which parts are worth copying and which to improve.

## 1. Get the reference and its coverage

Work from a local file. If the user gives a link, obtain the file with an available tool, or ask for it. If you cannot get the moving picture with its sound, say what you could not inspect: a few screenshots establish layout, not pacing.

Record its duration, frame size, frame rate and audio with `vvv_media.py probe`. Note who owns its content. Another couple's delivery or another creator's film is a reference, never material to ship.

## 2. Measure its rhythm

```text
python3 scripts/vvv_media.py audio  --project WORK --source REF.mp4            # listening copy of its soundtrack
node KIT/scripts/analyze-music.mjs REF.mp4 WORK/ref.beats.json --bpm-min=90 --bpm-max=140
python3 scripts/vvv.py check --video REF.mp4 --beats WORK/ref.beats.json --max-still 3
```

- Check the BPM against what you hear. A mixed soundtrack with voices or effects can mislead the analyzer to half, double or a related tempo; narrow `--bpm-min`/`--bpm-max` and rerun. In a test, the same film read as 85 BPM unconstrained and as the true 113.6 BPM with a 100–140 range.
- `check` reports the reference's still stretches, still share and beat alignment. These become your targets: match its good numbers and beat its bad ones.

## 3. Write its structure in beats

Sample frames on a regular grid (`vvv_media.py frames --at …`, up to 24 per call) plus densely around each transition, and play the moving ranges that matter. Then write a structure sheet:

| Section | Film time | Beats | What happens | How it moves | Text | Sound |
|---|---|---|---|---|---|---|
| Hook | 0.0–4.2 s | 8 | Question in three parts | Each part drops in on a beat | 3 short lines | Music starts, no intro |
| … | | | | | | |

Express lengths in beats at the reference's tempo, not seconds. Then the structure survives a different song. Mark what is characteristic (a dissolve into a PLAY screen, a progress bar stuck at 99%, typed lines with one key tap per character) separately from what is incidental.

## 4. Decide what carries over

| Carry over | Replace | Never take |
|---|---|---|
| Section order and lengths in beats | All people, photos and footage, with the user's own | The reference's footage, photos or voices |
| Kind of motion and transition | Copy, names and dates, with the user's facts | Its brand, logo or watermark |
| Layout ideas and type hierarchy | Music, unless the user has rights to the same track | Its music without rights |
| Gag or reveal structure | Baked-in titles, rebuilt as editable text | Customer material from a delivery used as reference |

Where the reference is weak (long holds, off-beat cuts, text too fast to read), improve it and say so.

## 5. Rebuild

Pick the closest wedding template and adapt it, or build a new composition from the kit core when the structure is new. Use the beat clock or the warp from [craft](craft.md#beats) and the font, music and catalog contract in [projects](projects.md). Draw titles, cards, photo frames and timelines in code. Make raster elements (stickers, textures, illustrations) through the [image workflow](image-generation.md) when they are not available. For a set, establish one baseline image before generating the rest.

When you extract a background from the reference to rebuild its foreground, make sure it is clean underneath. A crop can carry a baked-in fragment that appears once your new text animates away. If no clean plate exists, edit the image or redraw it.

Build the most characteristic section first and render it as a sample.

## 6. Compare

- Run `check` on your render with your project's beats, and compare its still share and beat offset with the reference's numbers.
- Put sampled frames side by side at the same beat positions: composition, hierarchy, crop, text size.
- Play both at the characteristic transitions.

Report what matches, what you changed on purpose, and what still differs. Carry the accepted treatment through the rest of the film. If the result is reusable, turn it into a template with a fictional fixture (see [projects](projects.md#add-a-template)).
