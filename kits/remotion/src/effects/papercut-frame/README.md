# Papercut Frame · 红底金角剪纸框

A red page with drifting gold paper-cut clouds (`RedBackdrop`), and gold paper-cut corners for any photo box (`GoldCorners`). Comedy uses both for its wedding gallery.

```tsx
import { GoldCorners, RedBackdrop } from "../../effects/papercut-frame";

<RedBackdrop drift={160 * ramp(t, B(0), B(12))} />        // px the clouds slide apart
<GoldCorners x={x} y={y} w={w} h={h} size={120} op={corners} />
```

- **Artwork.** The gold pieces are `public/assets/xy39/*-gold.png` (MIT, owner-provided); they travel with this effect.
- **Layout.** The backdrop is drawn on a 1920×1080 page; for 9:16, scale or reposition the cloud bands.
- **Beats.** Let the corners land one beat after the photo, with an ease-out, and keep the clouds drifting so the page never freezes.

The demo (`demo.tsx`, composition `VVV-Effect-PapercutFrame`) frames one photo over 12 beats at 100 BPM.
