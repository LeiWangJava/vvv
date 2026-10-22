"""Reproducible original mechanical key taps; no recordings or third-party audio assets."""
from pathlib import Path
import math
import random
import struct
import wave

RATE = 48000
DURATION = 0.045
PEAK = 0.74
OUT = Path(__file__).resolve().parents[1] / "public" / "sfx"
OUT.mkdir(parents=True, exist_ok=True)

for variant in range(4):
    rng = random.Random(8675309 + variant)
    samples = []
    previous_noise = 0.0
    for index in range(round(RATE * DURATION)):
        t = index / RATE
        noise = rng.uniform(-1, 1)
        bright_noise = noise - 0.72 * previous_noise
        previous_noise = noise
        # A dry key impact and a lower wooden/mechanical body, one attack per tap.
        impact = 0.54 * bright_noise * math.exp(-t / 0.0017)
        body = 0.31 * math.sin(2 * math.pi * (1160 + variant * 91) * t + 0.65) * math.exp(-t / 0.0058)
        bottom = 0.15 * math.sin(2 * math.pi * (380 + variant * 23) * t + 0.9) * math.exp(-t / 0.0085)
        shell = 0.10 * math.sin(2 * math.pi * (2390 + variant * 127) * t) * math.exp(-t / 0.0038)
        # Bring the final 8ms to digital zero without truncating the short resonant tail.
        fade = min(1.0, max(0.0, (DURATION - t) / 0.008)) ** 2
        samples.append((impact + body + bottom + shell) * fade)
    gain = PEAK / max(abs(value) for value in samples)
    pcm = [round(value * gain * 32767) for value in samples]
    pcm[-1] = 0
    path = OUT / f"dvstory-key-{variant + 1}.wav"
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(struct.pack(f"<{len(pcm)}h", *pcm))
    rms = math.sqrt(sum((value / 32767) ** 2 for value in pcm) / len(pcm))
    print(f"{path.name}: {DURATION * 1000:.0f}ms, peak {20 * math.log10(PEAK):.1f}dBFS, RMS {20 * math.log10(rms):.1f}dBFS, end {pcm[-1]}")
