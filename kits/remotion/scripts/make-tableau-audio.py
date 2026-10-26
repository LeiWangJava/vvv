#!/usr/bin/env python3
"""Synthesize the Tableau template's music from code (original, no samples).

    python3 scripts/make-tableau-audio.py

Writes public/music/tableau-tick.ogg (+ .beats.json). The track is 150 BPM with beat 0 at 0.4 s, so
one picture (8 beats) lasts 3.2 s. Its two halves follow the template (src/templates/tableau):

  beats  0–32   "the tick": dry, sparse half-time groove — a falling 808-style kick, a clock tick on
                every eighth, a low minor ostinato. Pictures 1–4 sit on it.
  beat  31      a short reverse swell and half a beat of silence.
  beats 32–88   "the drop": a dense, slightly overdriven wall of sustained chords over a sub drone,
                the kick on every second beat. Pictures 5 and later sit on it.
  beats 88–     ring-out.

Deterministic: the same script gives the same files.
"""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
BPM = 150.0
BEAT = 60.0 / BPM
T0 = 0.4
DROP = 32
END_BEAT = 88
TAIL = 2.6
ROOT = Path(__file__).resolve().parent.parent
rng = np.random.default_rng(20261026)


def tb(beat: float) -> float:
    return T0 + beat * BEAT


def midi_hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def lp(x, hz, order=2):
    return sosfilt(butter(order, min(hz, SR / 2 - 100) / (SR / 2), "low", output="sos"), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz / (SR / 2), "high", output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo / (SR / 2), hi / (SR / 2)], "band", output="sos"), x)


def add(buf: np.ndarray, x: np.ndarray, at: float, gain: float = 1.0, pan: float = 0.0) -> None:
    i = int(round(at * SR))
    if i >= len(buf):
        return
    n = min(len(x), len(buf) - i)
    left, right = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
    buf[i:i + n, 0] += x[:n] * gain * left * np.sqrt(2)
    buf[i:i + n, 1] += x[:n] * gain * right * np.sqrt(2)


# ---------------------------------------------------------------- voices
def kick(dur=0.55) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 42 + 130 * np.exp(-t / 0.045)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.28)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.004) * 0.25
    return np.tanh(1.6 * (body + click))


def tick(bright: bool) -> np.ndarray:
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * (2900 if bright else 2200) * t) * np.exp(-t / 0.008)
    noise = bp(rng.standard_normal(n), 3000, 9000) * np.exp(-t / 0.006) * 0.5
    return tone * 0.6 + noise


def clap() -> np.ndarray:
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    e = np.exp(-t / 0.09)
    for k in (0.0, 0.011, 0.022):  # three quick hands
        e = e + (t >= k) * np.exp(-np.clip(t - k, 0, None) / 0.006) * 0.8
    return bp(rng.standard_normal(n), 900, 5000) * e * 0.5


def pluck(m: float, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi_hz(m)
    x = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + np.sin(2 * np.pi * f * t)
    x = lp(x * np.exp(-t / 0.18), 900 + 1400 * np.exp(-t / 0.05).mean())
    return x * np.minimum(1, (n - np.arange(n)) / (0.01 * SR))


def saw_pad(notes: list[float], dur: float, drive: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for m in notes:
        for det in (-0.12, 0.0, 0.11):  # three detuned saws per note
            f = midi_hz(m + det)
            ph = rng.random()
            x += 2 * ((f * t + ph) % 1.0) - 1
    x /= len(notes) * 3
    x = lp(x, 2600)
    x = np.tanh(drive * x) / np.tanh(drive)
    attack = np.minimum(1, t / 0.02)
    release = np.minimum(1, (dur - t) / 0.04)
    return x * attack * release


def sub(m: float, dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * midi_hz(m) * t)
    return np.tanh(1.3 * x) * np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.05)


def swell(dur: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 600) * (t / dur) ** 3
    return x * 0.7


# ---------------------------------------------------------------- arrangement
# D minor. Ostinato on the tick, chords for the drop: Dm – Bb – Gm – A (two bars = 8 beats each).
OSTINATO = [(0, 38), (1.5, 38), (2.5, 41), (3.0, 40), (4, 38), (5.5, 38), (6.5, 45), (7.0, 44)]
CHORDS = [[50, 53, 57, 62], [46, 50, 53, 58], [43, 50, 55, 58], [45, 49, 52, 57]]
ROOTS = [26, 22, 19, 21]


def make_music() -> tuple[np.ndarray, list[float]]:
    total = tb(END_BEAT) + TAIL
    buf = np.zeros((int(total * SR) + 1, 2))
    k, c = kick(), clap()

    # the tick: beats 0–32
    for bar in range(DROP // 8):
        b0 = bar * 8
        for off in (0, 2.75, 3.5, 4, 6.75):
            if b0 + off < DROP - 0.5:
                add(buf, k, tb(b0 + off), 0.95 if off in (0, 4) else 0.7)
        for off in (2, 6):
            add(buf, c, tb(b0 + off), 0.55, 0.1)
        for e in range(16):
            if b0 + e / 2 < DROP - 0.5:
                add(buf, tick(e % 2 == 0), tb(b0 + e / 2), 0.32 if e % 2 == 0 else 0.2, -0.35 if e % 2 else 0.35)
        if bar >= 1:
            for off, m in OSTINATO:
                add(buf, pluck(m, 0.45), tb(b0 + off), 0.42, -0.15)
                add(buf, pluck(m + 12, 0.3), tb(b0 + off), 0.12, 0.3)
    # reverse swell into the drop, then half a beat of silence
    add(buf, swell(BEAT * 1.5), tb(DROP - 2), 0.18)

    # the drop: beats 32–88
    for i, b0 in enumerate(range(DROP, END_BEAT, 8)):
        chord, root = CHORDS[i % 4], ROOTS[i % 4]
        dur = 8 * BEAT + 0.05
        pad = saw_pad(chord, dur, 2.4)
        add(buf, pad, tb(b0), 0.5, -0.25)
        add(buf, saw_pad([m + 12 for m in chord[1:]], dur, 1.6), tb(b0), 0.22, 0.3)
        add(buf, sub(root + 12, dur), tb(b0), 0.55)
        for off in range(0, 8, 2):
            add(buf, k, tb(b0 + off), 1.0)
        for off in (3, 7):
            add(buf, c, tb(b0 + off), 0.45, -0.1)
        for e in range(16):
            add(buf, tick(True), tb(b0 + e / 2), 0.14, 0.4 if e % 2 else -0.4)
    # ring-out: the last chord and a kick
    ring = saw_pad(CHORDS[0], TAIL, 2.0) * np.exp(-np.arange(int(TAIL * SR)) / SR / 0.7)
    add(buf, ring, tb(END_BEAT), 0.5)
    add(buf, k, tb(END_BEAT), 1.0)

    # room: a short stereo slap for glue
    d = int(0.023 * SR)
    wet = np.zeros_like(buf)
    wet[d:, 0] = buf[:-d, 1] * 0.18
    wet[d * 2:, 1] = buf[:-d * 2, 0] * 0.18
    buf = buf + wet
    beats = [round(tb(b), 4) for b in range(END_BEAT + 1)]
    return buf, beats


def write_ogg(x: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    peak = np.abs(x).max()
    if peak > 0.98:
        x = x * 0.98 / peak
    with tempfile.NamedTemporaryFile(suffix=".f32", delete=False) as f:
        f.write(x.astype(np.float32).tobytes())
        raw = f.name
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", raw,
                    "-c:a", "libvorbis", "-q:a", "6", "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", str(path)], check=True)
    Path(raw).unlink()


def main() -> None:
    music, beats = make_music()
    rms = np.sqrt((music[int(tb(0) * SR):int(tb(END_BEAT) * SR)] ** 2).mean())
    music = np.tanh(music * (10 ** (-13 / 20) / max(rms, 1e-9)) * 1.1) / 1.1
    out = ROOT / "public" / "music" / "tableau-tick.ogg"
    write_ogg(music, out)
    out.with_suffix(".beats.json").write_text(json.dumps({"source": out.name, "duration": round(len(music) / SR, 3), "bpm": BPM, "tempoFolded": False, "meter": 4, "beats": beats}) + "\n")
    print(json.dumps({"music": str(out), "seconds": round(len(music) / SR, 1), "beats": len(beats)}))


if __name__ == "__main__":
    main()
