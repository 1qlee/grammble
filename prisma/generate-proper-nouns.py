#!/usr/bin/env python3
"""Precompute the set of guess-list words that are NOT clean common vocabulary.

A "clean" word is a genuinely recognizable common English word. The gram scorer
(generate-gram-scores.ts) measures a gram's quality by how many clean words
contain it, so proper nouns (SYDNEY, RODNEY) and other non-dictionary tokens must
be removed first -- otherwise a gram like DN scrapes past the supply floor on the
strength of names (SYDNEY, SIDNEY, RODNEY) while only KIDNEY / KIDNAP are real
vocabulary.

A word is flagged (excluded) when it is a known first name (nltk `names` corpus)
AND it is absent from the curated answer pools. The name corpus is the dominant
contaminant here (SYDNEY, RODNEY, SIDNEY are all names); the answer-pool rescue
prevents common nouns that happen to also be names (FOREST, CHANCE, PRINCE,
SHADOW) from being wrongly stripped -- a real proper noun is never an answer.

Note: this catches first-name proper nouns, not place names / brands that are not
also first names. First names dominate the false-supply problem in practice.

Only words at or above the scorer's frequency floor are written; rare words are
already dropped by the frequency threshold, so listing them here is noise.

    pip install nltk
    python3 -c "import nltk; nltk.download('names')"
    python3 prisma/generate-proper-nouns.py

Output: scripts/proper-nouns.json  ->  ["SYDNEY", "RODNEY", ...]  (sorted, upper)
Regenerate whenever the guess lists change, then re-run generate-gram-scores.ts.
"""

import json
import os

from nltk.corpus import names

# Must match FREQ_THRESHOLD in generate-gram-scores.ts. Words below it are dropped
# by the scorer regardless, so there is no reason to list them here.
FREQ_THRESHOLD = 3.3

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUESS_FILES = [
    os.path.join(ROOT, "src/assets/six-guess-list.json"),
    os.path.join(ROOT, "src/assets/seven-guess-list.json"),
    os.path.join(ROOT, "src/assets/eight-guess-list.json"),
]
ANSWER_FILES = [
    os.path.join(ROOT, "scripts/final-6-word-list.json"),
    os.path.join(ROOT, "scripts/final-7-word-list.json"),
    os.path.join(ROOT, "scripts/final-8-word-list.json"),
]
FREQ_FILE = os.path.join(ROOT, "scripts/word-frequencies.json")
OUT = os.path.join(ROOT, "scripts/proper-nouns.json")

name_set = set(n.upper() for n in names.words())
freq = json.load(open(FREQ_FILE))

answer_words = set()
for path in ANSWER_FILES:
    with open(path) as f:
        for w in json.load(f):
            answer_words.add(w.upper())


def is_proper(word: str) -> bool:
    # A first name that is never a curated answer -> a genuine proper noun.
    return word in name_set and word not in answer_words


guess_words = set()
for path in GUESS_FILES:
    with open(path) as f:
        for w in json.load(f):
            guess_words.add(w.upper())

flagged = sorted(
    w
    for w in guess_words
    if freq.get(w, 0) >= FREQ_THRESHOLD and is_proper(w)
)

with open(OUT, "w") as f:
    json.dump(flagged, f)

print(f"Wrote {len(flagged)} excluded proper/non-dictionary words to {OUT}")
