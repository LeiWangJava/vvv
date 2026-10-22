# Brainstorm: from an idea to a film

Use this when the user has a goal but no plan: "a wedding film", "an opener that welcomes our guests", "a photo story for the reception". The output is a chosen treatment, a beat sheet and a first sample, not a list of ideas.

## 1. Pin down the film

Get four answers, from the request if possible, otherwise by asking:

- **Who watches, and where.** A phone feed, a family chat, a welcome screen or the reception's main screen. This decides format, length and whether it must work with the sound off.
- **How long.** Feeds reward 15–40 s; a wedding opener can hold three minutes.
- **The one takeaway.** One sentence the viewer should be able to repeat afterwards.
- **What exists.** Photos, footage, names, dates, venue details, colors and a song the user loves. List what is missing.

## 2. Find the change worth watching

Good wedding films are about something changing on screen: two people's childhood photos converge into one story, a proposal leads into the ceremony, or a final toast gives the film its close. Look for:

- **A question or promise the film answers.** "我们怎么走到今天？" works better than a generic wedding montage.
- **A turn.** The point where the story turns, such as the first meeting, ceremony, reception or final toast.
- **A concrete image.** The couple's first photograph, a handwritten note or a family portrait carries more than abstract motion.
- **Specific words.** A shared memory supplied by the couple says more than a generic line about love.

Avoid the generic look: gradient blobs, floating particles, stock icons and taglines that could belong to any wedding. Each of them is a sign the film has no subject yet.

## 3. Offer three treatments

Make them differ in structure, not just color:

| | Treatment A | Treatment B | Treatment C |
|---|---|---|---|
| Logline | One sentence | | |
| Structure | Sections with beat counts | | |
| Look | Closest kit template, or a short description | | |
| Music | Tempo and mood; a track from `public/music/sources.json` or the user's | | |
| Why it's watchable | The change the viewer follows | | |
| Needs | Photos, footage or facts still missing | | |

Recommend one and say why. If the user wants to choose, let them. If they asked you to just make it, go with your recommendation and say which one you took. A treatment that maps onto a wedding template is cheaper and already passes `check`. Prefer it unless the idea needs a new structure.

## 4. Write the beat sheet

Fix the track first, then measure it (`npm run beats`) and plan in its beats:

| Section | Beats | On screen | Text | Peak on the beat |
|---|---|---|---|---|
| Welcome | 8 | The couple's first photo, then a welcome | One short line | Photo and text enter on separate beats |
| Names | 8 | The couple's portraits join | Names and date | Names land on the bar |
| … | | | | |

Check that the total length (beats × 60 / BPM) fits the target, that something new arrives at least every bar, and that every text has time to be read (see [craft](craft.md)).

## 5. Build the hardest scene first

- **On a template:** `init`, put the treatment's copy and assets into props, and change scene code only where the treatment differs.
- **New structure:** start a composition in the kit with the shared pieces (`core/beat-clock.ts` for beat numbers, `components/Music`, local fonts, the catalog `check` thresholds). Register it as a template so `vvv check` and `init` work on it ([projects](projects.md#add-a-template)).

Render the riskiest section as a sample, the one that proves the treatment: the turn, the densest text, the characteristic transition. Then `check` it, look at it, and show it with a one-line summary of the rest of the plan. Build the remaining sections after feedback, or straight away if the user asked you to finish.
