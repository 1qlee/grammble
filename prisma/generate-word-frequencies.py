#!/usr/bin/env python3
"""Precompute a Zipf word-frequency lookup for every guess word.

Run this whenever the guess lists change, then run generate-gram-scores.ts which
consumes the output. Kept separate (and in Python) because the `wordfreq` package
is the frequency source; the gram scorer stays dependency-free and just reads the
JSON this writes.

    pip install wordfreq
    python3 prisma/generate-word-frequencies.py

Output: scripts/word-frequencies.json  ->  { "WORD": zipf, ... }
Zipf scale (0-8): ~7 = "the", ~5 = "house", ~4 = "salmon", ~3 = uncommon,
< 2.5 = rare. generate-gram-scores.ts treats words below its FREQ_THRESHOLD, and
regular plurals, as non-viable guesses.
"""

import json
import os

from wordfreq import zipf_frequency

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUESS_FILES = [
    os.path.join(ROOT, "src/assets/six-guess-list.json"),
    os.path.join(ROOT, "src/assets/seven-guess-list.json"),
    os.path.join(ROOT, "src/assets/eight-guess-list.json"),
]
OUT = os.path.join(ROOT, "scripts/word-frequencies.json")

words = set()
for path in GUESS_FILES:
    with open(path) as f:
        for w in json.load(f):
            words.add(w.upper())

freq = {w: round(zipf_frequency(w.lower(), "en"), 2) for w in sorted(words)}

with open(OUT, "w") as f:
    json.dump(freq, f)

print(f"Wrote {len(freq)} word frequencies to {OUT}")
