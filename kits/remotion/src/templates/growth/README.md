# Growth · 周岁成长记

A first-birthday growth film: a playful title, a handwritten letter, a scrolling film strip, one
milestone card per photo with a handwritten caption, a scattered collage, a second letter, photos
floating through a starfield, and a scrolling photo wall. About two minutes, 16:9, every change on a
beat of the soundtrack.

The structure was measured from a reference film (a parent's 2:06 first-birthday video at 117.5 BPM)
and rebuilt from scratch. No frame, photo, caption or sound of the reference is used; every picture
comes from the project's own photos and every line from `copy` / `captions`.

## Sections (in beats of the chosen track)

| # | Section | Beats | Inputs | Look |
|---|---|---:|---|---|
| 1 | Title | 8 | `copy.title`, `copy.subtitle` | Black. Each character pops in with its own color and tilt, a doodle balloon and paper plane draw themselves, the subtitle fades in below. |
| 2 | Greeting | 8 | `copy.greeting` | One handwritten line typed character by character. |
| 3 | Letter | 20 | `copy.letter` (lines split by `\n`) | Handwritten lines appear one per beat, centered; the page breathes (slow push, faint shimmer) so it never freezes. |
| 4 | Film strip | 26 | `photos.film` (3–15, portrait best) | A film strip with sprocket holes and edge print scrolls right to left, three frames in view. Hard cut in on the beat. |
| 5 | Milestones | 4 per photo | `photos.milestones` (6–30) + `captions[i]` | Deckle-edged paper print on the left, slightly tilted, slow push; handwritten caption on the right. Hard cut every 4 beats. |
| 6 | Scatter | 24 | `photos.scatter` (6–24) | Photos drop onto black one by one at scattered positions and pile up, slowly drifting. |
| 7 | Second letter | 12 | `copy.lead`, `copy.letter2` | A lead phrase is written first, then the whole letter glows in line by line with sparkles and a hand-drawn swash. |
| 8 | Floating | 14 | `photos.floating` (6–20) | White-bordered photos fly toward the camera through a twinkling starfield. |
| 9 | Flash | — | — | RGB-split zoom and white bloom from the starfield into the wall. |
| 10 | Photo wall | 32 | `photos.wall` (9–45) | Three rows of photos scroll in alternating directions; every 8 beats the wall pulses (zoom + bloom). |
| 11 | Ending | 8 | `copy.ending` | The wall dims, a colorful ending line pops in, fade to black. |

Length: 116 beats plus 4 per milestone photo. With 20 milestones at 110 BPM, about 1:58.

## Inputs

- `photos.film`, `photos.milestones` are the story photos (shared pool). `scatter`, `floating` and
  `wall` may reuse any photo (independent slots), as the reference does.
- `captions` is a list aligned with `photos.milestones`: `captions[0]` goes under the first milestone
  photo. `\n` breaks a caption line. A missing caption leaves the right side empty.
- Copy: `title`, `subtitle`, `greeting`, `letter`, `lead`, `letter2`, `ending`.
- Music: any track the owner has rights to; run `npm run beats -- public/music/<file>` so cuts follow
  it. The default is Mixkit "First Kiss" (110 BPM), fetched by `npm run music`.

## Craft notes

- Text is Long Cang (handwriting) and ZCOOL KuaiLe (title), both packaged OFL fonts.
- The reference holds its first letter completely still for about 8 s; this template keeps a slow
  push and shimmer instead so `vvv check` never finds a still stretch over 3 s.
- The reference ends on the platform's end card; this template ends on its own line instead.
