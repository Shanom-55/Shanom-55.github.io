/* ============================================
   Shanom Portfolio — rhythm.js
   🎮 Boba Rhythm — 4-key mini rhythm game
   เพลง + ชาร์ตโน้ตถูก generate จาก grid เดียวกัน (WebAudio ล้วนๆ ไม่มีไฟล์เสียง)
   เปิดเกม: พิมพ์คำว่า "rhythm" หรือกดปุ่ม 🎮 ใน footer
   ============================================ */

const RHYTHM_GAME = {
  enabled: true,
  triggerWord: 'rhythm',   // พิมพ์คำนี้ที่ไหนก็ได้เพื่อเปิดเกม
  bpm: 150,
  leadIn: 2.6,             // วินาทีก่อนโน้ตแรก (นับ 3-2-1)
  scrollMs: 1600,          // โน้ตวิ่งจากขอบบนถึงเส้นตีในกี่ ms (ที่ speed 1x)
  speeds: [0.5, 1, 1.5, 2],// ตัวคูณความเร็วโน้ตให้เลือกในเกม
  judge: { perfect: 0.055, great: 0.095, good: 0.145, miss: 0.185 },
};

(function initRhythmGame() {
  const C = RHYTHM_GAME;
  if (!C.enabled) return;

  const lang = () => {
    if (typeof currentLang === 'string') return currentLang;
    return localStorage.getItem('shanom_lang') || 'th';
  };
  const T = (th, en) => (lang() === 'en' ? en : th);

  /* -----------------------------------------------
     Chart — แพทเทิร์น 16 จังหวะต่อบาร์ (0-3 = เลน, . = พัก)
  ----------------------------------------------- */
  const PATTERNS = {
    A: '0...1...2...3...',  // quarter เดินเลน
    B: '0...0...2...2...',
    C: '0.1.2.3.0.1.2.3.',  // 8th
    D: '0.2.1.3.0.2.1.3.',
    E: '0.1.2.3.2.1.0.3.',
    F: '01.2.30.12.3.01.',  // มี 16th แทรก
    G: '0.2.0.2.3.1.3.1.',
    H: '0..0..1..1..2..3',  // triplet feel
  };
  const ARRANGEMENT = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'C', 'D', 'E', 'F', 'G', 'H', 'C', 'D', 'A'];

  // Am - F - C - G (วนทุก 4 บาร์)
  const CHORDS = [
    { bass: 110.00, arpBase: 440.00 },  // Am
    { bass: 87.31, arpBase: 349.23 },   // F
    { bass: 130.81, arpBase: 523.25 },  // C
    { bass: 98.00, arpBase: 392.00 },   // G
  ];
  const LANE_COLORS = ['#E8864A', '#F0A870', '#A8D5A2', '#7DC97A'];
  const LANE_ARP = [440.00, 587.33, 659.25, 880.00]; // A4 D5 E5 A5
  const KEYS = ['d', 'f', 'j', 'k'];
  const STEP = 60 / C.bpm / 4; // 0.1s ต่อ 1 ไม้ 16

  function buildChart() {
    const notes = [];
    const arpAt = new Map();
    let step = 0;
    ARRANGEMENT.forEach(name => {
      const pat = PATTERNS[name];
      for (let i = 0; i < 16; i++) {
        const ch = pat[i];
        if (ch !== '.') {
          const lane = parseInt(ch, 10);
          notes.push({ step: step + i, lane, t: C.leadIn + (step + i) * STEP, judged: false, grade: null });
          arpAt.set(step + i, lane);
        }
      }
      step += 16;
    });
    return { notes, arpAt, totalSteps: step };
  }

  /* -----------------------------------------------
     Audio engine — สังเคราะห์กลอง/เบส/อาร์ป + เสียงตี
  ----------------------------------------------- */
  let ac = null, master = null, musicGain = null, noiseBuf = null;

  function audio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.85;
    master.connect(ac.destination);
    musicGain = ac.createGain();
    musicGain.gain.value = 1;
    musicGain.connect(master);

    const len = Math.floor(ac.sampleRate * 0.4);
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return ac;
  }

  const env = (g, when, peak, decay, attack) => {
    const a = attack === undefined ? 0.005 : attack;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + a);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  };

  function kick(when) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(155, when);
    o.frequency.exponentialRampToValueAtTime(45, when + 0.11);
    env(g, when, 0.9, 0.24);
    o.connect(g).connect(musicGain);
    o.start(when); o.stop(when + 0.28);
  }

  function snare(when) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
    env(g, when, 0.28, 0.16);
    s.connect(f).connect(g).connect(musicGain);
    s.start(when); s.stop(when + 0.2);
  }

  function hat(when, accent) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = 'highpass'; f.frequency.value = 7800;
    env(g, when, accent ? 0.11 : 0.055, 0.05);
    s.connect(f).connect(g).connect(musicGain);
    s.start(when); s.stop(when + 0.08);
  }

  function bass(when, freq) {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, when);
    f.type = 'lowpass'; f.frequency.setValueAtTime(700, when);
    f.frequency.exponentialRampToValueAtTime(220, when + 0.2);
    env(g, when, 0.24, 0.26);
    o.connect(f).connect(g).connect(musicGain);
    o.start(when); o.stop(when + 0.3);
  }

  function arp(when, freq) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, when);
    env(g, when, 0.13, 0.2, 0.004);
    o.connect(g).connect(musicGain);
    o.start(when); o.stop(when + 0.24);
  }

  function hitSfx(lane, perfect) {
    if (!ac) return;
    const when = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = perfect ? 'square' : 'triangle';
    o.frequency.setValueAtTime(LANE_ARP[lane] * 2, when);
    env(g, when, perfect ? 0.1 : 0.06, 0.09, 0.002);
    o.connect(g).connect(master);
    o.start(when); o.stop(when + 0.12);
  }

  /* -----------------------------------------------
     DOM
  ----------------------------------------------- */
  let overlay, panel, canvas, ctx2d, hud = {}, resultEl = {}, launchBtn = null;
  const W = 420, H = 620, PAD = 12;
  const LANE_W = (W - PAD * 2) / 4;
  const HIT_Y = 540;
  const NOTE_H = 22;

  function buildUI() {
    overlay = document.createElement('div');
    overlay.className = 'rhythm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="rhythm-panel" tabindex="-1">' +
      '  <div class="rhythm-head">' +
      '    <div class="rhythm-title">🎮 <span class="rt-name">Boba Rhythm</span></div>' +
      '    <button type="button" class="rhythm-close" aria-label="Close">✕</button>' +
      '  </div>' +
      '  <div class="rhythm-hud">' +
      '    <div class="rhythm-stat"><span class="rhythm-stat-k">Score</span><span class="rhythm-stat-v" data-hud="score">0</span></div>' +
      '    <div class="rhythm-stat"><span class="rhythm-stat-k">Combo</span><span class="rhythm-stat-v" data-hud="combo">0</span></div>' +
      '    <div class="rhythm-stat"><span class="rhythm-stat-k">Acc</span><span class="rhythm-stat-v" data-hud="acc">100%</span></div>' +
      '  </div>' +
      '  <div class="rhythm-progress"><div class="rhythm-progress-fill" data-hud="prog"></div></div>' +
      '  <div class="rhythm-speed"><span class="rh-speed-label"></span><span class="rh-chips"></span></div>' +
      '  <canvas class="rhythm-canvas" width="' + W + '" height="' + H + '" aria-label="rhythm game lanes"></canvas>' +
      '  <div class="rhythm-hint"><span class="rh-keys"></span> <span class="rh-esc">ESC = ปิด</span></div>' +
      '  <div class="rhythm-result">' +
      '    <div class="rhythm-rank">S</div>' +
      '    <div class="rhythm-rank-sub"></div>' +
      '    <div class="rhythm-result-row">' +
      '      <div><b data-res="score">0</b>Score</div>' +
      '      <div><b data-res="combo">0</b>Max Combo</div>' +
      '      <div><b data-res="acc">100%</b>Accuracy</div>' +
      '    </div>' +
      '    <div class="rhythm-judges">' +
      '      <span data-res="perfect">Perfect 0</span>' +
      '      <span data-res="great">Great 0</span>' +
      '      <span data-res="good">Good 0</span>' +
      '      <span data-res="miss">Miss 0</span>' +
      '    </div>' +
      '    <div class="rhythm-actions">' +
      '      <button type="button" class="rhythm-btn rhythm-btn-primary" data-res="again">เล่นใหม่</button>' +
      '      <button type="button" class="rhythm-btn rhythm-btn-ghost" data-res="quit">ปิด</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(overlay);
    panel = overlay.querySelector('.rhythm-panel');
    canvas = overlay.querySelector('.rhythm-canvas');
    ctx2d = canvas.getContext('2d');

    ['score', 'combo', 'acc', 'prog'].forEach(k => { hud[k] = overlay.querySelector('[data-hud="' + k + '"]'); });
    ['score', 'combo', 'acc', 'perfect', 'great', 'good', 'miss', 'again', 'quit'].forEach(k => {
      resultEl[k] = overlay.querySelector('[data-res="' + k + '"]');
    });

    overlay.querySelector('.rh-keys').innerHTML =
      '<span class="rhythm-keys">' + KEYS.map(k => '<span class="rhythm-key"> ' + k.toUpperCase() + ' </span>').join('') + '</span>';

    // speed chips
    const chips = overlay.querySelector('.rh-chips');
    chips.innerHTML = C.speeds.map(s =>
      '<button type="button" class="rhythm-chip" data-speed="' + s + '">' +
      (Number.isInteger(s) ? s : s.toFixed(1)) + '×</button>').join('');
    chips.addEventListener('click', (e) => {
      const b = e.target.closest('.rhythm-chip');
      if (!b) return;
      speed = parseFloat(b.dataset.speed);
      localStorage.setItem('shanom_rhythm_speed', String(speed));
      renderSpeed();
    });
    renderSpeed();

    overlay.querySelector('.rhythm-close').addEventListener('click', close);
    resultEl.again.addEventListener('click', () => { closeResult(); start(); });
    resultEl.quit.addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

    // crisp on retina
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    if (ctx2d && ctx2d.scale) ctx2d.scale(dpr, dpr);
  }

  function renderSpeed() {
    overlay.querySelectorAll('.rhythm-chip').forEach(b =>
      b.classList.toggle('on', parseFloat(b.dataset.speed) === speed));
  }

  function paintTexts() {
    if (!overlay) return;
    overlay.querySelector('.rh-esc').textContent = T('ESC = ปิด', 'ESC = close');
    overlay.querySelector('.rh-speed-label').textContent = T('ความเร็วโน้ต', 'Note speed');
    resultEl.again.textContent = T('เล่นใหม่', 'Play again');
    resultEl.quit.textContent = T('ปิด', 'Close');
    if (launchBtn) {
      launchBtn.innerHTML = '<span class="rhythm-launch-emoji">🎮</span> ' +
        T('เล่นมินิเกมจังหวะ', 'Play the rhythm mini-game');
    }
  }

  function buildLauncher() {
    const foot = document.querySelector('.footer-inner');
    if (!foot) return;
    launchBtn = document.createElement('button');
    launchBtn.type = 'button';
    launchBtn.className = 'rhythm-launch';
    foot.appendChild(launchBtn);
    launchBtn.addEventListener('click', () => { open(); });
    paintTexts();
  }

  /* -----------------------------------------------
     Game state
  ----------------------------------------------- */
  let notes = [], arpAt = new Map(), totalSteps = 0;
  let score = 0, combo = 0, maxCombo = 0, judged = 0;
  const tally = { perfect: 0, great: 0, good: 0, miss: 0 };
  let playing = false, rafId = null, schedTimer = null;
  let startAt = 0, nextStep = 0, lastFocus = null;
  // ความเร็วโน้ต (ตัวคูณ) — จำค่าไว้ข้ามครั้งที่เล่น
  let speed = parseFloat(localStorage.getItem('shanom_rhythm_speed'));
  if (!(speed > 0)) speed = 1;
  const laneFlash = [0, 0, 0, 0];
  const pops = [];

  const songTime = () => (ac ? ac.currentTime : performance.now() / 1000) - startAt;
  const songLength = () => C.leadIn + totalSteps * STEP;
  // speed สูง = โน้ตไหลเร็ว (เวลาเดินทางสั้นลง)
  const pxPerSec = () => HIT_Y / ((C.scrollMs / speed) / 1000);

  function resetState() {
    const chart = buildChart();
    notes = chart.notes; arpAt = chart.arpAt; totalSteps = chart.totalSteps;
    score = 0; combo = 0; maxCombo = 0; judged = 0;
    tally.perfect = tally.great = tally.good = tally.miss = 0;
    pops.length = 0;
    nextStep = 0;
    updateHud();
  }

  function updateHud() {
    if (!hud.score) return;
    hud.score.textContent = String(score);
    hud.combo.textContent = String(combo);
    const total = Math.max(1, judged);
    const pts = tally.perfect * 1 + tally.great * 0.75 + tally.good * 0.4;
    hud.acc.textContent = Math.round((pts / total) * 100) + '%';
  }

  function pop(text, color) {
    pops.push({ text, color, born: performance.now() });
    if (pops.length > 6) pops.shift();
  }

  function judge(note, dt) {
    note.judged = true;
    judged++;
    let g;
    if (dt <= C.judge.perfect) g = 'perfect';
    else if (dt <= C.judge.great) g = 'great';
    else g = 'good';
    note.grade = g;
    tally[g]++;
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    score += ({ perfect: 100, great: 70, good: 40 })[g] + Math.min(combo, 50);
    hitSfx(note.lane, g === 'perfect');
    pop(({ perfect: T('PERFECT', 'PERFECT'), great: 'GREAT', good: 'GOOD' })[g],
      ({ perfect: '#7DC97A', great: '#F0A870', good: '#E8C49A' })[g]);
    updateHud();
  }

  function press(lane) {
    laneFlash[lane] = performance.now();
    const now = songTime();
    let best = null, bestDt = Infinity;
    for (const n of notes) {
      if (n.lane !== lane || n.judged) continue;
      const dt = Math.abs(n.t - now);
      if (dt < bestDt) { bestDt = dt; best = n; }
    }
    if (best && bestDt <= C.judge.miss) judge(best, bestDt);
    else hitSfx(lane, false);
  }

  /* -----------------------------------------------
     Music scheduler (lookahead 150ms)
  ----------------------------------------------- */
  function schedule() {
    if (!ac || !playing) return;
    const horizon = ac.currentTime + 0.15;
    // ชาร์ตเริ่มที่ leadIn — ดนตรีต้องเริ่มที่จุดเดียวกัน ไม่งั้นเพลงจะนำโน้ต
    while (startAt + C.leadIn + nextStep * STEP < horizon && nextStep < totalSteps) {
      const when = startAt + C.leadIn + nextStep * STEP;
      const s = nextStep % 16;
      const bar = Math.floor(nextStep / 16);
      const chord = CHORDS[bar % CHORDS.length];

      if (s % 4 === 0) kick(when);
      if (s === 4 || s === 12) snare(when);
      if (s % 2 === 0) hat(when, s % 4 === 2);
      if (s === 0 || s === 6 || s === 10) bass(when, chord.bass);
      if (arpAt.has(nextStep)) arp(when, LANE_ARP[arpAt.get(nextStep)]);
      nextStep++;
    }
  }

  /* -----------------------------------------------
     Render
  ----------------------------------------------- */
  function roundRect(x, y, w, h, r) {
    if (!ctx2d || typeof ctx2d.roundRect === 'function') {
      ctx2d.beginPath();
      ctx2d.roundRect(x, y, w, h, r);
      return;
    }
    ctx2d.beginPath();
    ctx2d.moveTo(x + r, y);
    ctx2d.arcTo(x + w, y, x + w, y + h, r);
    ctx2d.arcTo(x + w, y + h, x, y + h, r);
    ctx2d.arcTo(x, y + h, x, y, r);
    ctx2d.arcTo(x, y, x + w, y, r);
    ctx2d.closePath();
  }

  function draw() {
    if (!ctx2d) return;
    const now = songTime();
    const nowMs = performance.now();
    ctx2d.clearRect(0, 0, W, H);

    // lanes
    for (let i = 0; i < 4; i++) {
      const x = PAD + i * LANE_W;
      ctx2d.fillStyle = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.015)';
      ctx2d.fillRect(x, 0, LANE_W, H);
      const age = nowMs - laneFlash[i];
      if (age < 130) {
        ctx2d.globalAlpha = 0.28 * (1 - age / 130);
        ctx2d.fillStyle = LANE_COLORS[i];
        ctx2d.fillRect(x, 0, LANE_W, H);
        ctx2d.globalAlpha = 1;
      }
    }

    // hit line + receptors
    ctx2d.strokeStyle = 'rgba(255, 217, 174, 0.85)';
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();
    ctx2d.moveTo(PAD, HIT_Y);
    ctx2d.lineTo(W - PAD, HIT_Y);
    ctx2d.stroke();

    for (let i = 0; i < 4; i++) {
      const x = PAD + i * LANE_W;
      const lit = nowMs - laneFlash[i] < 130;
      ctx2d.globalAlpha = lit ? 0.95 : 0.4;
      ctx2d.fillStyle = LANE_COLORS[i];
      roundRect(x + 6, HIT_Y - 6, LANE_W - 12, 12, 6);
      ctx2d.fill();
      ctx2d.globalAlpha = 1;
    }

    // notes
    for (const n of notes) {
      if (n.judged) continue;
      const y = HIT_Y - (n.t - now) * pxPerSec();
      if (y < -NOTE_H || y > H) continue;
      const x = PAD + n.lane * LANE_W;
      ctx2d.fillStyle = LANE_COLORS[n.lane];
      roundRect(x + 7, y - NOTE_H / 2, LANE_W - 14, NOTE_H, 8);
      ctx2d.fill();
      ctx2d.fillStyle = 'rgba(255,255,255,0.32)';
      roundRect(x + 11, y - NOTE_H / 2 + 4, LANE_W - 22, 4, 3);
      ctx2d.fill();
    }

    // countdown
    if (now < C.leadIn) {
      const left = Math.ceil(C.leadIn - now);
      ctx2d.fillStyle = 'rgba(255, 244, 232, 0.9)';
      ctx2d.font = '700 64px Poppins, sans-serif';
      ctx2d.textAlign = 'center';
      ctx2d.fillText(String(left), W / 2, H / 2 - 40);
      ctx2d.font = '600 16px Poppins, "Noto Sans Thai", sans-serif';
      ctx2d.fillText(T('เตรียมตัว...', 'Get ready...'), W / 2, H / 2 - 6);
    }

    // combo
    if (combo > 2) {
      ctx2d.fillStyle = 'rgba(255, 217, 174, 0.95)';
      ctx2d.font = '800 40px Poppins, sans-serif';
      ctx2d.textAlign = 'center';
      ctx2d.fillText(String(combo), W / 2, 190);
      ctx2d.font = '600 11px Poppins, sans-serif';
      ctx2d.fillStyle = 'rgba(255, 217, 174, 0.6)';
      ctx2d.fillText('COMBO', W / 2, 206);
    }

    // judgment pops
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      const age = nowMs - p.born;
      if (age > 520) { pops.splice(i, 1); continue; }
      ctx2d.globalAlpha = 1 - age / 520;
      ctx2d.fillStyle = p.color;
      ctx2d.font = '800 26px Poppins, sans-serif';
      ctx2d.textAlign = 'center';
      ctx2d.fillText(p.text, W / 2, 300 - age * 0.06);
      ctx2d.globalAlpha = 1;
    }

    hud.prog.style.width = Math.min(100, Math.max(0, (now / songLength()) * 100)).toFixed(1) + '%';
  }

  function loop() {
    if (!playing) return;
    // auto-miss โน้ตที่เลยเส้นไปแล้ว
    const now = songTime();
    for (const n of notes) {
      if (!n.judged && now - n.t > C.judge.miss) {
        n.judged = true; n.grade = 'miss'; judged++;
        tally.miss++; combo = 0;
        pop('MISS', '#E8864A');
        updateHud();
      }
    }
    draw();
    if (now > songLength() + 1.1) { finish(); return; }
    rafId = requestAnimationFrame(loop);
  }

  /* -----------------------------------------------
     Open / close / finish
  ----------------------------------------------- */
  function open() {
    if (overlay.classList.contains('open')) return;
    lastFocus = document.activeElement;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    panel.focus();
    paintTexts();
    resetState();
    closeResult();
    start();
  }

  function close() {
    playing = false;
    clearInterval(schedTimer);
    cancelAnimationFrame(rafId);
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    if (ac) { musicGain.gain.value = 0; }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function start() {
    const a = audio();
    if (!a) return;
    if (musicGain) musicGain.gain.value = 1;
    if (a.state === 'suspended') a.resume();
    resetState();
    playing = true;
    startAt = a.currentTime + 0.25;
    schedule();
    schedTimer = setInterval(schedule, 25);
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function finish() {
    playing = false;
    clearInterval(schedTimer);
    cancelAnimationFrame(rafId);

    const total = Math.max(1, judged);
    const acc = (tally.perfect + tally.great * 0.75 + tally.good * 0.4) / total;
    let rank, msg;
    if (acc >= 0.95) { rank = 'S'; msg = T('เทพชัดๆ! มือโปรเกมจังหวะ 🏆', 'Absolutely godlike! 🏆'); }
    else if (acc >= 0.88) { rank = 'A'; msg = T('เก่งมากกก เกือบเต็มแล้ว!', 'Amazing, nearly full combo!'); }
    else if (acc >= 0.75) { rank = 'B'; msg = T('ไม่เบานะเนี่ย 👏', 'Not bad at all 👏'); }
    else if (acc >= 0.6) { rank = 'C'; msg = T('อุ่นเครื่องก่อน เดี๋ยวรอบหน้าปัง', 'Warm-up round — next one will slap'); }
    else { rank = 'D'; msg = T('ฟังเพลงชิลๆ ก่อนก็ได้ 🧋', 'Maybe just vibe to the song first 🧋'); }

    overlay.querySelector('.rhythm-rank').textContent = rank;
    overlay.querySelector('.rhythm-rank-sub').textContent = msg;
    resultEl.score.textContent = String(score);
    resultEl.combo.textContent = String(maxCombo);
    resultEl.acc.textContent = Math.round(acc * 100) + '%';
    resultEl.perfect.textContent = T('Perfect ', 'Perfect ') + tally.perfect;
    resultEl.great.textContent = 'Great ' + tally.great;
    resultEl.good.textContent = 'Good ' + tally.good;
    resultEl.miss.textContent = 'Miss ' + tally.miss;
    overlay.querySelector('.rhythm-result').classList.add('open');
  }

  function closeResult() {
    const r = overlay.querySelector('.rhythm-result');
    if (r) r.classList.remove('open');
  }

  /* -----------------------------------------------
     Input
  ----------------------------------------------- */
  const KEYMAP = { d: 0, f: 1, j: 2, k: 3, arrowleft: 0, arrowdown: 1, arrowup: 2, arrowright: 3 };
  let buf = '';

  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable);

    if (overlay && overlay.classList.contains('open')) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === ' ' || e.key.indexOf('Arrow') === 0) e.preventDefault();
      if (e.repeat) return;
      const lane = KEYMAP[e.key.toLowerCase()];
      if (lane !== undefined) { e.preventDefault(); press(lane); }
      return;
    }

    if (typing || e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-12);
    if (buf.endsWith(C.triggerWord)) { buf = ''; open(); }
  });

  // แตะเล่นบนมือถือ — แบ่ง canvas เป็น 4 คอลัมน์
  function touchLane(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches && e.touches[0] ? e.touches[0] : e;
    const x = ((t.clientX - rect.left) / rect.width) * W;
    const lane = Math.min(3, Math.max(0, Math.floor((x - PAD) / LANE_W)));
    press(lane);
  }

  buildUI();
  buildLauncher();
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); touchLane(e); }, { passive: false });
  canvas.addEventListener('mousedown', (e) => {
    if (overlay.classList.contains('open')) touchLane(e);
  });
  document.querySelectorAll('.lang-btn').forEach(btn => btn.addEventListener('click', paintTexts));

  // เปิด DevTools แล้วเรียก ShanomRhythm.open() ได้เลย (state() มีไว้ให้เทสต์/ดีบัก)
  window.ShanomRhythm = {
    open,
    close,
    config: C,
    state: () => ({
      playing, startAt, nextStep, totalSteps, notes, score, combo, maxCombo, judged,
      tally: { ...tally }, songTime: songTime(), songLength: songLength(),
      open: overlay.classList.contains('open'), speed, pxPerSec: pxPerSec(),
    }),
  };
})();
