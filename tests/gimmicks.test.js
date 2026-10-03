/* jsdom smoke test — boba gimmick pack (gimmicks.js).
   Loads the real index.html + script.js + gimmicks.js, stubs Firestore /
   AudioContext / matchMedia / canvas, then fires real events at each gimmick.
   Run: node gimmicks.test.js   (or `npm test` in this folder) */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const LOCAL = ['firebase-config.js', 'script.js', 'gimmicks.js'];

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
      matches: /\(pointer:\s*fine\)/.test(q), // fine pointer ON, reduced-motion OFF
      media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null,
    });
    window.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} };
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(window.performance.now()), 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);

    const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
    window.__osc = 0;
    window.AudioContext = class {
      constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
      resume() { this.state = 'running'; return Promise.resolve(); }
      createOscillator() {
        const w = window;
        return { type: 'sine', frequency: param(), connect(n) { return n; }, start() { w.__osc++; }, stop() {} };
      }
      createGain() { return { gain: param(), connect(n) { return n; } }; }
    };

    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    window.HTMLCanvasElement.prototype.getContext = () => ({
      clearRect() {}, save() {}, restore() {}, beginPath() {}, arc() {}, fill() {},
      createRadialGradient: () => ({ addColorStop() {} }),
      set fillStyle(v) {}, get fillStyle() { return ''; }, globalAlpha: 1, filter: '',
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

// fake a 3000px-tall page so the scroll-straw math is testable
Object.defineProperty(dom.window.document.documentElement, 'scrollHeight', { value: 3000, configurable: true });

// run the real files as classic scripts, in the order index.html loads them
const ctx = dom.getInternalVMContext();
for (const name of LOCAL) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, name), 'utf8'), ctx, { filename: name });
}

(async () => {
  const { window } = dom;
  const { document } = window;
  await sleep(500); // let script.js finish its async firestore render
  const count = (sel) => document.querySelectorAll(sel).length;

  console.log('\n=== baseline (script.js still healthy) ===');
  check('2 work cards rendered from the firestore stub', count('.work-card') === 2, count('.work-card'));
  check('i18n applied (nav = หน้าแรก)', document.getElementById('nav-home').textContent === 'หน้าแรก',
    document.getElementById('nav-home').textContent);
  check('gimmicks.js executed (GIMMICKS visible in global scope)',
    vm.runInContext('typeof GIMMICKS === "object" && GIMMICKS.sipLogo === true', ctx) === true);

  console.log('\n=== 1&2. straw + cursor trail are OFF by default ===');
  check('GIMMICKS.shipped defaults: straw/trail false, rest true',
    vm.runInContext('JSON.stringify([GIMMICKS.scrollStraw, GIMMICKS.bobaTrail, GIMMICKS.sipLogo])', ctx) === '[false,false,true]');
  check('no .gx-straw injected', !document.querySelector('.gx-straw'));
  const mm = (x, y) => window.dispatchEvent(new window.MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
  mm(100, 100); await sleep(70); mm(300, 300); await sleep(30);
  check('no cursor-trail pearls spawned', count('.gx-trail') === 0, count('.gx-trail'));
  check('gimmicks.css keeps .gx-hello on its own line (display: flex)',
    fs.readFileSync(path.join(ROOT, 'gimmicks.css'), 'utf8').includes('.gx-hello {\n  display: flex;'));

  console.log('\n=== 5. time greeting ===');
  const hello = document.querySelector('.gx-hello');
  const badge = document.querySelector('#hero .hero-badge');
  check('.gx-hello injected before .hero-badge', hello && hello.nextElementSibling === badge);
  check('hello is the previous sibling of the badge (own line via CSS flex)', !!hello && !!badge);
  const h = new Date().getHours();
  const want = (h >= 5 && h < 11) ? '🌅' : (h < 16 ? '🌤️' : (h < 20 ? '🌇' : '🌙'));
  check('emoji matches the hour (' + h + 'h -> ' + want + ')',
    hello && hello.querySelector('.gx-hello-emoji').textContent === want, hello && hello.textContent);
  const thText = hello.textContent.trim();
  document.getElementById('langEN').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
  check('greeting re-renders on EN switch', hello.textContent.trim() !== thText, thText + ' => ' + hello.textContent.trim());
  document.getElementById('langTH').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
  check('...and back to TH', hello.textContent.trim() === thText, hello.textContent.trim());

  console.log('\n=== 7. sfx toggle ===');
  const sfx = document.querySelector('.sfx-toggle');
  check('.sfx-toggle created right after #langToggle',
    sfx && document.getElementById('langToggle').nextElementSibling === sfx);
  check('starts muted: 🔇 + aria-pressed=false', sfx.textContent === '🔇' && sfx.getAttribute('aria-pressed') === 'false');
  check('localStorage shanom_sfx empty at first', window.localStorage.getItem('shanom_sfx') === null);
  const osc0 = window.__osc;
  sfx.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(300);
  check('click -> 🔊 + .on + aria-pressed=true',
    sfx.textContent === '🔊' && sfx.classList.contains('on') && sfx.getAttribute('aria-pressed') === 'true');
  check('localStorage shanom_sfx = "1"', window.localStorage.getItem('shanom_sfx') === '1');
  check('toast shown: ' + document.querySelector('.gx-toast').textContent,
    document.querySelector('.gx-toast').classList.contains('show'));
  check('welcome arpeggio played 3 notes', window.__osc - osc0 === 3, window.__osc - osc0);

  console.log('\n=== 3. sip the logo ===');
  const logo = document.querySelector('.nav-logo');
  check('logo keyboard-reachable (role=button, tabindex=0)',
    logo.getAttribute('role') === 'button' && logo.getAttribute('tabindex') === '0');
  logo.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
  check('logo got .gx-sipping', logo.classList.contains('gx-sipping'));
  check('one 🧋 sip pearl spawned', count('.gx-sip-pearl') === 1, count('.gx-sip-pearl'));
  check('sip toast #1 is Thai while lang=th', document.querySelector('.gx-toast').textContent.includes('อีกอึก'),
    document.querySelector('.gx-toast').textContent);
  document.getElementById('langEN').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  logo.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
  check('after switching to EN the next sip toast is English (not frozen at load lang)',
    document.querySelector('.gx-toast').textContent.includes('chewy'),
    document.querySelector('.gx-toast').textContent);
  check('logo aria-label followed the language too', logo.getAttribute('aria-label').includes('boba'),
    logo.getAttribute('aria-label'));
  document.getElementById('langTH').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  logo.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
  check('...and back to Thai after switching back', document.querySelector('.gx-toast').textContent.includes('เลี้ยงเอง'),
    document.querySelector('.gx-toast').textContent);
  for (let i = 0; i < 4; i++) { await sleep(5); logo.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }
  await sleep(30);
  check('7th sip shows the secret toast', /ความลับ|Secret/.test(document.querySelector('.gx-toast').textContent),
    document.querySelector('.gx-toast').textContent);
  check('7th sip triggers 18 boba rain drops', count('.gx-rain') === 18, count('.gx-rain'));

  console.log('\n=== 4. type "boba" / tap footer cup ===');
  let rain = count('.gx-rain');
  const key = (k) => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true }));
  key('x'); 'boba'.split('').forEach(key);
  await sleep(30);
  check('typing b, o, b, a rains 30 more drops', count('.gx-rain') - rain === 30, '+' + (count('.gx-rain') - rain));
  check('rain toast shown', document.querySelector('.gx-toast').textContent.includes('ฝนไข่มุก'),
    document.querySelector('.gx-toast').textContent);
  rain = count('.gx-rain');
  const fb = document.querySelector('.footer-boba');
  for (let i = 0; i < 5; i++) fb.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(30);
  check('5 taps on the footer cup also rains (mobile fallback)', count('.gx-rain') - rain === 30,
    '+' + (count('.gx-rain') - rain));

  console.log('\n=== 6. pet the avatar ===');
  const avatar = document.querySelector('.hero-avatar');
  avatar.dispatchEvent(new window.MouseEvent('click', { bubbles: true, clientX: 900, clientY: 300 }));
  await sleep(20);
  check('avatar got .gx-pet', avatar.classList.contains('gx-pet'));
  check('5 emoji popped out', count('.gx-pop') === 5, count('.gx-pop'));

  console.log('\n=== click blips + works tabs unaffected ===');
  const osc1 = window.__osc;
  document.getElementById('nav-about').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  document.querySelector('.tab-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
  check('nav link + tab click each blipped', window.__osc - osc1 === 2, window.__osc - osc1);
  document.querySelector('[data-tab="lyrics"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
  const shown = [...document.querySelectorAll('.work-card')].filter(c => c.style.display !== 'none');
  check('lyrics tab shows only the lyrics card', shown.length === 1 && shown[0].dataset.tab === 'lyrics',
    shown.map(c => c.dataset.tab).join(','));

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  window.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
