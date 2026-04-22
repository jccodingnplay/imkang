/**
 * game.js — 리듬게임 메인 엔진
 * 렌더링, 입력, 판정, UI 상태 관리
 */

// ─── 상태 ───────────────────────────────────────────────
const state = {
  screen: 'menu',        // menu | game | result
  selectedSong: 0,
  selectedDiff: 'normal',
  score: 0,
  combo: 0,
  maxCombo: 0,
  totalNotes: 0,
  hitNotes: 0,
  judgments: { perfect: 0, good: 0, miss: 0 },
  notes: [],             // 현재 곡 노트
  activeNotes: [],       // 화면상 노트
  paused: false,
  gameStartTime: 0,
  gameRunning: false,
  lanePressed: [false, false, false, false],
  animFrame: null,
};

// ─── DOM 참조 ────────────────────────────────────────────
const screens = {
  menu:   document.getElementById('menu-screen'),
  game:   document.getElementById('game-screen'),
  result: document.getElementById('result-screen'),
};
const bgCanvas    = document.getElementById('bg-canvas');
const gameCanvas  = document.getElementById('game-canvas');
const bgCtx       = bgCanvas.getContext('2d');
const gCtx        = gameCanvas.getContext('2d');

// ─── 상수 ────────────────────────────────────────────────
const LANE_COUNT      = 4;
const NOTE_SPEED_BASE = 400;  // px/sec
const LANE_W_RATIO    = 0.15; // 각 레인 너비 = 전체의 %
const RECEPTOR_H      = 0.88; // 화면 높이의 몇 % 위치에 판정선

let CANVAS_W = 0, CANVAS_H = 0;
let LANE_W = 0, GAME_W = 0, GAME_X = 0;
let RECEPTOR_Y = 0;
let NOTE_SPEED = NOTE_SPEED_BASE;

// ─── 배경 파티클 ──────────────────────────────────────────
const bgParticles = [];
function initBgParticles() {
  bgParticles.length = 0;
  const count = Math.floor(window.innerWidth * window.innerHeight / 6000);
  for (let i = 0; i < count; i++) {
    bgParticles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.1,
      color: ['#a259ff', '#00e5ff', '#ff2d78', '#ffdd00'][Math.floor(Math.random() * 4)],
    });
  }
}

function drawBg() {
  const W = bgCanvas.width, H = bgCanvas.height;
  bgCtx.clearRect(0, 0, W, H);
  bgCtx.fillStyle = '#050510';
  bgCtx.fillRect(0, 0, W, H);

  // 그리드 라인
  bgCtx.strokeStyle = 'rgba(162,89,255,0.06)';
  bgCtx.lineWidth = 1;
  const gridSize = 60;
  for (let x = 0; x < W; x += gridSize) {
    bgCtx.beginPath(); bgCtx.moveTo(x, 0); bgCtx.lineTo(x, H); bgCtx.stroke();
  }
  for (let y = 0; y < H; y += gridSize) {
    bgCtx.beginPath(); bgCtx.moveTo(0, y); bgCtx.lineTo(W, y); bgCtx.stroke();
  }

  // 파티클
  for (const p of bgParticles) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    bgCtx.beginPath();
    bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    bgCtx.fillStyle = p.color + Math.floor(p.alpha * 255).toString(16).padStart(2, '0');
    bgCtx.fill();
  }

  // 중앙 글로우
  const grd = bgCtx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.4);
  grd.addColorStop(0, 'rgba(162,89,255,0.06)');
  grd.addColorStop(1, 'transparent');
  bgCtx.fillStyle = grd;
  bgCtx.fillRect(0, 0, W, H);
}

// ─── 리사이즈 ─────────────────────────────────────────────
function onResize() {
  bgCanvas.width  = window.innerWidth;
  bgCanvas.height = window.innerHeight;

  // 게임 캔버스는 게임 영역에 맞춤
  const gameArea = document.querySelector('.game-area');
  if (gameArea) {
    CANVAS_W = gameArea.clientWidth;
    CANVAS_H = gameArea.clientHeight;
    gameCanvas.width  = CANVAS_W;
    gameCanvas.height = CANVAS_H;
  }

  LANE_W    = Math.min(120, CANVAS_W * LANE_W_RATIO);
  GAME_W    = LANE_W * LANE_COUNT;
  GAME_X    = (CANVAS_W - GAME_W) / 2;
  RECEPTOR_Y = CANVAS_H * RECEPTOR_H;
  NOTE_SPEED = NOTE_SPEED_BASE * (CANVAS_H / 600);

  // 레인 키 버튼 크기
  const laneKeys = document.querySelectorAll('.lane-key');
  laneKeys.forEach((el, i) => {
    el.style.width  = LANE_W + 'px';
    el.style.height = Math.min(80, LANE_W * 0.75) + 'px';
    el.style.fontSize = (LANE_W * 0.3) + 'px';
  });

  initBgParticles();
}

// ─── 메뉴 초기화 ──────────────────────────────────────────
function initMenu() {
  const songList = document.getElementById('song-list');
  songList.innerHTML = '';
  SONGS.forEach((song, i) => {
    const card = document.createElement('div');
    card.className = 'song-card' + (i === state.selectedSong ? ' selected' : '');
    card.style.setProperty('--card-accent', song.cardAccent);
    card.innerHTML = `
      <div class="song-icon" style="background:${song.color}22">${song.icon}</div>
      <div class="song-meta">
        <div class="song-card-name">${song.name}</div>
        <div class="song-card-artist">${song.artist}</div>
      </div>
      <div class="song-card-bpm">${song.bpm} BPM</div>
    `;
    card.addEventListener('click', () => {
      state.selectedSong = i;
      document.querySelectorAll('.song-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
    songList.appendChild(card);
  });

  // 난이도 버튼
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedDiff = btn.dataset.diff;
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('start-btn').addEventListener('click', startCountdown);
}

// ─── 화면 전환 ────────────────────────────────────────────
function showScreen(name) {
  state.screen = name;
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
}

// ─── 카운트다운 ───────────────────────────────────────────
function startCountdown() {
  const overlay = document.getElementById('countdown-overlay');
  const numEl   = document.getElementById('countdown-number');
  showScreen('game');
  // ★ 게임 화면이 표시된 후 캔버스 크기를 재계산
  onResize();
  overlay.classList.remove('hidden');

  let count = 3;
  numEl.textContent = count;
  numEl.style.animation = 'none'; void numEl.offsetWidth;
  numEl.style.animation = '';

  const tick = setInterval(() => {
    count--;
    if (count <= 0) {
      clearInterval(tick);
      overlay.classList.add('hidden');
      startGame();
    } else {
      numEl.textContent = count;
      numEl.style.animation = 'none'; void numEl.offsetWidth;
      numEl.style.animation = 'countPulse 0.9s ease-out';
    }
  }, 1000);
}

// ─── 게임 시작 ────────────────────────────────────────────
function startGame() {
  const song = SONGS[state.selectedSong];

  // 상태 초기화
  Object.assign(state, {
    score: 0, combo: 0, maxCombo: 0, hitNotes: 0,
    judgments: { perfect: 0, good: 0, miss: 0 },
    paused: false, gameRunning: true,
  });

  // 비트맵 생성
  state.notes = generateBeatmap(state.selectedSong, state.selectedDiff);
  state.totalNotes = state.notes.length;
  state.activeNotes = state.notes.map(n => ({ ...n, y: -50, hit: false, missed: false }));

  // HUD
  document.getElementById('hud-song-name').textContent   = song.name;
  document.getElementById('hud-song-artist').textContent = song.artist;
  updateHUD();

  // 리드인: 화면 위쪽에서 판정선까지 노트가 내려오는 시간
  const leadIn = RECEPTOR_Y / NOTE_SPEED; // 초 단위 (보통 1.2~1.8초)

  // 음악 재생 (leadIn 이후에 시작)
  audioEngine.play(song.id, song.bpm, song.bars, leadIn, onSongEnd);
  state.gameStartTime = audioEngine.startTime;

  // 게임 루프
  if (state.animFrame) cancelAnimationFrame(state.animFrame);
  state.lastTimestamp = performance.now();
  state.animFrame = requestAnimationFrame(gameLoop);
}

function onSongEnd() {
  state.gameRunning = false;
  setTimeout(showResult, 500);
}

// ─── 게임 루프 ────────────────────────────────────────────
function gameLoop(timestamp) {
  if (!state.gameRunning) return;
  if (state.paused) { state.animFrame = requestAnimationFrame(gameLoop); return; }

  const elapsed = audioEngine.getElapsedTime(); // 초 단위

  // 노트 위치 업데이트
  for (const note of state.activeNotes) {
    if (note.hit || note.missed) continue;
    // 판정선 도달 시간까지 남은 시간 = note.time - elapsed
    const timeDiff = note.time - elapsed;
    note.y = RECEPTOR_Y - timeDiff * NOTE_SPEED;

    // Miss 판정: 판정선을 지나쳐 버린 경우 (elapsed가 양수일 때만 체크)
    const windows = JUDGMENT_WINDOWS[state.selectedDiff];
    if (elapsed > note.time + (windows.good / 1000)) {
      note.missed = true;
      onMiss();
    }
  }

  // 프로그레스 바
  document.getElementById('progress-bar').style.width = (audioEngine.getProgress() * 100) + '%';

  // 렌더
  drawGame(elapsed);

  state.animFrame = requestAnimationFrame(gameLoop);
}

// ─── 렌더링 ───────────────────────────────────────────────
const NOTE_H  = 22;
const NOTE_R  = 6;
const GLOW_COLORS = LANE_COLORS;

function drawGame(elapsed) {
  gCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // 레인 배경
  for (let i = 0; i < LANE_COUNT; i++) {
    const x = GAME_X + i * LANE_W;
    const grad = gCtx.createLinearGradient(x, 0, x, CANVAS_H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, LANE_COLORS[i] + '18');
    gCtx.fillStyle = grad;
    gCtx.fillRect(x, 0, LANE_W, CANVAS_H);

    // 레인 경계선
    gCtx.strokeStyle = 'rgba(255,255,255,0.06)';
    gCtx.lineWidth = 1;
    gCtx.beginPath(); gCtx.moveTo(x, 0); gCtx.lineTo(x, CANVAS_H); gCtx.stroke();
  }
  gCtx.strokeStyle = 'rgba(255,255,255,0.06)';
  gCtx.beginPath();
  gCtx.moveTo(GAME_X + GAME_W, 0);
  gCtx.lineTo(GAME_X + GAME_W, CANVAS_H);
  gCtx.stroke();

  // 판정선 글로우
  gCtx.save();
  const receptorGrad = gCtx.createLinearGradient(GAME_X, 0, GAME_X + GAME_W, 0);
  LANE_COLORS.forEach((c, i) => {
    receptorGrad.addColorStop(i / LANE_COUNT, c + 'aa');
    receptorGrad.addColorStop((i + 1) / LANE_COUNT, c + 'aa');
  });
  gCtx.strokeStyle = receptorGrad;
  gCtx.lineWidth = 3;
  gCtx.shadowBlur = 20;
  gCtx.shadowColor = '#a259ff';
  gCtx.beginPath();
  gCtx.moveTo(GAME_X, RECEPTOR_Y);
  gCtx.lineTo(GAME_X + GAME_W, RECEPTOR_Y);
  gCtx.stroke();
  gCtx.restore();

  // 수용기 (Receptor) — 각 레인
  for (let i = 0; i < LANE_COUNT; i++) {
    const x = GAME_X + i * LANE_W;
    const cx = x + LANE_W / 2;
    const pressed = state.lanePressed[i];

    gCtx.save();
    gCtx.shadowBlur = pressed ? 30 : 10;
    gCtx.shadowColor = LANE_COLORS[i];

    // 수용기 박스
    const rW = LANE_W * 0.72, rH = NOTE_H + 4;
    const rX = cx - rW / 2, rY = RECEPTOR_Y - rH / 2;

    gCtx.fillStyle = pressed
      ? LANE_COLORS[i] + 'cc'
      : LANE_COLORS[i] + '33';
    roundRect(gCtx, rX, rY, rW, rH, NOTE_R);
    gCtx.fill();

    gCtx.strokeStyle = LANE_COLORS[i] + (pressed ? 'ff' : '88');
    gCtx.lineWidth = 2;
    roundRect(gCtx, rX, rY, rW, rH, NOTE_R);
    gCtx.stroke();
    gCtx.restore();
  }

  // 노트 렌더링
  for (const note of state.activeNotes) {
    if (note.hit || note.missed) continue;
    if (note.y < -NOTE_H * 2 || note.y > CANVAS_H + NOTE_H) continue;

    const x  = GAME_X + note.lane * LANE_W;
    const cx = x + LANE_W / 2;
    const nW = LANE_W * 0.72;
    const nX = cx - nW / 2;
    const nY = note.y - NOTE_H / 2;
    const color = LANE_COLORS[note.lane];

    gCtx.save();
    gCtx.shadowBlur = 18;
    gCtx.shadowColor = color;

    // 노트 그라디언트
    const nGrad = gCtx.createLinearGradient(nX, nY, nX, nY + NOTE_H);
    nGrad.addColorStop(0, '#fff');
    nGrad.addColorStop(0.4, color);
    nGrad.addColorStop(1, color + '88');
    gCtx.fillStyle = nGrad;
    roundRect(gCtx, nX, nY, nW, NOTE_H, NOTE_R);
    gCtx.fill();

    // 노트 테두리
    gCtx.strokeStyle = '#ffffff88';
    gCtx.lineWidth = 1.5;
    roundRect(gCtx, nX, nY, nW, NOTE_H, NOTE_R);
    gCtx.stroke();

    // 광택 효과
    gCtx.fillStyle = 'rgba(255,255,255,0.3)';
    roundRect(gCtx, nX + 2, nY + 2, nW - 4, NOTE_H * 0.4, NOTE_R - 2);
    gCtx.fill();

    gCtx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── 입력 처리 ────────────────────────────────────────────
const KEY_MAP = { 'a': 0, 's': 1, 'd': 2, 'f': 3 };

document.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  const lane = KEY_MAP[key];
  if (lane === undefined) return;
  if (e.repeat) return;

  if (state.screen === 'game' && state.gameRunning && !state.paused) {
    pressLane(lane);
  }
});

document.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  const lane = KEY_MAP[key];
  if (lane === undefined) return;
  releaseLane(lane);
});

// ESC: 일시정지
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.screen === 'game' && state.gameRunning) togglePause();
});

function pressLane(lane) {
  state.lanePressed[lane] = true;
  const keyEl = document.getElementById('key-' + 'asdf'[lane]);
  if (keyEl) keyEl.classList.add('pressed');

  // 판정 (리드인 중에는 히트 불가 — elapsed가 충분히 커야 함)
  const elapsed = audioEngine.getElapsedTime();
  const windows = JUDGMENT_WINDOWS[state.selectedDiff];
  let bestDiff = Infinity, bestNote = null;

  for (const note of state.activeNotes) {
    if (note.hit || note.missed || note.lane !== lane) continue;
    const diff = Math.abs((note.time - elapsed) * 1000); // ms
    if (diff < bestDiff && diff < windows.good) {
      bestDiff = diff;
      bestNote = note;
    }
  }

  if (!bestNote) return;

  bestNote.hit = true;
  const diffMs = Math.abs((bestNote.time - elapsed) * 1000);

  if (diffMs <= windows.perfect) {
    onPerfect(lane, bestNote.y);
  } else {
    onGood(lane, bestNote.y);
  }
}

function releaseLane(lane) {
  state.lanePressed[lane] = false;
  const keyEl = document.getElementById('key-' + 'asdf'[lane]);
  if (keyEl) keyEl.classList.remove('pressed');
}

// ─── 판정 ─────────────────────────────────────────────────
function onPerfect(lane, y) {
  state.judgments.perfect++;
  state.score += 1000 + state.combo * 2;
  state.combo++;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.hitNotes++;
  showJudgment('PERFECT', 'perfect');
  spawnParticles(lane, y || RECEPTOR_Y, LANE_COLORS[lane]);
  updateHUD();
}

function onGood(lane, y) {
  state.judgments.good++;
  state.score += 500 + state.combo;
  state.combo++;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.hitNotes++;
  showJudgment('GOOD', 'good');
  updateHUD();
}

function onMiss() {
  state.judgments.miss++;
  state.combo = 0;
  showJudgment('MISS', 'miss');
  updateHUD();
}

// ─── 판정 텍스트 ──────────────────────────────────────────
let judgmentTimer = null;
function showJudgment(text, cls) {
  const el = document.getElementById('judgment-display');
  el.textContent = text;
  el.className = 'judgment-display ' + cls;
  void el.offsetWidth;
  el.classList.add('show');
  if (judgmentTimer) clearTimeout(judgmentTimer);
  judgmentTimer = setTimeout(() => el.classList.remove('show'), 500);
}

// ─── 파티클 ───────────────────────────────────────────────
function spawnParticles(lane, y, color) {
  const container = document.getElementById('particles-container');
  const cx = GAME_X + lane * LANE_W + LANE_W / 2;
  const count = 12;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 8 + 4;
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
    const dist = Math.random() * 80 + 30;
    p.style.cssText = `
      left: ${cx}px; top: ${y}px;
      width: ${size}px; height: ${size}px;
      background: ${color};
      box-shadow: 0 0 ${size}px ${color};
      --dx: ${Math.cos(angle) * dist}px;
      --dy: ${Math.sin(angle) * dist - 40}px;
      animation-duration: ${0.5 + Math.random() * 0.3}s;
    `;
    container.appendChild(p);
    setTimeout(() => p.remove(), 900);
  }
}

// ─── HUD 업데이트 ─────────────────────────────────────────
function updateHUD() {
  document.getElementById('score-value').textContent = state.score.toLocaleString();
  document.getElementById('combo-value').textContent = state.combo;

  // 콤보 펄스 애니메이션
  const comboEl = document.getElementById('combo-display');
  comboEl.classList.remove('pulse');
  void comboEl.offsetWidth;
  if (state.combo > 0) comboEl.classList.add('pulse');

  // 정확도 계산
  const total = state.hitNotes + state.judgments.miss;
  let acc = 100;
  if (total > 0) {
    acc = ((state.judgments.perfect * 1.0 + state.judgments.good * 0.6) /
           (state.judgments.perfect + state.judgments.good + state.judgments.miss)) * 100;
  }
  document.getElementById('accuracy-value').textContent = acc.toFixed(2) + '%';
}

// ─── 일시정지 ─────────────────────────────────────────────
function togglePause() {
  state.paused = !state.paused;
  document.getElementById('pause-overlay').classList.toggle('hidden', !state.paused);
  if (state.paused) audioEngine.ctx.suspend();
  else audioEngine.ctx.resume();
}

document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('resume-btn').addEventListener('click', () => {
  state.paused = false;
  document.getElementById('pause-overlay').classList.add('hidden');
  audioEngine.ctx.resume();
});
document.getElementById('quit-btn').addEventListener('click', () => {
  audioEngine.stop();
  state.gameRunning = false;
  state.paused = false;
  document.getElementById('pause-overlay').classList.add('hidden');
  showScreen('menu');
});

// ─── 결과 화면 ────────────────────────────────────────────
function showResult() {
  showScreen('result');
  const total = state.judgments.perfect + state.judgments.good + state.judgments.miss;
  let acc = 0;
  if (total > 0) {
    acc = ((state.judgments.perfect * 1.0 + state.judgments.good * 0.6) / total) * 100;
  }

  // 등급 계산
  let grade = 'D';
  if (acc >= 98) grade = 'S';
  else if (acc >= 95) grade = 'A';
  else if (acc >= 88) grade = 'B';
  else if (acc >= 75) grade = 'C';

  // 등급 색상
  const gradeColors = {
    S: 'linear-gradient(135deg, #ffe066, #ff8800)',
    A: 'linear-gradient(135deg, #a259ff, #ff2d78)',
    B: 'linear-gradient(135deg, #00e5ff, #0080ff)',
    C: 'linear-gradient(135deg, #66ffb2, #00cc88)',
    D: 'linear-gradient(135deg, #888, #555)',
  };

  const gradeEl = document.getElementById('result-grade');
  gradeEl.textContent = grade;
  gradeEl.style.background = gradeColors[grade];
  gradeEl.style.webkitBackgroundClip = 'text';
  gradeEl.style.webkitTextFillColor = 'transparent';
  gradeEl.style.animation = 'none'; void gradeEl.offsetWidth;
  gradeEl.style.animation = 'gradeAppear 0.5s cubic-bezier(0.34,1.56,0.64,1) both';

  document.getElementById('result-song-name').textContent = SONGS[state.selectedSong].name;
  document.getElementById('result-score').textContent     = state.score.toLocaleString();
  document.getElementById('result-accuracy').textContent  = acc.toFixed(2) + '%';
  document.getElementById('result-combo').textContent     = state.maxCombo;
  document.getElementById('result-perfect').textContent   = state.judgments.perfect;
  document.getElementById('result-good').textContent      = state.judgments.good;
  document.getElementById('result-miss').textContent      = state.judgments.miss;
}

document.getElementById('retry-btn').addEventListener('click', () => {
  showScreen('game');
  startCountdown();
});
document.getElementById('menu-btn-result').addEventListener('click', () => {
  showScreen('menu');
});

// ─── 배경 루프 ────────────────────────────────────────────
function bgLoop() {
  drawBg();
  requestAnimationFrame(bgLoop);
}

// ─── 초기화 ───────────────────────────────────────────────
window.addEventListener('resize', () => { onResize(); });

onResize();
initMenu();
bgLoop();
showScreen('menu');
