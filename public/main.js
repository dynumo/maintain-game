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
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const countdownDisplay = document.getElementById('countdownDisplay');
const debugPanel = document.getElementById('debugPanel');
const debugValues = document.getElementById('debugValues');

// Debug mode - always show tracking info
const DEBUG_MODE = true;

// Console logging helper
function log(category, message, data = null) {
  const timestamp = performance.now().toFixed(2);
  const prefix = `[${timestamp}ms] [${category}]`;
  if (data) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

// Configuration constants
const CONFIG = {
  ZONE_WIDTH_RATIO: 0.45,          // Larger zone for easier compliance
  ZONE_HEIGHT_RATIO: 0.5,
  SMILE_THRESHOLD: 1.5,            // Lower = easier to satisfy
  EYE_OPENNESS_THRESHOLD: 0.012,   // Lower = less sensitive to blinks
  MOVEMENT_THRESHOLD: 0.015,
  FACE_LOST_MS: 2500,              // More time before face lost fail
  GAZE_AWAY_LIMIT_MS: 3000,        // 3 seconds as requested
  EYES_CLOSED_LIMIT_MS: 3000,      // 3 seconds as requested
  BLINK_CHECK_INTERVAL_MS: 20000,
  MOVEMENT_WINDOW_MS: 2500,
  MAX_MOVEMENT_SAMPLES: 200,
  DETECTION_THROTTLE_MS: 50,       // ~20fps for face detection
  CALIBRATION_MS: 3000,            // Longer calibration period
  MAX_SCORE_MS: 600000,
  POLICY_CHANGE_MIN_MS: 20000,     // First policy change after 20s
  POLICY_CHANGE_MAX_MS: 35000,
  ZONE_DRIFT_SPEED: 0.0002,        // Slower drift
  ZONE_DRIFT_MAX: 0.06,
  // Loading and countdown
  LOADING_MIN_MS: 1500,            // Minimum loading time to show message
  COUNTDOWN_SECONDS: 3             // Countdown before calibration starts
};

log('CONFIG', 'Configuration loaded', CONFIG);

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
    // Audio not supported or blocked
  }
}

// Policy States - changes expectations and thresholds
const POLICIES = {
  ENGAGEMENT_PRIORITY: {
    name: 'Engagement Priority',
    smileMultiplier: 0.7,
    gazeMultiplier: 1.0,
    livenessMultiplier: 1.2,
    announcements: [
      'Policy update: Engagement metrics active.',
      'Engagement assessment initiated.',
      'Your enthusiasm is being evaluated.'
    ]
  },
  PROFESSIONAL_NEUTRALITY: {
    name: 'Professional Neutrality',
    smileMultiplier: 1.5, // Punish smiling too much
    gazeMultiplier: 0.8,
    livenessMultiplier: 0.9,
    announcements: [
      'Policy update: Professional standards in effect.',
      'Maintain composure.',
      'Excessive expression noted.'
    ]
  },
  REDUCED_EXPRESSIVENESS: {
    name: 'Reduced Expressiveness',
    smileMultiplier: 2.0,
    gazeMultiplier: 1.1,
    livenessMultiplier: 0.7,
    announcements: [
      'Expression threshold adjusted.',
      'Reduced display recommended.',
      'Calibrating to new parameters.'
    ]
  },
  HEIGHTENED_RESPONSIVENESS: {
    name: 'Heightened Responsiveness',
    smileMultiplier: 0.5,
    gazeMultiplier: 1.3,
    livenessMultiplier: 1.5,
    announcements: [
      'Heightened monitoring active.',
      'Response evaluation in progress.',
      'Your alertness is being measured.'
    ]
  },
  SUSTAINED_ATTENTION: {
    name: 'Sustained Attention',
    smileMultiplier: 1.0,
    gazeMultiplier: 0.6,
    livenessMultiplier: 1.0,
    announcements: [
      'Attention persistence required.',
      'Deviation tolerance decreased.',
      'Focus parameters updated.'
    ]
  },
  BASELINE_COMPLIANCE: {
    name: 'Baseline Compliance',
    smileMultiplier: 1.0,
    gazeMultiplier: 1.0,
    livenessMultiplier: 1.0,
    announcements: [
      'Returning to baseline.',
      'Standard parameters restored.',
      'Compliance threshold normalized.'
    ]
  }
};

const POLICY_KEYS = Object.keys(POLICIES);

// System messages organized by category (80-150+ unique messages per spec)
const MESSAGES = {
  warning: [
    'Attention drift detected.',
    'Expression deviation noted.',
    'Focus degradation observed.',
    'Compliance variance recorded.',
    'Behavioral anomaly flagged.',
    'Response latency increasing.',
    'Engagement metrics declining.',
    'Attention threshold approaching.',
    'Expression analysis: borderline.',
    'Movement pattern irregular.',
    'Eye contact insufficient.',
    'Posture deviation detected.',
    'Micro-expression flagged.',
    'Blink frequency abnormal.',
    'Gaze stability compromised.',
    'Attention span fragmenting.',
    'Expression authenticity: questionable.',
    'Compliance trajectory: declining.',
    'Warning: metric threshold imminent.',
    'Behavioral consistency wavering.'
  ],
  notice: [
    'PAYMENT OVERDUE',
    'NEW MESSAGE (3)',
    'CALENDAR: Meeting in 5 min',
    'SYSTEM ALERT',
    'SESSION WARNING',
    'UPDATE REQUIRED',
    'POLICY UPDATE',
    'ACTION REQUIRED',
    'UNREAD MESSAGE (7)',
    'APPROVAL PENDING',
    'REVIEW REQUESTED',
    'DEADLINE APPROACHING',
    'VERIFICATION NEEDED',
    'ACCOUNT NOTICE',
    'COMPLIANCE REMINDER',
    'MANDATORY TRAINING',
    'PERFORMANCE REVIEW',
    'SECURITY ALERT',
    'SYSTEM MAINTENANCE',
    'DATA SYNC REQUIRED',
    'CREDENTIALS EXPIRING',
    'BENEFITS ENROLLMENT',
    'TIMESHEET DUE',
    'EXPENSE REPORT',
    'INVENTORY CHECK'
  ],
  policy: [
    'Policy parameters adjusting.',
    'Threshold recalibration in progress.',
    'Assessment criteria updated.',
    'Compliance matrix modified.',
    'Evaluation protocol changing.',
    'Behavioral expectations shifting.',
    'Standard operating parameters altered.',
    'Metric weighting redistributed.',
    'Performance criteria evolving.',
    'Baseline expectations recalculated.',
    'Tolerance thresholds modified.',
    'Assessment algorithm updated.',
    'Compliance requirements adjusted.',
    'Behavioral protocol revised.',
    'Expectation parameters shifting.'
  ],
  contradiction: [
    'Previous guidance superseded.',
    'Disregard earlier instruction.',
    'Correction: opposite behavior expected.',
    'Error in prior assessment noted.',
    'Updated: previous metric inverted.',
    'Recalibrating: prior threshold incorrect.',
    'Adjustment: earlier feedback reversed.',
    'Note: previous standard deprecated.',
    'Override: contradicting prior policy.',
    'Revision: earlier expectation voided.',
    'Amendment: prior guidance withdrawn.',
    'Update: reversing earlier parameters.',
    'Clarification: opposite now required.',
    'Correction: prior assessment invalid.',
    'Notice: earlier instruction rescinded.'
  ],
  passive_aggressive: [
    'That was... noted.',
    'Interesting choice.',
    'If you say so.',
    'Acknowledged.',
    'As you prefer.',
    'Compliance within acceptable range. Barely.',
    'Your performance has been... recorded.',
    'Engagement remains within tolerance.',
    'Expression deemed... adequate.',
    'Noted for your file.',
    'The system sees you.',
    'Your effort is appreciated. Formally.',
    'Acceptable. For now.',
    'Meeting minimum requirements.',
    'Your enthusiasm is... registered.',
    'Behavior logged.',
    'Attempting compliance. Noted.',
    'Your presence has been confirmed.',
    'Satisfactory. Technically.',
    'Within parameters. Marginally.',
    'The record will reflect this.',
    'Your attempt is acknowledged.',
    'Compliance detected. Proceeding.',
    'Expression... sufficient.',
    'Attention... present.'
  ],
  terminal: [
    'Assessment concluded.',
    'Evaluation terminated.',
    'Session ended.',
    'Thank you for your cooperation.',
    'Your participation has been logged.',
    'Results have been recorded.',
    'This session is complete.',
    'Compliance period ended.',
    'Your assessment has concluded.',
    'Processing complete.'
  ],
  prompts: [
    'Remain present.',
    'Keep your attention forward.',
    'Maintain the required expression.',
    'You are being evaluated.',
    'Continue to demonstrate compliance.',
    'Your behavior is being analyzed.',
    'Stay within acceptable parameters.',
    'Deviation will be recorded.',
    'Maintain eye contact with the system.',
    'Expression should remain consistent.',
    'Focus your attention centrally.',
    'Your engagement is being measured.',
    'Do not look away.',
    'Continue your current behavior.',
    'Compliance is mandatory.',
    'Your presence is required.',
    'Attention must be sustained.',
    'Expression must be maintained.',
    'The assessment continues.',
    'Behavioral consistency required.'
  ],
  gaslighting: [
    'Did you look away just now?',
    'Your expression changed.',
    'Was that intentional?',
    'The system detected something.',
    'A variance was noted. Or was it?',
    'Rechecking previous assessment...',
    'That seemed inconsistent.',
    'Reviewing your last response...',
    'Something was flagged. Disregard.',
    'Anomaly detected. Correction: none detected.',
    'Your file has been updated. Or has it?',
    'Prior reading may have been incorrect.',
    'Recalibrating your baseline...',
    'Was that expression genuine?',
    'The system is uncertain about you.'
  ]
};

// Failure messages by category
const FAILURE_MESSAGES = {
  gaze: [
    'You seemed disengaged.',
    'Your attention drifted.',
    'Eye contact was insufficient.',
    'Please remain focused.',
    'That was noted.',
    'Gaze compliance: failed.',
    'Attention threshold exceeded.',
    'Focus was inadequate.'
  ],
  expression: [
    'That expression was inappropriate.',
    'Expression was insufficient.',
    'Your demeanor was unsatisfactory.',
    'Please maintain composure.',
    'That was... unexpected.',
    'Expression compliance: failed.',
    'Affect deviation: excessive.',
    'Display was inadequate.'
  ],
  presence: [
    'Presence degraded.',
    'You appeared absent.',
    'Engagement dropped below threshold.',
    'Please remain present.',
    'Activity level was insufficient.',
    'Presence compliance: failed.',
    'Engagement threshold exceeded.',
    'Attendance was inadequate.'
  ],
  blink: [
    'Blink duration exceeded the limit.',
    'Your eyes were closed too long.',
    'Prolonged eye closure detected.',
    'Please keep your eyes open.',
    'That was concerning.',
    'Blink compliance: failed.',
    'Eye closure threshold exceeded.'
  ],
  liveness: [
    'Liveness confirmation failed.',
    'Movement was insufficient.',
    'Please demonstrate activity.',
    'You seemed frozen.',
    'Natural behavior not detected.',
    'Liveness compliance: failed.',
    'Activity threshold not met.'
  ]
};

// Classification labels for leaderboard
const CLASSIFICATIONS = [
  { maxTime: 5000, label: 'Non-Compliant', note: 'Immediate failure.' },
  { maxTime: 15000, label: 'Deficient', note: 'Below minimum threshold.' },
  { maxTime: 30000, label: 'Borderline', note: 'Requires improvement.' },
  { maxTime: 60000, label: 'Acceptable', note: 'Meets minimum standard.' },
  { maxTime: 120000, label: 'Compliant', note: 'Within expectations.' },
  { maxTime: 180000, label: 'Adequately Engaged', note: 'Performance noted.' },
  { maxTime: 300000, label: 'Satisfactory', note: 'Formally acceptable.' },
  { maxTime: Infinity, label: 'Exemplary Compliance', note: 'Suspiciously good.' }
];

function getClassification(timeMs) {
  for (const c of CLASSIFICATIONS) {
    if (timeMs <= c.maxTime) {
      return { label: c.label, note: c.note };
    }
  }
  return CLASSIFICATIONS[CLASSIFICATIONS.length - 1];
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
  zoneCache: null,
  rafId: null,
  failureTime: 0,
  // Policy system
  currentPolicy: null,
  lastPolicyChange: 0,
  nextPolicyChange: 0,
  policyHistory: [],
  // Zone drift
  zoneDriftX: 0,
  zoneDriftY: 0,
  zoneDriftDirX: 1,
  zoneDriftDirY: 1,
  // Escalation phase
  escalationPhase: 1,
  // Message tracking to avoid repetition
  usedMessages: new Set(),
  lastMessageTime: 0,
  // Gaslighting state
  lastGaslightTime: 0,
  contradictionPending: false,
  // Debug tracking
  lastDebugUpdate: 0,
  currentDebugData: null,
  // Frame counting for debug
  frameCount: 0,
  faceDetectionCount: 0
};

function getRandomMessage(category) {
  const messages = MESSAGES[category] || MESSAGES.prompts;
  // Try to avoid recently used messages
  const available = messages.filter(m => !state.usedMessages.has(m));
  const pool = available.length > 0 ? available : messages;
  const msg = pool[Math.floor(Math.random() * pool.length)];
  state.usedMessages.add(msg);
  // Clear old messages periodically
  if (state.usedMessages.size > 50) {
    state.usedMessages.clear();
  }
  return msg;
}

function getFailureMessage(type) {
  const messages = FAILURE_MESSAGES[type] || FAILURE_MESSAGES.presence;
  return messages[Math.floor(Math.random() * messages.length)];
}

function setStatus(text) {
  statusLabel.textContent = text;
  log('STATUS', text);
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

function getZoneOffset() {
  return {
    x: state.zoneDriftX * canvas.width,
    y: state.zoneDriftY * canvas.height
  };
}

function updateZoneDrift(dt) {
  // Subtle zone drift per spec
  const speed = CONFIG.ZONE_DRIFT_SPEED * dt;
  const maxDrift = CONFIG.ZONE_DRIFT_MAX;

  state.zoneDriftX += speed * state.zoneDriftDirX;
  state.zoneDriftY += speed * state.zoneDriftDirY * 0.7;

  if (Math.abs(state.zoneDriftX) > maxDrift) {
    state.zoneDriftDirX *= -1;
    state.zoneDriftX = Math.sign(state.zoneDriftX) * maxDrift;
  }
  if (Math.abs(state.zoneDriftY) > maxDrift) {
    state.zoneDriftDirY *= -1;
    state.zoneDriftY = Math.sign(state.zoneDriftY) * maxDrift;
  }

  // Increase drift speed in later phases
  if (state.escalationPhase >= 2) {
    state.zoneDriftDirX += (Math.random() - 0.5) * 0.01;
    state.zoneDriftDirY += (Math.random() - 0.5) * 0.01;
  }
}

function drawZone(ctx, width, height) {
  const offset = getZoneOffset();
  const zoneWidth = width * CONFIG.ZONE_WIDTH_RATIO;
  const zoneHeight = height * CONFIG.ZONE_HEIGHT_RATIO;
  const x = (width - zoneWidth) / 2 + offset.x;
  const y = (height - zoneHeight) / 2 + offset.y;

  // Zone is shown more visibly for debugging
  ctx.strokeStyle = 'rgba(122, 160, 122, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(x, y, zoneWidth, zoneHeight);
  ctx.setLineDash([]);
}

// Debug display on canvas (kept for overlay visualization)
function drawDebugCanvas(ctx, width, height, data) {
  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(200, 220, 200, 0.9)';
  const lines = [
    `Zone: ${data.inZone ? 'IN' : 'OUT'}`,
    `Smile: ${data.smileRatio.toFixed(2)} (need >${(CONFIG.SMILE_THRESHOLD * 0.8).toFixed(2)})`,
    `Eyes: ${data.eyeOpenness.toFixed(4)}`,
    `Gaze: ${(state.gazeAwayMs / 1000).toFixed(1)}s / ${(CONFIG.GAZE_AWAY_LIMIT_MS / 1000).toFixed(1)}s`,
    `Drifts: E${state.eyeDrift.toFixed(2)} S${state.smileDrift.toFixed(2)} L${state.livenessDrift.toFixed(2)}`
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, 10, height - 70 + i * 14);
  });
}

// Update the sidebar debug panel with tracking values
function updateDebugPanel(data) {
  if (!DEBUG_MODE || !debugPanel || !debugValues) return;

  debugPanel.classList.remove('hidden');

  const gazePercent = Math.min(100, (state.gazeAwayMs / CONFIG.GAZE_AWAY_LIMIT_MS) * 100);
  const eyeDriftPercent = Math.min(100, state.eyeDrift * 100);
  const smileDriftPercent = Math.min(100, state.smileDrift * 100);
  const livenessDriftPercent = Math.min(100, state.livenessDrift * 100);
  const eyesClosedPercent = Math.min(100, (state.eyesClosedMs / CONFIG.EYES_CLOSED_LIMIT_MS) * 100);

  const getClass = (percent) => {
    if (percent > 75) return 'danger';
    if (percent > 50) return 'warning';
    return '';
  };

  debugValues.innerHTML = `
    <div class="debug-line">
      <span class="debug-label">Zone:</span>
      <span class="debug-value ${data.inZone ? '' : 'warning'}">${data.inZone ? 'IN' : 'OUT'}</span>
    </div>
    <div class="debug-line">
      <span class="debug-label">Gaze Away:</span>
      <span class="debug-value ${getClass(gazePercent)}">${(state.gazeAwayMs / 1000).toFixed(1)}s / ${(CONFIG.GAZE_AWAY_LIMIT_MS / 1000).toFixed(1)}s</span>
    </div>
    <div class="debug-line">
      <span class="debug-label">Eye Drift:</span>
      <span class="debug-value ${getClass(eyeDriftPercent)}">${eyeDriftPercent.toFixed(0)}%</span>
    </div>
    <div class="debug-line">
      <span class="debug-label">Smile:</span>
      <span class="debug-value ${data.smileRatio > CONFIG.SMILE_THRESHOLD * 0.8 ? '' : 'warning'}">${data.smileRatio.toFixed(2)}</span>
    </div>
    <div class="debug-line">
      <span class="debug-label">Smile Drift:</span>
      <span class="debug-value ${getClass(smileDriftPercent)}">${smileDriftPercent.toFixed(0)}%</span>
    </div>
    <div class="debug-line">
      <span class="debug-label">Liveness:</span>
      <span class="debug-value ${getClass(livenessDriftPercent)}">${livenessDriftPercent.toFixed(0)}%</span>
    </div>
    <div class="debug-line">
      <span class="debug-label">Eyes Closed:</span>
      <span class="debug-value ${getClass(eyesClosedPercent)}">${(state.eyesClosedMs / 1000).toFixed(1)}s</span>
    </div>
    <div class="debug-line">
      <span class="debug-label">Eye Open:</span>
      <span class="debug-value">${data.eyeOpenness.toFixed(4)}</span>
    </div>
    <div class="debug-line">
      <span class="debug-label">Phase:</span>
      <span class="debug-value">${state.escalationPhase}</span>
    </div>
    <div class="debug-line">
      <span class="debug-label">Frames:</span>
      <span class="debug-value">${state.frameCount} / ${state.faceDetectionCount} det</span>
    </div>
  `;

  state.currentDebugData = data;
}

function updateTimer(now) {
  if (state.phase !== 'running') {
    return;
  }
  const elapsed = now - state.startTime;
  timerLabel.textContent = formatTime(elapsed);
}

// Determine escalation phase based on elapsed time
function updateEscalationPhase(elapsed) {
  if (elapsed < 20000) {
    state.escalationPhase = 1; // Onboarding Pressure
  } else if (elapsed < 60000) {
    state.escalationPhase = 2; // Contradiction
  } else {
    state.escalationPhase = 3; // Overload
  }
}

// Policy system - changes expectations
function initPolicy(now) {
  state.currentPolicy = POLICIES.BASELINE_COMPLIANCE;
  state.lastPolicyChange = now;
  state.nextPolicyChange = now + CONFIG.POLICY_CHANGE_MIN_MS +
    Math.random() * (CONFIG.POLICY_CHANGE_MAX_MS - CONFIG.POLICY_CHANGE_MIN_MS);
  state.policyHistory = [];
}

function updatePolicy(now) {
  if (now < state.nextPolicyChange) return;

  const elapsed = now - state.startTime;

  // Don't change policy too early
  if (elapsed < 10000) return;

  // Select new policy (avoid repeating the same one)
  let newPolicyKey;
  do {
    newPolicyKey = POLICY_KEYS[Math.floor(Math.random() * POLICY_KEYS.length)];
  } while (POLICIES[newPolicyKey] === state.currentPolicy && POLICY_KEYS.length > 1);

  const newPolicy = POLICIES[newPolicyKey];
  state.policyHistory.push(state.currentPolicy.name);
  state.currentPolicy = newPolicy;
  state.lastPolicyChange = now;

  log('POLICY', `Changed to ${newPolicy.name}`);

  // Schedule next policy change (faster in later phases)
  const phaseMultiplier = state.escalationPhase === 3 ? 0.5 : state.escalationPhase === 2 ? 0.75 : 1;
  const minMs = CONFIG.POLICY_CHANGE_MIN_MS * phaseMultiplier;
  const maxMs = CONFIG.POLICY_CHANGE_MAX_MS * phaseMultiplier;
  state.nextPolicyChange = now + minMs + Math.random() * (maxMs - minMs);

  // Announce policy change (vaguely or not at all, per spec)
  if (Math.random() < 0.6) {
    const announcement = newPolicy.announcements[Math.floor(Math.random() * newPolicy.announcements.length)];
    setPrompt(announcement);

    // Sometimes add a contradictory message shortly after
    if (state.escalationPhase >= 2 && Math.random() < 0.3) {
      state.contradictionPending = true;
    }
  }
}

function showNotice() {
  if (state.phase !== 'running') {
    notice.classList.add('hidden');
    return;
  }
  const message = getRandomMessage('notice');
  notice.textContent = message;
  notice.classList.remove('hidden');

  // Position notice to sometimes overlap face area (attention theft)
  if (state.escalationPhase >= 2 && Math.random() < 0.3) {
    notice.style.top = '40%';
    notice.style.bottom = 'auto';
    notice.style.left = '50%';
    notice.style.transform = 'translateX(-50%)';
  } else {
    notice.style.top = '';
    notice.style.bottom = '12px';
    notice.style.left = '';
    notice.style.right = '12px';
    notice.style.transform = '';
  }

  setTimeout(() => notice.classList.add('hidden'), 1200 + Math.random() * 800);
}

function showBadge() {
  const badges = ['1', '2', '3', '5', '7', '!', '?', '99+', 'NEW'];
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
  const frequencies = [880, 1046, 784, 659, 523, 698];
  const freq = frequencies[Math.floor(Math.random() * frequencies.length)];
  playPing(freq, 0.1, 0.12);
}

function showSystemMessage() {
  const now = performance.now();
  if (now - state.lastMessageTime < 3000) return;
  state.lastMessageTime = now;

  // Choose message category based on phase and randomness
  let category;
  const roll = Math.random();

  if (state.escalationPhase === 1) {
    category = roll < 0.4 ? 'prompts' : roll < 0.7 ? 'passive_aggressive' : 'warning';
  } else if (state.escalationPhase === 2) {
    if (state.contradictionPending) {
      category = 'contradiction';
      state.contradictionPending = false;
    } else {
      category = roll < 0.2 ? 'prompts' : roll < 0.4 ? 'contradiction' : roll < 0.7 ? 'warning' : 'gaslighting';
    }
  } else {
    if (state.contradictionPending) {
      category = 'contradiction';
      state.contradictionPending = false;
    } else {
      category = roll < 0.15 ? 'prompts' : roll < 0.35 ? 'contradiction' : roll < 0.55 ? 'gaslighting' : roll < 0.8 ? 'warning' : 'passive_aggressive';
    }
  }

  setPrompt(getRandomMessage(category));
}

function triggerScreenShake() {
  if (state.escalationPhase < 2) return;
  const screen = document.querySelector('.screen');
  if (!screen) return;
  screen.style.transform = `translate(${(Math.random() - 0.5) * 4}px, ${(Math.random() - 0.5) * 4}px)`;
  setTimeout(() => {
    screen.style.transform = '';
  }, 100);
}

function triggerDistraction() {
  const phase = state.escalationPhase;

  // Weight distractions by phase
  let options;
  if (phase === 1) {
    options = [showNotice, showBadge, playNotificationPing, showSystemMessage];
  } else if (phase === 2) {
    options = [showNotice, showNotice, showBadge, showVeil, showCursor, playNotificationPing, showSystemMessage, showSystemMessage, triggerScreenShake];
  } else {
    options = [showNotice, showNotice, showBadge, showBadge, showVeil, showVeil, showCursor, showCursor, playNotificationPing, playNotificationPing, showSystemMessage, showSystemMessage, showSystemMessage, triggerScreenShake, triggerScreenShake];
  }

  const pick = options[Math.floor(Math.random() * options.length)];
  pick();

  // In phase 3, sometimes trigger multiple distractions
  if (phase === 3 && Math.random() < 0.4) {
    const secondPick = options[Math.floor(Math.random() * options.length)];
    setTimeout(() => secondPick(), 100 + Math.random() * 300);
  }
}

function scheduleDistractions() {
  if (state.distractions) {
    clearTimeout(state.distractions);
  }
  if (state.phase !== 'running' && state.phase !== 'calibrating') {
    return;
  }

  // Interval decreases with phase and distraction level
  const baseInterval = state.escalationPhase === 3 ? 1800 : state.escalationPhase === 2 ? 2800 : 4000;
  const interval = Math.max(800, baseInterval - state.distractionLevel * 150);
  state.distractionLevel = Math.min(15, state.distractionLevel + 1);

  state.distractions = setTimeout(() => {
    if (state.phase === 'running') {
      triggerDistraction();
    }
    scheduleDistractions();
  }, interval + Math.random() * 1000);
}

function resetMetrics(now) {
  log('METRICS', 'Resetting all metrics');
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
  state.zoneDriftX = 0;
  state.zoneDriftY = 0;
  state.zoneDriftDirX = 1;
  state.zoneDriftDirY = 1;
  state.escalationPhase = 1;
  state.usedMessages.clear();
  state.lastMessageTime = 0;
  state.lastGaslightTime = 0;
  state.contradictionPending = false;
  state.frameCount = 0;
  state.faceDetectionCount = 0;
  initPolicy(now);
}

async function initDetector() {
  log('DETECTOR', 'Initializing TensorFlow backend...');
  await tf.setBackend('webgl');
  await tf.ready();
  log('DETECTOR', 'TensorFlow ready, creating face detector...');
  return faceLandmarksDetection.createDetector(
    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    {
      runtime: 'tfjs',
      refineLandmarks: true
    }
  );
}

// Show loading overlay
function showLoading(text) {
  loadingOverlay.classList.remove('hidden');
  loadingText.textContent = text;
  loadingText.classList.remove('hidden');
  countdownDisplay.classList.add('hidden');
}

// Hide loading overlay
function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

// Run countdown before calibration
async function runCountdown() {
  return new Promise((resolve) => {
    loadingText.classList.add('hidden');
    countdownDisplay.classList.remove('hidden');

    let count = CONFIG.COUNTDOWN_SECONDS;
    countdownDisplay.textContent = count;

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownDisplay.textContent = count;
        playPing(440 + (CONFIG.COUNTDOWN_SECONDS - count) * 110, 0.1, 0.1);
      } else {
        clearInterval(interval);
        playPing(880, 0.15, 0.15);
        resolve();
      }
    }, 1000);
  });
}

async function startGame() {
  startBtn.disabled = true;
  setPrompt('');
  timerLabel.textContent = formatTime(0);
  state.zoneCache = null;

  log('GAME', '=== Starting new game ===');

  // Show loading overlay
  showLoading('Requesting webcam...');
  setStatus('Requesting webcam');

  try {
    if (!video.srcObject) {
      log('WEBCAM', 'Requesting getUserMedia...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      video.srcObject = stream;
      log('WEBCAM', 'Stream obtained', { tracks: stream.getTracks().length });
    }
  } catch (err) {
    log('ERROR', 'Webcam error', { name: err.name, message: err.message });
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
    hideLoading();
    startBtn.disabled = false;
    startBtn.textContent = 'Retry';
    return;
  }

  showLoading('Initializing camera...');
  setStatus('Initializing camera');

  log('WEBCAM', 'Waiting for video metadata...');
  await new Promise((resolve) => {
    if (video.readyState >= 1) {
      resolve();
    } else {
      video.onloadedmetadata = () => resolve();
    }
  });

  try {
    log('WEBCAM', 'Starting video playback...');
    await video.play();
    log('WEBCAM', 'Video playing', {
      width: video.videoWidth,
      height: video.videoHeight,
      readyState: video.readyState
    });
  } catch (err) {
    log('ERROR', 'Video playback error', { name: err.name, message: err.message });
    setStatus('Error');
    setPrompt('Failed to start video playback.');
    hideLoading();
    startBtn.disabled = false;
    startBtn.textContent = 'Retry';
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  log('CANVAS', 'Canvas sized', { width: canvas.width, height: canvas.height });

  // Wait for video to have actual frame data
  log('WEBCAM', 'Waiting for video frames...', { readyState: video.readyState });
  while (video.readyState < 4) {
    await new Promise(r => setTimeout(r, 100));
    log('WEBCAM', 'Still waiting for frames...', { readyState: video.readyState });
  }
  log('WEBCAM', 'Video has frames ready', { readyState: video.readyState });

  // Additional delay to ensure frames are rendering
  await new Promise(r => setTimeout(r, 500));

  if (!state.detector) {
    showLoading('Loading face detection model...');
    setStatus('Loading model...');
    setPrompt('Preparing assessment environment.');
    try {
      state.detector = await initDetector();
      log('DETECTOR', 'Face detector ready');
    } catch (err) {
      log('ERROR', 'Detector init error', { name: err.name, message: err.message });
      setStatus('Error');
      setPrompt('Failed to load face detection model.');
      hideLoading();
      startBtn.disabled = false;
      startBtn.textContent = 'Retry';
      return;
    }
  }

  initAudio();

  // Do test face detections to warm up the model and verify it works
  showLoading('Warming up detection...');
  setStatus('Preparing...');

  // Log video track information
  if (video.srcObject) {
    const videoTrack = video.srcObject.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      log('WEBCAM', 'Video track settings', {
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
        facingMode: settings.facingMode,
        deviceId: settings.deviceId?.substring(0, 8) + '...'
      });
    }
  }

  // Draw a test frame to canvas to verify video is working
  const testCtx = canvas.getContext('2d');
  testCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const testImageData = testCtx.getImageData(0, 0, 10, 10);
  const hasPixelData = testImageData.data.some(v => v > 0);
  const avgBrightness = testImageData.data.reduce((sum, v, i) => i % 4 !== 3 ? sum + v : sum, 0) / (10 * 10 * 3);
  log('WEBCAM', 'Video frame test', {
    hasPixelData,
    avgBrightness: avgBrightness.toFixed(1),
    samplePixels: Array.from(testImageData.data.slice(0, 16))
  });

  if (!hasPixelData || avgBrightness < 5) {
    log('ERROR', 'Video appears to be black or empty!');
    showLoading('Camera not working - check permissions');
    await new Promise(r => setTimeout(r, 2000));
  }

  // Keep test frame visible so user can see what camera sees
  // Don't clear - leave it on screen during warmup

  // Try warmup detection multiple times with both flipHorizontal settings
  let warmupFaces = [];
  let useFlipHorizontal = false;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      // Alternate between flip settings
      const flip = attempt <= 2 ? false : attempt <= 4 ? true : false;
      log('DETECTOR', `Warmup detection attempt ${attempt}/5 (flip=${flip})...`);
      const warmupStart = performance.now();
      warmupFaces = await state.detector.estimateFaces(video, { flipHorizontal: flip });
      const warmupTime = performance.now() - warmupStart;
      log('DETECTOR', `Warmup attempt ${attempt} complete in ${warmupTime.toFixed(0)}ms`, {
        facesFound: warmupFaces.length,
        flipHorizontal: flip
      });

      if (warmupFaces.length > 0) {
        useFlipHorizontal = flip;
        log('DETECTOR', 'Face found during warmup!', {
          box: warmupFaces[0].box,
          keypointsCount: warmupFaces[0].keypoints?.length,
          flipHorizontal: flip
        });
        break;
      }

      // Wait before retry
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      log('ERROR', `Warmup attempt ${attempt} failed`, { name: err.name, message: err.message });
    }
  }

  // Store the flip setting that worked
  state.useFlipHorizontal = useFlipHorizontal;
  testCtx.clearRect(0, 0, canvas.width, canvas.height);

  if (warmupFaces.length === 0) {
    log('WARNING', 'No face detected during warmup after 5 attempts');
    log('WARNING', 'Check: Is your face visible in the camera? Is lighting adequate?');
    log('WARNING', 'The video frame was drawn to canvas - can you see yourself?');
    showLoading('No face detected - check camera');
    setPrompt('Position your face in the camera view.');
    await new Promise(r => setTimeout(r, 2000));
  }

  // Show "Get Ready" message
  showLoading('Get Ready!');
  setStatus('Get Ready');
  setPrompt('Position your face in the center of the screen.');

  // Wait a moment, then countdown
  await new Promise(r => setTimeout(r, 1000));

  // Run countdown
  await runCountdown();

  // Hide loading overlay and start calibration
  hideLoading();

  setStatus('Calibrating');
  setPrompt('Hold steady. Face the system.');
  state.phase = 'calibrating';
  state.lastFrameTime = performance.now();
  state.lastFaceTime = performance.now();
  state.lastDetectionTime = 0;
  resetMetrics(performance.now());

  log('GAME', 'Calibration phase started');

  // Start the detection loop immediately
  state.rafId = requestAnimationFrame(loop);

  // Schedule transition to running after calibration
  setTimeout(() => {
    if (state.phase === 'calibrating') {
      state.phase = 'running';
      state.startTime = performance.now();
      setStatus('Assessment Active');
      setPrompt('Your compliance is being evaluated.');
      log('GAME', '=== Assessment started ===');
      scheduleDistractions();
    }
  }, CONFIG.CALIBRATION_MS);
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

  const windowMs = CONFIG.MOVEMENT_WINDOW_MS;
  let pruneIndex = 0;
  while (pruneIndex < state.movementSamples.length &&
         now - state.movementSamples[pruneIndex].time > windowMs) {
    pruneIndex++;
  }
  if (pruneIndex > 0) {
    state.movementSamples = state.movementSamples.slice(pruneIndex);
  }

  if (state.movementSamples.length > CONFIG.MAX_MOVEMENT_SAMPLES) {
    state.movementSamples = state.movementSamples.slice(-CONFIG.MAX_MOVEMENT_SAMPLES);
  }

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

function failRun(message, reason = 'unknown') {
  const elapsed = state.startTime > 0 ? performance.now() - state.startTime : 0;
  log('FAILURE', `=== GAME OVER: ${reason} ===`, {
    message,
    elapsed: elapsed.toFixed(0) + 'ms',
    eyeDrift: state.eyeDrift.toFixed(3),
    smileDrift: state.smileDrift.toFixed(3),
    livenessDrift: state.livenessDrift.toFixed(3),
    gazeAwayMs: state.gazeAwayMs.toFixed(0),
    eyesClosedMs: state.eyesClosedMs.toFixed(0),
    frameCount: state.frameCount,
    faceDetectionCount: state.faceDetectionCount
  });

  state.failureTime = performance.now();
  state.phase = 'failed';
  setStatus('Assessment Concluded');

  // Cold, neutral failure message per spec
  const terminalMessage = getRandomMessage('terminal');
  setPrompt(message + ' ' + terminalMessage);

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
  startBtn.textContent = 'Retry Assessment';
  scoreEntry.classList.remove('hidden');
  submitScore.disabled = false;

  // Keep debug panel visible after failure
  if (DEBUG_MODE && state.currentDebugData) {
    updateDebugPanel(state.currentDebugData);
  }
}

async function loop(now) {
  if (state.phase === 'idle') {
    state.rafId = null;
    return;
  }

  state.frameCount++;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const dt = now - state.lastFrameTime;
  state.lastFrameTime = now;

  // Update zone drift
  if (state.phase === 'running') {
    updateZoneDrift(dt);

    const elapsed = now - state.startTime;
    updateEscalationPhase(elapsed);
    updatePolicy(now);
  }

  // Draw zone (very subtle, per spec)
  drawZone(ctx, canvas.width, canvas.height);

  updateTimer(now);

  // Throttle face detection
  const timeSinceLastDetection = now - state.lastDetectionTime;
  if (state.processing || !state.detector || timeSinceLastDetection < CONFIG.DETECTION_THROTTLE_MS) {
    state.rafId = requestAnimationFrame(loop);
    return;
  }

  state.processing = true;
  state.lastDetectionTime = now;

  let faces;
  try {
    faces = await state.detector.estimateFaces(video, { flipHorizontal: state.useFlipHorizontal || false });
    state.faceDetectionCount++;
  } catch (err) {
    log('ERROR', 'Face detection error', { name: err.name, message: err.message });
    state.processing = false;
    state.rafId = requestAnimationFrame(loop);
    return;
  }

  state.processing = false;

  if (!faces.length) {
    const timeSinceFace = now - state.lastFaceTime;
    log('DETECTION', `No face detected for ${timeSinceFace.toFixed(0)}ms`);

    if (timeSinceFace > CONFIG.FACE_LOST_MS && state.phase === 'running') {
      failRun('Tracking lost.', 'face_lost');
      return;
    }

    // Update debug panel even when no face
    if (DEBUG_MODE) {
      updateDebugPanel({
        inZone: false,
        smileRatio: 0,
        eyeOpenness: 0
      });
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

  // Get zone with drift offset
  const offset = getZoneOffset();
  const zoneWidth = width * CONFIG.ZONE_WIDTH_RATIO;
  const zoneHeight = height * CONFIG.ZONE_HEIGHT_RATIO;
  const zoneX = (width - zoneWidth) / 2 + offset.x;
  const zoneY = (height - zoneHeight) / 2 + offset.y;

  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2
  };

  const inZone =
    eyeCenter.x > zoneX &&
    eyeCenter.x < zoneX + zoneWidth &&
    eyeCenter.y > zoneY &&
    eyeCenter.y < zoneY + zoneHeight;

  // Apply policy multipliers
  const policy = state.currentPolicy || POLICIES.BASELINE_COMPLIANCE;
  const gazeMultiplier = policy.gazeMultiplier;
  const smileMultiplier = policy.smileMultiplier;
  const livenessMultiplier = policy.livenessMultiplier;

  if (inZone) {
    state.eyeDrift = Math.max(0, state.eyeDrift - dt / 400);
    state.gazeAwayMs = Math.max(0, state.gazeAwayMs - dt * 2);
  } else {
    state.eyeDrift += (dt / 1500) * gazeMultiplier;  // Slower accumulation
    state.gazeAwayMs += dt * gazeMultiplier;
  }

  const mouthWidth = distance(mouthLeft, mouthRight);
  const mouthHeight = distance(upperLip, lowerLip);
  const smileRatio = mouthWidth / Math.max(1, mouthHeight);

  // Smile detection - more forgiving
  const effectiveSmileThreshold = CONFIG.SMILE_THRESHOLD;
  const smileOk = smileRatio > effectiveSmileThreshold * 0.8; // 20% more forgiving

  if (smileOk) {
    state.smileDrift = Math.max(0, state.smileDrift - dt / 400);
  } else {
    state.smileDrift += (dt / 2000) * smileMultiplier;  // Much slower accumulation
  }

  const movementTotal = updateMovement(now, nose, leftEye, rightEye, width);
  if (movementTotal < CONFIG.MOVEMENT_THRESHOLD) {
    state.livenessDrift += (dt / 3000) * livenessMultiplier;  // Slower liveness check
  } else {
    state.livenessDrift = Math.max(0, state.livenessDrift - dt / 400);
  }

  const eyeOpenness = getEyeOpenness(leftUpper, leftLower, rightUpper, rightLower, width);
  const eyesClosed = eyeOpenness < CONFIG.EYE_OPENNESS_THRESHOLD;

  // Draw debug info on canvas
  const debugData = { inZone, smileRatio, eyeOpenness };
  drawDebugCanvas(ctx, width, height, debugData);

  // Update sidebar debug panel
  if (DEBUG_MODE) {
    updateDebugPanel(debugData);
  }

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

  // Tighter thresholds in later phases
  const phaseThresholdMultiplier = state.escalationPhase === 3 ? 0.8 : state.escalationPhase === 2 ? 0.9 : 1.0;
  const gazeLimit = CONFIG.GAZE_AWAY_LIMIT_MS * phaseThresholdMultiplier;
  const eyesClosedLimit = CONFIG.EYES_CLOSED_LIMIT_MS * phaseThresholdMultiplier;

  if (state.phase === 'running') {
    // Log periodic status during running
    if (state.frameCount % 60 === 0) {
      log('RUNNING', 'Status check', {
        elapsed: ((now - state.startTime) / 1000).toFixed(1) + 's',
        inZone,
        eyeDrift: state.eyeDrift.toFixed(3),
        smileDrift: state.smileDrift.toFixed(3),
        livenessDrift: state.livenessDrift.toFixed(3),
        gazeAwayMs: state.gazeAwayMs.toFixed(0),
        eyesClosedMs: state.eyesClosedMs.toFixed(0)
      });
    }

    if (state.eyeDrift > 1) {
      failRun(getFailureMessage('gaze'), 'eye_drift_exceeded');
      return;
    }
    if (state.gazeAwayMs > gazeLimit) {
      failRun(getFailureMessage('gaze'), 'gaze_away_limit');
      return;
    }
    if (state.smileDrift > 1) {
      failRun(getFailureMessage('expression'), 'smile_drift_exceeded');
      return;
    }
    if (state.livenessDrift > 1) {
      failRun(getFailureMessage('presence'), 'liveness_drift_exceeded');
      return;
    }
    if (state.eyesClosedMs > eyesClosedLimit) {
      failRun(getFailureMessage('blink'), 'eyes_closed_limit');
      return;
    }
    if (state.blinkDrift > 1) {
      failRun(getFailureMessage('liveness'), 'blink_drift_exceeded');
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
      const classification = getClassification(score.time_ms);
      const item = document.createElement('li');
      item.innerHTML = `<strong>${escapeHtml(score.name)}</strong> — ${formatTime(score.time_ms)} <span class="classification">[${classification.label}]</span>`;
      scoresList.appendChild(item);
    });
  } catch (err) {
    scoresList.innerHTML = '';
    const errItem = document.createElement('li');
    errItem.textContent = 'Unable to load leaderboard.';
    scoresList.appendChild(errItem);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function submitScoreEntry() {
  const name = playerName.value.trim() || 'SUBJECT';
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
      setPrompt(data.error || 'Submission failed.');
      submitScore.disabled = false;
      return;
    }
  } catch (err) {
    setPrompt('Network error.');
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
    startBtn.textContent = 'Begin Assessment';
    state.phase = 'idle';

    // Hide debug panel on new game start
    if (debugPanel) {
      debugPanel.classList.add('hidden');
    }

    startGame();
  }
}

startBtn.addEventListener('click', handleStart);

startBtn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleStart();
  }
});

// Global keyboard shortcut - Space to start/retry
document.addEventListener('keydown', (e) => {
  if (e.key === ' ' && document.activeElement !== playerName) {
    e.preventDefault();
    handleStart();
  }
});

submitScore.addEventListener('click', submitScoreEntry);

playerName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!submitScore.disabled) {
      submitScoreEntry();
    }
  }
});

window.addEventListener('beforeunload', () => {
  stopVideoStream();
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
  }
});

log('INIT', 'Game initialized');
fetchScores();
setPrompt('Awaiting subject.');
