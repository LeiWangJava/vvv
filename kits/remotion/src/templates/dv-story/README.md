# DV Story · 我们的故事

`VVV-DVStory` is a beat-locked wedding warm-up film of about three minutes:

| Section | What happens | Copy / photo keys |
|---|---|---|
| Title | VHS snow, the title drops into a camcorder viewfinder, the camera pushes through | `titleCn`, `titleEn` |
| Welcome | Typed lines on black; the day count uses keycap digits (`[1978]`) | `welcome1`–`welcome3` |
| Early years | Viewfinder (REC, timecode, meters): two birth photos, thanks to the parents, childhood photos flashing one per bar | `birth1`, `birth2`, `parents*`, `childhood`, `grateful*` |
| Handover | The viewfinder dissolves into the PLAY screen over 2.4 s while the last typed line stays readable | `handoverFadeSec` |
| Love story | PLAY cards with bunny and bear stickers, the first-meeting card, then photo pages with a 📍 title each | `believe`, `fate` + `chat*`, `together`, `since`, `first` … `newHome` |
| Proposal and engagement | Ask card, proposal pages, decide card, engagement pages | `ask`, `proposal`, `decide`, `engaged` |
| Wedding photos | A 35 mm strip scrolling one frame per bar | `weddingPhotos` |
| Ending | A sticker and one typed line, fading with the music | `ending` |

Every cut, photo entrance and typed character sits on a beat of the soundtrack. One original key tap plays for each typed character.

## Copy and photos

Defaults are the fictional demo couple 林以舟 & 许知夏 and the kit's demo photos. Replace every name, date and line in `props.copy` with the couple's own facts before delivery. `｜` breaks a line and `[digits]` draws keycaps.

Photos are project asset IDs: `@asset-id` in `props.photos`. Commas or spaces put photos on one page; `|` starts another page under the same title:

```text
@photo-a, @photo-b | @photo-c
```

Unknown IDs, file paths and URLs are errors; there is no fallback to demo photos. An empty photo slot or an empty line skips its scene, and a missing key counts as empty, so the demo copy never appears in a project by accident. The first-meeting scene shows the `fate` photo when one is given, otherwise a drawn chat card with `chatTime`, `chatA` and `chatB`.

## Music and timing

The default track is *Fifth of February* (Mixkit, download-only): run `npm run music` in the project. Scene lengths in `story.ts` are counted in beats and fitted to that song's phrases: childhood photos from beat 60, the wedding strip from 244, the ending card on 288 and the end of the film on 304.

Another song re-times the whole film from its beat map (`npm run beats -- public/music/<file>`); check where the PLAY section, the strip and the ending land and adjust the beat counts in `story.ts` if needed. `music.trimBeforeSec` rebases the beats to the trimmed audio. An optional `music2` takes over at film beat `atBeat`, entering on its own beat `fromBeat` with an equal-power crossfade; both stay separate tracks.

`proposalFirst` orders proposal → engagement → strip (default) or engagement → strip → proposal. `endingBeats` is 4–32. `typingSfxVolume` 0 silences the key taps; `stickers: false` shows words only; `sinceArt` can put the couple's own illustration (a transparent PNG under `public/`) on the 从此以后 card.

## Assets

Stickers, the film strip and textures live in `public/assets/dvstory/`; the 19 extra demo photos are `public/photos/dvdemo-*.jpg` in `assets.json`. The title is drawn with the packaged LongCang and Caveat fonts. The key taps `public/sfx/dvstory-key-{1..4}.wav` are synthesized by `scripts/make-key-sfx.py`; no recording is used.

Contract tests: `node --test src/templates/dv-story/contract.test.mjs`. They cover inputs and timing; renders still need review.
