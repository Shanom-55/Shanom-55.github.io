/* ============================================
   Shanom Portfolio — gimmicks.js
   Cute gimmick pack 🧋
   อยากปิดอันไหน -> แก้ค่าใน GIMMICKS เป็น false แล้วบันทึก
   ============================================ */

const GIMMICKS = {
  scrollStraw: false,  // ปิดแล้วตามคำขอ (เปิดกลับได้: true)
  bobaTrail: false,    // ปิดแล้วตามคำขอ (เปิดกลับได้: true)
  sipLogo: true,       // คลิกแก้วชาที่เมนู = ดูดชา (ดูดครบ 7 ที มี secret)
  bobaWord: true,      // พิมพ์คำว่า "boba" ที่ไหนก็ได้ -> ฝนไข่มุก
  timeGreeting: true,  // ทักทายตามเวลา เช้า/บ่าย/เย็น/ดึก
  petAvatar: true,     // คลิก/แตะรูปโปรไฟล์ -> กระโดด + หัวใจลอย
  clickSfx: true,      // เสียงติ๊ดเบาๆ ตอนกดปุ่ม + ปุ่มเปิด/ปิดเสียง (ค่าเริ่มต้นปิด)
};

(function initGimmicks() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  // ===== ภาษา (ตาม i18n ของเว็บ) =====
  const lang = () => {
    if (typeof currentLang === 'string') return currentLang;
    return localStorage.getItem('shanom_lang') || 'th';
  };
  const T = (th, en) => (lang() === 'en' ? en : th);

  // ===== Toast น่ารัก =====
  let toastEl = null;
  let toastTimer = null;

  function toast(msg, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'gx-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms || 2200);
  }

  // ===== เสียงติ๊ด (WebAudio — ไม่ต้องใช้ไฟล์เสียง) =====
  let audioCtx = null;
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]; // C major pentatonic

  function audio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function blip(freq, dur, vol) {
    const ctx = audio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    const v = vol === undefined ? 0.05 : vol;
    const d = dur === undefined ? 0.12 : dur;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + d);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(v, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + d);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + d + 0.02);
  }

  const sfxOn = () => localStorage.getItem('shanom_sfx') === '1';
  const cuteBlip = () => {
    if (sfxOn()) blip(NOTES[Math.floor(Math.random() * NOTES.length)], 0.11, 0.045);
  };

  /* -----------------------------------------------
     1. Scroll Straw — หลอดชาที่เติมขึ้นเรื่อยๆ
  ----------------------------------------------- */
  if (GIMMICKS.scrollStraw) {
    const straw = document.createElement('div');
    straw.className = 'gx-straw';
    straw.innerHTML = '<div class="gx-straw-fill"></div><div class="gx-straw-pearl"></div>';
    document.body.appendChild(straw);

    const fill = straw.querySelector('.gx-straw-fill');
    const pearl = straw.querySelector('.gx-straw-pearl');
    let ticking = false;

    const update = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      fill.style.width = (pct * 100).toFixed(2) + '%';
      pearl.style.left = (10 + pct * (window.innerWidth - 26)).toFixed(1) + 'px';
      straw.style.opacity = max > 40 ? '1' : '0';
    };

    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* -----------------------------------------------
     2. Boba Cursor Trail
  ----------------------------------------------- */
  if (GIMMICKS.bobaTrail && finePointer && !reducedMotion) {
    const COLORS = [
      ['rgba(255,255,255,0.9)', 'rgba(139,94,60,0.75)'],
      ['rgba(255,255,255,0.9)', 'rgba(196,133,90,0.7)'],
      ['rgba(255,255,255,0.9)', 'rgba(124,201,122,0.7)'],
      ['rgba(255,255,255,0.9)', 'rgba(240,168,112,0.7)'],
    ];
    let last = 0;
    let lx = -999;
    let ly = -999;

    window.addEventListener('mousemove', (e) => {
      const now = performance.now();
      if (now - last < 38) return;
      const dist = Math.hypot(e.clientX - lx, e.clientY - ly);
      if (dist < 14) return;
      last = now;
      lx = e.clientX;
      ly = e.clientY;

      const size = Math.random() * 7 + 5;
      const c = COLORS[Math.floor(Math.random() * COLORS.length)];
      const p = document.createElement('div');
      p.className = 'gx-trail';
      p.style.cssText =
        'left:' + e.clientX + 'px;top:' + e.clientY + 'px;' +
        'width:' + size + 'px;height:' + size + 'px;' +
        'background:radial-gradient(circle at 32% 28%,' + c[0] + ' 0%,' + c[1] + ' 70%);' +
        'box-shadow:0 2px 6px rgba(196,133,90,0.25);';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 760);
    }, { passive: true });
  }

  /* -----------------------------------------------
     3. Sip the logo — คลิกแก้วชาเพื่อ "ดูด"
  ----------------------------------------------- */
  if (GIMMICKS.sipLogo) {
    const logo = document.querySelector('.nav-logo');
    if (logo) {
      const img = logo.querySelector('.nav-logo-img');
      let sips = 0;

      logo.setAttribute('role', 'button');
      logo.setAttribute('tabindex', '0');

      // เก็บเป็นคู่ [th, en] แล้วค่อยแปลตอนคลิก — ไม่ล็อกภาษาตอนโหลดหน้า
      const MESSAGES = [
        ['อื้มม~ หวานกำลังดี 🧋', 'Mmm~ perfect sweetness 🧋'],
        ['อีกอึก! 🥤', 'One more sip! 🥤'],
        ['ไข่มุกนุ่มมากกก', 'These pearls are so chewy'],
        ['แก้วนี้ผมเลี้ยงเอง 😌', 'This one is on me 😌'],
        ['หวานน้อย 100% นะ', 'Less sugar, 100% 💯'],
        ['ดูดเพลินจนลืมทำเพลง', 'Sipping so hard I forgot to produce'],
      ];

      const applyLogoLabel = () =>
        logo.setAttribute('aria-label', T('ดูดชาไข่มุกหน่อยมั้ย? คลิกเลย', 'Want some boba? Click me'));
      applyLogoLabel();
      document.querySelectorAll('.lang-btn').forEach(btn => btn.addEventListener('click', applyLogoLabel));

      const sip = () => {
        sips++;
        logo.classList.remove('gx-sipping');
        void logo.offsetWidth; // restart animation
        logo.classList.add('gx-sipping');
        setTimeout(() => logo.classList.remove('gx-sipping'), 650);

        const r = img.getBoundingClientRect();
        const p = document.createElement('div');
        p.className = 'gx-sip-pearl';
        p.textContent = '🧋';
        p.style.left = (r.left + r.width / 2) + 'px';
        p.style.top = (r.top + 4) + 'px';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 900);

        if (sfxOn()) blip(880, 0.09, 0.05);

        if (sips % 7 === 0) {
          toast(T('🎉 เจอความลับแล้ว! ดูดครบ 7 อึก — ของขวัญคือเพลงใหม่เร็วๆ นี้ (มั้ง)',
            '🎉 Secret found! 7 sips — your reward is a new song soon (maybe)'));
          bobaRain(18);
        } else {
          const m = MESSAGES[sips % MESSAGES.length];
          toast(T(m[0], m[1]));
        }
      };

      logo.addEventListener('click', sip);
      logo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sip(); }
      });

      // hint wiggle ครั้งเดียวต่อ session
      if (!sessionStorage.getItem('shanom_hinted')) {
        setTimeout(() => {
          logo.classList.add('gx-wiggle');
          setTimeout(() => {
            logo.classList.remove('gx-wiggle');
            sessionStorage.setItem('shanom_hinted', '1');
          }, 750);
        }, 4500);
      }
    }
  }

  /* -----------------------------------------------
     4. Boba Rain + พิมพ์คำว่า "boba"
  ----------------------------------------------- */
  function bobaRain(count) {
    if (reducedMotion) return;
    const n = count || 26;
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'gx-rain';
      d.textContent = Math.random() > 0.25 ? '🧋' : (Math.random() > 0.5 ? '✨' : '🎵');
      d.style.left = (Math.random() * 100) + 'vw';
      d.style.fontSize = (Math.random() * 18 + 18) + 'px';
      d.style.animationDuration = (Math.random() * 1.8 + 2.2) + 's';
      d.style.animationDelay = (Math.random() * 0.9) + 's';
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 5200);
    }
    if (sfxOn()) blip(1046.5, 0.18, 0.05);
  }

  if (GIMMICKS.bobaWord) {
    let buf = '';
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
      if (e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-10);
      if (buf.endsWith('boba')) {
        buf = '';
        bobaRain(30);
        toast(T('🧋 ฝนไข่มุกตกแล้ววว!', '🧋 It\'s raining boba!'));
      }
    });

    // บนมือถือไม่มีคีย์บอร์ด -> แตะแก้วชาในฟุตเตอร์ 5 ที
    const footerBoba = document.querySelector('.footer-boba');
    if (footerBoba) {
      let taps = 0;
      footerBoba.style.cursor = 'pointer';
      footerBoba.addEventListener('click', () => {
        taps++;
        if (taps >= 5) {
          taps = 0;
          bobaRain(30);
          toast(T('🧋 ฝนไข่มุก!', '🧋 Boba rain!'));
        }
      });
    }
  }

  /* -----------------------------------------------
     5. Time greeting — ทักทายตามช่วงเวลา
  ----------------------------------------------- */
  function renderGreeting() {
    const h = new Date().getHours();
    let emoji, text;
    if (h >= 5 && h < 11) {
      emoji = '🌅'; text = T('สวัสดีตอนเช้า', 'Good morning');
    } else if (h >= 11 && h < 16) {
      emoji = '🌤️'; text = T('สวัสดีตอนบ่าย', 'Good afternoon');
    } else if (h >= 16 && h < 20) {
      emoji = '🌇'; text = T('สวัสดีตอนเย็น', 'Good evening');
    } else if (h >= 20) {
      emoji = '🌙'; text = T('ดึกแล้วนะ ยังไม่นอนอีกเหรอ?', 'Late night — still awake?');
    } else {
      emoji = '🌙'; text = T('ตีสองแล้ว พักผ่อนบ้างนะ', 'It\'s late, please get some rest');
    }
    return { emoji, text };
  }

  let helloEl = null;
  function paintGreeting() {
    if (!helloEl) return;
    const g = renderGreeting();
    helloEl.innerHTML = '<span class="gx-hello-emoji">' + g.emoji + '</span> ' + g.text;
  }

  if (GIMMICKS.timeGreeting) {
    const badge = document.querySelector('#hero .hero-badge');
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
      helloEl = document.createElement('div');
      helloEl.className = 'gx-hello';
      helloEl.setAttribute('aria-live', 'polite');
      if (badge) heroContent.insertBefore(helloEl, badge);
      else heroContent.appendChild(helloEl);
      paintGreeting();
      setInterval(paintGreeting, 60000);
      document.querySelectorAll('.lang-btn').forEach(btn => btn.addEventListener('click', paintGreeting));
    }
  }

  /* -----------------------------------------------
     6. Pet the avatar — แตะรูปโปรไฟล์
  ----------------------------------------------- */
  if (GIMMICKS.petAvatar) {
    const avatar = document.querySelector('.hero-avatar');
    if (avatar) {
      avatar.style.cursor = 'pointer';
      avatar.setAttribute('title', T('ลูบหัวหน่อย 😌', 'Pet me 😌'));
      const EMOJI = ['❤️', '🧋', '✨', '🎵', '💚'];

      avatar.addEventListener('click', (e) => {
        avatar.classList.remove('gx-pet');
        void avatar.offsetWidth;
        avatar.classList.add('gx-pet');
        setTimeout(() => avatar.classList.remove('gx-pet'), 600);

        if (!reducedMotion) {
          for (let i = 0; i < 5; i++) {
            const s = document.createElement('div');
            s.className = 'gx-pop';
            s.textContent = EMOJI[Math.floor(Math.random() * EMOJI.length)];
            s.style.left = (e.clientX + (Math.random() - 0.5) * 90) + 'px';
            s.style.top = (e.clientY + (Math.random() - 0.5) * 40) + 'px';
            s.style.animationDelay = (i * 0.07) + 's';
            document.body.appendChild(s);
            setTimeout(() => s.remove(), 1100);
          }
        }
        if (sfxOn()) blip(659.25, 0.14, 0.05);
      });
    }
  }

  /* -----------------------------------------------
     7. Click SFX + ปุ่มเปิด/ปิดเสียง
  ----------------------------------------------- */
  if (GIMMICKS.clickSfx) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'sfx-toggle' + (sfxOn() ? ' on' : '');
    toggle.setAttribute('aria-pressed', sfxOn() ? 'true' : 'false');
    toggle.setAttribute('aria-label', T('เปิด/ปิดเสียงเอฟเฟกต์', 'Toggle sound effects'));

    const sync = () => {
      const on = sfxOn();
      toggle.textContent = on ? '🔊' : '🔇';
      toggle.classList.toggle('on', on);
      toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    sync();

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      localStorage.setItem('shanom_sfx', sfxOn() ? '0' : '1');
      sync();
      if (sfxOn()) {
        // เล่นโน้ตทักทายตอนเปิดเสียง
        [0, 1, 2].forEach((i) => setTimeout(() => blip(NOTES[i + 2], 0.12, 0.05), i * 90));
      }
      toast(sfxOn() ? T('🔊 เปิดเสียงแล้ว', '🔊 Sound on') : T('🔇 ปิดเสียงแล้ว', '🔇 Sound off'), 1400);
    });

    const langToggle = document.getElementById('langToggle');
    if (langToggle && langToggle.parentNode) {
      langToggle.insertAdjacentElement('afterend', toggle);
    } else {
      document.querySelector('.nav-inner').appendChild(toggle);
    }

    // เสียงติ๊ดตอนกดปุ่ม/ลิงก์/การ์ด
    document.addEventListener('click', (e) => {
      const el = e.target.closest('a, button, .work-card, .tab-btn, .dot, .follow-card');
      if (el && !el.classList.contains('sfx-toggle') && !el.closest('.nav-logo')) cuteBlip();
    });
  }
})();
