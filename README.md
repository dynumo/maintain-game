# Maintain

A short browser game where you must maintain eye contact, keep smiling, and remain visibly present while the system watches.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000` in a desktop browser.

## Docker

Build and run the image:

```bash
docker build -t maintain-game .
docker run -p 3000:3000 -v $(pwd)/data:/app/data --name maintain-game maintain-game
```

Open `http://localhost:3000` in a desktop browser.

## CapRover

- Create a new app in CapRover (e.g. `maintain-game`).
- Deploy by enabling the **Dockerfile** build method.
- Set the app's container port to `3000`.
- Add a persistent volume mapping for the leaderboard database:
  - **Container path:** `/app/data`
  - **Host path:** `/var/lib/caprover/maintain-game-data` (or any persistent path)

## Notes

- Webcam processing happens entirely in the browser.
- Scores are stored in a local SQLite database (`data/leaderboard.db`).
