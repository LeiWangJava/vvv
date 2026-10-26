# Music

[`sources.json`](sources.json) lists every track the templates can use, with its source, license, size and SHA-256.

- **Bundled:** `maple-leaf-rag.ogg` is Scott Joplin's *Maple Leaf Rag* (1899). The composition and this recording are in the public domain per [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Scott_Joplin_-_Maple_Leaf_Rag_(1899).ogg). Starter uses it, so Starter renders offline.
- **Bundled:** `showtime-party.ogg` (128 BPM) and the effects in `public/sfx/showtime/` are original audio synthesized by `scripts/make-showtime-audio.py` for the Showtime template (MIT). Run the script again to rebuild them; its sections follow `src/templates/showtime/plan.ts`.
- **Bundled:** `tableau-tick.ogg` (150 BPM, beat 0 at 0.4 s, drop at beat 32) is original music synthesized by `scripts/make-tableau-audio.py` for the Tableau template (MIT). Run the script again to rebuild it.
- **Download:** the `mixkit-*.mp3` tracks are covered by the Mixkit Stock Music Free License. They are not redistributed with VVV. Run `npm run music` inside a project to fetch the tracks it references, or add `-- --all` to fetch every track. The script writes a file only after its size and hash match the record.
- **Your own music:** put the file in `public/music/` and run `npm run beats -- public/music/<file>` to write its beat map. Then point `music.src` at it. Use music you have the right to use for your purpose.

Each `*.beats.json` file holds the tempo, beats, downbeats, accents and phrases measured from that track. Templates place cuts on those beats, so a project without a beat map falls back to the template's design timing.
