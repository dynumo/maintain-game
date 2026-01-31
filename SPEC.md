# SPEC — MAINTAIN

## One-line Pitch
A short browser game where you must maintain eye contact, keep smiling, and remain visibly “present” under pressure — while the system silently judges you.

Theme: **Mask**

---

## Core Concept

The player is watched through their webcam.

They must:
- Maintain eye contact with the on-screen face zone
- Maintain a “smile” (approximate, geometry-based)
- Remain visibly alive (movement + blink detection)

While:
- Visual and auditory distractions attempt to pull attention away
- The system evaluates behaviour with vague, neutral feedback

Failure ends the run.
Survival time is recorded on a public leaderboard.

---

## Non-Goals (Very Important)

This project will NOT:
- Upload or store webcam video or images
- Perform emotion recognition or identity detection
- Attempt clinical or accurate autism simulation
- Explain its metaphor explicitly
- Be fair

---

## Platform & Tech

### Client
- Browser (desktop only)
- HTML / CSS / JavaScript
- Webcam via `getUserMedia`
- Face landmarks processed **entirely client-side**

Recommended library:
- MediaPipe Face Mesh **or**
- TensorFlow.js face-landmarks-detection

### Server
- Node.js + Express
- SQLite (leaderboard only)
- Dockerised
- No webcam data ever reaches the server

---

## Game Loop

1. Player clicks **Start**
2. Webcam permission requested
3. Calibration phase (2–3 seconds, minimal instructions)
4. Run begins
5. Player attempts to satisfy constraints
6. Failure condition met
7. Time survived submitted to leaderboard
8. Leaderboard shown

---

## Detection Mechanics (Approximate by Design)

### Eye Contact
- Define a central “eye zone” on screen
- Track gaze or eye landmarks
- If eyes drift outside zone for > ~700ms → fail meter increases

Exact gaze precision is NOT required.

---

### Smile Detection
- Geometry-based only
- Measure mouth width vs height
- Apply generous threshold
- Short grace period allowed

No emotion classification or ML confidence scoring.

---

### Liveness / Anti-Photo

The system must detect that the subject is not completely static.

Implemented via:
- Frame-to-frame landmark movement (nose + eye corners)
- Rolling window (~2–3 seconds)
- If total movement < threshold → warning, then fail

Optional secondary check:
- Blink detection (eye openness)
- Require at least one blink every 10–15 seconds

---

## Distractions

Distractions are cheap, textual, and intrusive.

Examples:
- Floating system notices (“PAYMENT OVERDUE”)
- Unread message badges
- Cursor jitter
- Audio pings
- UI elements briefly obscuring the face zone

Distractions must:
- Compete with the face for attention
- Increase slowly over time

---

## Feedback & Tone

System feedback is:
- Neutral
- Vague
- Mildly passive-aggressive

Examples:
- “You seemed disengaged.”
- “That expression was inappropriate.”
- “Please remain present.”

No encouragement.
No explanation.

---

## Failure & Ending

On failure:
- Webcam feed freezes or fades
- Neutral message displayed
- Name entry + score submission shown

No score breakdown.
No retry encouragement.

Optional final text:
> “Thank you for your cooperation.”

---

## Leaderboard

### Behaviour
- Player enters a name (2–24 chars)
- Time survived submitted in milliseconds
- Leaderboard shows top N scores

### Anti-abuse (Light)
- Client-side sanity checks
- Server-side rate limiting
- Upper bound on accepted times

Cheating is acceptable at small scale.

---

## Privacy Statement (Required)

Displayed before webcam activation:

> “Webcam processing happens entirely in your browser. No video or images are uploaded or stored.”

---

## Scope Constraints

Target:
- One scene
- One mechanic set
- One emotional beat

If pressed for time:
1. Eye contact
2. Smile
3. Leaderboard

Everything else is optional.

---

## Success Criteria

The game succeeds if:
- Players understand the rules intuitively
- Players feel uncomfortable within 30 seconds
- Someone says “that was horrible” and means it positively
