# Brain-teaser game: puzzle engine plan

Status: planning, no code yet. The game will live in a **new repository**; this plan moves there.

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

## Audiences (one engine, several profiles)
Adults first, children second. The engine is shared; profiles change only presentation and parameters.
- **Visual themes:** a PuzzleSpec uses abstract tokens (shape A, colour 2, ...); the theme maps them to
  visuals. Adult = abstract figures (Mensa-like). Child = friendly images (animals, fruit, pictograms).
- **Difficulty start + range per age band:** adult, 12-16, 9-11, 6-8. Same generators, different parameter ranges.
- **Children:** shorter sessions, softer or optional timers, encouraging feedback, larger touch targets,
  read-aloud/pictogram instructions (can share assets with DynamicPictograms), no exam mode by default.
- **Privacy:** no child accounts at first; progress stored locally (GDPR, minors). Optional parent view later.

## Languages: Danish and English from day one
- The engine is language-neutral: PuzzleSpecs contain no text, only tokens and rule IDs.
- All UI text lives in translation files (`da.json`, `en.json`); no hard-coded strings.
- Explanations are built from rule metadata with templates per language
  (e.g. rule `progression(size,+1)` -> "Størrelsen vokser ét trin pr. felt" / "Size grows one step per cell").
- Language is chosen per profile; the default follows the device language.
- Verbal tasks need a separate word bank per language, calibrated per language (not translations).
- Read-aloud (child mode) uses the browser's speech synthesis for the selected language.

## Modes
- **Training:** adaptive, immediate feedback plus an explanation of the rule.
- **Exam simulation:** configurable item count, timer and option count (preset for Mensa DK once
  confirmed); no feedback until the end; score with a rough, clearly labelled estimate.
- Strategy practice: pacing, skip and return.

## Roadmap
1. Engine core + matrix generator (extended rules) + validator + property tests.
2. Explanations + simple training UI (Danish and English).
3. Exam-simulation mode + adaptive difficulty up to the top end.
4. Series completion, odd-one-out, figure analogies.
5. Child profile: theme, age bands, child-friendly UI.
6. WISC domains: digit/picture span, symbol search, coding, block patterns, mental rotation.
7. Verbal content (separate Danish and English word banks), accessibility, mobile.

## Open questions
- Confirm the Mensa Danmark test format (items, time, options).
- Name of the new repository (to attach it to the session).
