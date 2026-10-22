import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { beatClock } from "../../core/beat-clock";
import { eIn3, eOut3, eOut5, ramp } from "../../core/ease";
import { getPhoto, photoSrc } from "../../core/manifest";
import { defineTemplate, type TemplateProps } from "../../core/template";
import { useT } from "../../core/time";
import { GoldCorners, RedBackdrop } from ".";

/** Demo of the paper-cut frame: the red page drifts, a photo settles in, gold corners land one beat apart. */
export const slots = { photo: {} } as const;
const BEATS = 12;
const B = beatClock(null, 100);

const Demo: React.FC<TemplateProps<typeof slots>> = ({ photos }) => {
  const t = useT();
  const photo = getPhoto(photos.photo);
  const enter = eOut5(ramp(t, B(0), B(1)));
  const out = eIn3(ramp(t, B(BEATS - 1), B(BEATS)));
  const h = 760;
  const w = Math.min(1500, Math.round(h * (photo.width / photo.height)));
  const x = (1920 - w) / 2, y = (1080 - h) / 2;
  const corners = eOut3(ramp(t, B(2), B(3)));
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <RedBackdrop drift={160 * ramp(t, B(0), B(BEATS))} />
      <div style={{ position: "absolute", left: x, top: y + (1 - enter) * 60, width: w, height: h, opacity: enter, overflow: "hidden",
        border: "6px solid #E8C27A", boxShadow: "0 30px 80px rgba(60,0,0,0.5)" }}>
        <Img src={photoSrc(photo)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.02 + 0.08 * ramp(t, B(0), B(BEATS))})` }} />
      </div>
      <GoldCorners x={x - 10} y={y - 10} w={w + 20} h={h + 20} size={110 + 30 * (1 - corners)} op={corners} />
    </AbsoluteFill>
  );
};

export const papercutFrameDemo = defineTemplate({
  id: "VVV-Effect-PapercutFrame",
  code: "Effect",
  title: "Papercut Frame",
  couple: false,
  slots,
  seconds: () => B(BEATS) + 0.3,
  component: Demo,
  fps: 30,
  copy: {},
});
