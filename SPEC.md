# SPEC — MAINTAIN
## Behavioural Compliance Assessment (Maximalist Edition)

---

## One-Line Pitch

**MAINTAIN** is a short, oppressive browser-based assessment where the player must continuously perform *acceptable human behaviour* under surveillance.

You are not here to win.  
You are here to comply — for as long as possible.

Theme: **Mask**

---

## Design Intent (Non-Negotiable)

This is not a “webcam demo” or a “face tracking experiment”.

This is an **institutional compliance simulator** that:
- feels bureaucratic
- feels judgemental
- feels internally inconsistent
- escalates regardless of player competence

The system must feel *confident*, *cold*, and *petty*.

If the experience feels neutral, playful, or fair, the project has failed.

---

## Core Fantasy

You are undergoing a mandatory behavioural assessment.

The system:
- does not explain itself clearly
- changes expectations without warning
- records failure without justification
- treats compliance as baseline, not success

The mask is not something you put on once.
It is something you must **actively maintain**.

---

## Platform & Constraints

### Client
- Desktop browser only
- HTML / CSS / JavaScript
- Single-page experience
- Webcam via `getUserMedia`
- Face processing **entirely client-side**

### Server
- Node.js + Express
- SQLite (leaderboard only)
- Dockerised
- No video, images, or landmarks sent to server

---

## Hard Performance Requirements

These are mandatory.

- Webcam input downscaled (≈ 640px width)
- Face detection at 15–24 FPS max
- Rendering capped (target 24 FPS)
- Single main loop (no runaway intervals)
- Distractions prioritise DOM/CSS over canvas
- Must run smoothly on a typical laptop in Chrome

If performance drops, visual fidelity is sacrificed before mechanics.

---

## Core Systems (The Pillars)

### 1. Eye Contact (Attention Compliance)

- A central “attention zone” exists
- Eye landmarks must remain within tolerance
- Drift outside zone for > ~700ms increases penalty
- Zone subtly drifts over time

The zone is never explicitly shown.

---

### 2. Affect Compliance (Smile / Expression)

- Geometry-based smile approximation only
- Mouth width vs height
- Generous thresholds initially
- Thresholds tighten or invert later

At times the system may require:
- More enthusiasm
- Less enthusiasm
- Neutrality

The player is not informed which.

---

### 3. Liveness Verification

Purpose: prevent static images and reinforce tension.

Implemented via:
- Landmark micro-movement (nose + eyes)
- Rolling window (2–3 seconds)
- Blink requirement (e.g. once every 10–15s)

Excessive stillness triggers warnings, then failure.

---

### 4. Appropriateness Policy (Critical)

This is a **rule system**, not a detection system.

- Internal “policy state” changes every 15–30 seconds
- Each state subtly alters thresholds and expectations
- Some states contradict earlier guidance

Examples:
- “Engagement Priority”
- “Professional Neutrality”
- “Reduced Expressiveness”
- “Heightened Responsiveness”

Policy changes are announced vaguely or not at all.

This system is essential. Without it, the experience is incomplete.

---

## Game Loop

1. Start screen (cold, institutional tone)
2. Privacy notice (local processing only)
3. Webcam permission
4. Brief calibration (no optimisation)
5. Assessment begins
6. Systems escalate in phases
7. Failure occurs
8. Time recorded
9. Leaderboard submission + classification

---

## Escalation Phases

### Phase 1: Onboarding Pressure (0–20s)
- Mild distractions
- Clear-ish expectations
- Early confidence building

### Phase 2: Contradiction (20–60s)
- Policy shifts begin
- Feedback conflicts
- Distractions overlap face zone

### Phase 3: Overload (60s+)
- Multiple simultaneous pressures
- Rapid policy changes
- Increased penalties
- Gaslighting UI behaviours

The game must feel unfair by design.

---

## Distractions (Maximalist, Cheap)

Distractions must be numerous, intrusive, and escalating.

### Categories

**Administrative Noise**
- “PAYMENT OVERDUE”
- “POLICY UPDATE”
- “ACTION REQUIRED”
- “UNREAD MESSAGE (3)”

**Attention Theft**
- Popups overlapping face area
- UI elements that follow gaze
- Centralised prompts

**Sensory Pressure**
- Audio pings
- Brief screen shake
- Short flashes (with warning)

**Gaslighting UI**
- Moving attention zone
- Delayed feedback
- Contradictory messages in quick succession

Distractions are scheduled via a weighted system, not random spam.

---

## System Voice & Copy (Critical)

The system voice is:
- Confident
- Vague
- Passive-aggressive
- Emotionless

No encouragement. No reassurance.

### Required Volume
- Minimum 80–150 unique messages
- Tagged by category:
  - warning
  - notice
  - policy
  - contradiction
  - passive-aggressive
  - terminal

Repetition must be avoided where possible.

---

## Failure Handling

Failure is not dramatic.

- Webcam feed freezes or fades
- Neutral message displayed
- No explanation of cause
- No breakdown of mistakes

Optional final line:
> “Thank you for your cooperation.”

---

## Leaderboard (Social Layer)

### Submission
- Player enters name (2–24 chars)
- Time survived recorded (ms)
- Submission occurs once per run

### Presentation
- Ranked by time
- Each entry includes:
  - Name
  - Time
  - Classification label
  - System note

Examples:
- “Acceptably Engaged”
- “Borderline”
- “Non-Compliant”

---

## Anti-Abuse (Light, Intentional)

- Client-side sanity checks
- Server-side rate limiting
- Upper bound on accepted time
- Cheating is tolerated socially

---

## Privacy Statement (Mandatory)

Displayed before webcam activation:

> “Webcam processing occurs entirely in your browser. No video or images are uploaded or stored.”

---

## Definition of Success

This project succeeds if:
- Discomfort begins within 10 seconds
- Players instinctively adjust behaviour
- Someone says “that was horrible” positively
- The metaphor lands without explanation

This is not a puzzle.
It is an experience.

Ship it once it works.
Do not soften it.
