const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const statusLabel = document.getElementById('status');
const notice = document.getElementById('notice');
const startBtn = document.getElementById('startBtn');
const timerLabel = document.getElementById('timer');
const promptLabel = document.getElementById('prompt');
const scoreEntry = document.getElementById('scoreEntry');
const playerName = document.getElementById('playerName');
const submitScore = document.getElementById('submitScore');
const scoresList = document.getElementById('scores');

const state = {
  phase: 'idle',
  detector: null,
  startTime: 0,
  lastFrameTime: 0,
  lastFaceTime: 0,
  eyeDrift: 0,
  smileDrift: 0,
  livenessDrift: 0,
  blinkDrift: 0,
  lastBlinkTime: 0,
  movementSamples: [],
  lastPoints: null,
  processing: false,
  distractions: null
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
  'SYSTEM ALERT'
];

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
  const zoneWidth = width * 0.3;
  const zoneHeight = height * 0.35;
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

function scheduleDistractions() {
  if (state.distractions) {
    clearInterval(state.distractions);
  }
  state.distractions = setInterval(showNotice, 4500);
}

function resetMetrics(now) {
  state.eyeDrift = 0;
  state.smileDrift = 0;
  state.livenessDrift = 0;
  state.blinkDrift = 0;
  state.lastBlinkTime = now;
  state.movementSamples = [];
  state.lastPoints = null;
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

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  await new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
  });

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  if (!state.detector) {
    setStatus('Loading model');
    state.detector = await initDetector();
  }

  setStatus('Calibrating');
  setPrompt('Hold steady.');
  state.phase = 'calibrating';
  state.lastFrameTime = performance.now();
  state.lastFaceTime = performance.now();
  resetMetrics(performance.now());
  scheduleDistractions();

  setTimeout(() => {
    state.phase = 'running';
    state.startTime = performance.now();
    setStatus('Running');
    setPrompt(prompts[Math.floor(Math.random() * prompts.length)]);
  }, 2200);

  requestAnimationFrame(loop);
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

  const windowMs = 2200;
  while (state.movementSamples.length && now - state.movementSamples[0].time > windowMs) {
    state.movementSamples.shift();
  }

  return state.movementSamples.reduce((sum, sample) => sum + sample.value, 0);
}

function updateBlink(now, leftUpper, leftLower, rightUpper, rightLower, width) {
  const leftOpen = distance(leftUpper, leftLower) / width;
  const rightOpen = distance(rightUpper, rightLower) / width;
  const openness = (leftOpen + rightOpen) / 2;

  const closed = openness < 0.015;
  if (closed && now - state.lastBlinkTime > 180) {
    state.lastBlinkTime = now;
  }
}

function failRun(message) {
  state.phase = 'failed';
  setStatus('Failed');
  setPrompt(message);
  if (video.srcObject) {
    video.pause();
  }
  if (state.distractions) {
    clearInterval(state.distractions);
  }
  scoreEntry.classList.remove('hidden');
  submitScore.disabled = false;
}

async function loop(now) {
  if (state.phase === 'idle') {
    return;
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawZone(ctx, canvas.width, canvas.height);
  updateTimer(now);

  const dt = now - state.lastFrameTime;
  state.lastFrameTime = now;

  if (state.processing || !state.detector) {
    requestAnimationFrame(loop);
    return;
  }

  state.processing = true;
  const faces = await state.detector.estimateFaces(video, { flipHorizontal: false });
  state.processing = false;

  if (!faces.length) {
    if (now - state.lastFaceTime > 1500 && state.phase === 'running') {
      failRun('Tracking lost.');
      return;
    }
    requestAnimationFrame(loop);
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

  const zoneWidth = width * 0.3;
  const zoneHeight = height * 0.35;
  const zoneX = (width - zoneWidth) / 2;
  const zoneY = (height - zoneHeight) / 2;

  const inZone =
    nose.x > zoneX &&
    nose.x < zoneX + zoneWidth &&
    nose.y > zoneY &&
    nose.y < zoneY + zoneHeight;

  if (inZone) {
    state.eyeDrift = Math.max(0, state.eyeDrift - dt / 600);
  } else {
    state.eyeDrift += dt / 800;
  }

  const mouthWidth = distance(mouthLeft, mouthRight);
  const mouthHeight = distance(upperLip, lowerLip);
  const smileRatio = mouthWidth / Math.max(1, mouthHeight);

  if (smileRatio > 1.9) {
    state.smileDrift = Math.max(0, state.smileDrift - dt / 600);
  } else {
    state.smileDrift += dt / 1000;
  }

  const movementTotal = updateMovement(now, nose, leftEye, rightEye, width);
  if (movementTotal < 0.02) {
    state.livenessDrift += dt / 1800;
  } else {
    state.livenessDrift = Math.max(0, state.livenessDrift - dt / 600);
  }

  updateBlink(now, leftUpper, leftLower, rightUpper, rightLower, width);
  if (now - state.lastBlinkTime > 15000) {
    state.blinkDrift += dt / 2000;
  } else {
    state.blinkDrift = Math.max(0, state.blinkDrift - dt / 800);
  }

  if (state.phase === 'running') {
    if (state.eyeDrift > 1) {
      failRun('Eye contact was interrupted.');
      return;
    }
    if (state.smileDrift > 1) {
      failRun('Expression was insufficient.');
      return;
    }
    if (state.livenessDrift > 1) {
      failRun('Presence degraded.');
      return;
    }
    if (state.blinkDrift > 1) {
      failRun('Liveness confirmation failed.');
      return;
    }
  }

  requestAnimationFrame(loop);
}

async function fetchScores() {
  const response = await fetch('/api/scores');
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
}

async function submitScoreEntry() {
  const name = playerName.value.trim() || 'SYSTEM';
  const timeMs = state.startTime ? performance.now() - state.startTime : 0;
  submitScore.disabled = true;

  await fetch('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, timeMs })
  });

  scoreEntry.classList.add('hidden');
  await fetchScores();
}

startBtn.addEventListener('click', () => {
  if (state.phase === 'idle') {
    startGame();
  }
});

submitScore.addEventListener('click', submitScoreEntry);

fetchScores();
setPrompt('Awaiting input.');
