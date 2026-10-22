# Make your first VVV video

This repository contains the skill, the project helper and five editable templates. Render a sample from the command line first, then let your coding agent adapt the project.

## Prerequisites

- Python 3.9 or newer, with `venv` and pip.
- Node.js 26 and npm (the locally verified version; see [verification](verification.md)).
- A clone of this repository and disk space for dependencies, the renderer's browser and video output.
- Claude Code, Codex or WorkBuddy for the agent workflow. An image-generation service is optional.

The commands are for macOS/Linux shells; rendering has been verified on macOS ARM64. The first render may download Chrome Headless Shell. Fonts are bundled.

## 1. Prepare the helper

From the repository root:

```sh
VVV_ROOT="$PWD"
python3 -m venv "$VVV_ROOT/.venv"
"$VVV_ROOT/.venv/bin/python" -m pip install -r "$VVV_ROOT/requirements.txt"
vvv() { "$VVV_ROOT/.venv/bin/python" "$VVV_ROOT/skills/vvv/scripts/vvv.py" "$@"; }
```

The `vvv` shell function is shorthand for the helper. Keep the variable and function in the same shell.

## 2. Try a template with its demo inputs

```sh
vvv templates --kit "$VVV_ROOT/kits/remotion"
vvv init --kit "$VVV_ROOT/kits/remotion" --template doodle --example \
  --output "$VVV_ROOT/.work/first-film"
cd "$VVV_ROOT/.work/first-film"
npm ci
npm run music
npm run sample -- --scale 0.5
```

`templates` lists each template with its description, formats and the photos each format needs (`minPhotos`, `targetPhotos`). `init --example` builds a new project from the template's shipped demo inputs and fictional demo photos, already mapped to the right slots. `npm run music` downloads Doodle's licensed soundtrack and checks its hash; it cannot be bundled. `sample` renders the template's representative window (seconds 18–36 for Doodle), prints the MP4 path and writes `out/sample.report.json`.

**Offline option:** Starter uses bundled public-domain music, so it needs no `npm run music`:

```sh
vvv init --kit "$VVV_ROOT/kits/remotion" --template starter --example \
  --output "$VVV_ROOT/.work/starter-film"
```

Then measure the sample:

```sh
vvv check --project "$VVV_ROOT/.work/first-film"
```

`check` reads the latest sample or render and reports whether the frame matches the format, whether the soundtrack is audible, any still stretch longer than the template allows, and how closely the cuts follow the beats. It ends with a list of things only a viewer can judge. A passing check is not visual approval; watch the sample.

`npm run studio` opens the project in Remotion Studio at the printed local URL.

## 3. Use your own photos

```sh
vvv describe --kit "$VVV_ROOT/kits/remotion" --template doodle
vvv init --kit "$VVV_ROOT/kits/remotion" --template doodle \
  --photos "/absolute/path/to/your/photos" --output "$VVV_ROOT/.work/my-film"
```

`describe` prints one compact JSON with everything you need to fill a template: formats and photo needs, the photo slots (with hints where the template gives them), editable copy fields, other props, music, sample window, fixture and the next commands to run. Add `--format 9:16` to see one format.

`init` copies the editable source and runtime assets into a **new** directory; an existing output is an error. `--photos` accepts a directory or file and can be repeated. Photos are assigned in import order: every slot gets its minimum before any slot gets more. With too few photos, add more or pass `--allow-repeat`. HEIC photos need the optional `pillow-heif` package; without it they are reported as `HEIC_UNSUPPORTED`. Choose a format with `--format 16:9` or `--format 9:16`; a template refuses a format it does not declare instead of stretching the frame.

Open `creative/contact-sheet.jpg` and `inputs.json`. Replace the demo names, dates and copy, and move photo IDs to the right slots. Then validate and sample:

```sh
cd "$VVV_ROOT/.work/my-film"
npm ci
npm run music
vvv validate --project "$VVV_ROOT/.work/my-film"
npm run sample -- --scale 0.5
```

`validate` prints only the checks that did not pass, plus a `passed` count; add `--verbose` to see every check. An unknown key in `props` produces an `INPUT_UNKNOWN_KEY` warning. Override the sample window with `--from` and `--to` (seconds, `--to` exclusive).

## Use the skill with your agent

**Claude Code:** install the plugin, which includes the kit:

```text
/plugin install vvv --marketplace actionow-ai/vvv
```

(Before Claude Code 2.1.275: `/plugin marketplace add actionow-ai/vvv`, then `/plugin install vvv@vibevision`.)

**Codex, Cursor, Gemini CLI, GitHub Copilot and most other agents** read skills from `.agents/skills/`. Install with `npx skills add actionow-ai/vvv`, or copy the whole `skills/vvv` directory yourself (a lone `SKILL.md` lacks the helpers and references). This keeps an existing installation:

```sh
VVV_PROJECT="$VVV_ROOT/.work/my-film"
if [ -e "$VVV_PROJECT/.agents/skills/vvv" ]; then
  echo "Existing skill kept"
else
  mkdir -p "$VVV_PROJECT/.agents/skills" && cp -R "$VVV_ROOT/skills/vvv" "$VVV_PROJECT/.agents/skills/vvv"
fi
export VVV_KIT="$VVV_ROOT/kits/remotion"   # where the helpers find the templates
```

For Claude Code without the plugin, use `.claude/skills/` instead; for **WorkBuddy**, import the skill ZIP ([WorkBuddy setup](workbuddy.md)). [Agent compatibility](agent-compatibility.md) lists the folders of 25 agents, personal (all-project) installs and the Codex installer. Claude Code picks up new skills without a restart (`/reload-skills` if the `.claude/skills` folder was created during the session); other agents may need a new session.

Start the agent in the project and ask, for example:

> Use the vvv skill in this project. Replace the poem's photos with the two files I selected, use pale blue text and 24px frame corners, and keep the paper background. Render the poem and its transition as a sample before making the full film.

The agent edits `inputs.json` for exposed controls and `src/templates/<template>/` for layout, pacing, animation or new scenes. Agents can run `describe` to learn a template's inputs without reading its source.

## Recreate a reference video

Give the agent a local reference video and your attachments (photos, logos, copy, music). It measures the reference's structure and beat rhythm with the media helper, the kit's music analyzer and `vvv check`, rebuilds it on the closest template or a new composition, generates missing artwork and compares its render with the reference. The reference is never used as shipped material. See [capabilities](capabilities.md#recreate-a-reference-video).

## Music and generated images

The kit's [music list](../kits/remotion/public/music/README.md) has one bundled public-domain track and several Mixkit tracks that are fetched, not redistributed. To use your own track, put an authorized file in `public/music/`, run `npm run beats -- public/music/my-track.mp3` to write its beat map, and set `props.music.src` to `music/my-track.mp3`. Changing the track can change timing; review the transitions.

Image generation is optional and has three routes: an image tool available in the agent session (`native`), the bundled bridge to a local, signed-in Codex (`c2c`, which lets Claude Code use Codex's image generation), or an explicitly configured Images API (`api`). VVV never switches to a paid API silently. See the [image generation reference](../skills/vvv/references/image-generation.md).

## Finish and hand off

```sh
npm run render -- --scale 1
```

The default scale is `0.5`; `1` renders full resolution. The command writes `out/render.report.json`. Keep the whole project with the result (`vvv.json`, `inputs.json`, `assets.json`, `src/`, `public/`, `catalog/`, scripts, lock files and license notices) so it can be edited elsewhere after `npm ci`. To hand it to someone else, pack it with `vvv pack --project . --output ../my-film.vvv`.

Any edit to source, inputs or media makes earlier output stale; `vvv inspect --project .` shows the current state. [Troubleshooting](troubleshooting.md) covers common errors.
