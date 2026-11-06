# Dynamic Pictograms

Visual schedules on a phone or tablet. They replace the laminated cards on a Velcro board, and they are quick to change when the day changes.

A helper (parent, carer, teacher) says or types what is going to happen, for example:

> Breakfast, brush teeth, then bus to school at 8. After school swimming with Grandma, dinner, bath and bed.

The app turns it into a list of pictograms in the right order. The person using the schedule can then:

- **tap a pictogram to hear it** read aloud ("Swimming with Grandma"),
- **tap ✓ when it is done.** The app gives praise and says what comes next,
- see what is happening **now** and **next**, either as the whole day or in a simpler Now/Next view.

## Features (stage 1)

| | |
|---|---|
| **Plan from a sentence** | Type it or dictate it with 🎤. This works offline on the device: it understands "then", commas, "before"/"after", times ("at 8", "7pm", "noon") and "bath and bed". |
| **Optional AI planner** | Claude can turn longer, free-form descriptions into steps. You need your own Anthropic API key (Settings → AI planner). |
| **Pictures that stay the same** | Every activity always gets the same picture, label and category colour, so the person learns to recognise it. When you change a picture (photo, emoji or online pictogram), the app can remember it, and that activity uses your picture from then on. |
| **Your own pictograms** | Take a photo of the real thing (their toothbrush, their school bus, Grandma), or search thousands of ARASAAC action pictograms online. Add words that should find it ("stable" → *Horse club*). |
| **Categories → groups → items** | The library is a tree (e.g. *Food & drink → Breakfast → Pancakes*), with colour-coded categories. |
| **Routines** | Save lists you use again ("School morning", "Swimming day"). Use one for today in one tap, or add it to a plan. |
| **Edit everything** | Change the order (▲▼), pictures, words, times and what is said aloud. |
| **Person mode** | 👀 shows a simple view with no editing. To get back to helper mode, hold the 🔒 for 2 seconds. |
| **Private & offline** | Everything is stored on the device. It can be installed to the home screen and works without internet. Backups can be exported and imported. |

## Running it

There is no build step. It is plain HTML, CSS and JavaScript modules.

```bash
npm start          # serves on http://localhost:8080  (or any static web server)
npm test           # parser unit tests (Node 18+)
```

To use it on an iPhone or iPad, host the folder on any HTTPS static host (GitHub Pages, Netlify, …). Open it in Safari, then tap Share → *Add to Home Screen*. The microphone and installing need HTTPS (or `localhost`).

## Project layout

```
index.html, styles.css    app shell and styling
js/app.js                 views: Today, Plan, Routines, Pictograms, Settings, picture picker
js/library.js             built-in pictogram library (category tree)
js/parser.js              offline "sentence → steps" planner
js/ai.js                  optional Claude planner (Anthropic SDK, your own API key)
js/speech.js              read aloud + dictation (browser speech engines)
js/arasaac.js             online ARASAAC pictogram search
js/store.js               on-device storage, backup/restore
sw.js, manifest.webmanifest   offline support and install to home screen
tests/                    unit tests
```

## Roadmap

- **Stage 2: the person designs their own pictograms.** Choose a category (Food), refine it (Breakfast), then choose the item (Pancakes), and reorder their own day. The library is already built as this category tree, and the picture picker already works this way, so this is mostly a simpler, very visual version of the picker for the person.
- Share plans between devices (e.g. home ↔ school).
- More languages for the offline planner (speech and ARASAAC search already support several).

## Credits

Built-in pictograms use the device's emoji. Online pictograms come from [ARASAAC](https://arasaac.org). They are by Sergio Palao, owned by the Government of Aragón (Spain), and licensed CC BY-NC-SA, which means free for non-commercial use.
