# Generated video: capability-gated extension

VVV currently has an executable image adapter and local media-processing tools. **There is no bundled video-generation provider or `vvv_video.py` command.** This reference describes how to plan and use a video tool if the current host independently exposes one, and what a future adapter must preserve.

## Decide whether generation is needed

Use code for controlled typography, diagrams, interfaces and deterministic motion. Use supplied footage when it contains the required real content. Consider generated footage for natural movement or a visual scene that cannot be obtained from available material, within the user's creative direction.

Inspect the actual tool before promising text-to-video, image-to-video, reference editing, start/end frames, duration, aspect ratio or audio. Image-generation access and a host model name do not prove video-generation access. Preserve the service's authorization, cost and content rules; no silent provider switch or speculative retry loop.

## Keep a production request and lifecycle record

For an authorized call, record the scene purpose, prompt, ordered references and their roles, requested duration/format, camera or subject motion, continuity constraints, audio policy, chosen provider/model and agreed cost scope. These are planning fields, not a validated VVV API schema.

If the tool is asynchronous, keep its returned job ID and observed status. Follow its documented polling interval and cancellation behavior. A timeout or unknown status is not a failed job that can safely be submitted again; check the existing job before starting another. Do not invent idempotency or cancellation support.

Save the actual selected output in the editable project using the host's supported delivery mechanism. Keep raw output and provenance; a temporary URL, prompt or completed job ID alone is not delivery. Do not store credentials in the record.

## Inspect before using the clip

Use [media processing](media-processing.md) to inspect actual dimensions, frame rate, duration and audio. Review relevant moving segments for subject continuity, motion, framing and unintended artifacts. Keep or mute generated sound deliberately; do not assume it matches the user's intended dialogue or music.

Integrate the clip into a real scene layer and render a representative range of the main timeline. Compare the requested properties with the received output and record gaps. Native model duration, aspect ratio and identity guarantees must not be inferred from local post-processing.

Until a provider is implemented and tested, describe this as a host-dependent extension. Continue with code, supplied media and still-image generation when those methods satisfy the brief.
