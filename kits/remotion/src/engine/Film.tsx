import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useDirectionalBlur } from "../components/Photo";
import { eIn3, eIo3, eIo5, eOut3, eSine, ramp } from "../core/ease";
import { TimeProvider } from "../core/time";

/**
 * Motion-graphics timeline modeled on the XY-01 Python engine:
 *
 * - Segments are layers on one canvas with absolute [from, to) times. They overlap, and each
 *   choreographs its own entrance and exit (grow + fade, slide away), like an After Effects comp.
 * - Frame transitions (push / spin / zoom / dissolve) composite two segments.
 * - Moving elements get directional motion blur from their own velocity (see Photo `motion`);
 *   spin and zoom are multi-sampled like a real shutter.
 * - Everything reads *design time*. With a beat warp, the music clock is mapped to design time,
 *   so authored moments land on the beat.
 */

export interface FilmSegment {
  id: string;
  from: number;
  to: number;
  render: () => React.ReactNode;
}

export type FilmTransition =
  | {
      kind: "push";
      from: number;
      to: number;
      a: string;
      b: string;
      /** where the new picture comes from: "left" = it enters from the right (moves left) */
      dir: "left" | "right" | "up" | "down";
      ease?: (p: number) => number;
      /** shutter as a fraction of a frame for this push's blur (Python: 1.0 or 0.7) */
      shutter?: number;
    }
  | { kind: "wipe" | "cover"; from: number; to: number; a: string; b: string; dir: "left" | "right" | "up" | "down" }
  | { kind: "iris"; from: number; to: number; a: string; b: string; at?: [number, number] }
  | { kind: "spin" | "zoom" | "dissolve" | "page" | "cross" | "blur"; from: number; to: number; a: string; b: string };

export type TransitionKind = FilmTransition["kind"];
export type Dir = "left" | "right" | "up" | "down";

/** Virtual shutter open for 0.6 of a frame, as in the Python engine. */
export const SHUTTER = 0.6;

/** Half the shutter interval in seconds: evaluate a path at t ± this to get motion-blur length. */
export function useHalfShutter(): number {
  const { fps } = useVideoConfig();
  return SHUTTER / fps / 2;
}

const Layer: React.FC<{ t: number; segments: FilmSegment[]; only?: string[]; background: string }> = ({
  t,
  segments,
  only,
  background,
}) => (
  <TimeProvider t={t}>
    <AbsoluteFill style={{ background }}>
      {segments
        .filter((s) => s.from <= t && t < s.to && (!only || only.includes(s.id)))
        .map((s) => (
          <AbsoluteFill key={s.id}>{s.render()}</AbsoluteFill>
        ))}
    </AbsoluteFill>
  </TimeProvider>
);

/** Average opaque layers exactly: each adds 1/n of itself (used only while the frame moves fast). */
const Average: React.FC<{ children: React.ReactNode[] }> = ({ children }) => (
  <AbsoluteFill style={{ isolation: "isolate", background: "#000" }}>
    {children.map((c, i) => (
      <AbsoluteFill key={i} style={{ mixBlendMode: "plus-lighter", opacity: 1 / children.length }}>
        {c}
      </AbsoluteFill>
    ))}
  </AbsoluteFill>
);

/** Smallest scale at which a frame rotated by `deg` still covers the whole viewport. */
const coverScale = (deg: number, w: number, h: number) => {
  const r = (Math.abs(deg) * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return Math.max((w * c + h * s) / w, (w * s + h * c) / h);
};

export const Film: React.FC<{
  segments: FilmSegment[];
  transitions?: FilmTransition[];
  background?: (t: number) => string;
  /** music time → design time (beat warp); identity when omitted */
  toDesign?: (tau: number) => number;
}> = ({ segments, transitions = [], background = () => "#FCFBF8", toDesign }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const warp = toDesign ?? ((x: number) => x);
  const t = warp(frame / fps);
  const tr = transitions.find((x) => x.from <= t && t < x.to);

  // push blur: how far the strip travels while the shutter is open
  let pushTravel: [number, number] | undefined;
  if (tr?.kind === "push") {
    const e = tr.ease ?? eIo5;
    const horiz = tr.dir === "left" || tr.dir === "right";
    const L = horiz ? width : height;
    const h = (tr.shutter ?? 1) / fps / 2;
    const len = Math.abs(e(ramp(t + h, tr.from, tr.to)) - e(ramp(t - h, tr.from, tr.to))) * L;
    pushTravel = horiz ? [len, 0] : [0, len];
  }
  const pushBlur = useDirectionalBlur(pushTravel);

  const layer = (ts: number, only?: string[]) => (
    <Layer t={ts} segments={segments} only={only} background={background(ts)} />
  );

  if (!tr) return layer(t);
  const p = ramp(t, tr.from, tr.to);

  if (tr.kind === "push") {
    const e = tr.ease ?? eIo5;
    const horiz = tr.dir === "left" || tr.dir === "right";
    const L = horiz ? width : height;
    const sign = tr.dir === "left" || tr.dir === "up" ? 1 : -1;
    const off = e(p) * L * sign;
    const move = (d: number) => (horiz ? `translateX(${d}px)` : `translateY(${d}px)`);
    return (
      <AbsoluteFill style={{ filter: pushBlur.filter, background: "#000" }}>
        <AbsoluteFill style={{ transform: move(-off) }}>{layer(t, [tr.a])}</AbsoluteFill>
        <AbsoluteFill style={{ transform: move(sign * L - off) }}>{layer(t, [tr.b])}</AbsoluteFill>
        {pushBlur.defs}
      </AbsoluteFill>
    );
  }

  if (tr.kind === "wipe") {
    // soft-edged wipe: B is revealed by a feathered edge sweeping across, A drifts slightly
    const e = eIo3(p);
    const soft = 18;
    const to = { left: "to left", right: "to right", up: "to top", down: "to bottom" }[tr.dir];
    const a = e * (100 + soft) - soft;
    const mask = `linear-gradient(${to}, #000 ${a}%, transparent ${a + soft}%)`;
    const drift = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[tr.dir];
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <AbsoluteFill style={{ transform: `translate(${drift[0] * 40 * e}px, ${drift[1] * 40 * e}px)` }}>{layer(t, [tr.a])}</AbsoluteFill>
        <AbsoluteFill style={{ WebkitMaskImage: mask, maskImage: mask, transform: `translate(${-drift[0] * 40 * (1 - e)}px, ${-drift[1] * 40 * (1 - e)}px)` }}>
          {layer(t, [tr.b])}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  if (tr.kind === "cover") {
    // B slides in over A (A stays and dims), with a soft shadow on B's leading edge
    const e = eIo5(p);
    const horiz = tr.dir === "left" || tr.dir === "right";
    const L = horiz ? width : height;
    const sign = tr.dir === "left" || tr.dir === "up" ? 1 : -1;
    const d = sign * L * (1 - e);
    const shadowX = horiz ? sign * -30 : 0;
    const shadowY = horiz ? 0 : sign * -30;
    return (
      <AbsoluteFill style={{ background: "#000", filter: pushBlur.filter }}>
        <AbsoluteFill style={{ transform: `scale(${1 - 0.04 * e})`, filter: `brightness(${1 - 0.35 * e})` }}>{layer(t, [tr.a])}</AbsoluteFill>
        <AbsoluteFill style={{ transform: horiz ? `translateX(${d}px)` : `translateY(${d}px)`, boxShadow: `${shadowX}px ${shadowY}px 60px rgba(0,0,0,0.35)` }}>
          {layer(t, [tr.b])}
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  if (tr.kind === "iris") {
    // B opens in a growing circle (around `at`, default center), feathered edge
    const e = eIo3(p);
    const [ax, ay] = tr.at ?? [0.5, 0.5];
    const R = Math.hypot(Math.max(ax, 1 - ax) * width, Math.max(ay, 1 - ay) * height);
    const r = e * (R + 80);
    const mask = `radial-gradient(circle at ${ax * 100}% ${ay * 100}%, #000 ${Math.max(0, r - 80)}px, transparent ${r}px)`;
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <AbsoluteFill style={{ transform: `scale(${1 + 0.05 * e})` }}>{layer(t, [tr.a])}</AbsoluteFill>
        <AbsoluteFill style={{ WebkitMaskImage: mask, maskImage: mask, transform: `scale(${1.06 - 0.06 * e})` }}>{layer(t, [tr.b])}</AbsoluteFill>
      </AbsoluteFill>
    );
  }

  if (tr.kind === "blur") {
    // focus pull: A defocuses, B comes into focus (no flash, no zoom)
    const m = eIo3(p);
    const ba = 22 * eSine(Math.min(1, p / 0.55));
    const bb = 22 * (1 - eSine(Math.max(0, (p - 0.45) / 0.55)));
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <AbsoluteFill style={{ filter: `blur(${ba}px)` }}>{layer(t, [tr.a])}</AbsoluteFill>
        <AbsoluteFill style={{ opacity: m, filter: `blur(${bb}px)` }}>{layer(t, [tr.b])}</AbsoluteFill>
      </AbsoluteFill>
    );
  }

  if (tr.kind === "dissolve") {
    const m = eIo3(p);
    const blurA = 16 * eSine(Math.min(1, p / 0.6));
    const blurB = 16 * (1 - eSine(Math.max(0, (p - 0.4) / 0.6)));
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <AbsoluteFill style={{ transform: `scale(${1 + 0.04 * eSine(p)})`, filter: `blur(${blurA}px)` }}>
          {layer(t, [tr.a])}
        </AbsoluteFill>
        <AbsoluteFill style={{ opacity: m, transform: `scale(${1.04 - 0.04 * eSine(p)})`, filter: `blur(${blurB}px)` }}>
          {layer(t, [tr.b])}
        </AbsoluteFill>
        <AbsoluteFill style={{ background: "#fff", opacity: 0.22 * Math.sin(Math.PI * p) }} />
      </AbsoluteFill>
    );
  }

  if (tr.kind === "cross") {
    // plain crossfade, B settling from a hair larger: the gentlest change, for photo-to-photo
    const m = eIo3(p);
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        {layer(t, [tr.a])}
        <AbsoluteFill style={{ opacity: m, transform: `scale(${1.025 - 0.025 * m})` }}>{layer(t, [tr.b])}</AbsoluteFill>
      </AbsoluteFill>
    );
  }

  if (tr.kind === "page") {
    // book page: A lifts toward the camera around the left edge and flips over, revealing B
    const e = eIo3(p);
    const ang = -180 * e;
    const lift = Math.sin(Math.PI * Math.min(1, e * 2));
    return (
      <AbsoluteFill>
        {layer(t, [tr.b])}
        <AbsoluteFill
          style={{ background: "linear-gradient(to right, rgba(40,25,10,0.45) 0%, rgba(40,25,10,0) 45%)", opacity: 0.8 * (1 - e) }}
        />
        {e < 0.5 ? (
          <AbsoluteFill style={{ perspective: 5000 }}>
            <AbsoluteFill
              style={{ transformOrigin: "0% 50%", transform: `rotateY(${ang}deg)`, boxShadow: `0 0 ${60 * lift}px rgba(40,25,10,${0.35 * lift})` }}
            >
              {layer(t, [tr.a])}
              <AbsoluteFill
                style={{
                  background: `linear-gradient(to left, rgba(40,25,10,${0.35 * lift}) 0%, rgba(255,250,240,${0.12 * lift}) 55%, rgba(40,25,10,0) 100%)`,
                }}
              />
            </AbsoluteFill>
          </AbsoluteFill>
        ) : null}
      </AbsoluteFill>
    );
  }

  // spin / zoom: switch from A to B at the midpoint, shutter-sampled while moving fast
  const kind = tr.kind;
  const params = (ts: number) => {
    const q0 = ramp(ts, tr.from, tr.to);
    if (q0 < 0.5) {
      const q = eIn3(q0 / 0.5);
      return kind === "spin" ? { id: tr.a, ang: 80 * q, sc: 1 + 0.3 * q } : { id: tr.a, ang: 0, sc: Math.exp(Math.log(1.8) * q) };
    }
    const q = eOut3((q0 - 0.5) / 0.5);
    return kind === "spin"
      ? { id: tr.b, ang: -80 * (1 - q), sc: 1.3 - 0.3 * q }
      : { id: tr.b, ang: 0, sc: Math.exp(Math.log(1.8) * (1 - q)) };
  };
  const dt = 0.8 / fps;
  const s0 = params(t - dt / 2);
  const s1 = params(t + dt / 2);
  const R = Math.hypot(width, height) / 2;
  const span = Math.abs(((s1.ang - s0.ang) * Math.PI) / 180) * R + Math.abs(Math.log(s1.sc / s0.sc)) * R;
  const n = Math.min(24, Math.max(1, Math.round(span / 2)));
  const sample = (ts: number) => {
    const { id, ang, sc } = params(ts);
    const s = kind === "spin" ? Math.max(sc, coverScale(ang, width, height)) : sc;
    return (
      <AbsoluteFill style={{ transform: `rotate(${-ang}deg) scale(${s})` }}>{layer(ts, [id])}</AbsoluteFill>
    );
  };
  if (n === 1) return sample(t);
  return <Average>{Array.from({ length: n }, (_, i) => sample(t + ((i + 0.5) / n - 0.5) * dt))}</Average>;
};
