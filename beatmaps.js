/**
 * beatmaps.js — 곡 메타데이터 & 비트맵 생성기
 * 각 곡의 BPM에 맞춰 노트를 자동 생성합니다.
 */

// 곡 정보
const SONGS = [
  {
    id: 0,
    name: 'Neon Rush',
    artist: 'Cyber Synth (NCS Style)',
    bpm: 128,
    bars: 32,
    icon: '⚡',
    color: '#ff2d78',
    cardAccent: '#ff2d78',
    description: 'Uplifting EDM',
  },
  {
    id: 1,
    name: 'Cyber Dream',
    artist: 'Future Bass Lab (NCS Style)',
    bpm: 140,
    bars: 32,
    icon: '🌌',
    color: '#00e5ff',
    cardAccent: '#00e5ff',
    description: 'Melodic Future Bass',
  },
  {
    id: 2,
    name: 'Phoenix Wave',
    artist: 'Quantum Drops (NCS Style)',
    bpm: 150,
    bars: 32,
    icon: '🔥',
    color: '#a259ff',
    cardAccent: '#a259ff',
    description: 'Energetic Dubstep',
  },
];

// 판정 윈도우 (ms)
const JUDGMENT_WINDOWS = {
  easy:   { perfect: 100, good: 180 },
  normal: { perfect: 70,  good: 130 },
  hard:   { perfect: 45,  good: 90  },
};

// 난이도별 노트 밀도 조절
const DIFFICULTY_DENSITY = {
  easy:   0.45,
  normal: 0.70,
  hard:   1.00,
};

// 레인별 색상
const LANE_COLORS = ['#ff2d78', '#00e5ff', '#a259ff', '#ffdd00'];
const LANE_KEYS   = ['A', 'S', 'D', 'F'];

/**
 * 비트맵 생성 — BPM, 마디 수, 난이도를 받아 노트 배열을 반환
 * 각 노트: { time: number(s), lane: 0-3 }
 */
function generateBeatmap(songId, difficulty) {
  const song    = SONGS[songId];
  const bpm     = song.bpm;
  const bars    = song.bars;
  const density = DIFFICULTY_DENSITY[difficulty];

  const beat = 60 / bpm;
  const bar  = beat * 4;
  const notes = [];

  // 패턴 라이브러리 (0=A, 1=S, 2=D, 3=F)
  const patterns = {
    // 기본 4분음표
    quarter:    [0, 1, 2, 3],
    // 8분음표 교대
    eighth:     [0, 2, 1, 3, 2, 0, 3, 1],
    // 왼쪽 롤
    rollLeft:   [0, 1, 2, 3, 2, 1],
    // 오른쪽 롤
    rollRight:  [3, 2, 1, 0, 1, 2],
    // 트릴 (AB)
    trillAB:    [0, 1, 0, 1, 0, 1, 0, 1],
    // 트릴 (CD)
    trillCD:    [2, 3, 2, 3, 2, 3, 2, 3],
    // 쉐이크
    shake:      [0, 3, 1, 2, 3, 0, 2, 1],
    // 드롭 패턴 (강렬)
    dropA:      [0, 2, 1, 3, 0, 3, 1, 2, 2, 0, 3, 1],
    dropB:      [1, 0, 2, 3, 1, 3, 0, 2, 3, 1, 2, 0],
    // 동시타 (Hard)
    chord2A:    [[0,1], 2, [0,1], 2, 3, [2,3], 0, [2,3]],
    chord2B:    [[0,3], 1, 2, [1,2], [0,3], 2, 1, [0,3]],
  };

  // 구간별 패턴 배정
  for (let bar_i = 0; bar_i < bars; bar_i++) {
    const phase  = bar_i % 16;
    const barTime = bar_i * bar;

    // INTRO (0-3): 4분음표만
    if (phase < 4) {
      if (Math.random() < density * 0.6) {
        for (let b = 0; b < 4; b++) {
          if (Math.random() < density * 0.5) {
            notes.push({ time: barTime + b * beat, lane: patterns.quarter[b % 4] });
          }
        }
      }
    }

    // BUILD-UP (4-7): 8분음표 시작
    else if (phase < 8) {
      const subdivisions = 8;
      const subBeat = beat / 2;
      const pat = Math.random() < 0.5 ? patterns.eighth : patterns.rollLeft;
      for (let s = 0; s < subdivisions; s++) {
        if (Math.random() < density * 0.65) {
          const lane = pat[s % pat.length];
          if (Array.isArray(lane)) {
            lane.forEach(l => notes.push({ time: barTime + s * subBeat, lane: l }));
          } else {
            notes.push({ time: barTime + s * subBeat, lane });
          }
        }
      }
    }

    // DROP (8-15): 풀 패턴
    else {
      const subdivisions = difficulty === 'hard' ? 16 : 8;
      const subBeat = beat * 4 / subdivisions;

      let pat;
      if (difficulty === 'hard') {
        pat = Math.random() < 0.5 ? patterns.chord2A : patterns.dropA;
      } else if (difficulty === 'normal') {
        const opts = [patterns.dropA, patterns.dropB, patterns.shake, patterns.rollLeft];
        pat = opts[Math.floor(Math.random() * opts.length)];
      } else {
        const opts = [patterns.eighth, patterns.rollLeft, patterns.rollRight];
        pat = opts[Math.floor(Math.random() * opts.length)];
      }

      for (let s = 0; s < subdivisions; s++) {
        if (Math.random() < density) {
          const lane = pat[s % pat.length];
          if (Array.isArray(lane)) {
            lane.forEach(l => notes.push({ time: barTime + s * subBeat, lane: l }));
          } else {
            notes.push({ time: barTime + s * subBeat, lane });
          }
        }
      }
    }
  }

  // 정렬 후 너무 가까운 노트 제거 (같은 레인 30ms 이내)
  notes.sort((a, b) => a.time - b.time);
  const filtered = [];
  const lastTime = [-1, -1, -1, -1];
  const minGap = 0.06; // 60ms
  for (const note of notes) {
    if (note.time - lastTime[note.lane] > minGap) {
      filtered.push(note);
      lastTime[note.lane] = note.time;
    }
  }

  return filtered;
}

window.SONGS = SONGS;
window.LANE_COLORS = LANE_COLORS;
window.LANE_KEYS = LANE_KEYS;
window.JUDGMENT_WINDOWS = JUDGMENT_WINDOWS;
window.generateBeatmap = generateBeatmap;
