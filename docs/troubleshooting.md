# Troubleshooting

Your agent checks the setup and recovers from errors by itself: every helper error tells it what to do next. You should only be asked for things only you can give: permission to install software, more photos, a fact about your story or a music track you have the rights to.

## If the agent seems stuck

Tell it:

> Run the vvv doctor and follow its steps.

The agent's own guide is the skill's [troubleshooting reference](../skills/vvv/references/troubleshooting.md).

## Things only you can decide

- **Not enough photos.** Each template and format needs a minimum number; the agent tells you how many. Send more, or let it repeat some photos, or pick another template.
- **iPhone photos (HEIC).** The agent can install HEIC support or convert them; if neither works, export them as JPEG.
- **Music.** Templates use licensed tracks the agent downloads. If the download fails, or you want your own song, give the agent a track you have the rights to; popular songs usually are not licensed for this.
- **Names, dates and events.** The agent never invents them; answer when it asks.

## Reporting a problem

Open an issue at https://github.com/actionow-ai/vvv/issues, or ask your agent to write one: your system, the template, what you asked for and what happened. Leave out passwords, keys and private photos. See [contributing](../CONTRIBUTING.md).
