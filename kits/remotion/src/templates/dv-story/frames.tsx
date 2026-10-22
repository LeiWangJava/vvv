import React from "react";
import { AbsoluteFill, Img, random } from "remotion";
import { art } from "./media";
import { PIXEL, SANS } from "./text";

/**
 * The two "screens" of the film: a home-video camcorder viewfinder (REC, timecode, HDV, tape,
 * Tv 60, audio meter) for the childhood half, and a "PLAY ●" playback screen for the love story.
 * Coordinates are 1920×1080 (the reference video measured at 1280×720, ×1.5).
 */

const SCREEN = { x: 42, y: 27, w: 1836, h: 1026, r: 44 };

/** Camcorder screen background: textured LCD with rounded corners inside a black bezel. */
export const DVBackground: React.FC<{ f: number }> = ({ f }) => {
  const k = Math.floor(f / 3);
  const lift = 0.94 + 0.06 * random(`dvbg-${k}`);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <div
        style={{
          position: "absolute",
          left: SCREEN.x,
          top: SCREEN.y,
          width: SCREEN.w,
          height: SCREEN.h,
          borderRadius: SCREEN.r,
          overflow: "hidden",
          filter: `brightness(${lift})`,
        }}
      >
        <Img src={art("textures/bg-rec.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" }} />
      </div>
    </AbsoluteFill>
  );
};

const two = (n: number) => String(n).padStart(2, "0");

/** Viewfinder overlay. `clipSeconds` drives the timecode; `dotOn` blinks the REC lamp. */
export const DVOverlay: React.FC<{ clipSeconds: number; dotOn: boolean }> = ({ clipSeconds, dotOn }) => {
  const s = Math.max(0, Math.floor(clipSeconds));
  const tc = `${Math.floor(s / 3600)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`;
  const white = "rgba(246,246,246,0.95)";
  const ticks = Array.from({ length: 46 }, (_, i) => 1360 + i * 10);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
        <g fontFamily={SANS} fill={white}>
          <text x={95} y={112} fontSize={47} fontWeight={500} letterSpacing={1}>
            REC
          </text>
          {dotOn ? <circle cx={248} cy={96} r={18} fill="#e5262e" /> : null}
          <text x={95} y={200} fontSize={52} fontWeight={400} letterSpacing={1}>
            {tc}
          </text>

          <rect x={1557} y={75} width={115} height={53} rx={6} fill="none" stroke={white} strokeWidth={3} />
          <text x={1614.5} y={116} fontSize={36} fontWeight={600} textAnchor="middle">
            HDV
          </text>
          {/* tape / camera lamp */}
          <g fill="#37c24a">
            <path d="M1722 86 L1744 96 L1744 116 L1722 126 Z" />
            <rect x={1744} y={80} width={78} height={52} rx={7} />
          </g>
          <rect x={1754} y={99} width={58} height={25} rx={5} fill="#0f3a16" />
          <circle cx={1770} cy={111.5} r={7} fill="#37c24a" />
          <circle cx={1796} cy={111.5} r={7} fill="#37c24a" />

          <path d="M1716 205 L1744 205 L1744 177 Z" />
          <text x={1820} y={205} fontSize={42} fontWeight={500} textAnchor="end">
            LW
          </text>
          <text x={1820} y={280} fontSize={42} fontWeight={500} textAnchor="end">
            AWB
          </text>

          <rect x={103} y={940} width={77} height={63} rx={6} fill="none" stroke="#8fd0ef" strokeWidth={3} />
          <text x={141.5} y={987} fontSize={40} fontWeight={500} textAnchor="middle">
            Tv
          </text>
          <path d="M194 966 L210 946 L226 966 Z M194 978 L210 998 L226 978 Z" />
          <text x={236} y={990} fontSize={50} fontWeight={400}>
            60
          </text>

          <text x={1250} y={955} fontSize={37} fontWeight={400}>
            -dB40
          </text>
          <text x={1640} y={955} fontSize={37} fontWeight={400} textAnchor="middle">
            12
          </text>
          <text x={1816} y={955} fontSize={37} fontWeight={400} textAnchor="end">
            0
          </text>
          <rect x={1300} y={971} width={32} height={31} rx={3} />
          <text x={1316} y={996} fontSize={25} fontWeight={600} textAnchor="middle" fill="#111">
            M
          </text>
          <rect x={1356} y={984} width={460} height={3} />
          {ticks.map((x) => (
            <rect key={x} x={x} y={x % 50 === 10 ? 970 : 976} width={2.5} height={x % 50 === 10 ? 26 : 16} />
          ))}
          <rect x={1638} y={965} width={3} height={34} />
          <rect x={1813} y={965} width={3} height={34} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/** Playback screen: black with a faint lit "screen" band and two hairlines, like the reference. */
export const PlayBackground: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 132, height: 820, background: "#060606" }} />
    <div style={{ position: "absolute", left: 0, right: 0, top: 131, height: 2, background: "rgba(255,255,255,0.13)" }} />
    <div style={{ position: "absolute", left: 0, right: 0, top: 951, height: 2, background: "rgba(255,255,255,0.10)" }} />
  </AbsoluteFill>
);

/** "PLAY ●" label, top left; the dot blinks on the beat. */
export const PlayLabel: React.FC<{ dotOn: boolean }> = ({ dotOn }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div
      style={{
        position: "absolute",
        left: 106,
        top: 92,
        fontFamily: PIXEL,
        fontWeight: 700,
        fontSize: 37,
        letterSpacing: 2,
        color: "#f4f4f4",
        lineHeight: 1,
      }}
    >
      PLAY
    </div>
    {dotOn ? <div style={{ position: "absolute", left: 233, top: 99, width: 27, height: 27, borderRadius: 14, background: "#e5262e" }} /> : null}
  </AbsoluteFill>
);
