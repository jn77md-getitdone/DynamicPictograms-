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
| **Start by talking** | Tap the big 🎤 and say what will happen today. When you stop talking, the list of pictograms is made. You can also type. |
| **Suggestions for every step** | Each step shows a strip of pictures to choose from: pictures **chosen before**, up to **2 library pictures** (built-in plus an ARASAAC action pictogram), and **3 new AI drawings** made for that activity. Tap one to use it. |
| **AI-drawn pictograms** | With an Anthropic API key, Claude draws new pictograms (SVG) in one fixed house style: flat colours, bold outlines, a simple figure. Generated pictures therefore look like one set. You can also describe a picture yourself (“girl in a wheelchair at the pool”) in the picker's ✨ AI draw tab. Set your country in Settings so food, schools and buses look familiar. |
| **It learns** | When a plan is used, each picture in it counts as chosen. Next time the favourite picture is preselected. Once the same picture has been chosen twice in a row, the activity is “settled”: it's used automatically, and no new AI drawings are requested for it. Earlier drawings are cached and reused, so the app gets faster and cheaper over time. |
| **Offline planner** | Without AI it still works offline: it understands "then", commas, "before"/"after", times ("at 8", "7pm", "noon") and "bath and bed". |
| **Broad library** | About 200 built-in pictograms. They include European and Nordic food (rye bread, porridge, meatballs, pastries…), clubs and sports (handball, scouts, gymnastics…), weather clothes, aids (hearing aid, wheelchair), calming activities and feelings. Danish words such as *rugbrød*, *SFO* and *madpakke* are understood. |
| **Your own pictograms** | Take a photo of the real thing, search ARASAAC online, use an emoji, or let AI draw one. Add words that should find it (“stable” → *Horse club*). |
| **Routines** | Save lists you use again (“School morning”). Use one for today in one tap, or add it to a plan. |
| **Edit everything** | Change the order (▲▼), pictures, words, times and what is said aloud. |
| **Person mode** | 👀 shows a simple view with no editing: tap a picture to hear it, tap ✓ when it's done. To get back to helper mode, hold the 🔒 for 2 seconds. |
| **Private & offline** | Everything, including what the app has learned, is stored on the device. It can be installed to the home screen and works without internet. Backups can be exported and imported. |

### About AI pictures and cost

Claude draws pictograms as vector graphics (SVG), not photos or paintings. That suits simple, clear pictograms, and they stay sharp at any size. Each plan uses one request to make the list, plus one request per *new* activity to draw 3 pictures. Activities that are settled, or drawn before, cost nothing. You can pick the model in Settings: Opus 5.5 (best drawings), Sonnet 5.5 (faster) or Haiku 5.5 (cheapest).

## Two ways to open it

- **Inside Claude (easiest):** the app is published as a private Claude artifact. There, the AI (questions, plans, drawings, photo → cartoon) runs on your own Claude login, with no API key. Claude asks once for permission. Inside Claude the browser blocks the microphone, so you dictate with the 🎤 key on the iPad/iPhone keyboard. Rebuild the artifact page with `node scripts/build-artifact.mjs`.
- **As a normal web page / home-screen app** (GitHub Pages or any HTTPS host): works offline, and uses built-in dictation where the browser supports it. The AI needs an Anthropic API key in Settings.

## Setup: your own photos

**Pictograms → 📷 Set up with your own photos** (offered on first use) goes through about 40 everyday things and places: the car, the dining table, their bed, the toilet, a typical breakfast, the lunch box, school, the playground, Mum, Dad, Grandma, their toothbrush, shoes, school bag… For each one you take a photo, or skip it. You can use the photo as it is, or let the AI turn it into a cartoon pictogram. From then on that picture is used everywhere: in the live preview, in new plans and in suggestions. You can also add your own, such as "Horse club".

## The day view

The **NOW** card is always the big card at the top. Below it are **Next** and the rest of the day (**Later**). Tapping **✓ Done** moves the step to a small **✓ Done** row at the bottom, the next step takes its place, and an **Undo** button appears for a few seconds. In helper mode, tap a done picture to mark it as not done.

## How a plan is made

1. **Talk.** Say (or type) what will happen. Pictograms appear live as you speak ("I hear: …").
2. **Questions.** The AI asks up to 4 short clarifying questions, but only where the answer changes the pictures or the order (what's in the lunch box, how you travel, who is there). Tap an answer or type your own. You can skip this step.
3. **Pictograms.** You get the steps in order, each with picture suggestions. You can move steps, change words, or take a 📷 photo of the real thing and turn it into a cartoon pictogram. Then **Use for today** or **Save as routine**.

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
js/ai.js                  optional Claude planner + pictogram drawing (Anthropic SDK, your own API key)
js/memory.js              learning: which picture is chosen for which activity
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
