#!/usr/bin/env python3
"""Synthesize the Showtime template's music and sound effects from code (original, no samples).

    python3 scripts/make-showtime-audio.py

Writes public/music/showtime-party.ogg (+ .beats.json) and public/sfx/showtime/*.ogg. Everything
is generated here, so the audio ships with the template under the kit's own license. The track is
128 BPM with beat 0 at 0.5 s; its sections follow the template's plan (src/templates/showtime/plan.ts):
the TV-signal intro, the festive groove for the host's lines, the countdown hits, the fanfare for
the groom and bride (with the music cut out for the record-scratch gags), a softer groove for the
wedding photos and the closing chorus. Deterministic: the same script gives the same files.
"""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
BPM = 128.0
BEAT = 60.0 / BPM
T0 = 0.5
END_BEAT = 356
ROOT = Path(__file__).resolve().parent.parent
rng = np.random.default_rng(20261018)


def tb(beat: float) -> float:
    return T0 + beat * BEAT


def midi_hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n: int, a: float, d: float, s: float = 0.0, r: float = 0.0) -> np.ndarray:
    """attack, decay to sustain s, release over the last r seconds (all seconds)."""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    if r > 0:
        rel = np.clip((n / SR - t) / r, 0, 1)
        e = e * rel
    return e


def lp(x, hz, order=2):
    return sosfilt(butter(order, min(hz, SR / 2 - 100) / (SR / 2), "low", output="sos"), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz / (SR / 2), "high", output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo / (SR / 2), hi / (SR / 2)], "band", output="sos"), x)


def saw(f, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((f * t + phase) % 1.0) - 1


def square(f, n, duty=0.5):
    t = np.arange(n) / SR
    return np.where((f * t) % 1.0 < duty, 1.0, -1.0)


def sine(f, n, phase=0.0):
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t + phase)


class Bus:
    def __init__(self, seconds: float):
        self.n = int(seconds * SR)
        self.L = np.zeros(self.n)
        self.R = np.zeros(self.n)

    def add(self, x, at: float, gain=1.0, pan=0.0):
        i = int(at * SR)
        if i >= self.n:
            return
        x = x[: self.n - i]
        if x.ndim == 2:
            self.L[i:i + len(x)] += gain * x[:, 0]
            self.R[i:i + len(x)] += gain * x[:, 1]
            return
        lg, rg = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.L[i:i + len(x)] += gain * lg * x * 1.414
        self.R[i:i + len(x)] += gain * rg * x * 1.414

    def stereo(self):
        return np.stack([self.L, self.R], axis=1)


# ---------------------------------------------------------------- instruments
def kick(soft=False):
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / (0.22 if not soft else 0.16))
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.004) * 0.35
    return np.tanh(1.6 * (body + click)) * (0.75 if soft else 1.0)


def clap():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 900, 5200)
    e = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022]):
        e += np.where(t >= off, np.exp(-(t - off) / (0.006 if k < 2 else 0.11)), 0)
    return noise * e * 0.55


def snare(gain=1.0):
    n = int(0.24 * SR)
    t = np.arange(n) / SR
    tone = sine(190, n) * np.exp(-t / 0.05) * 0.5
    noise = hp(rng.standard_normal(n), 1800) * np.exp(-t / 0.09)
    return (tone + noise) * 0.5 * gain


def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 7000, 4)
    return x * np.exp(-t / (0.08 if open_ else 0.014)) * 0.32


def crash(seconds=2.4):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 4500, 2)
    return x * np.exp(-t / 0.9) * 0.4


def supersaw(m, seconds, cutoff=3200, voices=7, detune=0.18):
    n = int(seconds * SR)
    f = midi_hz(m)
    xs = []
    for v in range(voices):
        cents = (v - (voices - 1) / 2) * detune / ((voices - 1) / 2)
        xs.append(saw(f * 2 ** (cents / 12), n, rng.random()))
    L = lp(sum(xs[::2]), cutoff)
    R = lp(sum(xs[1::2]), cutoff)
    return np.stack([L, R], axis=1) / voices


def stab(chord, seconds=0.22, cutoff=3800):
    x = sum(supersaw(m, seconds, cutoff) for m in chord) / len(chord)
    return x * env(len(x), 0.004, 0.09, 0.15, 0.04)[:, None] * 1.4


def pad(chord, seconds, cutoff=1800):
    x = sum(supersaw(m, seconds, cutoff, voices=5, detune=0.12) for m in chord) / len(chord)
    return x * env(len(x), 0.25, 1.5, 0.75, 0.4)[:, None]


def bass(m, seconds):
    n = int(seconds * SR)
    f = midi_hz(m)
    x = 0.65 * saw(f, n) + 0.35 * sine(f / 2, n)
    return np.tanh(1.4 * lp(x, 420)) * env(n, 0.004, 0.18, 0.55, 0.03) * 0.8


def pluck(m, seconds, bright=5200):
    n = int(seconds * SR)
    f = midi_hz(m)
    x = 0.6 * square(f, n, 0.3) + 0.4 * saw(f * 2.0, n)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * np.arange(n) / SR)
    x = lp(x * vib, bright)
    return x * env(n, 0.006, 0.16, 0.25, 0.05) * 0.5


def bell(m, seconds=1.2):
    n = int(seconds * SR)
    f = midi_hz(m)
    x = sine(f, n) + 0.5 * sine(f * 2.76, n) + 0.25 * sine(f * 5.4, n)
    return x * env(n, 0.002, 0.45) * 0.35


def piano(m, seconds=1.6):
    n = int(seconds * SR)
    f = midi_hz(m)
    t = np.arange(n) / SR
    x = sum((0.6 ** k) * sine(f * (k + 1) * (1 + 0.0007 * k), n) * np.exp(-t * (1.6 + 1.3 * k)) for k in range(6))
    return x * env(n, 0.003, 9.0) * 0.42


def brass(chord, seconds):
    x = sum(supersaw(m, seconds, 2400, voices=3, detune=0.06) for m in chord) / len(chord)
    n = len(x)
    e = env(n, 0.02, 0.25, 0.6, 0.06)
    return lp(x[:, 0] * e, 2600)[:, None].repeat(2, 1) * 1.6


def riser(seconds):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    steps = 24
    for k in range(steps):
        a, b = k * n // steps, (k + 1) * n // steps
        cut = 400 + (9000 - 400) * (k / steps) ** 2
        out[a:b] = hp(noise[a:b], cut)
    pitch = 200 + 1400 * (t / seconds) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * 0.15
    return (out * 0.35 + tone) * (t / seconds) ** 1.5


def boom():
    n = int(1.8 * SR)
    t = np.arange(n) / SR
    f = 32 + 70 * np.exp(-t / 0.08)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7)
    return np.tanh(2 * x) * 0.9


def reverb(st, seconds=1.6, mix=0.18):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = []
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / (seconds / 5))
        ir = lp(ir, 6000)
        ir /= np.sqrt((ir ** 2).sum())
        wet = np.fft.irfft(np.fft.rfft(st[:, ch], len(st) + n) * np.fft.rfft(ir, len(st) + n))[: len(st)]
        out.append(st[:, ch] * (1 - mix) + wet * mix * 3)
    return np.stack(out, axis=1)


# ---------------------------------------------------------------- harmony and melody (C major, pentatonic lead)
PROG = [[60, 64, 67], [55, 59, 62, 67], [57, 60, 64], [53, 57, 60, 65]]  # C  G  Am  F
BASS = [36, 43, 45, 41]
# eighth-note lead over the 4-bar loop: (step in eighths, length in eighths, midi)
LEAD_A = [
    (0, 1, 76), (1, 1, 79), (2, 2, 81), (4, 1, 79), (5, 1, 76), (6, 2, 74),
    (8, 1, 74), (9, 1, 76), (10, 2, 79), (12, 1, 76), (13, 1, 74), (14, 2, 72),
    (16, 1, 72), (17, 1, 74), (18, 1, 76), (19, 1, 79), (20, 2, 81), (22, 2, 79),
    (24, 2, 77), (26, 1, 76), (27, 1, 74), (28, 4, 72),
]
LEAD_B = [  # fanfare answer for the groom / bride introductions
    (0, 2, 79), (2, 1, 79), (3, 1, 81), (4, 4, 84),
    (8, 2, 83), (10, 1, 81), (11, 1, 79), (12, 4, 79),
    (16, 2, 81), (18, 1, 79), (19, 1, 76), (20, 4, 79),
    (24, 2, 77), (26, 2, 76), (28, 4, 74),
]
LEAD_SOFT = [
    (0, 3, 76), (3, 1, 74), (4, 4, 72), (8, 3, 74), (11, 1, 76), (12, 4, 79),
    (16, 3, 81), (19, 1, 79), (20, 4, 76), (24, 3, 77), (27, 1, 76), (28, 4, 74),
]


def section_groove(bus: Bus, b0: int, b1: int, style: str, lead=None, mute: list[tuple[int, int]] = ()):
    """Lay drums, bass, chords and an optional lead from beat b0 to b1 (exclusive)."""
    def muted(b):
        return any(a <= b < z for a, z in mute)

    for b in range(b0, b1):
        if muted(b):
            continue
        t = tb(b)
        bar = (b - b0) // 4
        chord_i = bar % 4
        beat_in_bar = (b - b0) % 4
        if style in ("party", "fanfare", "finale"):
            bus.add(kick(), t, 0.95)
            if beat_in_bar in (1, 3):
                bus.add(clap(), t, 0.8, 0.05)
            bus.add(hat(True), t + BEAT / 2, 0.55, 0.3)
            bus.add(hat(), t, 0.35, -0.3)
            bus.add(hat(), t + BEAT * 0.75, 0.25, -0.3)
            # off-beat bass pump
            bus.add(bass(BASS[chord_i], BEAT * 0.45), t + BEAT / 2, 0.9)
            bus.add(bass(BASS[chord_i] + (12 if beat_in_bar == 3 else 0), BEAT * 0.3), t, 0.35)
            # chord stabs on the and of each beat
            bus.add(stab(PROG[chord_i], 0.2), t + BEAT / 2, 0.42 if style != "fanfare" else 0.3)
        elif style == "soft":
            if beat_in_bar in (0, 2):
                bus.add(kick(soft=True), t, 0.6)
            if beat_in_bar == 2:
                bus.add(clap(), t, 0.45)
            bus.add(hat(), t + BEAT / 2, 0.22, 0.2)
            if beat_in_bar == 0:
                bus.add(bass(BASS[chord_i], BEAT * 1.8), t, 0.7)
                bus.add(bass(BASS[chord_i] + 7, BEAT * 0.9), t + BEAT * 2.5, 0.45)
            # piano arpeggio
            notes = PROG[chord_i] + [PROG[chord_i][0] + 12]
            for k in range(2):
                m = notes[(beat_in_bar * 2 + k) % len(notes)] + 12
                bus.add(piano(m, 1.4), t + k * BEAT / 2, 0.32, -0.25 + 0.5 * k)
        elif style == "build":
            bus.add(kick(), t, 0.85)
            bus.add(snare(0.4 + 0.6 * (b - b0) / max(1, b1 - b0)), t, 0.8)
            bus.add(snare(0.3 + 0.6 * (b - b0) / max(1, b1 - b0)), t + BEAT / 2, 0.7)
            bus.add(bass(BASS[0], BEAT * 0.4), t + BEAT / 2, 0.6)
        if beat_in_bar == 0 and style in ("party", "fanfare", "finale", "soft"):
            p = pad(PROG[chord_i], BEAT * 4, 1400 if style == "soft" else 1800)
            bus.add(p, t, 0.32 if style != "soft" else 0.42)
            if style == "fanfare":
                bus.add(brass([m + 12 for m in PROG[chord_i][:3]], BEAT * 0.9), t, 0.38)
                bus.add(brass([m + 12 for m in PROG[chord_i][:3]], BEAT * 0.9), t + BEAT * 2.5, 0.3)
    if lead:
        loop = 32  # eighths in four bars
        for start in range(b0, b1, 16):
            for step, length, m in lead:
                b = start + step / 2
                if b >= b1 or muted(int(b)):
                    continue
                inst = piano(m, length * BEAT / 2 + 0.6) * 0.9 if style == "soft" else pluck(m, length * BEAT / 2 + 0.05)
                bus.add(inst, tb(b), 0.33 if style != "soft" else 0.36, 0.1)
            _ = loop


def make_music() -> tuple[np.ndarray, list[float]]:
    seconds = tb(END_BEAT) + 3.0
    bus = Bus(seconds)
    # 0–8  TV static; 8–16  colour bars with the 1 kHz test tone; 16–24 channel jingle; 24–32 riser
    n = int(tb(8) * SR)
    static = bp(rng.standard_normal(n), 300, 9000) * 0.12
    static *= 0.7 + 0.3 * np.sin(2 * np.pi * 0.7 * np.arange(n) / SR)
    bus.add(static, 0, 1.0)
    n = int((tb(16) - tb(8)) * SR)
    tone = sine(1000, n) * 0.16 * env(n, 0.01, 99, 1, 0.02)
    bus.add(tone, tb(8), 1.0)
    for k, m in enumerate([72, 76, 79, 84, 79, 84, 88, 91]):
        bus.add(bell(m, 1.0), tb(16 + k), 0.9, -0.4 + 0.1 * k)
    bus.add(pad(PROG[0], BEAT * 8, 1600), tb(16), 0.4)
    bus.add(riser(tb(32) - tb(24)), tb(24), 0.9)
    for k in range(16):
        bus.add(snare(0.3 + 0.7 * k / 15), tb(24 + k / 2), 0.55)
    bus.add(boom(), tb(32), 0.9)
    bus.add(crash(), tb(32), 0.8)

    # 32–116  the host's lines: festive groove, lead from 56
    section_groove(bus, 32, 56, "party")
    section_groove(bus, 56, 116, "party", LEAD_A)
    for b in (56, 84, 104):
        bus.add(crash(), tb(b), 0.55)
    # 116–160  countdown: filter build, big hits on 3 / 2 / 1, two-beat hits between
    section_groove(bus, 116, 120, "build")
    for b in (120, 124, 144):
        bus.add(boom(), tb(b), 1.0)
        bus.add(crash(), tb(b), 0.7)
        bus.add(stab([48, 55, 60, 64], 0.6, 2500), tb(b), 0.6)
    section_groove(bus, 128, 144, "build")
    for b in range(128, 144, 2):
        bus.add(stab(PROG[(b // 2) % 4], 0.25), tb(b), 0.45)
    section_groove(bus, 148, 160, "party", LEAD_A)
    bus.add(crash(), tb(148), 0.6)

    # 160–200  the groom: fanfare; drumroll 172–176; record scratch stops the music 180–184
    section_groove(bus, 160, 172, "fanfare", LEAD_B)
    section_groove(bus, 176, 180, "fanfare")
    section_groove(bus, 184, 200, "fanfare", LEAD_B)
    for b in (160, 176, 184):
        bus.add(crash(), tb(b), 0.6)
    bus.add(boom(), tb(184), 0.8)
    # 200–240  the bride: same fanfare; drumroll 216–220; music drops to a music box 220–228
    section_groove(bus, 200, 216, "fanfare", LEAD_B)
    for k, m in enumerate([84, 88, 91, 88, 84, 88, 91, 96, 91, 88, 84, 79, 84, 88, 91, 96]):
        bus.add(bell(m, 0.9), tb(220 + k / 2), 0.7, 0.2)
    section_groove(bus, 228, 240, "fanfare", LEAD_B)
    for b in (200, 228):
        bus.add(crash(), tb(b), 0.6)
    bus.add(boom(), tb(228), 0.7)

    # 240–248 breakdown into the photos
    bus.add(pad(PROG[3], BEAT * 4, 1200), tb(240), 0.5)
    bus.add(pad(PROG[1], BEAT * 4, 1400), tb(244), 0.5)
    bus.add(riser(BEAT * 8), tb(240), 0.6)
    # 248–324 wedding photos: soft groove with piano and a gentle lead
    section_groove(bus, 248, 324, "soft", LEAD_SOFT)
    bus.add(crash(3.5), tb(248), 0.45)
    for k, m in enumerate([84, 88, 91, 96]):
        bus.add(bell(m, 1.4), tb(272 + k / 2), 0.7)
    # 324–352 finale chorus, then a held chord and bell to the end
    section_groove(bus, 324, 348, "finale", LEAD_A)
    bus.add(crash(3.0), tb(324), 0.65)
    last = pad([48, 60, 64, 67, 72], seconds - tb(348) - 0.2, 2200)
    bus.add(last, tb(348), 0.7)
    bus.add(boom(), tb(348), 0.7)
    for m in (72, 76, 79, 84):
        bus.add(bell(m, 3.0), tb(348), 0.6)

    st = bus.stereo()
    # sidechain: duck everything a little under each kick in the groove sections
    duck = np.ones(len(st))
    for b in list(range(32, 116)) + list(range(148, 172)) + list(range(176, 180)) + list(range(184, 216)) + list(range(228, 240)) + list(range(324, 348)):
        i = int(tb(b) * SR)
        k = int(0.18 * SR)
        if i + k < len(duck):
            duck[i:i + k] = np.minimum(duck[i:i + k], 1 - 0.35 * np.exp(-np.arange(k) / (0.06 * SR)))
    st = st * duck[:, None]
    st = reverb(st, 1.8, 0.16)
    st = np.tanh(st * 1.3) / np.tanh(1.3)
    beats = [round(tb(b), 4) for b in range(0, END_BEAT + 1)]
    return st, beats


# ---------------------------------------------------------------- sound effects
def sfx_all() -> dict[str, np.ndarray]:
    out = {}
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = 900 * np.exp(-t / 0.03) + 300
    out["pop"] = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03) * 0.8
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    w = rng.standard_normal(n)
    out["whoosh"] = np.concatenate([bp(w[a:a + n // 20], 300 + 3000 * (k / 20), 900 + 4000 * (k / 20)) for k, a in enumerate(range(0, n, n // 20))])[:n] * np.sin(np.pi * t / 0.6) ** 2 * 0.8
    out["ding"] = bell(91, 1.5) * 1.6
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    click = hp(rng.standard_normal(n), 2000)
    out["shutter"] = click * (np.exp(-t / 0.01) + 0.7 * np.where(t > 0.09, np.exp(-(t - 0.09) / 0.02), 0)) * 0.7
    # record scratch: a noisy tone sweeping down and up fast
    n = int(0.55 * SR)
    t = np.arange(n) / SR
    f = 600 + 1800 * np.abs(np.sin(2 * np.pi * 2.6 * t)) * np.exp(-t / 0.3)
    tone = saw(1, n) * 0
    ph = np.cumsum(f) / SR
    tone = (2 * (ph % 1) - 1) * 0.5 + bp(rng.standard_normal(n), 800, 4000) * 0.4
    out["scratch"] = lp(tone, 5000) * np.exp(-t / 0.35) * 0.9
    # tape rewind: chirps speeding up
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    f = 300 + 2400 * (t / 1.6) ** 2
    out["rewind"] = (np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * (8 + 30 * t) * t)) + bp(rng.standard_normal(n), 1500, 6000) * 0.3) * 0.35 * np.minimum(1, (1.6 - t) / 0.1)
    # drum roll, 1.9 s, crescendo
    n = int(1.9 * SR)
    roll = np.zeros(n)
    k = 0.0
    while k < 1.8:
        s = snare(0.4 + 0.6 * k / 1.8)
        i = int(k * SR)
        roll[i:i + len(s)] += s[: n - i]
        k += 0.045
    out["drumroll"] = roll * 0.8
    out["boom"] = boom()
    # applause: many tiny claps
    n = int(2.8 * SR)
    ap = np.zeros(n)
    for _ in range(900):
        i = int(rng.random() * (n - 0.03 * SR))
        c = bp(rng.standard_normal(int(0.03 * SR)), 900, 6000) * np.exp(-np.arange(int(0.03 * SR)) / (0.006 * SR))
        ap[i:i + len(c)] += c * (0.2 + 0.8 * rng.random())
    t = np.arange(n) / SR
    out["applause"] = ap * np.minimum(1, t / 0.25) * np.minimum(1, (2.8 - t) / 0.8) * 0.35
    # boing: a springy pitch bend
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    f = 180 + 120 * np.sin(2 * np.pi * 9 * t) * np.exp(-t / 0.25) + 160 * t
    out["boing"] = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.3) * 0.7
    # sparkle: a run of high bells
    sp = np.zeros(int(1.4 * SR))
    for k, m in enumerate([96, 100, 103, 108, 103, 108, 112]):
        b = bell(m, 0.8)
        i = int(k * 0.06 * SR)
        sp[i:i + len(b)] += b[: len(sp) - i] * 0.7
    out["sparkle"] = sp
    # cartoon dizzy (descending wobble) for the drunk groom
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    f = 700 - 300 * t + 60 * np.sin(2 * np.pi * 6 * t)
    out["dizzy"] = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4 * np.exp(-t / 0.9)
    return out


def write_ogg(x: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
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
    # loudness: aim for an integrated level around -14 LUFS (approximated by RMS over the groove)
    rms = np.sqrt((music[int(tb(32) * SR):int(tb(116) * SR)] ** 2).mean())
    music = music * (10 ** (-11.5 / 20) / max(rms, 1e-9))
    out = ROOT / "public" / "music" / "showtime-party.ogg"
    write_ogg(music, out)
    (out.with_suffix(".beats.json")).write_text(json.dumps({"source": out.name, "duration": round(len(music) / SR, 3), "bpm": BPM, "tempoFolded": False, "meter": 4, "beats": beats}) + "\n")
    for name, x in sfx_all().items():
        write_ogg(x, ROOT / "public" / "sfx" / "showtime" / f"{name}.ogg")
    print(json.dumps({"music": str(out), "seconds": round(len(music) / SR, 1), "beats": len(beats), "sfx": sorted(sfx_all().keys())}))


if __name__ == "__main__":
    main()
