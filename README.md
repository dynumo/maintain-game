# Maintain

A short browser game where you must maintain eye contact, keep smiling, and remain visibly present while the system watches.

Created by [Adam McBride](https://www.adammcbride.co.uk/) for the **2026 Global Game Jam** at [Farset Labs](https://www.farsetlabs.org.uk/) in Belfast.

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

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `LEADERBOARD_RESET_TOKEN` | Secret token for resetting the leaderboard | No |

## Leaderboard Reset Endpoint

To enable the leaderboard reset functionality, set the `LEADERBOARD_RESET_TOKEN` environment variable:

```bash
# Local
LEADERBOARD_RESET_TOKEN=your-secret-token npm start

# Docker
docker run -p 3000:3000 -e LEADERBOARD_RESET_TOKEN=your-secret-token -v $(pwd)/data:/app/data maintain-game
```

Once configured, you can reset the leaderboard by making a DELETE request:

```bash
# Using header authentication
curl -X DELETE http://localhost:3000/api/scores -H "X-Reset-Token: your-secret-token"

# Or using query parameter
curl -X DELETE "http://localhost:3000/api/scores?token=your-secret-token"
```

## Background Music (Optional)

To add background music, place an MP3 file named `maintain-bg-music.mp3` in the `public/` folder. If the file exists, music controls (play/pause toggle and volume slider) will appear in the bottom-right corner. Music is off by default.

## Notes

- Webcam processing happens entirely in the browser.
- Scores are stored in a local SQLite database (`data/leaderboard.db`).
- The leaderboard displays the top 20 scores with scrolling for entries beyond 5.
- The game includes accessibility features (ARIA labels, keyboard navigation, screen reader support).
