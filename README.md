# BJJ Mind Map

A phone-first web app for organizing your Brazilian Jiu-Jitsu game. Add it to your iPhone home screen and it runs full-screen like a normal app, offline.

## Features

- **Library**: every move, grouped **by type** (positions, guards, grips, submissions, sweeps, passes, escapes, takedowns, transitions) or **by position** (each guard and position shows its grips, submissions, sweeps, passes and where it leads). Search covers names, notes, tags and clip titles. You can star favorites.
- **Paths (game plans)**: save ordered sequences such as *Standing → Guard Pull → Closed Guard → Hip Bump → Mount → Armbar*. Star one as your **main plan** and it stays at the top. When you add a step, the app suggests what flows from the previous step. **Show on map** traces the path in gold with numbered steps. Find them under **Library → Paths**.
- **Mind map**
  - **Web**: the whole game as a spider web. Tap a box and the moves that flow **in** light up blue, the moves that flow **out** light up orange, and everything else fades. Pinch to zoom, drag the background to pan, drag boxes to arrange them. Tap the selected box again to open its details.
  - **Flow**: a focused view with the chosen move in the middle, what flows into it above and what flows out of it below. Tap any box to follow the chain.
  - **Max**: follows every chain to the end. Everything that eventually leads into the move is shown above it and everything that can follow is shown below, as an indented tree. Each move appears once, so loops like armbar ⇄ triangle don't repeat.
- **Move details**: flows in and out (each connection has a **Why** note such as *they posture up*, shown on the map, and a **How** note for the details), notes, clips, and the course chapters that cover the move.
- **Clips**: paste a YouTube, BJJ Fanatics, Submeta or any other link, with an optional timestamp. YouTube clips play inside the app starting at the timestamp. BJJ Fanatics and Submeta don't allow embedding, so those open in their own site or app.
- **Journal**, in two sections:
  - **Lessons**: what you learned in class (date, school, coach, topic, notes), linked to the moves it covered.
  - **Rolling**: reflections after sparring, covering which school and who you rolled with, how it felt (1–5), what worked, where you struggled or got caught, and a focus for next time. Your latest focus stays pinned at the top.
  - Every move's detail screen lists the journal entries that mention it.
- **Courses**: track instructionals, split them into chapters with timestamps, tick chapters off and link each one to the moves it teaches.
- **Backup to iCloud**: one tap saves a backup file to iCloud Drive through the share sheet (always the same file name, so each backup replaces the last), and the app reminds you when you have changes that are not backed up yet (daily, every 3 days, weekly, or never).

## Put it on your iPhone

The app is a set of static files, so any static host works. GitHub Pages is free:

1. In this repo on GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, pick **Deploy from a branch**, choose the branch with this code and the `/ (root)` folder, then **Save**.
3. After a minute your app is at `https://<your-username>.github.io/BJJ-Mind-Map/`.
4. Open that link in **Safari** on your iPhone, tap **Share**, then **Add to Home Screen**.

> Your data lives only on the device, in the app's local storage. The home-screen app and Safari keep **separate** storage, so start using the app from the home-screen icon. Export a backup now and then (to iCloud Drive, for example).

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

There's no build step and no dependencies: it's plain HTML, CSS and JavaScript modules.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | App shell |
| `css/styles.css` | Styles (dark and light mode) |
| `js/app.js` | UI: tabs, library, detail sheets, courses, settings |
| `js/graph.js` | Spider-web and flow renderer: force layout, pan, zoom, drag |
| `js/store.js` | Data model and local-storage persistence |
| `js/clips.js` | Link source detection, YouTube and timestamp parsing |
| `js/seed.js` | Starter game loaded on first launch |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and home-screen install |
