/* =============================================================
   PriceFleet — Home · interações e animações
   JS puro (IntersectionObserver + rAF). Lenis é carregado sob
   demanda apenas em desktop com mouse e sem movimento reduzido.
   ============================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => mqReduce.matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const formatters = {};
  const fmt = (v, d = 0) => {
    formatters[d] ||= new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
    return formatters[d].format(v);
  };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  let lenis = null;

  /* ---------- Visibilidade: pausa loops fora da viewport / aba oculta ---------- */
  const visible = new WeakMap();
  const viewIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      visible.set(e.target, e.isIntersecting);
      e.target.classList.toggle('is-offscreen', !e.isIntersecting);
    });
  }, { rootMargin: '80px 0px' });
  const trackView = (el) => viewIO.observe(el);
  const isActive = (el) => visible.get(el) === true && !document.hidden;
  const waitActive = async (el) => { while (!isActive(el)) await sleep(200); };
  $$('[data-loop]').forEach(trackView);
  document.addEventListener('visibilitychange', () => root.classList.toggle('tab-hidden', document.hidden));

  function onceInView(el, fn, threshold = 0.15) {
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(el); }
    }, { threshold });
    io.observe(el);
  }
  function loopWhileVisible(el, fn) {
    if (!el) return;
    (async () => { for (;;) { await waitActive(el); await fn(el); } })();
  }

  /* ---------- Contadores (formato pt-BR) ---------- */
  function renderNum(el, v) {
    const d = +(el.dataset.decimals || 0);
    el.textContent = (el.dataset.prefix || '') + fmt(v, d) + (el.dataset.suffix || '');
  }
  function countTo(el, to, { from = 0, dur = 1200 } = {}) {
    cancelAnimationFrame(el._raf);
    if (reduced()) { renderNum(el, to); return Promise.resolve(); }
    return new Promise((resolve) => {
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        renderNum(el, from + (to - from) * easeOutExpo(p));
        if (p < 1) el._raf = requestAnimationFrame(tick); else resolve();
      };
      el._raf = requestAnimationFrame(tick);
    });
  }
  $$('[data-count]:not([data-count-manual])').forEach((el) => {
    if (!reduced()) renderNum(el, 0);
    onceInView(el, () => countTo(el, +el.dataset.count));
  });

  /* ---------- Reveals no scroll (uma vez, a 15% da viewport) ---------- */
  $$('[data-stagger]').forEach((p) => {
    $$('[data-reveal]', p).forEach((c, i) => c.style.setProperty('--d', `${i * 80}ms`));
  });
  $$('[data-reveal="lines"]').forEach((h) => $$('.line', h).forEach((l, i) => l.style.setProperty('--i', i)));
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      revealIO.unobserve(el);
      el.style.willChange = 'opacity, transform, filter';
      el.classList.add('is-in');
      setTimeout(() => { el.style.willChange = ''; }, 1800);
    });
  }, { threshold: 0.15 });
  $$('[data-reveal]').forEach((el) => revealIO.observe(el));

  /* ---------- Hero: entrada + mockup ---------- */
  (function hero() {
    const mock = $('[data-hero-mock]');
    if (!mock) return;
    const steps = $$('[data-wizard] li', mock);
    const val = $('.vfinal__val', mock);
    const spark = $('.mspark__line', mock);
    if (!reduced()) {
      steps[2].className = 'is-active';
      steps[3].className = '';
      renderNum(val, 0);
      spark.style.strokeDashoffset = '1';
    }
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-loaded')));
    if (reduced()) return;
    setTimeout(() => {
      steps[2].className = 'is-done';
      steps[3].className = 'is-active';
      countTo(val, +val.dataset.count, { dur: 1400 });
      spark.style.transition = 'stroke-dashoffset 1400ms cubic-bezier(.22,1,.36,1)';
      spark.style.strokeDashoffset = '0';
    }, 1750); // 550ms de entrada do mockup + 1200ms
  })();

  /* ---------- Navbar: fundo ao rolar + progresso ---------- */
  const nav = $('#nav');
  const progress = $('.nav__progress span');
  let navTick = false;
  function onScroll() {
    if (navTick) return;
    navTick = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      nav.classList.toggle('is-scrolled', y > 40);
      const max = root.scrollHeight - innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      navTick = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mega menu "Produto" ---------- */
  const megaLi = $('[data-mega]');
  const megaBtn = $('[data-mega-btn]');
  const mega = $('[data-mega-panel]');
  let megaTimer = 0;
  let hoverOpenedAt = 0;
  const megaOpen = () => megaBtn.getAttribute('aria-expanded') === 'true';
  function setMega(open) {
    clearTimeout(megaTimer);
    megaBtn.setAttribute('aria-expanded', String(open));
    mega.classList.toggle('is-open', open);
  }
  megaBtn.addEventListener('click', () => {
    if (megaOpen() && performance.now() - hoverOpenedAt < 600) return; // aberto pelo hover há pouco
    setMega(!megaOpen());
  });
  megaLi.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (!megaOpen()) hoverOpenedAt = performance.now();
    setMega(true);
  });
  megaLi.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') megaTimer = setTimeout(() => setMega(false), 180);
  });
  megaLi.addEventListener('focusout', (e) => { if (!megaLi.contains(e.relatedTarget)) setMega(false); });
  mega.addEventListener('click', (e) => { if (e.target.closest('a, button')) setMega(false); });
  document.addEventListener('click', (e) => { if (!megaLi.contains(e.target)) setMega(false); });

  /* ---------- Menu mobile ---------- */
  const burger = $('[data-burger]');
  const mmenu = $('[data-mmenu]');
  const outside = [$('main'), $('.final')];
  const menuOpen = () => burger.getAttribute('aria-expanded') === 'true';
  function setMenu(open) {
    if (open === menuOpen()) return;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    mmenu.classList.toggle('is-open', open);
    root.classList.toggle('menu-open', open);
    outside.forEach((el) => { if (el) el.inert = open; });
    if (lenis) open ? lenis.stop() : lenis.start();
  }
  burger.addEventListener('click', () => setMenu(!menuOpen()));
  mmenu.addEventListener('click', (e) => { if (e.target.closest('a[href^="#"]')) setMenu(false); });
  $$('[data-msub]').forEach((b) => b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open));
    document.getElementById(b.getAttribute('aria-controls')).classList.toggle('is-open', open);
  }));
  addEventListener('resize', debounce(() => { if (innerWidth >= 1024) setMenu(false); }, 150));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (megaOpen()) { setMega(false); megaBtn.focus(); }
    if (menuOpen()) { setMenu(false); burger.focus(); }
  });

  /* ---------- Marquees (horizontal e vertical) ---------- */
  class Marquee {
    constructor(el) {
      this.el = el;
      this.axis = el.dataset.axis === 'y' ? 'y' : 'x';
      this.dir = el.dataset.dir === 'reverse' ? -1 : 1;
      this.cycle = +(el.dataset.cycle || 40) * 1000;
      this.track = $('.marquee__track', el);
      this.group = $('.marquee__group', this.track);
      this.offset = 0;
      this.speed = 1;
      this.target = 1;
      this.fill();
      el.addEventListener('pointerenter', () => { this.target = 0.3; });
      el.addEventListener('pointerleave', () => { this.target = 1; });
      trackView(el);
    }
    size(n) { return this.axis === 'x' ? n.offsetWidth : n.offsetHeight; }
    fill() {
      $$('[data-clone]', this.track).forEach((n) => n.remove());
      this.dist = this.size(this.group) || 1;
      const need = this.size(this.el) + this.dist;
      let total = this.dist;
      while (total < need || this.track.children.length < 2) {
        const c = this.group.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        c.removeAttribute('aria-label');
        c.dataset.clone = '';
        this.track.appendChild(c);
        total += this.dist;
        if (this.track.children.length > 24) break;
      }
    }
    step(dt) {
      this.speed += (this.target - this.speed) * Math.min(1, dt / 220);
      this.offset += this.dir * (this.dist / this.cycle) * dt * this.speed;
      const pos = ((this.offset % this.dist) + this.dist) % this.dist;
      this.track.style.transform = this.axis === 'x'
        ? `translate3d(${-pos}px,0,0)`
        : `translate3d(0,${-pos}px,0)`;
    }
  }
  const marquees = reduced() ? [] : $$('[data-marquee]').map((el) => new Marquee(el));
  if (marquees.length) {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!document.hidden) marquees.forEach((m) => { if (visible.get(m.el)) m.step(dt); });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    const refill = () => marquees.forEach((m) => m.fill());
    addEventListener('resize', debounce(refill, 200));
    if (document.fonts) document.fonts.ready.then(refill);
  }

  /* ---------- 3.4 Problema: planilha → PriceFleet ---------- */
  (function problem() {
    const xf = $('[data-xform]');
    if (!xf) return;
    const steps = $$('[data-xstep]', xf);
    const setStep = (n) => steps.forEach((s) => s.classList.toggle('is-on', +s.dataset.xstep === n));
    setStep(0);
    onceInView(xf, async () => {
      if (reduced()) { xf.classList.add('is-run', 'is-done'); setStep(2); return; }
      await sleep(500);
      setStep(1);
      xf.classList.add('is-run');
      await sleep(1450);
      setStep(2);
      xf.classList.add('is-done');
    }, 0.35);
  })();

  /* ---------- 3.5 Como funciona ---------- */
  (function steps() {
    // Card 1 — digitação + toggle Novo/Seminovo (funcional)
    const card1 = $('[data-step-form]');
    if (card1) {
      const fields = $$('[data-type]', card1);
      const sw = $('[data-step-switch]', card1);
      const opts = $$('[data-opt]', card1);
      let touched = false;
      const setSw = (on) => {
        sw.setAttribute('aria-checked', String(on));
        opts.forEach((o) => o.classList.toggle('is-on', +o.dataset.opt === (on ? 1 : 0)));
      };
      setSw(false);
      sw.addEventListener('click', () => { touched = true; setSw(sw.getAttribute('aria-checked') !== 'true'); });
      if (!reduced()) {
        fields.forEach((f) => { f.textContent = ''; });
        loopWhileVisible(card1, async () => {
          for (const f of fields) {
            f.classList.add('is-typing');
            const text = f.dataset.type;
            for (let i = 1; i <= text.length; i++) { f.textContent = text.slice(0, i); await sleep(36); }
            await sleep(140);
            f.classList.remove('is-typing');
          }
          await sleep(450);
          if (!touched) setSw(sw.getAttribute('aria-checked') !== 'true');
          await sleep(2800);
          await waitActive(card1);
          fields.forEach((f) => { f.textContent = ''; });
          await sleep(350);
        });
      }
    }

    // Card 2 — barras de deflatores em sequência
    const card2 = $('[data-step-bars]');
    if (card2) {
      if (reduced()) card2.classList.add('is-run');
      else loopWhileVisible(card2, async (el) => {
        el.classList.add('is-run');
        await sleep(4400);
        el.classList.remove('is-run');
        await sleep(700);
      });
    }

    // Card 3 — contador + selo "Aprovado"
    const card3 = $('[data-step-result]');
    if (card3) {
      const val = $('.vres__val', card3);
      if (reduced()) card3.classList.add('is-approved');
      else {
        renderNum(val, 0);
        loopWhileVisible(card3, async (el) => {
          el.classList.remove('is-approved');
          await countTo(val, +val.dataset.count, { from: 0, dur: 1400 });
          await sleep(200);
          el.classList.add('is-approved');
          await sleep(3400);
        });
      }
    }
  })();

  /* ---------- 3.6 Simulação: prazo de 6 a 60 meses + gráfico + KPIs ---------- */
  (function simulation() {
    const sim = $('[data-sim]');
    if (!sim) return;
    // Modelo ilustrativo: resultado acumulado R(t) = -setup + a·t - b·t²
    // price = mensalidade · a = resultado operacional mensal · res = valor residual no fim do prazo
    const M = {
      compra: 86266.25, setup: 9000, b: 4, ymin: -12000, ymax: 32000,
      p: {
        6: { price: 4200, a: 1700, res: 80200 },
        12: { price: 3390, a: 1020, res: 76100 },
        18: { price: 3150, a: 980, res: 72400 },
        24: { price: 2990, a: 950, res: 69300 },
        30: { price: 2870, a: 925, res: 67100 },
        36: { price: 2790, a: 907.36, res: 65494.54 },
        42: { price: 2730, a: 893, res: 63900 },
        48: { price: 2680, a: 880, res: 62400 },
        54: { price: 2640, a: 869, res: 61000 },
        60: { price: 2600, a: 858, res: 59700 },
      },
    };
    const SAMPLES = 36;
    const R = (p, t) => -M.setup + p.a * t - M.b * t * t;
    const metrics = (n) => {
      const p = M.p[n];
      const r = R(p, n);
      return {
        r,
        roi: (r / M.compra) * 100,
        margem: (r / (p.price * n)) * 100,
        ebitda: r + (M.compra - p.res),
        // ROA a.a.: resultado anualizado ÷ valor médio do veículo (ativo) no contrato
        roa: ((r / (n / 12)) / ((M.compra + p.res) / 2)) * 100,
        equilibrio: (p.a - Math.sqrt(p.a * p.a - 4 * M.b * M.setup)) / (2 * M.b),
      };
    };
    const yFrac = (v) => (M.ymax - v) / (M.ymax - M.ymin);
    const points = (n) => Array.from({ length: SAMPLES + 1 }, (_, i) => yFrac(R(M.p[n], (n * i) / SAMPLES)) * 300);
    const toPath = (ys) => ys.map((y, i) => `${i ? 'L' : 'M'}${((i / SAMPLES) * 1000).toFixed(1)} ${y.toFixed(2)}`).join(' ');

    const line = $('.chart__line', sim);
    const area = $('.chart__area', sim);
    const plot = $('[data-chart]', sim);
    const range = $('[data-range]', sim);
    const term = $('[data-term]', sim);
    const kpi = Object.fromEntries($$('[data-kpi]', sim).map((el) => [el.dataset.kpi, el]));
    const ptPay = $('[data-pt-pay]', sim);
    const ptEnd = $('[data-pt-end]', sim);
    const ptEndLbl = $('[data-pt-end-lbl]', sim);
    const xMid = $('[data-x-mid]', sim);
    const xEnd = $('[data-x-end]', sim);
    const live = $('[data-sim-live]', sim);

    let current = +range.value;
    let ys = points(current);
    let anim = 0;

    const draw = (arr) => {
      const d = toPath(arr);
      line.setAttribute('d', d);
      area.setAttribute('d', `${d} L1000 300 L0 300 Z`);
    };
    const markers = (n) => {
      const m = metrics(n);
      ptPay.style.left = `${(m.equilibrio / n) * 100}%`;
      ptPay.style.top = `${yFrac(0) * 100}%`;
      $('em', ptPay).textContent = `Equilíbrio · mês ${fmt(m.equilibrio, 1)}`;
      ptEnd.style.left = '100%';
      ptEnd.style.top = `${yFrac(m.r) * 100}%`;
      ptEndLbl.textContent = `R$ ${fmt(m.r / 1000, 1)} mil`;
      xMid.textContent = String(n / 2);
      xEnd.textContent = `${n} meses`;
    };
    const syncRange = (n) => {
      range.style.setProperty('--p', `${((n - 6) / 54) * 100}%`);
      range.setAttribute('aria-valuetext', `${n} meses`);
      term.textContent = `${n} meses`;
    };

    draw(ys);
    markers(current);
    syncRange(current);

    function setPeriod(n) {
      syncRange(n);
      if (n === current) return;
      const prev = metrics(current);
      const next = metrics(n);
      Object.keys(kpi).forEach((k) => countTo(kpi[k], next[k], { from: prev[k], dur: 700 }));
      markers(n);
      live.textContent = `Prazo de ${n} meses: ROI ${fmt(next.roi, 1)}%, margem ${fmt(next.margem, 1)}%, EBITDA R$ ${fmt(next.ebitda, 0)}, ROA de ${fmt(next.roa, 1)}% ao ano. Valores ilustrativos.`;

      const from = ys.slice();
      const to = points(n);
      cancelAnimationFrame(anim);
      if (reduced()) { ys = to; draw(ys); }
      else {
        const t0 = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / 600);
          const e = easeInOut(p);
          ys = from.map((y, i) => y + (to[i] - y) * e);
          draw(ys);
          if (p < 1) anim = requestAnimationFrame(tick);
        };
        anim = requestAnimationFrame(tick);
      }
      current = n;
    }
    range.addEventListener('input', () => setPeriod(+range.value));

    // Entrada: desenha a linha (clip) e conta os KPIs
    const m0 = metrics(current);
    if (!reduced()) Object.values(kpi).forEach((el) => renderNum(el, 0));
    onceInView(sim, () => {
      plot.classList.add('is-drawn');
      Object.keys(kpi).forEach((k) => countTo(kpi[k], m0[k], { dur: 1200 }));
    }, 0.3);
  })();

  /* ---------- 3.9 Carrossel de depoimentos ---------- */
  (function carousel() {
    const car = $('[data-carousel]');
    if (!car) return;
    const vp = $('[data-car-viewport]', car);
    const slides = $$('.slide', car);
    const dotsWrap = $('[data-car-dots]', car);
    const prev = $('[data-car-prev]', car);
    const next = $('[data-car-next]', car);
    const dots = slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'carousel__dot';
      b.setAttribute('aria-label', `Ir para o depoimento ${i + 1}`);
      b.addEventListener('click', () => go(i));
      dotsWrap.appendChild(b);
      return b;
    });
    let idx = 0;
    const go = (i) => {
      i = Math.max(0, Math.min(slides.length - 1, i));
      vp.scrollTo({ left: i * vp.clientWidth, behavior: reduced() ? 'auto' : 'smooth' });
    };
    const update = () => {
      const i = Math.round(vp.scrollLeft / Math.max(1, vp.clientWidth));
      idx = Math.max(0, Math.min(slides.length - 1, i));
      dots.forEach((d, j) => d.setAttribute('aria-current', j === idx ? 'true' : 'false'));
      prev.disabled = idx === 0;
      next.disabled = idx === slides.length - 1;
    };
    prev.addEventListener('click', () => go(idx - 1));
    next.addEventListener('click', () => go(idx + 1));
    let t = 0;
    vp.addEventListener('scroll', () => { cancelAnimationFrame(t); t = requestAnimationFrame(update); }, { passive: true });
    car.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
    });
    addEventListener('resize', debounce(() => go(idx), 150));
    update();
  })();

  /* ---------- 3.11 FAQ (um aberto por vez) ---------- */
  (function faq() {
    const items = $$('.faq__item');
    items.forEach((item) => {
      const btn = $('button', item);
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        items.forEach((o) => {
          const on = o === item && open;
          $('button', o).setAttribute('aria-expanded', String(on));
          o.classList.toggle('is-open', on);
        });
      });
    });
  })();

  /* ---------- Modal: Solicitar demonstração ---------- */
  const modal = $('[data-modal]');
  const form = $('[data-demo-form]');
  const viewForm = $('[data-view="form"]', modal);
  const viewOk = $('[data-view="success"]', modal);
  let opener = null;
  // Mensagem sugerida conforme o CTA de origem (data-demo="...")
  const SUBJECT_MSG = {
    integracoes: 'Quero falar sobre integrações com os sistemas da minha locadora.',
    reforma: 'Quero simular o impacto da Reforma Tributária na minha locadora.',
  };

  function resetForm() {
    form.reset();
    $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
    $$('.field__err', form).forEach((el) => { el.textContent = ''; });
    $('[data-form-status]', form).textContent = '';
    viewForm.hidden = false;
    viewOk.hidden = true;
  }
  function openModal(subject, trigger) {
    opener = trigger || null;
    if (!viewOk.hidden) resetForm();
    const msg = $('#f-msg');
    if (SUBJECT_MSG[subject] && !msg.value.trim()) msg.value = SUBJECT_MSG[subject];
    if (lenis) lenis.stop();
    modal.showModal();
    requestAnimationFrame(() => modal.classList.add('is-open'));
    setTimeout(() => $('#f-nome').focus(), 30);
  }
  function closeModal() {
    modal.classList.remove('is-open');
    setTimeout(() => { if (modal.open) modal.close(); }, reduced() ? 0 : 200);
  }
  modal.addEventListener('close', () => {
    modal.classList.remove('is-open');
    if (lenis) lenis.start();
    if (opener && document.contains(opener)) opener.focus();
  });
  modal.addEventListener('cancel', (e) => { e.preventDefault(); closeModal(); });
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  $$('[data-modal-close]', modal).forEach((b) => b.addEventListener('click', closeModal));

  // Validação inline
  const FREE_MAIL = /@(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|icloud|me|bol|uol|terra|ig)\.[a-z.]+$/i;
  const rules = {
    nome: (v) => v.trim().length >= 2 || 'Informe seu nome.',
    email: (v) => {
      const s = v.trim();
      if (!s) return 'Informe seu e-mail corporativo.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return 'Digite um e-mail válido, como nome@empresa.com.br.';
      if (FREE_MAIL.test(s)) return 'Use o e-mail da sua empresa, não um e-mail pessoal.';
      return true;
    },
    telefone: (v) => { const d = v.replace(/\D/g, ''); return d.length === 10 || d.length === 11 || 'Informe um telefone com DDD.'; },
    empresa: (v) => v.trim().length >= 2 || 'Informe o nome da empresa.',
    cargo: (v) => !!v || 'Selecione seu cargo.',
    frota: (v) => !!v || 'Selecione o tamanho da frota.',
    consentimento: (_, el) => el.checked || 'Autorize o contato para continuar.',
  };
  function validate(el) {
    const rule = rules[el.name];
    if (!rule) return true;
    const res = rule(el.value, el);
    const ok = res === true;
    el.setAttribute('aria-invalid', String(!ok));
    const err = document.getElementById(el.getAttribute('aria-describedby'));
    if (err) err.textContent = ok ? '' : res;
    return ok;
  }
  const inputs = $$('input, select', form);
  inputs.forEach((el) => {
    el.addEventListener('blur', () => { if (el.value || el.type === 'checkbox' || el.dataset.touched) validate(el); el.dataset.touched = '1'; });
    el.addEventListener('change', () => { if (el.tagName === 'SELECT' || el.type === 'checkbox') validate(el); });
    el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') validate(el); });
  });
  const tel = $('#f-tel');
  tel.addEventListener('input', () => {
    const d = tel.value.replace(/\D/g, '').slice(0, 11);
    let out = d;
    if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 6) out = d.length === 11
      ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
      : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    tel.value = out;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('[data-form-status]', form);
    status.textContent = '';
    const invalid = inputs.filter((el) => !validate(el));
    if (invalid.length) { invalid[0].focus(); return; }

    const btn = $('[data-submit]', form);
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    $$('.btn__label', btn).forEach((l) => { l.textContent = 'Enviando…'; });
    try {
      const data = Object.fromEntries(new FormData(form));
      const endpoint = form.dataset.endpoint; // [validar: endpoint de envio]
      if (endpoint) {
        const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!r.ok) throw new Error(String(r.status));
      } else {
        await sleep(1200); // simulação enquanto não há endpoint
      }
      viewForm.hidden = true;
      viewOk.hidden = false;
      // Conversão (só dispara se o rastreamento foi aceito e carregado)
      if (window.dataLayer) window.dataLayer.push({ event: 'demo_request', origem: data.origem || '' });
      if (window.fbq) window.fbq('track', 'Lead');
      $('[data-success-title]', viewOk).focus();
    } catch (err) {
      status.textContent = 'Não foi possível enviar agora. Tente de novo em instantes.';
    } finally {
      btn.classList.remove('is-loading');
      btn.removeAttribute('aria-busy');
      $$('.btn__label', btn).forEach((l) => { l.textContent = 'Agendar demonstração'; });
    }
  });

  /* ---------- Cliques globais: CTAs e âncoras ---------- */
  document.addEventListener('click', (e) => {
    const demo = e.target.closest('[data-demo]');
    if (demo) {
      e.preventDefault();
      setMega(false);
      setMenu(false);
      openModal(demo.dataset.demo, demo);
      return;
    }
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href === '#') { e.preventDefault(); return; } // link a validar
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    if (lenis) {
      e.preventDefault();
      lenis.scrollTo(target, { offset: -96, duration: 1.1 });
      history.pushState(null, '', href);
    }
  });

  /* ---------- Smooth scroll (Lenis) só em desktop com mouse ---------- */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced()) {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/lenis@1.1.13/dist/lenis.min.js';
    s.async = true;
    s.onload = () => {
      if (!window.Lenis) return;
      lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
      const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    };
    document.head.appendChild(s);
  }

  /* ---------- Diferenciais: explorador com troca automática ---------- */
  (function explorer() {
    const fx = $('[data-fx]');
    if (!fx) return;
    const tabs = $$('[role="tab"]', fx);
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
    let idx = 0;
    let auto = !reduced();

    function select(n, { focus = false, user = false } = {}) {
      if (user) auto = false;
      idx = (n + tabs.length) % tabs.length;
      tabs.forEach((t, k) => {
        const on = k === idx;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        t.classList.remove('is-running');
      });
      panels.forEach((p, k) => { p.hidden = k !== idx; });
      if (focus) tabs[idx].focus();
      if (auto) {
        void tabs[idx].offsetWidth; // reinicia a barra de progresso
        tabs[idx].classList.add('is-running');
      }
    }
    tabs.forEach((t, k) => {
      t.addEventListener('click', () => select(k, { user: true }));
      $('.fx__bar i', t).addEventListener('animationend', () => { if (auto && k === idx) select(idx + 1); });
    });
    $('.fx__list', fx).addEventListener('keydown', (e) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (keys[e.key]) { e.preventDefault(); select(idx + keys[e.key], { focus: true, user: true }); }
      if (e.key === 'Home') { e.preventDefault(); select(0, { focus: true, user: true }); }
      if (e.key === 'End') { e.preventDefault(); select(tabs.length - 1, { focus: true, user: true }); }
    });
    // pausa enquanto o usuário interage com o bloco
    fx.addEventListener('pointerenter', () => fx.classList.add('is-paused'));
    fx.addEventListener('pointerleave', () => fx.classList.remove('is-paused'));
    fx.addEventListener('focusin', () => fx.classList.add('is-paused'));
    fx.addEventListener('focusout', (e) => { if (!fx.contains(e.relatedTarget)) fx.classList.remove('is-paused'); });
    // links do menu/rodapé (#f-0X) abrem o recurso correspondente
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#f-0"]');
      if (!a) return;
      const k = tabs.findIndex((t) => `#${t.id}` === a.getAttribute('href'));
      if (k > -1) select(k, { user: true });
    });
    onceInView(fx, () => select(0), 0.3);
  })();

  /* ---------- Reforma Tributária: alternância de cenário ---------- */
  (function reforma() {
    const sim = $('[data-rt]');
    if (!sim) return;
    const btns = $$('[data-rt-state]', sim);
    const ind = $('.rt__seg-ind', sim);
    const val = $('[data-rt-value]', sim);
    const fill = $('[data-rt-fill]', sim);
    const STATES = { atual: { v: 18.4, w: 92 }, reforma: { v: 15.1, w: 75.5 } }; // ilustrativo (−3,3 p.p.)
    let cur = 'atual';
    let touched = false;
    const moveInd = () => {
      const b = btns.find((x) => x.getAttribute('aria-pressed') === 'true');
      ind.style.width = `${b.offsetWidth}px`;
      ind.style.transform = `translateX(${b.offsetLeft}px)`;
    };
    function set(state) {
      if (state === cur) return;
      const from = STATES[cur].v;
      cur = state;
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rtState === state)));
      moveInd();
      sim.classList.toggle('is-after', state === 'reforma');
      fill.style.width = `${STATES[state].w}%`;
      countTo(val, STATES[state].v, { from, dur: 900 });
    }
    ind.style.transition = 'none';
    moveInd();
    requestAnimationFrame(() => { ind.style.transition = ''; });
    addEventListener('resize', debounce(moveInd, 100));
    if (document.fonts) document.fonts.ready.then(moveInd);
    btns.forEach((b) => b.addEventListener('click', () => { touched = true; set(b.dataset.rtState); }));
    // ao entrar na tela, mostra a queda da margem uma vez
    onceInView(sim, async () => { await sleep(reduced() ? 0 : 1000); if (!touched) set('reforma'); }, 0.5);
  })();

  /* ---------- Antes e depois: hover numa linha destaca o par ---------- */
  (function compare() {
    const cmp = $('.compare');
    if (!cmp) return;
    $$('.compare__list', cmp).forEach((list) => $$('li', list).forEach((li, i) => { li.dataset.i = i; }));
    const clear = () => $$('li.is-hl', cmp).forEach((x) => x.classList.remove('is-hl'));
    cmp.addEventListener('pointerover', (e) => {
      const li = e.target.closest('li[data-i]');
      clear();
      if (li) $$(`li[data-i="${li.dataset.i}"]`, cmp).forEach((x) => x.classList.add('is-hl'));
    });
    cmp.addEventListener('pointerleave', clear);
  })();

  /* ---------- Microinterações de cursor (só mouse, sem movimento reduzido) ---------- */
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer && !reduced()) {
    // Spotlight nos cards
    $$('.step__media, .compare__col, .stat, .post__link, .simcard, .fx__stage, .rt__sim, .tcard').forEach((el) => el.classList.add('spot'));
    let spotRaf = 0;
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest && e.target.closest('.spot');
      if (!el) return;
      cancelAnimationFrame(spotRaf);
      spotRaf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    }, { passive: true });

    // Brilho do hero segue o mouse (suavizado)
    const hero = $('.hero');
    let hx = 50, hy = 0, tx = 50, ty = 0, heroRaf = 0;
    const heroTick = () => {
      hx += (tx - hx) * 0.08; hy += (ty - hy) * 0.08;
      hero.style.setProperty('--hx', `${hx.toFixed(2)}%`);
      hero.style.setProperty('--hy', `${hy.toFixed(2)}%`);
      heroRaf = Math.abs(tx - hx) + Math.abs(ty - hy) > 0.1 ? requestAnimationFrame(heroTick) : 0;
    };
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 100;
      ty = Math.min(45, ((e.clientY - r.top) / r.height) * 100);
      if (!heroRaf) heroRaf = requestAnimationFrame(heroTick);
    });

    // Botões magnéticos
    $$('.btn--lg.btn--primary, .nav__cta').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.15;
        const y = (e.clientY - r.top - r.height / 2) * 0.3;
        b.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      });
      b.addEventListener('pointerleave', () => { b.style.translate = ''; });
    });
  }

  /* ---------- Mockup do hero: inclinação que se desfaz com a rolagem ---------- */
  (function heroTilt() {
    const el = $('.hero__mock .mock');
    if (!el || reduced()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.85)));
      el.style.transform = `perspective(1600px) rotateX(${((1 - p) * 10).toFixed(2)}deg) scale(${(0.97 + 0.03 * p).toFixed(4)})`;
    };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    addEventListener('resize', update);
    update();
  })();

  /* ---------- Navbar: destaca a seção visível ---------- */
  (function currentSection() {
    const map = [['diferenciais', megaBtn], ['como-funciona'], ['integracoes'], ['conteudos'], ['contato']]
      .map(([id, link]) => [document.getElementById(id), link || $(`.nav__link[href="#${id}"]`)])
      .filter(([sec, link]) => sec && link);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const pair = map.find(([sec]) => sec === e.target);
        if (!pair) return;
        pair[1].classList.toggle('is-current', e.isIntersecting);
        if (e.isIntersecting) pair[1].setAttribute('aria-current', 'location');
        else pair[1].removeAttribute('aria-current');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach(([sec]) => io.observe(sec));
  })();

  /* ---------- Consentimento de cookies (LGPD) + rastreamento ---------- */
  // [validar] Preencher no deploy de produção. Vazio = nada é carregado.
  // IDs em uso no site atual: ver PLACEHOLDERS.md.
  const TRACKING = { gtm: '', ga4: '', googleAds: '', metaPixel: '' };
  const CONSENT_KEY = 'pf-consent';

  function inject(src) {
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }
  function loadTracking() {
    window.dataLayer = window.dataLayer || [];
    if (TRACKING.gtm) {
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      inject(`https://www.googletagmanager.com/gtm.js?id=${TRACKING.gtm}`);
    }
    const gtagIds = [TRACKING.ga4, TRACKING.googleAds].filter(Boolean);
    if (gtagIds.length) {
      inject(`https://www.googletagmanager.com/gtag/js?id=${gtagIds[0]}`);
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      gtagIds.forEach((id) => window.gtag('config', id));
    }
    if (TRACKING.metaPixel) {
      const fbq = window.fbq = function () {
        fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
      };
      fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
      window._fbq = fbq;
      inject('https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', TRACKING.metaPixel);
      fbq('track', 'PageView');
    }
  }
  (function consent() {
    const bar = $('[data-consent]');
    if (!bar) return;
    let choice = null;
    try { choice = localStorage.getItem(CONSENT_KEY); } catch (e) { /* armazenamento indisponível */ }
    if (choice === 'yes') { loadTracking(); return; }
    if (choice === 'no') return;
    bar.hidden = false;
    $$('[data-consent-choice]', bar).forEach((b) => b.addEventListener('click', () => {
      const accepted = b.dataset.consentChoice === 'yes';
      try { localStorage.setItem(CONSENT_KEY, accepted ? 'yes' : 'no'); } catch (e) { /* segue sem lembrar */ }
      bar.hidden = true;
      if (accepted) loadTracking();
    }));
  })();

  /* ---------- Ferramenta de revisão (remover antes de publicar) ---------- */
  (function review() {
    const tool = $('[data-review-tool]');
    if (!tool) return;
    const btn = $('[data-review-btn]', tool);
    const panel = $('#review-panel');
    const list = $('[data-review-list]', tool);
    const seen = new Set();
    const items = $$('[data-validar], .ph').filter((el) => {
      if (el.closest('[data-clone]') || el.closest('[data-review-tool]')) return false;
      const note = (el.dataset.validar || el.textContent).trim();
      if (seen.has(note)) return false;
      seen.add(note);
      return true;
    });
    items.forEach((el) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = (el.dataset.validar || el.textContent).trim().replace(/^\[|\]$/g, '');
      if (el.closest('dialog')) b.textContent += ' (formulário de demonstração)';
      b.addEventListener('click', () => {
        if (el.closest('dialog')) return;
        el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
        el.classList.remove('is-flash');
        void el.offsetWidth;
        el.classList.add('is-flash');
      });
      li.appendChild(b);
      list.appendChild(li);
    });
    $('[data-review-count]', tool).textContent = String(items.length);
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      root.classList.toggle('is-review', open);
    });
  })();
})();
