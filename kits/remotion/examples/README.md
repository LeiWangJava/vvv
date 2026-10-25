# Template examples

Reproducible wedding films using the kit's editable scene code and explicitly selected demonstration assets:

- `doodle-wedding.json`: the Doodle wedding film, 142 seconds on *Dance with Me*; photo mapping from the original selection rules.
- `album-wedding.json`: the Album wedding film. Its photo mapping follows the original template's selection rules (portraits, dating, poem, eight wedding outfits). `VVV-Album` renders the 197.5-second 16:9 film and `VVV-Album-Vertical` the 49.8-second 9:16 short from the same inputs.
- `dv-our-story.json`: the DV Story wedding film for the demo couple, 182.5 seconds on *Fifth of February*.
- `comedy-wedding.json`: the Comedy opener, 212 seconds on *Fun and Games* and *When in Love* with twelve effects; no clips or narration.
- `starter-reel.json`: the Starter reel with fourteen demo photos; the demo inputs of its package.
- `growth-birthday.json`: the Growth first-birthday film with demo photos standing in for a baby's; about 2:26 on the bundled *Maple Leaf Rag*.
- `hundred-100days.json`: the Hundred 100-days film, the same film with twelve milestones; about 2:04 on *Maple Leaf Rag*.
- `showtime-wedding.json`: the Showtime big-screen comic opener, about 2:50 on its own bundled *Showtime Party*, with twelve synthesized effects.
- `effect-papercut-frame.json`: input for the `VVV-Effect-PapercutFrame` demo.

`cases.tsx` registers these compositions without changing a normal project's `src/Root.tsx`. From `kits/remotion`:

```sh
npm ci
npm run check
npx remotion studio examples/cases.tsx
npm run music -- --track mixkit-dance-with-me.mp3
npx remotion render examples/cases.tsx VVV-Doodle out/doodle.mp4 --scale=0.5
npm run music -- --track mixkit-skyline.mp3
npx remotion render examples/cases.tsx VVV-Album out/album.mp4 --frames=90-801 --scale=0.5
npx remotion render examples/cases.tsx VVV-Album-Vertical out/album-vertical.mp4 --scale=0.5
npm run music -- --track mixkit-fifth-of-february.mp3
npx remotion render examples/cases.tsx VVV-DVStory out/dv-story.mp4 --scale=0.5
npm run music -- --all
npx remotion render examples/cases.tsx VVV-Comedy out/comedy.mp4 --scale=0.5
npx remotion render examples/cases.tsx VVV-Starter out/starter.mp4 --scale=0.5
```

Omit `--frames` to render the full template and omit `--scale` for 1920×1080 output. Gallery excerpts are intentionally shorter than the full projects. The current ranges and finishing fades are recorded in [the public gallery](../../../docs/templates.md#reproduce-the-gallery) and [preview metadata](../../../docs/assets/previews.json). Album uses *Skyline*, DV Story *Fifth of February*, and Doodle *Dance with Me*; these Mixkit tracks are download-only.

Edit a fixture's wedding copy and asset IDs together, using the couple's supplied photos for a new project. All example media terms are in [MEDIA_LICENSE.md](../MEDIA_LICENSE.md).
