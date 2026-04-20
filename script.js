/* ============================================
   Shanom Portfolio — script.js
   Boba Pearl Canvas + Interactions
   ============================================ */

// ===== Boba Pearl Canvas Animation =====
(function initBobaCanvas() {
  const canvas = document.getElementById('bobaCanvas');
  const ctx = canvas.getContext('2d');

  let W, H;
  let pearls = [];
  let animId;

  const PEARL_COUNT = 38;
  const PEARL_COLORS = [
    'rgba(139, 94, 60, 0.55)',    // dark brown
    'rgba(196, 133, 90, 0.45)',   // mid brown
    'rgba(168, 213, 162, 0.5)',   // lime green
    'rgba(124, 201, 122, 0.4)',   // lime green bright
    'rgba(232, 196, 154, 0.45)',  // light brown/orange
    'rgba(240, 168, 112, 0.4)',   // orange soft
  ];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  class Pearl {
    constructor(isReset) {
      this.reset(isReset);
    }

    reset(offscreen = false) {
      const r = Math.random() * 18 + 8;
      this.r = r;
      this.x = Math.random() * W;
      this.y = offscreen ? -r - Math.random() * 300 : Math.random() * H;
      this.vy = Math.random() * 0.8 + 0.3;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.color = PEARL_COLORS[Math.floor(Math.random() * PEARL_COLORS.length)];
      this.highlight = `rgba(255,255,255,${Math.random() * 0.35 + 0.15})`;
      this.opacity = Math.random() * 0.6 + 0.25;
      this.blur = Math.random() * 3 + 0.5;
      this.wobble = Math.random() * Math.PI * 2;
      this.wobbleSpeed = (Math.random() - 0.5) * 0.02;
    }

    update() {
      this.wobble += this.wobbleSpeed;
      this.x += this.vx + Math.sin(this.wobble) * 0.18;
      this.y += this.vy;

      if (this.y > H + this.r + 40) {
        this.reset(true);
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.filter = `blur(${this.blur}px)`;

      // Pearl body with radial gradient (3D-ish)
      const grad = ctx.createRadialGradient(
        this.x - this.r * 0.3, this.y - this.r * 0.3, this.r * 0.05,
        this.x, this.y, this.r
      );
      grad.addColorStop(0, this.highlight);
      grad.addColorStop(0.45, this.color);
      grad.addColorStop(1, this.color.replace(/[\d.]+\)$/, '0.1)'));

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.restore();
    }
  }

  function init() {
    pearls = [];
    for (let i = 0; i < PEARL_COUNT; i++) {
      pearls.push(new Pearl(false));
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    for (const p of pearls) {
      p.update();
      p.draw(ctx);
    }
    animId = requestAnimationFrame(loop);
  }

  resize();
  init();
  loop();
  window.addEventListener('resize', () => { resize(); });
})();


// ===== Navbar Scroll Effect =====
(function initNavbar() {
  const nav = document.getElementById('navbar');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }, { passive: true });

  // Burger menu (mobile)
  const burger = document.getElementById('navBurger');
  const navLinks = document.querySelector('.nav-links');
  if (burger) {
    burger.addEventListener('click', () => {
      const open = navLinks.style.display === 'flex';
      navLinks.style.display = open ? 'none' : 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '70px';
      navLinks.style.right = '2rem';
      navLinks.style.background = 'rgba(253,250,246,0.95)';
      navLinks.style.backdropFilter = 'blur(16px)';
      navLinks.style.padding = '1rem 1.5rem';
      navLinks.style.borderRadius = '16px';
      navLinks.style.boxShadow = '0 8px 30px rgba(196,133,90,0.15)';
      navLinks.style.border = '1.5px solid rgba(232,196,154,0.4)';
      navLinks.style.gap = '0.8rem';
    });
  }
})();

// ===== Works Dynamic Loading & Tab Switching =====
(async function initWorks() {
  const worksGrid = document.getElementById('worksGrid');
  const loader = document.getElementById('worksLoader');
  const tabBtns = document.querySelectorAll('.tab-btn');

  if (!worksGrid || !loader) return;

  try {
    // 1. Fetch works from Firestore
    const snapshot = await db.collection('works').get();
    const works = [];
    snapshot.forEach(doc => works.push({ id: doc.id, ...doc.data() }));

    works.sort((a, b) => {
      const orderA = a.orderIndex !== undefined ? a.orderIndex : 99999;
      const orderB = b.orderIndex !== undefined ? b.orderIndex : 99999;
      if (orderA !== orderB) return orderA - orderB;
      const timeA = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });

    loader.style.display = 'none';

    if (works.length === 0) {
      worksGrid.innerHTML = '<div style="text-align: center; grid-column: 1/-1; color: var(--text-light); padding: 2rem;">ยังไม่มีผลงาน</div>';
      return;
    }

    // 2. Render cards
    let html = '';
    works.forEach(work => {
      const typeClass = work.type === 'lyrics' ? 'lyrics-thumb' : 'music-thumb';
      const colorClass = work.colorVariant || '';

      let thumbContent = '';
      if (work.youtube) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
        const ytMatch = work.youtube.match(regExp);
        const videoId = (ytMatch && ytMatch[2].length === 11) ? ytMatch[2] : null;

        if (videoId) {
          thumbContent = `
            <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}?rel=0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe>
          `;
        }
      }

      if (!thumbContent) {
        if (work.type === 'music') {
          thumbContent = `
            <div class="music-wave">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="work-genre">${escHtml(work.genre)}</div>
          `;
        } else {
          // Mock preview for lyrics, you can add real lyrics to DB if needed
          thumbContent = `
            <div class="lyrics-preview">
              <span class="lyric-line active">"${escHtml(work.title)}"</span>
              <span class="lyric-line dim">"..."</span>
            </div>
          `;
        }
      }

      html += `
        <div class="work-card reveal" data-tab="${work.type}" style="display: ${work.type === 'music' ? '' : 'none'};">
          <div class="work-card-inner">
            <div class="work-thumb ${typeClass} ${colorClass}">
              ${thumbContent}
            </div>
          </div>
        </div>
      `;
    });

    worksGrid.innerHTML = html;

    // 3. Tab logic
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const cards = document.querySelectorAll('.work-card');
        let visibleCount = 0;
        cards.forEach(card => {
          if (card.dataset.tab === tab) {
            card.style.display = '';
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            setTimeout(() => {
              card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
              card.style.opacity = '1';
              card.style.transform = 'translateY(0)';
            }, visibleCount * 60 + 20);
            visibleCount++;
          } else {
            card.style.display = 'none';
          }
        });
      });
    });

    // 4. Bind Wave Hover
    document.querySelectorAll('.work-card[data-tab="music"]').forEach(card => {
      const spans = card.querySelectorAll('.music-wave span');
      card.addEventListener('mouseenter', () => {
        spans.forEach(s => s.style.animationDuration = '0.5s');
      });
      card.addEventListener('mouseleave', () => {
        spans.forEach(s => s.style.animationDuration = '');
      });
    });

    // 5. Observe new cards
    observeElements(document.querySelectorAll('#worksGrid .work-card'));

  } catch (err) {
    console.error("Error loading works:", err);
    loader.textContent = 'ไม่สามารถโหลดผลงานได้';
  }
})();

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== Scroll Reveal =====
(function initScrollReveal() {
  const observerOptions = {
    rootMargin: '0px 0px -60px 0px',
    threshold: 0.1,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Apply reveal class to section children (works will be added dynamically)
  const revealTargets = document.querySelectorAll(
    '.about-text, .about-stats, .stat-card, .follow-card, .section-title, .section-label'
  );

  window.observeElements = (elements) => {
    elements.forEach((el, i) => {
      if (!el.classList.contains('reveal')) {
        el.classList.add('reveal');
      }
      el.style.transitionDelay = `${(i % 4) * 0.08}s`;
      observer.observe(el);
    });
  };

  observeElements(revealTargets);
})();

// ===== Smooth Hover Parallax on Hero Avatar =====
(function initParallax() {
  const wrap = document.querySelector('.hero-avatar-wrap');
  if (!wrap) return;

  document.addEventListener('mousemove', (e) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = (e.clientX - cx) / cx;
    const dy = (e.clientY - cy) / cy;

    wrap.style.transform = `translate(${dx * 10}px, ${dy * 8}px)`;
  });
})();

// (Wave hover logic moved to initWorks function)

