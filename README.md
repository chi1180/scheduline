<div align="center">
<img src="https://github.com/chi1180/scheduline/blob/main/assets/icon.png?raw=true" width="320px">
</div>

# Scheduline

Scheduline is a desktop scheduling app for planning your day with a calendar and a Today view.

## What it does

- Browse and edit events in a week-based calendar
- Move events with keyboard shortcuts
- Keep daily notes linked to selected events
- Review today's timeline alongside the note editor
- Save data locally in IndexedDB

## Main screens

- **Calendar**: week view for creating, selecting, moving, and editing events

![Calendar](./assets/calendar.png)

- **Today**: focused day view with a timeline and a note editor

![Today](./assets/today.png)

## Running the app

```bash
bun install
bun run dev
bun run dev:hmr
bun run build:prod
```

## Project structure

```text
src/
  bun/        # app bootstrap
  mainview/   # React UI
```

## Notes

- Data is stored locally in the browser via IndexedDB
- The app is built with React, Tailwind CSS, Vite, and Electrobun
