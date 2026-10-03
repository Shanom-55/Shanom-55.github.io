/* Harness: run the REAL index.html + script.js + gimmicks.js + rhythm.js in jsdom
   with a controllable WebAudio clock, then play a full chart note-by-note.
   Lives in /tmp so the repo stays clean. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const LOCAL = ['firebase-config.js', 'script.js', 'gimmicks.js', 'rhythm.js'];

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '   -> ' + extra : '')); }
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const vc = new VirtualConsole();
vc.on('jsdomError', e => console.log('  [jsdomError] ' + e.message.split('\n')[0]));
vc.on('error', (...a) => console.log('  [console.error] ' + a.join(' ')));

const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
  url: 'https://shanom.local/index.html',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.matchMedia = (q) => ({
      matches: /\(pointer:\s*fine\)/.test(q), media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null,
    });
    window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} };
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(window.performance.now()), 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);

    // --- instrumented WebAudio with a MANUALLY driven clock (window.__ct) ---
    window.__ct = 0;
    window.__osc = 0;
    window.__buf = 0;
    window.__events = [];
    const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
    const node = (extra) => Object.assign({ connect(n) { return n; }, disconnect() {}, start() {}, stop() {} }, extra);
    window.AudioContext = class {
      constructor() {
        this.state = 'running';
        this.destination = {};
        this.sampleRate = 44100;
        Object.defineProperty(this, 'currentTime', { get: () => window.__ct });
      }
      resume() { this.state = 'running'; return Promise.resolve(); }
      createGain() { return node({ gain: param() }); }
      createBiquadFilter() { return node({ type: '', frequency: param(), Q: param() }); }
      createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
      createBufferSource() {
        return node({ buffer: null, start(w) { window.__buf++; if (w !== undefined) (window.__when = window.__when || []).push(w); } });
      }
      createOscillator() {
        return node({
          type: 'sine', frequency: param(),
          start(w) { window.__osc++; if (w !== undefined) (window.__when = window.__when || []).push(w); },
        });
      }
    };

    // jsdom has no canvas backend
    window.HTMLCanvasElement.prototype.getContext = () => ({
      clearRect() {}, fillRect() {}, save() {}, restore() {}, beginPath() {}, closePath() {},
      moveTo() {}, lineTo() {}, arc() {}, arcTo() {}, fill() {}, stroke() {}, scale() {},
      roundRect() {}, fillText() {}, measureText: () => ({ width: 10 }),
      createRadialGradient: () => ({ addColorStop() {} }),
      set fillStyle(v) { this.__f = v; }, get fillStyle() { return this.__f || ''; },
      strokeStyle: '', lineWidth: 1, globalAlpha: 1, font: '', textAlign: '', filter: '',
    });

    window.firebase = {
      initializeApp() {}, auth: () => ({}),
      firestore: () => ({
        collection: () => ({
          get: () => Promise.resolve({
            forEach(cb) {
              cb({ id: 'w1', data: () => ({ type: 'music', title: 'Boba Core', genre: 'Artcore', orderIndex: 1, youtube: 'https://youtu.be/dQw4w9WgXcQ' }) });
              cb({ id: 'w2', data: () => ({ type: 'lyrics', title: 'Night Motion', orderIndex: 2 }) });
            },
          }),
        }),
      }),
    };
  },
});

Object.defineProperty(dom.window.document.documentElement, 'scrollHeight', { value: 3000, configurable: true });

const ctx = dom.getInternalVMContext();
for (const name of LOCAL) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, name), 'utf8'), ctx, { filename: name });
}

(async () => {
  const { window } = dom;
  const { document } = window;
  await sleep(400);

  const overlay = () => document.querySelector('.rhythm-overlay');
  const key = (k, opts) => window.dispatchEvent(new window.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true }, opts)));
  const S = () => window.ShanomRhythm.state();

  console.log('\n=== page baseline ===');
  check('all 4 scripts ran (rhythm API exposed)', typeof window.ShanomRhythm === 'object');
  check('gimmick pack still alive (sfx toggle + time greeting present)',
    !!document.querySelector('.sfx-toggle') && !!document.querySelector('.gx-hello'));
  check('straw + trail are OFF by default in the rhythm run too',
    !document.querySelector('.gx-straw'));
  check('works cards still render from firestore stub', document.querySelectorAll('.work-card').length === 2);

  console.log('\n=== launcher + open ===');
  const launch = document.querySelector('.rhythm-launch');
  check('footer launcher button injected', !!launch && launch.closest('.footer-inner') !== null);
  check('launcher label is Thai by default', /เล่นมินิเกม/.test(launch.textContent), launch.textContent.trim());
  check('launcher has no emoji', !/\p{Extended_Pictographic}/u.test(launch.textContent), launch.textContent);
  'rhythm'.split('').forEach(key);
  await sleep(30);
  check('typing "rhythm" opens the overlay', overlay().classList.contains('open'));
  check('page scroll locked while playing', document.body.style.overflow === 'hidden', document.body.style.overflow);
  check('game state is playing', S().playing === true);

  console.log('\n=== chart generation (150 BPM, 17 bars) ===');
  const st = S();
  check('124 notes generated', st.notes.length === 124, st.notes.length);
  check('272 sixteenth steps (17 bars x 16)', st.totalSteps === 272, st.totalSteps);
  check('first note at leadIn 2.6s', Math.abs(st.notes[0].t - 2.6) < 1e-9, st.notes[0].t);
  check('last note at 29.4s (step 268)', Math.abs(st.notes[123].t - 29.4) < 1e-9, st.notes[123].t);
  check('song length = 29.8s', Math.abs(st.songLength - 29.8) < 1e-9, st.songLength);
  check('all lanes are 0-3', st.notes.every(n => n.lane >= 0 && n.lane <= 3));
  check('notes sorted by time', st.notes.every((n, i) => i === 0 || n.t >= st.notes[i - 1].t));
  check('step grid = 0.1s per 16th at 150 BPM',
    Math.abs((st.notes[123].t - st.notes[0].t) / 268 - 0.1) < 1e-9,
    (st.notes[123].t - st.notes[0].t) / 268);
  check('chart is straight: no triplet (3-step) gap anywhere (no swing)',
    st.notes.every((n, i) => i === 0 || (n.step - st.notes[i - 1].step) !== 3),
    st.notes.map((n, i) => i && (n.step - st.notes[i - 1].step)).filter(d => d === 3).length + ' triplet gaps');

  console.log('\n=== play the whole chart perfectly ===');
  const startAt = st.startAt;
  const KEYS = ['d', 'f', 'j', 'k'];
  const oscBefore = window.__osc;
  for (const n of st.notes) {
    window.__ct = startAt + n.t;               // land exactly on the note
    key(KEYS[n.lane]);
  }
  const hitBlips = window.__osc - oscBefore;   // read before any await: press() is synchronous
  await sleep(40);
  const after = S();
  check('all 124 notes judged', after.judged === 124, after.judged);
  check('124 perfect, 0 miss', after.tally.perfect === 124 && after.tally.miss === 0, JSON.stringify(after.tally));
  check('combo = 124', after.combo === 124, after.combo);
  check('max combo = 124', after.maxCombo === 124, after.maxCombo);
  const expectedScore = 124 * 100 + (50 * 51) / 2 + 74 * 50; // 100 + min(combo,50) each hit
  check('score = 17375 (100 + min(combo,50) per hit)', after.score === expectedScore, after.score + ' vs ' + expectedScore);
  check('HUD shows the score', document.querySelector('[data-hud="score"]').textContent === '17375',
    document.querySelector('[data-hud="score"]').textContent);
  check('HUD accuracy = 100%', document.querySelector('[data-hud="acc"]').textContent === '100%',
    document.querySelector('[data-hud="acc"]').textContent);
  check('every perfect hit = 2 oscillators (melody note + octave sparkle)', hitBlips === 248, hitBlips);

  console.log('\n=== music sequencer scheduled the whole song ===');
  // walk the clock forward so the 25ms lookahead scheduler emits every step
  for (let t = 3; t <= 30.6 && S().nextStep < S().totalSteps; t += 0.5) {
    window.__ct = startAt + t;      // ยังต่ำกว่าจุดจบ 30.9 เพื่อไม่ให้ finish ตัดก่อน
    await sleep(35);
  }
  const sched = S();
  check('all 272 steps scheduled', sched.nextStep === 272, sched.nextStep);
  // per bar: 4 kicks + 3 bass + (notes) oscillators; 2 snares + 8 hats buffer sources
  const expectOsc = 17 * 4 + 17 * 3 + 124 + 248; // music + (note+sparkle) per perfect hit
  const expectBuf = 17 * 2 + 17 * 8;
  check('oscillators = ' + expectOsc + ' (68 kick + 51 bass + 124 arp + 248 hit)',
    window.__osc === expectOsc, window.__osc);
  check('noise sources = ' + expectBuf + ' (34 snare + 136 hat)', window.__buf === expectBuf, window.__buf);
  const minT = Math.min.apply(null, window.__when);
  check('first scheduled audio event lands on leadIn (startAt+2.6)', Math.abs(minT - (st.startAt + 2.6)) < 1e-6, minT);
  check('nothing scheduled before leadIn (music can no longer lead the chart)',
    window.__when.every(w => w >= st.startAt + 2.6 - 1e-9));

  console.log('\n=== speed selector ===');
  check('default 1x -> pxPerSec 337.5', Math.abs(S().pxPerSec - 337.5) < 1e-6, S().pxPerSec);
  const chip = (v) => overlay().querySelector('.rhythm-chip[data-speed="' + v + '"]');
  check('4 speed chips rendered (0.5/1/1.5/2)', overlay().querySelectorAll('.rhythm-chip').length === 4);
  chip('2').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('2x -> speed 2, pxPerSec 675, chip .on', S().speed === 2 && Math.abs(S().pxPerSec - 675) < 1e-6 && chip('2').classList.contains('on'), S().pxPerSec);
  check('2x persisted to localStorage', window.localStorage.getItem('shanom_rhythm_speed') === '2', window.localStorage.getItem('shanom_rhythm_speed'));
  chip('0.5').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('0.5x -> pxPerSec 168.75', Math.abs(S().pxPerSec - 168.75) < 1e-6, S().pxPerSec);
  chip('1').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('back to 1x', S().speed === 1 && Math.abs(S().pxPerSec - 337.5) < 1e-6, S().speed);

  console.log('\n=== finish + results ===');
  window.__ct = startAt + S().songLength + 2;
  await sleep(60);
  const res = document.querySelector('.rhythm-result');
  check('result screen opened', res.classList.contains('open'));
  check('rank = S for 100% accuracy', document.querySelector('.rhythm-rank').textContent === 'S',
    document.querySelector('.rhythm-rank').textContent);
  check('result max combo = 124', document.querySelector('[data-res="combo"]').textContent === '124',
    document.querySelector('[data-res="combo"]').textContent);
  check('result accuracy = 100%', document.querySelector('[data-res="acc"]').textContent === '100%',
    document.querySelector('[data-res="acc"]').textContent);
  check('result miss count = 0', /Miss 0/.test(document.querySelector('[data-res="miss"]').textContent),
    document.querySelector('[data-res="miss"]').textContent);
  check('game stopped playing', S().playing === false);

  console.log('\n=== miss detection + rank on a bad run ===');
  document.querySelector('[data-res="again"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(30);
  check('"play again" resets score/combo/notes', S().score === 0 && S().combo === 0 && S().judged === 0,
    JSON.stringify({ s: S().score, c: S().combo, j: S().judged }));
  const st2 = S();
  // let 3 notes slip past without pressing
  window.__ct = st2.startAt + st2.notes[2].t + 0.4;
  await sleep(60);
  const missed = S();
  check('3 unpressed notes became MISS', missed.tally.miss === 3, JSON.stringify(missed.tally));
  check('combo stays 0 after misses', missed.combo === 0, missed.combo);
  // now hit one late-but-inside-window and one early
  window.__ct = st2.startAt + st2.notes[3].t + 0.075; // +75ms -> great window (55-95ms)
  key(KEYS[st2.notes[3].lane]);
  window.__ct = st2.startAt + st2.notes[4].t - 0.13;  // -130ms -> good window (<=145ms)
  key(KEYS[st2.notes[4].lane]);
  window.__ct = st2.startAt + st2.notes[5].t + 0.2;   // +200ms -> outside miss window, should ghost-tap
  key(KEYS[st2.notes[5].lane]);
  const mixed = S();
  check('late 75ms = GREAT', mixed.tally.great === 1, JSON.stringify(mixed.tally));
  check('early 130ms = GOOD', mixed.tally.good === 1, JSON.stringify(mixed.tally));
  check('200ms off = no judgment (ghost tap)', mixed.tally.perfect === 0 && mixed.judged === 5, mixed.judged);
  window.__ct = st2.startAt + S().songLength + 2;
  await sleep(60);
  check('bad run ranks D', document.querySelector('.rhythm-rank').textContent === 'D',
    document.querySelector('.rhythm-rank').textContent);

  console.log('\n=== close / mobile touch / lang ===');
  key('Escape');
  await sleep(30);
  check('ESC closes the overlay', !overlay().classList.contains('open'));
  check('page scroll restored', document.body.style.overflow === '', '"' + document.body.style.overflow + '"');
  launch.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(30);
  check('footer button re-opens the game', overlay().classList.contains('open') && S().playing === true);
  const canvas = overlay().querySelector('.rhythm-canvas');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 420, height: 620, right: 420, bottom: 620, x: 0, y: 0 });
  const st3 = S();
  window.__ct = st3.startAt + st3.notes[0].t;
  const lane = st3.notes[0].lane;
  const laneX = 12 + lane * 99 + 49.5; // PAD + lane*LANE_W + half lane
  canvas.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, clientX: laneX, clientY: 300 }));
  await sleep(20);
  const touched = S();
  check('tapping the lane-' + lane + ' column judges that note (mobile input)',
    touched.judged === 1 && touched.tally.perfect === 1, JSON.stringify(touched.tally));
  const otherX = 12 + ((lane + 2) % 4) * 99 + 49.5;
  canvas.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, clientX: otherX, clientY: 300 }));
  check('tapping an empty lane is only a ghost tap', S().judged === 1, S().judged);
  document.getElementById('langEN').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
  check('launcher + buttons translate to EN', /Play the rhythm mini-game/.test(launch.textContent) &&
    document.querySelector('[data-res="again"]').textContent === 'Play again',
    launch.textContent.trim());
  check('typing in an input does NOT open the game', (() => {
    key('Escape');
    const inp = document.createElement('input');
    document.body.appendChild(inp);
    inp.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    'hythm'.split('').forEach(k => inp.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true })));
    inp.remove();
    return !overlay().classList.contains('open');
  })());

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  window.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
