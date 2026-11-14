# Brain-teaser game: puzzle engine plan

Status: planning, no code yet.

## Goals
1. Train the cognitive domains measured by WISC-style tests (fluid reasoning, visual spatial,
   working memory, processing speed, verbal), without copying any test items.
2. Prepare for the **Mensa Danmark** admission test. Assumed to be a non-verbal figure/matrix test
   under strict time limits; the exact item count, time and options **must be confirmed with Mensa Danmark**.

Not goals: reporting an IQ, diagnosis, or using "WISC"/"Mensa" in branding.

## Engine architecture
seed + task type + difficulty -> Generator -> PuzzleSpec (pure JSON) -> Validator -> Renderer (SVG)
                                         ^                                            |
                                         +---- adaptive difficulty (Elo) <-- response + time

- Seeded random generation: reproducible, testable, supports "daily puzzle".
- PuzzleSpec contains stimulus, options, answer, the rules used (for explanations), difficulty params.
- Engine has no UI dependencies (TypeScript package). Frontend: React + SVG.
- The validator ensures exactly one correct answer and balanced distractors (I-RAVEN-style).

## Matrix generator (core)
- Attributes: shape, size, colour, count, position, rotation, layer.
- Rules: constant, progression, arithmetic, distribute-three, overlay (OR / AND / XOR / subtract),
  movement/rotation, counting.
- Difficulty = number of rules x attributes x layers x distractor closeness x option count (6-8).

## Modes
- **Training:** adaptive, immediate feedback plus an explanation of the rule.
- **Exam simulation:** configurable item count, timer and option count (preset for Mensa DK once
  confirmed); no feedback until the end; score with a rough, clearly labelled estimate.
- Strategy practice: pacing, skip and return.

## Roadmap
1. Engine core + matrix generator (extended rules) + validator + property tests.
2. Explanations + simple training UI (Danish first, i18n-ready).
3. Exam-simulation mode + adaptive difficulty up to the top end.
4. Series completion, odd-one-out, figure analogies.
5. WISC domains: digit/picture span, symbol search, coding, block patterns, mental rotation.
6. Verbal content (Danish word bank), accessibility, mobile.

## Open questions
- Confirm the Mensa Danmark test format (items, time, options).
- Audience: adult (Mensa), child (WISC ages 6-16), or both profiles?
- Same repo as DynamicPictograms, or a new repo?
