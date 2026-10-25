import React, { useId } from "react";
import { eIo3 } from "../../core/ease";

/**
 * The cartoon groom and bride who host the film: big-headed, articulated figures drawn in SVG, so
 * they can dance on the beat. Original artwork of this template (no external characters).
 * A pose is a set of joint angles; a move is a list of poses, one per beat, eased between beats.
 */

export interface Pose {
  /** shoulder and elbow angles (degrees, 0 = arm hanging down, positive = raised outward) */
  la: [number, number];
  ra: [number, number];
  /** hip and knee (degrees, 0 = straight down) */
  ll: [number, number];
  rl: [number, number];
  /** body lean (degrees), bounce (px, up is negative) and head tilt (degrees) */
  lean: number;
  bob: number;
  head: number;
}

const P = (la: [number, number], ra: [number, number], lean = 0, bob = 0, head = 0, ll: [number, number] = [0, 0], rl: [number, number] = [0, 0]): Pose => ({ la, ra, ll, rl, lean, bob, head });

/** Named poses. Angles are for the figure's own left / right (viewer's right / left). */
export const POSES = {
  stand: P([8, 6], [8, 6]),
  hipL: P([40, 95], [8, 6], 0, 0, 4),
  wave1: P([10, 8], [150, 40], -3, 0, -5),
  wave2: P([10, 8], [150, -10], -3, -6, -5),
  up: P([160, 10], [160, 10], 0, -14, 0, [-6, 0], [6, 0]),
  vL: P([135, 0], [30, 20], 6, -6, 6, [8, 10], [0, 0]),
  vR: P([30, 20], [135, 0], -6, -6, -6, [0, 0], [-8, 10]),
  discoL: P([150, 0], [-20, 60], 8, 0, 8, [12, 18], [-4, 0]),
  discoR: P([-20, 60], [150, 0], -8, 0, -8, [4, 0], [-12, 18]),
  pointL: P([95, 0], [10, 8], 4, 0, 6),
  pointR: P([10, 8], [95, 0], -4, 0, -6),
  phone: P([28, -118], [28, -118], 0, 0, -6),
  clapA: P([34, -112], [34, -112], 0, 0, 0),
  clapB: P([22, -96], [22, -96], 0, -6, 0),
  bow: P([20, 30], [20, 30], 0, 10, 18),
  heart: P([168, -105], [168, -105], 0, -4, 0),
  cheerA: P([170, -10], [170, -10], 0, -18, 0, [-10, 20], [10, 20]),
  cheerB: P([120, 30], [120, 30], 0, 0, 0),
  kickL: P([60, 60], [100, 20], -6, -10, -4, [60, 60], [0, 0]),
  kickR: P([100, 20], [60, 60], 6, -10, 4, [0, 0], [-60, 60]),
  shrug: P([30, 100], [30, 100], 0, 0, 10),
  think: P([10, 8], [24, -142], 0, 0, 12),
};
export type PoseName = keyof typeof POSES;

/** Moves: one pose per beat. */
export const MOVES: Record<string, PoseName[]> = {
  idle: ["stand", "hipL"],
  dance: ["discoL", "vR", "discoR", "vL"],
  bounce: ["vL", "up", "vR", "up"],
  wave: ["wave1", "wave2"],
  point: ["pointL", "pointL"],
  pointR: ["pointR", "pointR"],
  phone: ["phone", "phone"],
  clap: ["clapA", "clapB"],
  bow: ["stand", "bow", "bow", "stand"],
  heart: ["heart", "heart"],
  cheer: ["cheerA", "cheerB"],
  kick: ["kickL", "stand", "kickR", "stand"],
  shrug: ["shrug", "stand"],
  think: ["think", "think"],
};

const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const mixPair = (a: [number, number], b: [number, number], k: number): [number, number] => [mix(a[0], b[0], k), mix(a[1], b[1], k)];
export const blend = (a: Pose, b: Pose, k: number): Pose => ({
  la: mixPair(a.la, b.la, k), ra: mixPair(a.ra, b.ra, k), ll: mixPair(a.ll, b.ll, k), rl: mixPair(a.rl, b.rl, k),
  lean: mix(a.lean, b.lean, k), bob: mix(a.bob, b.bob, k), head: mix(a.head, b.head, k),
});

/** Pose at `beat` (fractional) of a move; each pose holds its beat and eases into the next over the last 40%. */
export function poseAt(move: string, beat: number, phase = 0): Pose {
  const list = MOVES[move] ?? MOVES.idle;
  const b = Math.max(0, beat + phase);
  const i = Math.floor(b);
  const f = b - i;
  const a = POSES[list[i % list.length]];
  const c = POSES[list[(i + 1) % list.length]];
  const k = f < 0.6 ? 0 : eIo3((f - 0.6) / 0.4);
  const p = blend(a, c, k);
  // a small bounce on every beat
  return { ...p, bob: p.bob - 8 * Math.exp(-f * 6) };
}

const SKIN = "#FFE2CC";
const SKIN_D = "#F4BFA0";
const SUIT = "#1E2233";
const SUIT_L = "#3A4160";

/** One limb: upper and lower segment from a joint, angles in degrees. */
const Limb: React.FC<{ x: number; y: number; a: number; b: number; l1: number; l2: number; w1: number; w2: number; fill: string; side: 1 | -1; hand?: React.ReactNode; end?: React.ReactNode }> = ({ x, y, a, b, l1, l2, w1, w2, fill, side, hand, end }) => (
  <g transform={`translate(${x} ${y}) rotate(${side * a})`}>
    <rect x={-w1 / 2} y={-w1 / 2} width={w1} height={l1 + w1 / 2} rx={w1 / 2} fill={fill} />
    <g transform={`translate(0 ${l1}) rotate(${side * b})`}>
      <rect x={-w2 / 2} y={-w2 / 2} width={w2} height={l2 + w2 / 2} rx={w2 / 2} fill={fill} />
      <g transform={`translate(0 ${l2})`}>{hand ?? end}</g>
    </g>
  </g>
);

const Face: React.FC<{ blink: number; hair: React.ReactNode; back?: React.ReactNode; id: string; lash?: boolean; mouth?: "smile" | "o" | "grin" }> = ({ blink, hair, back, id, lash = false, mouth = "smile" }) => (
  <g>
    {back}
    <defs>
      <radialGradient id={`${id}-skin`} cx="45%" cy="40%" r="65%">
        <stop offset="0%" stopColor="#FFF1E6" />
        <stop offset="70%" stopColor={SKIN} />
        <stop offset="100%" stopColor={SKIN_D} />
      </radialGradient>
    </defs>
    <ellipse cx={0} cy={0} rx={92} ry={100} fill={`url(#${id}-skin)`} />
    <ellipse cx={-94} cy={8} rx={14} ry={20} fill={SKIN_D} />
    <ellipse cx={94} cy={8} rx={14} ry={20} fill={SKIN_D} />
    {/* eyes */}
    {[-36, 36].map((ex) => (
      <g key={ex} transform={`translate(${ex} 10) scale(1 ${Math.max(0.08, 1 - blink)})`}>
        <ellipse rx={17} ry={22} fill="#2A1A16" />
        <ellipse rx={10} ry={13} cx={2} cy={3} fill="#5A3A2E" />
        <circle r={6} cx={-5} cy={-8} fill="#FFFFFF" />
        <circle r={2.6} cx={6} cy={6} fill="#FFFFFF" opacity={0.85} />
      </g>
    ))}
    {lash && blink < 0.6 && [-36, 36].map((ex) => <path key={ex} d={`M ${ex - 18} -8 Q ${ex} -22 ${ex + 20} -10`} stroke="#2A1A16" strokeWidth={5} fill="none" strokeLinecap="round" />)}
    {/* brows */}
    <path d="M -54 -26 Q -36 -36 -18 -28" stroke="#3A2A22" strokeWidth={6} fill="none" strokeLinecap="round" />
    <path d="M 18 -28 Q 36 -36 54 -26" stroke="#3A2A22" strokeWidth={6} fill="none" strokeLinecap="round" />
    {/* blush */}
    <ellipse cx={-56} cy={44} rx={18} ry={10} fill="#FF8FA0" opacity={0.55} />
    <ellipse cx={56} cy={44} rx={18} ry={10} fill="#FF8FA0" opacity={0.55} />
    {mouth === "o" ? (
      <ellipse cx={0} cy={58} rx={12} ry={15} fill="#9A2A36" />
    ) : mouth === "grin" ? (
      <path d="M -26 46 Q 0 80 26 46 Z" fill="#9A2A36" stroke="#7A1A26" strokeWidth={2} />
    ) : (
      <path d="M -20 50 Q 0 68 20 50" stroke="#9A2A36" strokeWidth={6} fill="none" strokeLinecap="round" />
    )}
    {hair}
  </g>
);

/** Blink for a couple of frames every few seconds, offset per character. */
const blinkAt = (t: number, seed: number) => {
  const period = 3.1 + seed * 0.7;
  const p = ((t + seed * 1.3) % period) / period;
  return p > 0.965 ? Math.sin(((p - 0.965) / 0.035) * Math.PI) : 0;
};

export interface ToonProps {
  /** design seconds (for blinking) */
  t: number;
  pose: Pose;
  /** screen position of the feet (center) and height in px */
  x: number;
  y: number;
  h: number;
  flip?: boolean;
  /** optional prop in the right hand */
  hold?: "phone" | "bouquet" | "glass" | "mic" | null;
  mouth?: "smile" | "o" | "grin";
  opacity?: number;
  /** extra rotation of the whole figure (spinning when dizzy) */
  spin?: number;
}

const Prop: React.FC<{ hold: ToonProps["hold"] }> = ({ hold }) => {
  if (hold === "phone") return <g transform="translate(-14 4) rotate(-8)"><rect x={0} y={-6} width={34} height={60} rx={6} fill="#20232E" /><rect x={4} y={-1} width={26} height={46} rx={3} fill="#7FD6FF" /></g>;
  if (hold === "glass") return <g transform="translate(-10 -10)"><path d="M 0 0 L 22 0 L 18 34 L 4 34 Z" fill="#FFE07A" stroke="#FFFFFF" strokeWidth={3} /><rect x={9} y={34} width={4} height={18} fill="#FFFFFF" /><rect x={2} y={50} width={18} height={4} rx={2} fill="#FFFFFF" /></g>;
  if (hold === "mic") return <g transform="translate(-8 -30)"><rect x={2} y={22} width={12} height={46} rx={5} fill="#22252F" /><circle cx={8} cy={16} r={14} fill="#B8BCC8" /></g>;
  if (hold === "bouquet")
    return (
      <g transform="translate(0 6)">
        <path d="M -8 0 L 8 0 L 4 40 L -4 40 Z" fill="#7BB36A" />
        {[[-22, -10, "#FF8FB1"], [0, -22, "#FFFFFF"], [22, -10, "#FF6F91"], [-12, -30, "#FFD1DC"], [14, -32, "#FF8FB1"], [0, -4, "#FFC2D4"]].map(([cx, cy, c], i) => (
          <circle key={i} cx={cx as number} cy={cy as number} r={16} fill={c as string} stroke="#E25C84" strokeWidth={2} />
        ))}
      </g>
    );
  return null;
};

const Hand: React.FC<{ r: number; children?: React.ReactNode }> = ({ r, children }) => (
  <g>
    <circle r={r} fill={SKIN} stroke={SKIN_D} strokeWidth={2} />
    {children}
  </g>
);

/** The groom: black suit, white shirt, red bow tie, neat side-parted hair. */
export const Groom: React.FC<ToonProps> = ({ t, pose, x, y, h, flip = false, hold = null, mouth = "smile", opacity = 1, spin = 0 }) => {
  const id = useId().replace(/:/g, "");
  const s = h / 900;
  const hair = (
    <g>
      <path d="M -96 -12 Q -104 -96 -30 -112 Q 40 -126 88 -80 Q 104 -54 98 -10 Q 84 -54 40 -66 Q -6 -40 -64 -58 Q -84 -40 -96 -12 Z" fill="#1B1414" />
      <path d="M -40 -98 Q 10 -112 60 -86" stroke="#4A3A3A" strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.7} />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s}) rotate(${spin} 0 -450)`} opacity={opacity}>
      <ellipse cx={0} cy={4} rx={120} ry={18} fill="#000" opacity={0.18} />
      <g transform={`translate(0 ${pose.bob}) rotate(${pose.lean} 0 -380)`}>
        {/* legs */}
        <Limb x={-34} y={-400} a={pose.ll[0]} b={-pose.ll[1]} l1={190} l2={175} w1={56} w2={50} fill={SUIT} side={1} end={<ellipse cx={-14} cy={10} rx={42} ry={20} fill="#0E0E14" />} />
        <Limb x={34} y={-400} a={pose.rl[0]} b={pose.rl[1]} l1={190} l2={175} w1={56} w2={50} fill={SUIT} side={-1} end={<ellipse cx={14} cy={10} rx={42} ry={20} fill="#0E0E14" />} />
        {/* torso */}
        <defs>
          <linearGradient id={`${id}-suit`} x1="0" x2="1">
            <stop offset="0%" stopColor={SUIT_L} />
            <stop offset="45%" stopColor={SUIT} />
            <stop offset="100%" stopColor="#141725" />
          </linearGradient>
        </defs>
        <path d="M -92 -660 Q 0 -690 92 -660 L 84 -390 Q 0 -372 -84 -390 Z" fill={`url(#${id}-suit)`} />
        <path d="M -30 -668 L 0 -560 L 30 -668 Z" fill="#FFFFFF" />
        <path d="M -30 -668 L 0 -560 L -52 -600 Z" fill="#2B3050" />
        <path d="M 30 -668 L 0 -560 L 52 -600 Z" fill="#2B3050" />
        <path d="M -24 -652 L 0 -640 L 24 -652 L 24 -628 L 0 -640 L -24 -628 Z" fill="#D21F3C" />
        <circle cx={0} cy={-520} r={6} fill="#C9CCD8" />
        <circle cx={0} cy={-470} r={6} fill="#C9CCD8" />
        <path d="M 46 -600 L 70 -606 L 66 -590 Z" fill="#FFFFFF" />
        {/* arms */}
        <Limb x={-92} y={-646} a={pose.la[0]} b={pose.la[1]} l1={150} l2={135} w1={50} w2={44} fill={SUIT} side={1} hand={<Hand r={26} />} />
        <Limb x={92} y={-646} a={pose.ra[0]} b={pose.ra[1]} l1={150} l2={135} w1={50} w2={44} fill={SUIT} side={-1} hand={<Hand r={26}><Prop hold={hold} /></Hand>} />
        {/* neck and head */}
        <rect x={-22} y={-700} width={44} height={40} fill={SKIN_D} />
        <g transform={`translate(0 -800) rotate(${pose.head})`}>
          <Face blink={blinkAt(t, 0.3)} hair={hair} id={`${id}-f`} mouth={mouth} />
        </g>
      </g>
    </g>
  );
};

/** The bride: white strapless gown with a full skirt, veil, hair bun with a tiara. */
export const Bride: React.FC<ToonProps & { veilWave?: number }> = ({ t, pose, x, y, h, flip = false, hold = "bouquet", mouth = "smile", opacity = 1, spin = 0, veilWave }) => {
  const id = useId().replace(/:/g, "");
  const s = h / 900;
  const wave = veilWave ?? Math.sin(t * 2.2) * 10;
  const sway = Math.sin(t * 3.1) * 6 + pose.lean * 1.2;
  const back = (
    <g>
      {/* veil behind the head, flowing down past the shoulders */}
      <path d={`M -60 -70 Q -150 120 ${-170 + wave} 520 L ${120 + wave} 560 Q 120 140 60 -70 Z`} fill="#FFFFFF" opacity={0.42} />
      <ellipse cx={0} cy={-96} rx={58} ry={44} fill="#2A1C1A" />
    </g>
  );
  const hair = (
    <g>
      <path d="M -98 10 Q -110 -96 -20 -112 Q 70 -122 98 -40 Q 104 0 96 30 Q 88 -40 50 -56 Q 0 -36 -40 -66 Q -70 -40 -78 30 Q -92 30 -98 10 Z" fill="#2A1C1A" />
      <path d="M -50 -110 L -36 -132 L -20 -112 L 0 -140 L 20 -112 L 36 -132 L 50 -110 Z" fill="#FFE28A" stroke="#FFFFFF" strokeWidth={3} />
      <circle cx={0} cy={-134} r={7} fill="#FF9FBD" />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s}) rotate(${spin} 0 -450)`} opacity={opacity}>
      <ellipse cx={0} cy={4} rx={190} ry={22} fill="#000" opacity={0.18} />
      <g transform={`translate(0 ${pose.bob})`}>
        <defs>
          <linearGradient id={`${id}-gown`} x1="0" x2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="55%" stopColor="#F6F2F4" />
            <stop offset="100%" stopColor="#DCD3DA" />
          </linearGradient>
        </defs>
        {/* skirt: flares from the waist, sways with the music */}
        <path d={`M -70 -430 Q ${-160 + sway} -200 ${-210 + sway} -6 Q 0 26 ${210 + sway} -6 Q ${160 + sway} -200 70 -430 Z`} fill={`url(#${id}-gown)`} />
        <path d={`M -40 -420 Q ${-80 + sway} -200 ${-110 + sway} -12`} stroke="#E8DDE4" strokeWidth={6} fill="none" />
        <path d={`M 40 -420 Q ${80 + sway} -200 ${110 + sway} -12`} stroke="#E8DDE4" strokeWidth={6} fill="none" />
        {/* lace hem and a few sequins */}
        {Array.from({ length: 13 }, (_, k) => {
          const hx = -200 + k * (400 / 12) + sway;
          return <circle key={k} cx={hx} cy={-6 + 6 * Math.sin(k)} r={17} fill="#FFFFFF" stroke="#EBDDE6" strokeWidth={3} />;
        })}
        {[[-60, -300], [50, -250], [-110, -120], [90, -90], [-20, -170], [130, -40], [-150, -40]].map(([sx, sy], k) => (
          <circle key={k} cx={sx + sway * (1 + sy / 430)} cy={sy} r={5} fill="#FFE6F0" opacity={0.5 + 0.5 * Math.sin(t * 4 + k)} />
        ))}
        <g transform={`rotate(${pose.lean} 0 -440)`}>
          {/* bodice */}
          <path d="M -62 -640 Q 0 -664 62 -640 L 70 -430 Q 0 -410 -70 -430 Z" fill={`url(#${id}-gown)`} />
          <path d="M -62 -640 Q -30 -622 0 -640 Q 30 -622 62 -640 L 62 -650 Q 0 -676 -62 -650 Z" fill={SKIN} />
          <path d="M -70 -440 Q 0 -420 70 -440 L 70 -424 Q 0 -404 -70 -424 Z" fill="#F2C9D6" />
          {/* arms */}
          <Limb x={-66} y={-640} a={pose.la[0]} b={pose.la[1]} l1={140} l2={128} w1={34} w2={30} fill={SKIN} side={1} hand={<Hand r={20} />} />
          <Limb x={66} y={-640} a={pose.ra[0]} b={pose.ra[1]} l1={140} l2={128} w1={34} w2={30} fill={SKIN} side={-1} hand={<Hand r={20}><Prop hold={hold} /></Hand>} />
          <rect x={-18} y={-700} width={36} height={52} fill={SKIN_D} />
          <g transform={`translate(0 -790) rotate(${pose.head})`}>
            <Face blink={blinkAt(t, 1.7)} hair={hair} back={back} id={`${id}-f`} lash mouth={mouth} />
          </g>
        </g>
      </g>
    </g>
  );
};

/** Both figures in one 1920×1080 overlay; positions in px. */
export const Couple: React.FC<{
  t: number;
  beat: number;
  groom?: { move: string; x: number; y?: number; h?: number; hold?: ToonProps["hold"]; mouth?: ToonProps["mouth"]; spin?: number; opacity?: number } | null;
  bride?: { move: string; x: number; y?: number; h?: number; hold?: ToonProps["hold"]; mouth?: ToonProps["mouth"]; spin?: number; opacity?: number } | null;
}> = ({ t, beat, groom, bride }) => (
  <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
    {groom && (
      <Groom t={t} pose={poseAt(groom.move, beat)} x={groom.x} y={groom.y ?? 1040} h={groom.h ?? 720} hold={groom.hold ?? null} mouth={groom.mouth} spin={groom.spin} opacity={groom.opacity} />
    )}
    {bride && (
      <Bride t={t} pose={poseAt(bride.move, beat, 0.5)} x={bride.x} y={bride.y ?? 1040} h={bride.h ?? 700} hold={bride.hold === undefined ? "bouquet" : bride.hold} mouth={bride.mouth} spin={bride.spin} opacity={bride.opacity} flip />
    )}
  </svg>
);
