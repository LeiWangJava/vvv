# Production decisions and continuation

Use this reference for a new film, a substantial recreation or work resumed across sessions. A small copy or timing edit can use the existing project notes; it does not need a new planning package.

## Locate the current work

Read the user's latest request together with existing source, inputs, decisions and output reports. Identify the actual project directory, renderer, entry/composition, render command and local asset roots. A copied Skill is not the video kit; an existing custom composition is not a photo-template project. Use [project operations](projects.md) only for projects its helper supports.

Retain established audience, content, style, order, format, sound and service choices. For kit projects, `vvv.json` → `workflow.approvedConstraints` holds approved creative constraints; record what was approved and its scope, rather than inferring approval from a rendered file. Its workflow stage is a note, not proof that a particular output was inspected. Existing authorization to continue still applies after a routine correction.

## Keep one useful production note

For a substantial task, maintain `creative/production.md`, or update equivalent existing brief/storyboard/handoff files. The [worked example](../examples/production-notes.md) shows the useful information; omit irrelevant sections rather than filling placeholders.

| Decision | Record enough to continue |
|---|---|
| Brief | Audience, viewing context, main message, duration, canvas variants, language, sound intent and required content |
| Sources | Local/source IDs, include/reference/evidence roles, access and inspected coverage; facts separate from assumptions |
| Direction | Visual hierarchy, typography/material treatment and motion rules that serve this subject; what to preserve or change from a reference |
| Scenes | Timeline ranges, visible action/result, picture and copy, sound, transition and acceptance check |
| Assets | Needed element, reuse/extract/code/generate route, target scene, real file or unresolved gap, selected version |
| Continuation | Current source/render version, actual review coverage, approved constraints, unresolved findings and the next useful action |

For sound, choose intentionally: silent/autoplay, supplied original sound, music-led, narration-led or a combination. If a requested sound layer cannot yet be produced or checked, record it as unfinished. A silently rendered preview is not evidence that an audio requirement disappeared.

Use a rough timed sequence to check message and reading load before polishing every scene. Then implement the sample range that tests the principal uncertainty: a story turn, a difficult caption, a reference's characteristic transition or a generated asset integrated with real content. Reuse that work in the main composition.

## Choose the next step from evidence

| Current condition | Next useful action |
|---|---|
| Required source cannot be accessed | Record the gap; continue independent work; resolve it before claiming its facts or fidelity |
| Story or style is uncertain | Compare a small number of concrete treatments against the purpose, then implement the most useful representative range |
| Core asset is missing | Define its scene role and acceptance criteria, choose a supported production route, inspect the result in context |
| Sample exists | Verify its source correspondence and actual file; inspect the relevant picture/motion/sound before sharing it |
| Feedback or new content arrived | Map the change to scene/time/layer, preserve unaffected decisions, rerender the affected range plus dependent transitions |
| Direction is established and continuing is authorized | Extend the actual composition and perform final coverage checks; do not restart intake or approval |
| Render failed | Diagnose the reported dependency, source or encoder error; reuse completed assets and resolve the cause before repeating work |

For generation failures, inspect the job and any received asset before retrying. Fixable output integration is different from an unavailable service. Route changes follow existing capability and billing authorization; a failed tool does not create new authorization.

## Resume without losing the film

Before leaving substantial work, update the actual artifact paths, tested commands, current gaps and next action. Keep useful render reports with their versioned artifacts: kit `out/sample.report.json` and `out/render.report.json` describe the latest run and can be overwritten. Copy a report alongside a retained review version when a comparison matters.

The render fingerprint covers what a render depends on (inputs, assets, source, public media, package files) and not `vvv.json`, so workflow notes there never make a report stale. Do not rewrite report fingerprints to make them look current. Put detailed review observations in `creative/`, which is outside the rendering fingerprint. Retain the difference between current source, historical evidence and what the user approved.

On the next session, inspect those records and the current files. Reuse valid assets and rendered ranges; reshoot or regenerate only when the changed requirement calls for it. Continue with [review and handoff](review-handoff.md).
