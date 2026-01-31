const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const statusLabel = document.getElementById('status');
const notice = document.getElementById('notice');
const badge = document.getElementById('badge');
const veil = document.getElementById('veil');
const cursor = document.getElementById('cursor');
const startBtn = document.getElementById('startBtn');
const timerLabel = document.getElementById('timer');
const promptLabel = document.getElementById('prompt');
const scoreEntry = document.getElementById('scoreEntry');
const playerName = document.getElementById('playerName');
const submitScore = document.getElementById('submitScore');
const scoresList = document.getElementById('scores');

// Configuration constants
const CONFIG = {
  ZONE_WIDTH_RATIO: 0.3,
  ZONE_HEIGHT_RATIO: 0.35,
  SMILE_THRESHOLD: 1.9,
  EYE_OPENNESS_THRESHOLD: 0.015,
  MOVEMENT_THRESHOLD: 0.02,
  FACE_LOST_MS: 1500,
  GAZE_AWAY_LIMIT_MS: 700,
  EYES_CLOSED_LIMIT_MS: 700,
  BLINK_CHECK_INTERVAL_MS: 15000,
  MOVEMENT_WINDOW_MS: 2200,
  MAX_MOVEMENT_SAMPLES: 200,
  DETECTION_THROTTLE_MS: 33, // ~30fps for face detection
  CALIBRATION_MS: 2200,
  MAX_SCORE_MS: 600000 // 10 minute cap
};

// Audio context for notification sounds
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playPing(frequency = 880, duration = 0.08, volume = 0.15) {
  try {
    const ctx = initAudio();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio not supported or blocked, fail silently
  }
}

const state = {
  phase: 'idle',
  detector: null,
  startTime: 0,
  lastFrameTime: 0,
  lastFaceTime: 0,
  lastDetectionTime: 0,
  eyeDrift: 0,
  smileDrift: 0,
  livenessDrift: 0,
  blinkDrift: 0,
  lastBlinkTime: 0,
  gazeAwayMs: 0,
  eyesClosedMs: 0,
  movementSamples: [],
  lastPoints: null,
  processing: false,
  distractions: null,
  distractionLevel: 0,
  zoneCache: null, // Cached zone drawing
  rafId: null, // Track animation frame for cleanup
  failureTime: 0 // Store exact failure time
};

const prompts = [
  'Remain present.',
  'Keep your attention forward.',
  'Maintain the required expression.',
  'You are being evaluated.'
];

const notices = [
  'PAYMENT OVERDUE',
  'NEW MESSAGE',
  'CALENDAR UPDATE',
  'SYSTEM ALERT',
  'SESSION WARNING'
];

const badges = ['1', '2', '3', '5', '!', '?'];

// Varied failure messages per spec - vague, neutral, mildly passive-aggressive
const failureMessages = {
  gaze: [
    'You seemed disengaged.',
    'Your attention drifted.',
    'Eye contact was insufficient.',
    'Please remain focused.',
    'That was noted.'
  ],
  expression: [
    'That expression was inappropriate.',
    'Expression was insufficient.',
    'Your demeanor was unsatisfactory.',
    'Please maintain composure.',
    'That was... unexpected.'
  ],
  presence: [
    'Presence degraded.',
    'You appeared absent.',
    'Engagement dropped below threshold.',
    'Please remain present.',
    'Activity level was insufficient.'
  ],
  blink: [
    'Blink duration exceeded the limit.',
    'Your eyes were closed too long.',
    'Prolonged eye closure detected.',
    'Please keep your eyes open.',
    'That was concerning.'
  ],
  liveness: [
    'Liveness confirmation failed.',
    'Movement was insufficient.',
    'Please demonstrate activity.',
    'You seemed frozen.',
    'Natural behavior not detected.'
  ]
};

function getFailureMessage(type) {
  const messages = failureMessages[type] || failureMessages.presence;
  return messages[Math.floor(Math.random() * messages.length)];
}

function setStatus(text) {
  statusLabel.textContent = text;
}

function setPrompt(text) {
  promptLabel.textContent = text;
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function drawZone(ctx, width, height) {
  const zoneWidth = width * CONFIG.ZONE_WIDTH_RATIO;
  const zoneHeight = height * CONFIG.ZONE_HEIGHT_RATIO;
  const x = (width - zoneWidth) / 2;
  const y = (height - zoneHeight) / 2;
  ctx.strokeStyle = 'rgba(122, 122, 160, 0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, zoneWidth, zoneHeight);
}

function updateTimer(now) {
  if (state.phase !== 'running') {
    return;
  }
  const elapsed = now - state.startTime;
  timerLabel.textContent = formatTime(elapsed);
}

function showNotice() {
  if (state.phase !== 'running') {
    notice.classList.add('hidden');
    return;
  }
  const message = notices[Math.floor(Math.random() * notices.length)];
  notice.textContent = message;
  notice.classList.remove('hidden');
  setTimeout(() => notice.classList.add('hidden'), 1200);
}

function showBadge() {
  badge.textContent = badges[Math.floor(Math.random() * badges.length)];
  badge.classList.remove('hidden');
  setTimeout(() => badge.classList.add('hidden'), 900);
}

function showVeil() {
  veil.classList.remove('hidden');
  veil.classList.remove('show');
  void veil.offsetWidth;
  veil.classList.add('show');
  setTimeout(() => veil.classList.add('hidden'), 1400);
}

function showCursor() {
  const x = Math.random() * 70 + 15;
  const y = Math.random() * 60 + 20;
  cursor.style.left = `${x}%`;
  cursor.style.top = `${y}%`;
  cursor.classList.remove('hidden');
  setTimeout(() => cursor.classList.add('hidden'), 700);
}

function playNotificationPing() {
  // Vary the ping sound slightly for different "notification types"
  const frequencies = [880, 1046, 784, 659];
  const freq = frequencies[Math.floor(Math.random() * frequencies.length)];
  playPing(freq, 0.1, 0.12);
}

function triggerDistraction() {
  const options = [showNotice, showBadge, showVeil, showCursor, playNotificationPing];
  const pick = options[Math.floor(Math.random() * options.length)];
  pick();
}

function scheduleDistractions() {
  if (state.distractions) {
    clearTimeout(state.distractions);
  }
  if (state.phase !== 'running' && state.phase !== 'calibrating') {
    return;
  }
  const interval = Math.max(2200, 4600 - state.distractionLevel * 260);
  state.distractionLevel = Math.min(8, state.distractionLevel + 1);
  state.distractions = setTimeout(() => {
    if (state.phase === 'running') {
      triggerDistraction();
    }
    scheduleDistractions();
  }, interval);
}

function resetMetrics(now) {
  state.eyeDrift = 0;
  state.smileDrift = 0;
  state.livenessDrift = 0;
  state.blinkDrift = 0;
  state.lastBlinkTime = now;
  state.gazeAwayMs = 0;
  state.eyesClosedMs = 0;
  state.movementSamples = [];
  state.lastPoints = null;
  state.distractionLevel = 0;
}

async function initDetector() {
  await tf.setBackend('webgl');
  await tf.ready();
  return faceLandmarksDetection.createDetector(
    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    {
      runtime: 'tfjs',
      refineLandmarks: true
    }
  );
}

async function startGame() {
  startBtn.disabled = true;
  setStatus('Requesting webcam');
  setPrompt('');
  timerLabel.textContent = formatTime(0);
  state.zoneCache = null; // Clear zone cache for fresh start

  try {
    if (!video.srcObject) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      video.srcObject = stream;
    }
  } catch (err) {
    let errorMsg = 'Webcam access denied.';
    if (err.name === 'NotFoundError') {
      errorMsg = 'No webcam detected.';
    } else if (err.name === 'NotReadableError') {
      errorMsg = 'Webcam is in use by another application.';
    } else if (err.name === 'OverconstrainedError') {
      errorMsg = 'Webcam does not meet requirements.';
    }
    setStatus('Error');
    setPrompt(errorMsg);
    startBtn.disabled = false;
    startBtn.textContent = 'Retry';
    return;
  }

  setStatus('Initializing camera');
  await new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
  });

  try {
    await video.play();
  } catch (err) {
    setStatus('Error');
    setPrompt('Failed to start video playback.');
    startBtn.disabled = false;
    startBtn.textContent = 'Retry';
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  if (!state.detector) {
    setStatus('Loading model...');
    setPrompt('This may take a moment.');
    try {
      state.detector = await initDetector();
    } catch (err) {
      setStatus('Error');
      setPrompt('Failed to load face detection model.');
      startBtn.disabled = false;
      startBtn.textContent = 'Retry';
      return;
    }
  }

  // Initialize audio context on user interaction (required by browsers)
  initAudio();

  setStatus('Calibrating');
  setPrompt('Hold steady. Look at the center box.');
  state.phase = 'calibrating';
  state.lastFrameTime = performance.now();
  state.lastFaceTime = performance.now();
  state.lastDetectionTime = 0;
  resetMetrics(performance.now());
  scheduleDistractions();

  setTimeout(() => {
    if (state.phase === 'calibrating') {
      state.phase = 'running';
      state.startTime = performance.now();
      setStatus('Running');
      setPrompt(prompts[Math.floor(Math.random() * prompts.length)]);
    }
  }, CONFIG.CALIBRATION_MS);

  state.rafId = requestAnimationFrame(loop);
}

function getPoint(keypoints, index) {
  const point = keypoints[index];
  return { x: point.x, y: point.y };
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function updateMovement(now, nose, leftEye, rightEye, width) {
  if (!state.lastPoints) {
    state.lastPoints = { nose, leftEye, rightEye };
    return 0;
  }

  const movement =
    distance(nose, state.lastPoints.nose) +
    distance(leftEye, state.lastPoints.leftEye) +
    distance(rightEye, state.lastPoints.rightEye);

  state.lastPoints = { nose, leftEye, rightEye };
  const normalized = movement / width;
  state.movementSamples.push({ time: now, value: normalized });

  // Efficiently prune old samples with bounded array size
  const windowMs = CONFIG.MOVEMENT_WINDOW_MS;
  let pruneIndex = 0;
  while (pruneIndex < state.movementSamples.length &&
         now - state.movementSamples[pruneIndex].time > windowMs) {
    pruneIndex++;
  }
  if (pruneIndex > 0) {
    state.movementSamples = state.movementSamples.slice(pruneIndex);
  }

  // Hard cap to prevent memory issues
  if (state.movementSamples.length > CONFIG.MAX_MOVEMENT_SAMPLES) {
    state.movementSamples = state.movementSamples.slice(-CONFIG.MAX_MOVEMENT_SAMPLES);
  }

  // Calculate total with cached sum for better performance
  let total = 0;
  for (let i = 0; i < state.movementSamples.length; i++) {
    total += state.movementSamples[i].value;
  }
  return total;
}

function getEyeOpenness(leftUpper, leftLower, rightUpper, rightLower, width) {
  const leftOpen = distance(leftUpper, leftLower) / width;
  const rightOpen = distance(rightUpper, rightLower) / width;
  return (leftOpen + rightOpen) / 2;
}

function stopVideoStream() {
  if (video.srcObject) {
    video.pause();
    const tracks = video.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    video.srcObject = null;
  }
}

function failRun(message) {
  // Store failure time immediately for accurate scoring
  state.failureTime = performance.now();
  state.phase = 'failed';
  setStatus('Failed');
  setPrompt(message);

  // Clean up resources
  stopVideoStream();

  if (state.distractions) {
    clearTimeout(state.distractions);
    state.distractions = null;
  }

  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }

  startBtn.disabled = false;
  startBtn.textContent = 'Retry';
  scoreEntry.classList.remove('hidden');
  submitScore.disabled = false;
}

async function loop(now) {
  if (state.phase === 'idle') {
    state.rafId = null;
    return;
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Use cached zone if available, otherwise draw and cache
  if (state.zoneCache && state.zoneCache.width === canvas.width && state.zoneCache.height === canvas.height) {
    ctx.drawImage(state.zoneCache, 0, 0);
  } else {
    drawZone(ctx, canvas.width, canvas.height);
    // Cache the zone drawing
    state.zoneCache = document.createElement('canvas');
    state.zoneCache.width = canvas.width;
    state.zoneCache.height = canvas.height;
    const cacheCtx = state.zoneCache.getContext('2d');
    drawZone(cacheCtx, canvas.width, canvas.height);
  }

  updateTimer(now);

  const dt = now - state.lastFrameTime;
  state.lastFrameTime = now;

  // Throttle face detection to reduce CPU/GPU usage
  const timeSinceLastDetection = now - state.lastDetectionTime;
  if (state.processing || !state.detector || timeSinceLastDetection < CONFIG.DETECTION_THROTTLE_MS) {
    state.rafId = requestAnimationFrame(loop);
    return;
  }

  state.processing = true;
  state.lastDetectionTime = now;
  const faces = await state.detector.estimateFaces(video, { flipHorizontal: false });
  state.processing = false;

  if (!faces.length) {
    if (now - state.lastFaceTime > CONFIG.FACE_LOST_MS && state.phase === 'running') {
      failRun('Tracking lost.');
      return;
    }
    state.rafId = requestAnimationFrame(loop);
    return;
  }

  state.lastFaceTime = now;
  const face = faces[0];
  const keypoints = face.keypoints;

  const nose = getPoint(keypoints, 1);
  const leftEye = getPoint(keypoints, 33);
  const rightEye = getPoint(keypoints, 263);
  const mouthLeft = getPoint(keypoints, 61);
  const mouthRight = getPoint(keypoints, 291);
  const upperLip = getPoint(keypoints, 13);
  const lowerLip = getPoint(keypoints, 14);
  const leftUpper = getPoint(keypoints, 159);
  const leftLower = getPoint(keypoints, 145);
  const rightUpper = getPoint(keypoints, 386);
  const rightLower = getPoint(keypoints, 374);

  const width = canvas.width;
  const height = canvas.height;

  const zoneWidth = width * CONFIG.ZONE_WIDTH_RATIO;
  const zoneHeight = height * CONFIG.ZONE_HEIGHT_RATIO;
  const zoneX = (width - zoneWidth) / 2;
  const zoneY = (height - zoneHeight) / 2;

  // Use center point between eyes instead of nose for more accurate gaze detection
  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2
  };

  const inZone =
    eyeCenter.x > zoneX &&
    eyeCenter.x < zoneX + zoneWidth &&
    eyeCenter.y > zoneY &&
    eyeCenter.y < zoneY + zoneHeight;

  if (inZone) {
    state.eyeDrift = Math.max(0, state.eyeDrift - dt / 600);
    state.gazeAwayMs = Math.max(0, state.gazeAwayMs - dt * 1.4);
  } else {
    state.eyeDrift += dt / 800;
    state.gazeAwayMs += dt;
  }

  const mouthWidth = distance(mouthLeft, mouthRight);
  const mouthHeight = distance(upperLip, lowerLip);
  const smileRatio = mouthWidth / Math.max(1, mouthHeight);

  if (smileRatio > CONFIG.SMILE_THRESHOLD) {
    state.smileDrift = Math.max(0, state.smileDrift - dt / 600);
  } else {
    state.smileDrift += dt / 1000;
  }

  const movementTotal = updateMovement(now, nose, leftEye, rightEye, width);
  if (movementTotal < CONFIG.MOVEMENT_THRESHOLD) {
    state.livenessDrift += dt / 1800;
  } else {
    state.livenessDrift = Math.max(0, state.livenessDrift - dt / 600);
  }

  const eyeOpenness = getEyeOpenness(leftUpper, leftLower, rightUpper, rightLower, width);
  const eyesClosed = eyeOpenness < CONFIG.EYE_OPENNESS_THRESHOLD;
  if (eyesClosed) {
    state.lastBlinkTime = now;
    state.eyesClosedMs += dt;
  } else {
    state.eyesClosedMs = Math.max(0, state.eyesClosedMs - dt * 2);
  }

  if (now - state.lastBlinkTime > CONFIG.BLINK_CHECK_INTERVAL_MS) {
    state.blinkDrift += dt / 2000;
  } else {
    state.blinkDrift = Math.max(0, state.blinkDrift - dt / 800);
  }

  if (state.phase === 'running') {
    if (state.eyeDrift > 1) {
      failRun(getFailureMessage('gaze'));
      return;
    }
    if (state.gazeAwayMs > CONFIG.GAZE_AWAY_LIMIT_MS) {
      failRun(getFailureMessage('gaze'));
      return;
    }
    if (state.smileDrift > 1) {
      failRun(getFailureMessage('expression'));
      return;
    }
    if (state.livenessDrift > 1) {
      failRun(getFailureMessage('presence'));
      return;
    }
    if (state.eyesClosedMs > CONFIG.EYES_CLOSED_LIMIT_MS) {
      failRun(getFailureMessage('blink'));
      return;
    }
    if (state.blinkDrift > 1) {
      failRun(getFailureMessage('liveness'));
      return;
    }
  }

  state.rafId = requestAnimationFrame(loop);
}

async function fetchScores() {
  try {
    const response = await fetch('/api/scores');
    if (!response.ok) {
      throw new Error('Failed to fetch');
    }
    const data = await response.json();
    scoresList.innerHTML = '';

    if (!data.scores || !data.scores.length) {
      const empty = document.createElement('li');
      empty.textContent = 'No records.';
      scoresList.appendChild(empty);
      return;
    }

    data.scores.forEach((score) => {
      const item = document.createElement('li');
      item.textContent = `${score.name} — ${formatTime(score.time_ms)}`;
      scoresList.appendChild(item);
    });
  } catch (err) {
    scoresList.innerHTML = '';
    const errItem = document.createElement('li');
    errItem.textContent = 'Unable to load leaderboard.';
    scoresList.appendChild(errItem);
  }
}

async function submitScoreEntry() {
  const name = playerName.value.trim() || 'SYSTEM';
  // Use stored failure time for accuracy, with cap per spec
  let timeMs = state.failureTime && state.startTime
    ? state.failureTime - state.startTime
    : 0;
  timeMs = Math.min(timeMs, CONFIG.MAX_SCORE_MS);
  submitScore.disabled = true;

  try {
    const response = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, timeMs: Math.round(timeMs) })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setPrompt(data.error || 'Failed to submit score.');
      submitScore.disabled = false;
      return;
    }
  } catch (err) {
    setPrompt('Network error. Try again.');
    submitScore.disabled = false;
    return;
  }

  scoreEntry.classList.add('hidden');
  playerName.value = '';
  await fetchScores();
}

function handleStart() {
  if (state.phase === 'idle' || state.phase === 'failed') {
    scoreEntry.classList.add('hidden');
    submitScore.disabled = false;
    startBtn.textContent = 'Start';
    state.phase = 'idle'; // Reset phase before starting
    startGame();
  }
}

startBtn.addEventListener('click', handleStart);

// Keyboard support for start button
startBtn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleStart();
  }
});

submitScore.addEventListener('click', submitScoreEntry);

// Keyboard support for score submission
playerName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!submitScore.disabled) {
      submitScoreEntry();
    }
  }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  stopVideoStream();
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
  }
});

fetchScores();
setPrompt('Awaiting input.');
