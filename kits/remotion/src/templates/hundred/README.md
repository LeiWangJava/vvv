# Hundred · 百天纪念

A 100-days (百天) film for the 百日宴. It is the Growth film (`../growth/film.tsx`, sections described
in `../growth/README.md`) with fewer photos, 100-day copy and a milestone line from pregnancy to day 100.
About 1:45 at 110 BPM with 12 milestones; each extra milestone adds 4 beats.

| Slot | Photos (min–max, default) | What fits |
|---|---|---|
| `film` | 3–12, 6 | Newborn close-ups, portrait photos with simple backgrounds |
| `milestones` | 6–24, 12 | One per moment in time order: pregnancy test, ultrasound, birth, first bath, full month, first smile, lifting the head, day 100. Each gets `captions[i]` |
| `scatter` | 6–20, 12 | Everyday snaps and expressions; may repeat other slots |
| `floating` | 6–18, 12 | Bright photos with a large subject; may repeat |
| `wall` | 9–36, 24 | Any photos in time order, family photos late; may repeat |

Copy: `title` 送给百天的你, `subtitle`, `greeting`, `letter`, `letter2`, `ending` 百天快乐. Music defaults to
Mixkit "First Kiss" (fetched by `npm run music`); any licensed track works after `npm run beats`.

Slot card for Codex: `studio/slot-cards/hundred.slots.json` (event `hundred-days`).
