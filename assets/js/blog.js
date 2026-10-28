/* =============================================================
   PriceFleet — Blog · listagem, template de artigo e interações
   Um único template (blog/artigo.html) atende todos os artigos.
   Navbar, rodapé, modal e aviso de cookies vêm da home (index.html),
   então o blog nunca fica com uma versão diferente deles.
   ============================================================= */
(() => {
  'use strict';

  const CFG = window.PF_BLOG || {};
  const MD = window.PFMarkdown;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const ROOT = document.documentElement.dataset.root || '../';
  const VER = new URL(document.currentScript.src).searchParams.get('v') || '';
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const { esc, fold } = MD;

  const nf = new Intl.NumberFormat('pt-BR');
  const nfCompact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  const num = (n) => (n >= 10000 ? nfCompact.format(n) : nf.format(n));
  const TZ = 'America/Sao_Paulo';
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const parts = (d) => Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric' })
    .formatToParts(d).map((p) => [p.type, p.value]));
  const shortDate = (d) => { const p = parts(d); return `${p.day} ${MONTHS[p.month - 1]} ${p.year}`; };
  const longDate = (d) => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const isoDate = (d) => { const p = parts(d); return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`; };
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  function ago(d) {
    const s = (d - Date.now()) / 1000;
    const steps = [[60, 'second'], [3600, 'minute', 60], [86400, 'hour', 3600], [2592000, 'day', 86400], [31536000, 'month', 2592000], [Infinity, 'year', 31536000]];
    for (const [lim, unit, div = 1] of steps) if (Math.abs(s) < lim) return unit === 'second' ? 'agora mesmo' : rtf.format(Math.round(s / div), unit);
    return '';
  }
  const ic = (id, cls = 'icon') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const initials = (name) => {
    const w = name.trim().split(/\s+/).filter((x) => x.length > 2);
    return (w.length ? w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '') : name.trim()[0] || '?').toUpperCase();
  };
  const isTeam = (name) => /pricefleet/i.test(name);
  const avatar = (name, cls) => `<span class="${cls}" aria-hidden="true">${isTeam(name) ? ic('logo-mark') : esc(initials(name))}</span>`;

  /* ---------- Artigos: API do CMS no domínio oficial, snapshot fora dele ---------- */
  async function fetchJSON(url, ms = 8000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error(`${r.status} em ${url}`);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  function normalize(p) {
    const content = String(p.content || '');
    const words = content.split(/\s+/).filter(Boolean).length;
    let image = String(p.image || '').trim();
    if (image.startsWith('/')) image = (CFG.imageBase || '') + image;
    return {
      slug: String(p.slug),
      title: String(p.title).trim(),
      excerpt: String(p.excerpt || '').trim(),
      content,
      author: String(p.author || '').trim() || 'Equipe PriceFleet',
      date: new Date(p.publishDate),
      category: String(p.category || '').trim() || 'Artigos',
      image,
      mins: parseInt(p.readTime, 10) || Math.max(1, Math.round(words / 200)),
    };
  }
  let postsReq = null;
  function loadPosts() {
    postsReq ||= (async () => {
      let raw = null;
      if (CFG.api && (CFG.apiHosts || []).includes(location.hostname)) {
        try { raw = await fetchJSON(CFG.api); } catch (e) { console.warn('[Blog] API do CMS indisponível; usando o snapshot.', e); }
      }
      if (!raw) raw = await fetchJSON(ROOT + CFG.snapshot);
      const list = Array.isArray(raw) ? raw : raw.posts || [];
      return list.filter((p) => p && p.slug && p.title).map(normalize)
        .filter((p) => !Number.isNaN(+p.date)).sort((a, b) => b.date - a.date);
    })();
    return postsReq;
  }

  /* ---------- Navbar, rodapé, modal e cookies reaproveitados da home ---------- */
  async function loadChrome() {
    const html = await (await fetch(`${ROOT}index.html`)).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const pick = (sel) => doc.querySelector(sel);
    const top = [pick('body > svg'), pick('.skip-link'), pick('#nav')];
    const bottom = [pick('.final'), pick('#demo-modal'), pick('[data-consent]')];
    if (top.concat(bottom).some((n) => !n)) throw new Error('index.html sem navbar/rodapé esperados');

    // Âncoras da home viram links para a home; o que existe nesta página continua local.
    const local = new Set(['conteudo', 'contato', 'cta-final']);
    top.concat(bottom).forEach((part) => {
      [part, ...part.querySelectorAll('[href], [src]')].forEach((el) => {
        if (el.closest('svg') && el.tagName.toLowerCase() === 'use') return;
        for (const attr of ['href', 'src']) {
          const v = el.getAttribute(attr);
          if (!v || v === '#' || /^(https?:|mailto:|tel:|data:|\/)/i.test(v)) continue;
          if (v === '#conteudos') el.setAttribute(attr, `${ROOT}blog/`);
          else if (v.startsWith('#')) { if (!local.has(v.slice(1))) el.setAttribute(attr, ROOT + v); }
          else el.setAttribute(attr, ROOT + v);
        }
      });
    });
    $$(`a[href="${ROOT}blog/"]`, top[2]).forEach((a) => { a.classList.add('is-current'); a.setAttribute('aria-current', 'page'); });

    const slotTop = $('[data-chrome="top"]');
    const slotBottom = $('[data-chrome="bottom"]');
    slotTop.replaceWith(...top.map((n) => document.importNode(n, true)));
    slotBottom.replaceWith(...bottom.map((n) => document.importNode(n, true)));
  }
  function loadMain() {
    const s = document.createElement('script');
    s.src = `${ROOT}assets/js/main.js${VER ? `?v=${VER}` : ''}`;
    document.body.appendChild(s);
  }

  /* ---------- Capas: imagem do CMS ou capa da marca (sem imagem / erro) ---------- */
  function brandCover(seed) {
    let h = 0;
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const id = `pfc-${h.toString(36)}`;
    const art = [
      '<rect x="90" y="70" width="70" height="140" rx="12" fill="#009844" fill-opacity=".9"/><rect x="240" y="100" width="70" height="110" rx="12" fill="#009844" fill-opacity=".35"/><path d="M240 70h70" stroke="#009844" stroke-width="3" stroke-dasharray="6 6"/>',
      '<circle cx="200" cy="120" r="70" fill="#009844" fill-opacity=".14"/><path d="M235 85 165 155" stroke="#009844" stroke-width="10" stroke-linecap="round"/><circle cx="168" cy="90" r="18" fill="none" stroke="#009844" stroke-width="10"/><circle cx="232" cy="150" r="18" fill="#C5D031" stroke="#004422" stroke-width="4"/>',
      '<circle cx="165" cy="120" r="62" fill="#009844" fill-opacity=".85"/><circle cx="235" cy="120" r="62" fill="#C5D031" fill-opacity=".9" stroke="#004422" stroke-width="3"/><path d="m214 120 14 14 26-28" fill="none" stroke="#004422" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
      '<path d="M60 190 140 130l60 30 70-70 70 40" fill="none" stroke="#009844" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="340" cy="130" r="12" fill="#C5D031" stroke="#004422" stroke-width="4"/>',
    ][h % 4];
    return `<svg class="cover-svg" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F6F5"/><stop offset="1" stop-color="#E3F1E5"/></linearGradient></defs><rect width="400" height="240" fill="url(#${id})"/><g stroke="#009844" stroke-opacity=".14"><path d="M0 60h400M0 120h400M0 180h400"/></g>${art}</svg>`;
  }
  const cover = (p, { eager = false, alt = '' } = {}) => (p.image
    ? `<img src="${esc(p.image)}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" data-cover="${esc(p.slug)}">`
    : brandCover(p.slug));
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    if (img.dataset.cover) img.outerHTML = brandCover(img.dataset.cover);
    else if (img.classList.contains('art__cover-bg')) img.remove();
  }, true);

  const postHref = (p) => encodeURIComponent(p.slug);
  function card(p, { feature = false, reveal = true, eager = false } = {}) {
    const H = feature ? 'h2' : 'h3';
    return `<article class="post${feature ? ' post--feature' : ''}"${reveal ? ' data-reveal="scale"' : ''}>
      <a class="post__link" href="${postHref(p)}">
        <div class="post__cover">${cover(p, { eager })}</div>
        <div class="post__body">
          <p class="post__meta">${esc(p.category)} · <time datetime="${isoDate(p.date)}">${shortDate(p.date)}</time></p>
          <${H} class="post__title">${esc(p.title)}</${H}>
          ${p.excerpt ? `<p class="t-small post__excerpt">${esc(p.excerpt)}</p>` : ''}
          <p class="post__foot">${ic('i-clock', 'icon icon--sm')}${p.mins} min de leitura<span aria-hidden="true">·</span>${esc(p.author)}</p>
        </div>
      </a>
    </article>`;
  }

  /* ---------- Curtidas, visualizações e comentários ---------- */
  const Store = (() => {
    const cfg = CFG.store || {};
    const remote = cfg.provider === 'supabase' && cfg.url && cfg.anonKey;
    const KEY = 'pf-blog-v1';
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
    const save = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* segue sem salvar */ } };
    const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
    // Identificador anônimo deste navegador: garante uma curtida por pessoa, sem login.
    const voter = (() => {
      try {
        let v = localStorage.getItem('pf-blog-voter');
        if (!v) { v = uuid(); localStorage.setItem('pf-blog-voter', v); }
        return v;
      } catch (e) { return uuid(); }
    })();
    // Uma visualização por artigo a cada sessão do navegador.
    const firstView = (slug) => {
      try {
        const k = `pf-blog-seen:${slug}`;
        if (sessionStorage.getItem(k)) return false;
        sessionStorage.setItem(k, '1');
        return true;
      } catch (e) { return true; }
    };

    const local = {
      async stats(slug) {
        const d = load();
        return { views: d.views?.[slug] || 0, likes: d.liked?.[slug] ? 1 : 0, comments: (d.comments?.[slug] || []).length, liked: !!d.liked?.[slug] };
      },
      async view(slug) { const d = load(); d.views ||= {}; d.views[slug] = (d.views[slug] || 0) + 1; save(d); },
      async like(slug, on) {
        const d = load();
        d.liked ||= {};
        if (on) d.liked[slug] = 1; else delete d.liked[slug];
        save(d);
        return on ? 1 : 0;
      },
      async comments(slug) { return (load().comments?.[slug] || []).slice().reverse(); },
      async comment(slug, name, body) {
        const d = load();
        const c = { id: uuid(), name, body, date: new Date().toISOString(), approved: true };
        d.comments ||= {};
        (d.comments[slug] ||= []).push(c);
        save(d);
        return c;
      },
    };

    const base = remote ? `${cfg.url.replace(/\/+$/, '')}/rest/v1` : '';
    async function call(path, opts = {}) {
      const r = await fetch(base + path, {
        ...opts,
        headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      });
      const data = r.status === 204 ? null : await r.json().catch(() => null);
      if (!r.ok) throw new Error((data && data.message) || `Erro ${r.status}`);
      return data;
    }
    const rpc = (fn, args) => call(`/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
    const toComment = (c) => ({ id: c.id, name: c.author_name, body: c.body, date: c.created_at, approved: c.approved !== false });
    const supabase = {
      async stats(slug) {
        const r = (await rpc('blog_stats', { p_slugs: [slug], p_voter: voter }) || [])[0] || {};
        return { views: +r.views || 0, likes: +r.likes || 0, comments: +r.comments || 0, liked: !!r.liked };
      },
      async view(slug) { await rpc('blog_view', { p_slug: slug }); },
      async like(slug, on) { return +(await rpc('blog_like', { p_slug: slug, p_voter: voter, p_on: on })) || 0; },
      async comments(slug) {
        const rows = await call(`/blog_comments?select=id,author_name,body,created_at&slug=eq.${encodeURIComponent(slug)}&order=created_at.desc&limit=200`);
        return (rows || []).map(toComment);
      },
      async comment(slug, name, body) { return toComment(await rpc('blog_comment', { p_slug: slug, p_name: name, p_body: body })); },
    };

    const api = remote ? supabase : local;
    return {
      shared: !!remote,
      like: api.like,
      comments: api.comments,
      comment: api.comment,
      async open(slug) {
        if (firstView(slug)) {
          try { await api.view(slug); } catch (e) { console.warn('[Blog] visualização não registrada', e); }
        }
        return api.stats(slug);
      },
    };
  })();

  /* ---------- SEO do artigo (título, canonical, Open Graph, JSON-LD) ---------- */
  function setMeta(attr, key, value) {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute('content', value);
  }
  function applySeo(p) {
    const url = `${CFG.siteUrl}/blog/${p.slug}`;
    const image = p.image || `${CFG.siteUrl}/assets/og/og-image.png`;
    document.title = `${p.title} | Blog PriceFleet`;
    $('link[rel="canonical"]').setAttribute('href', url);
    setMeta('name', 'description', p.excerpt || p.title);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:title', p.title);
    setMeta('property', 'og:description', p.excerpt || p.title);
    setMeta('property', 'og:image', image);
    setMeta('property', 'article:published_time', p.date.toISOString());
    setMeta('property', 'article:section', p.category);
    setMeta('property', 'article:author', p.author);
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify([
      {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: p.title,
        description: p.excerpt,
        image,
        datePublished: p.date.toISOString(),
        articleSection: p.category,
        inLanguage: 'pt-BR',
        mainEntityOfPage: url,
        author: isTeam(p.author) ? { '@type': 'Organization', name: p.author } : { '@type': 'Person', name: p.author },
        publisher: { '@type': 'Organization', name: 'PriceFleet', url: `${CFG.siteUrl}/`, logo: { '@type': 'ImageObject', url: `${CFG.siteUrl}/assets/img/brand/logo-pricefleet.svg` } },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: `${CFG.siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${CFG.siteUrl}/blog` },
          { '@type': 'ListItem', position: 3, name: p.title, item: url },
        ],
      },
    ]);
    document.head.appendChild(ld);
  }

  /* ---------- Avisos curtos ---------- */
  let toastT = 0;
  function toast(msg) {
    const el = $('[data-toast]');
    if (!el) return;
    el.innerHTML = `${ic('i-check', 'icon icon--sm')}<span>${esc(msg)}</span>`;
    el.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('is-on'), 2600);
  }

  /* =============================================================
     LISTAGEM (blog/index.html)
     ============================================================= */
  async function listPage() {
    const main = $('[data-blog-list]');
    const [posts] = await Promise.all([loadPosts(), chrome]);
    const chips = $('[data-chips]');
    const search = $('[data-search]');
    const grid = $('[data-grid]');
    const count = $('[data-count-text]');

    const cats = [...posts.reduce((m, p) => m.set(p.category, (m.get(p.category) || 0) + 1), new Map())]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
    const params = new URLSearchParams(location.search);
    let cat = cats.find(([c]) => MD.slugify(c) === params.get('categoria'))?.[0] || '';
    let q = params.get('busca') || '';
    search.value = q;

    chips.innerHTML = [['', posts.length], ...cats].map(([c, n]) =>
      `<button class="bchip" type="button" data-cat="${esc(c)}" aria-pressed="false">${c ? esc(c) : 'Todos'}<small>${n}</small></button>`).join('');

    function render(first) {
      $$('[data-cat]', chips).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
      const terms = fold(q).split(/\s+/).filter(Boolean);
      const list = posts.filter((p) => (!cat || p.category === cat)
        && terms.every((t) => fold(`${p.title} ${p.excerpt} ${p.category} ${p.author}`).includes(t)));
      const featured = !cat && !terms.length;
      grid.innerHTML = list.map((p, i) => card(p, { feature: featured && i === 0, reveal: first, eager: i === 0 })).join('');
      $('[data-empty]').hidden = list.length > 0;
      count.textContent = list.length
        ? `${list.length} ${list.length === 1 ? 'artigo' : 'artigos'}${cat ? ` em ${cat}` : ''}${terms.length ? ` para “${q.trim()}”` : ''}`
        : '';
      const sp = new URLSearchParams();
      if (cat) sp.set('categoria', MD.slugify(cat));
      if (q.trim()) sp.set('busca', q.trim());
      history.replaceState(null, '', `${location.pathname}${sp.toString() ? `?${sp}` : ''}`);
    }

    chips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      cat = b.dataset.cat;
      render(false);
    });
    search.addEventListener('input', debounce(() => { q = search.value; render(false); }, 160));
    $('[data-search-form]').addEventListener('submit', (e) => e.preventDefault());
    $('[data-clear]').addEventListener('click', () => { cat = ''; q = ''; search.value = ''; render(false); search.focus(); });

    render(true);
    main.removeAttribute('aria-busy');
  }

  /* =============================================================
     ARTIGO (blog/artigo.html → /blog/<slug>)
     ============================================================= */
  function currentSlug() {
    const qs = new URLSearchParams(location.search).get('slug');
    if (qs) return qs;
    const last = decodeURIComponent(location.pathname.replace(/\/+$/, '').split('/').pop() || '');
    return /\.html$/.test(last) ? '' : last;
  }
  function related(p, posts) {
    const others = posts.filter((x) => x !== p);
    const same = others.filter((x) => x.category === p.category);
    return [...same, ...others.filter((x) => !same.includes(x))].slice(0, 3);
  }
  const shareLinks = () => `
    <li><a class="sharebtn" data-share="linkedin" target="_blank" rel="noopener" title="LinkedIn" aria-label="Compartilhar no LinkedIn">${ic('i-linkedin')}</a></li>
    <li><a class="sharebtn" data-share="whatsapp" target="_blank" rel="noopener" title="WhatsApp" aria-label="Compartilhar no WhatsApp">${ic('i-whatsapp')}</a></li>
    <li><a class="sharebtn" data-share="x" target="_blank" rel="noopener" title="X" aria-label="Compartilhar no X">${ic('i-x-brand')}</a></li>
    <li><a class="sharebtn" data-share="email" title="E-mail" aria-label="Enviar por e-mail">${ic('i-mail')}</a></li>
    <li><button class="sharebtn" type="button" data-copy title="Copiar link" aria-label="Copiar link do artigo">${ic('i-link')}</button></li>`;

  function articleHtml(p, posts, { html, toc }) {
    const i = posts.indexOf(p);
    const newer = posts[i - 1];
    const older = posts[i + 1];
    const tocList = toc.map((t) => `<li><a href="#${t.id}" data-toc="${t.id}">${t.text}</a></li>`).join('');
    const stat = (key, icon, label, href) => {
      const inner = `${ic(icon)}<b data-stat="${key}">–</b><span class="sr-only"> ${label}</span>`;
      return `<li title="${label[0].toUpperCase()}${label.slice(1)}">${href ? `<a href="${href}">${inner}</a>` : inner}</li>`;
    };
    return `
    <article class="art" data-art>
      <header class="art__head wrap">
        <div class="measure art__head-in">
          <nav class="crumbs" aria-label="Você está em">
            <a href="${ROOT}">Início</a>${ic('i-chevron-right')}<a href="./">Blog</a>${ic('i-chevron-right')}<a href="./?categoria=${MD.slugify(p.category)}">${esc(p.category)}</a>
          </nav>
          <span class="chip">${esc(p.category)}</span>
          <h1 class="art__title">${esc(p.title)}</h1>
          ${p.excerpt ? `<p class="art__lead">${esc(p.excerpt)}</p>` : ''}
          <div class="art__bar">
            <div class="art__meta">
              <span class="art__author">${avatar(p.author, 'art__av')}<span><small>Por</small><b>${esc(p.author)}</b></span></span>
              <span class="art__m">${ic('i-calendar')}<time datetime="${isoDate(p.date)}">${longDate(p.date)}</time></span>
              <span class="art__m">${ic('i-clock')}${p.mins} min de leitura</span>
            </div>
            <ul class="art__stats" aria-label="Engajamento do artigo">
              ${stat('views', 'i-eye', 'visualizações')}
              ${stat('likes', 'i-heart', 'curtidas')}
              ${stat('comments', 'i-message', 'comentários', '#comentarios')}
            </ul>
          </div>
        </div>
      </header>

      <figure class="art__cover wrap"><div class="art__cover-in">${p.image ? `<img class="art__cover-bg" src="${esc(p.image)}" alt="" aria-hidden="true">` : ''}${cover(p, { eager: true, alt: `Imagem de destaque do artigo: ${p.title}` })}</div></figure>

      <div class="art__layout wrap">
        <div class="art__grid">
          <div class="art__main">
            ${toc.length > 1 ? `<details class="toc-m"><summary>${ic('i-book')}Neste artigo<span>${toc.length} seções</span>${ic('i-chevron-down')}</summary><ol>${tocList}</ol></details>` : ''}
            <div class="prose" data-prose>${html}</div>

            <section class="react" aria-labelledby="react-t">
              <div class="react__txt">
                <p class="react__t" id="react-t">Este conteúdo foi útil?</p>
                <p class="react__s">Curta e compartilhe com quem precifica contratos na sua locadora.</p>
              </div>
              <div class="react__acts">
                <button class="likebtn" type="button" aria-pressed="false" data-like>${ic('i-heart')}<span data-like-label>Curtir</span><b data-stat="likes">–</b></button>
                <ul class="shares" aria-label="Compartilhar">${shareLinks()}</ul>
              </div>
            </section>

            <nav class="pnav" aria-label="Outros artigos">
              ${older ? `<a class="pnav__a" href="${postHref(older)}" rel="prev"><small>${ic('i-arrow-left', 'icon icon--sm')}Artigo anterior</small><b>${esc(older.title)}</b></a>` : '<span></span>'}
              ${newer ? `<a class="pnav__a pnav__a--next" href="${postHref(newer)}" rel="next"><small>Próximo artigo${ic('i-arrow-right', 'icon icon--sm')}</small><b>${esc(newer.title)}</b></a>` : '<span></span>'}
              <a class="link-arrow pnav__back" href="./">${ic('i-arrow-left', 'icon icon--sm')}Voltar para o blog</a>
            </nav>

            <section class="cmts" id="comentarios" aria-labelledby="cmts-t">
              <h2 class="cmts__title" id="cmts-t">Comentários <span data-stat="comments-paren"></span></h2>
              <form class="cform" novalidate data-cform>
                <div class="field">
                  <label for="c-nome">Nome</label>
                  <input id="c-nome" name="nome" type="text" autocomplete="name" maxlength="80" required aria-describedby="ce-nome">
                  <p class="field__err" id="ce-nome"></p>
                </div>
                <div class="field">
                  <label for="c-texto">Comentário</label>
                  <textarea id="c-texto" name="comentario" rows="4" maxlength="1000" required aria-describedby="ce-texto c-count"></textarea>
                  <p class="field__err" id="ce-texto"></p>
                </div>
                <div class="cform__hp" aria-hidden="true">
                  <label for="c-site">Não preencha</label><input id="c-site" name="site" type="text" tabindex="-1" autocomplete="off">
                </div>
                <div class="cform__foot">
                  <p class="cform__note">Seu nome e seu comentário ficam visíveis para todos. Não inclua dados pessoais. <span class="cform__count" id="c-count" data-ccount>0/1000</span></p>
                  <button class="btn btn--primary" type="submit" data-csubmit>
                    <span class="btn__inner"><span class="btn__spinner" aria-hidden="true"></span><span class="btn__roll"><span class="btn__label">Publicar comentário</span><span class="btn__label" aria-hidden="true">Publicar comentário</span></span></span>
                  </button>
                </div>
                <p class="form__status" role="alert" data-cstatus></p>
              </form>
              <ol class="clist" data-clist aria-label="Comentários publicados"></ol>
              <p class="cempty" data-cempty hidden>${ic('i-message')}Ainda não há comentários. Comece a conversa.</p>
              ${Store.shared ? '' : `<p class="bnote">${ic('i-alert', 'icon icon--sm')}<span>Ambiente de revisão: curtidas, visualizações e comentários ficam salvos apenas neste navegador até o banco de dados ser conectado.</span></p>`}
            </section>
          </div>

          <aside class="art__aside" aria-label="Navegação do artigo">
            <div class="art__aside-in">
              ${toc.length > 1 ? `<nav class="toc" aria-labelledby="toc-t"><p class="toc__h" id="toc-t">Neste artigo</p><ol>${tocList}</ol></nav>` : ''}
              <div class="acta">
                <span class="acta__ic">${ic('logo-mark')}</span>
                <p class="acta__t">Veja o PriceFleet calculando um contrato da sua operação.</p>
                <button class="btn btn--primary btn--block" type="button" data-demo>
                  <span class="btn__inner"><span class="btn__roll"><span class="btn__label">Solicitar demonstração</span><span class="btn__label" aria-hidden="true">Solicitar demonstração</span></span></span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </article>

    <section class="section section--soft related" aria-labelledby="rel-t">
      <div class="container">
        <header class="section-head section-head--row">
          <div class="section-head__main">
            <span class="eyebrow">${ic('i-book')}Continue lendo</span>
            <h2 class="t-h3" id="rel-t">Artigos relacionados</h2>
          </div>
          <a class="link-arrow" href="./">Ver todos os artigos ${ic('i-arrow-right', 'icon icon--sm')}</a>
        </header>
        <div class="posts" data-stagger>${related(p, posts).map((x) => card(x)).join('')}</div>
      </div>
    </section>

    <div class="dock" role="toolbar" aria-label="Ações do artigo" data-dock>
      <button class="dock__btn" type="button" aria-pressed="false" data-like title="Curtir">${ic('i-heart')}<b data-stat="likes">–</b><span class="sr-only"> curtidas</span></button>
      <span class="dock__sep" aria-hidden="true"></span>
      <a class="dock__btn" href="#comentarios" title="Comentários">${ic('i-message')}<b data-stat="comments">–</b><span class="sr-only"> comentários</span></a>
      <span class="dock__sep" aria-hidden="true"></span>
      <div class="dock__share">
        <button class="dock__btn" type="button" aria-expanded="false" aria-controls="dock-share" data-dock-share>${ic('i-share')}<span>Compartilhar</span></button>
        <ul class="dock__pop shares" id="dock-share" aria-label="Compartilhar" hidden>${shareLinks()}</ul>
      </div>
    </div>
    <p class="btoast" role="status" aria-live="polite" data-toast></p>`;
  }

  function notFoundHtml(posts) {
    return `
    <section class="art__head wrap bnf">
      <div class="measure art__head-in">
        <nav class="crumbs" aria-label="Você está em"><a href="${ROOT}">Início</a>${ic('i-chevron-right')}<a href="./">Blog</a></nav>
        <span class="eyebrow">${ic('i-alert')}Artigo não encontrado</span>
        <h1 class="art__title">Não encontramos este artigo.</h1>
        <p class="art__lead">O endereço pode ter mudado ou o conteúdo saiu do ar. Veja os artigos mais recentes do blog.</p>
        <a class="btn btn--primary btn--lg" href="./"><span class="btn__inner"><span class="btn__roll"><span class="btn__label">Ir para o blog</span><span class="btn__label" aria-hidden="true">Ir para o blog</span></span></span></a>
      </div>
    </section>
    <section class="section related" aria-label="Artigos recentes">
      <div class="container"><div class="posts">${posts.slice(0, 3).map((x) => card(x)).join('')}</div></div>
    </section>`;
  }

  async function articlePage() {
    const main = $('[data-post]');
    const slug = currentSlug();
    const [posts] = await Promise.all([loadPosts(), chrome]);
    const p = posts.find((x) => x.slug === slug);

    if (!p) {
      main.innerHTML = notFoundHtml(posts);
      document.title = 'Artigo não encontrado | Blog PriceFleet';
      setMeta('name', 'robots', 'noindex');
      main.removeAttribute('aria-busy');
      return;
    }

    // URL individual: /blog/<slug> (o 404.html do GitHub Pages redireciona para cá com ?slug=).
    if (new URLSearchParams(location.search).has('slug')) history.replaceState(null, '', `${encodeURIComponent(p.slug)}${location.hash}`);
    const url = `${location.origin}${location.pathname}`;
    applySeo(p);
    main.innerHTML = articleHtml(p, posts, MD.render(p.content, p.title));
    main.removeAttribute('aria-busy');
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) requestAnimationFrame(() => target.scrollIntoView());
    }

    wireShare(p, url);
    wireToc();
    wireDock();
    wireEngagement(p);
  }

  function wireShare(p, url) {
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(p.title);
    const hrefs = {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${p.title} ${url}`)}`,
      x: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
      email: `mailto:?subject=${t}&body=${encodeURIComponent(`${p.excerpt ? `${p.excerpt}\n\n` : ''}${url}`)}`,
    };
    $$('[data-share]').forEach((a) => { a.href = hrefs[a.dataset.share]; });

    async function copy() {
      try {
        await navigator.clipboard.writeText(url);
      } catch (e) {
        const ta = Object.assign(document.createElement('textarea'), { value: url });
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      toast('Link copiado');
    }
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-copy]')) copy();
    });

    // Compartilhar (dock): menu nativo no celular, lista de redes no desktop.
    const btn = $('[data-dock-share]');
    const pop = $('#dock-share');
    const setPop = (open) => { btn.setAttribute('aria-expanded', String(open)); pop.hidden = !open; };
    btn.addEventListener('click', async () => {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        try { await navigator.share({ title: p.title, text: p.excerpt, url }); } catch (e) { /* cancelado */ }
        return;
      }
      setPop(pop.hidden);
    });
    pop.addEventListener('click', (e) => { if (e.target.closest('a, button')) setPop(false); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.dock__share')) setPop(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { setPop(false); btn.focus(); } });
  }

  function wireToc() {
    const links = $$('[data-toc]');
    if (!links.length) return;
    const heads = [...new Set(links.map((a) => a.dataset.toc))].map((id) => document.getElementById(id)).filter(Boolean);
    let tick = false;
    const update = () => {
      tick = false;
      let cur = '';
      const line = innerHeight * 0.3;
      for (const h of heads) if (h.getBoundingClientRect().top < line) cur = h.id;
      links.forEach((a) => a.classList.toggle('is-active', a.dataset.toc === cur));
    };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
    update();
    $('.toc-m')?.addEventListener('click', (e) => { if (e.target.closest('a')) e.currentTarget.open = false; });
  }

  function wireDock() {
    const dock = $('[data-dock]');
    const prose = $('[data-prose]');
    let tick = false;
    const update = () => {
      tick = false;
      const r = prose.getBoundingClientRect();
      const on = r.top < innerHeight * 0.55 && r.bottom > innerHeight * 0.35;
      dock.classList.toggle('is-on', on);
      dock.inert = !on;
    };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', update);
    update();
  }

  function wireEngagement(p) {
    const stats = { views: 0, likes: 0, comments: 0, liked: false };
    const paint = () => {
      $$('[data-stat="views"]').forEach((el) => { el.textContent = num(stats.views); });
      $$('[data-stat="likes"]').forEach((el) => { el.textContent = num(stats.likes); });
      $$('[data-stat="comments"]').forEach((el) => { el.textContent = num(stats.comments); });
      $$('[data-stat="comments-paren"]').forEach((el) => { el.textContent = `(${num(stats.comments)})`; });
      $$('[data-like]').forEach((b) => {
        b.setAttribute('aria-pressed', String(stats.liked));
        b.setAttribute('aria-label', `${stats.liked ? 'Remover curtida' : 'Curtir este artigo'} (${num(stats.likes)} ${stats.likes === 1 ? 'curtida' : 'curtidas'})`);
      });
      $$('[data-like-label]').forEach((el) => { el.textContent = stats.liked ? 'Curtido' : 'Curtir'; });
    };

    Store.open(p.slug).then((s) => { Object.assign(stats, s); paint(); }).catch((e) => {
      console.error('[Blog] estatísticas', e);
      $$('[data-stat]').forEach((el) => { el.textContent = '–'; });
    });

    // Curtir / descurtir (otimista, desfaz se o servidor recusar)
    let busy = false;
    document.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-like]');
      if (!b || busy) return;
      busy = true;
      const prev = { ...stats };
      stats.liked = !stats.liked;
      stats.likes = Math.max(0, stats.likes + (stats.liked ? 1 : -1));
      paint();
      if (stats.liked && !reduced()) $$('[data-like]').forEach((x) => { x.classList.remove('is-pop'); void x.offsetWidth; x.classList.add('is-pop'); });
      try {
        stats.likes = await Store.like(p.slug, stats.liked);
        paint();
      } catch (err) {
        Object.assign(stats, prev);
        paint();
        toast('Não foi possível registrar a curtida agora.');
      } finally { busy = false; }
    });

    // Comentários
    const list = $('[data-clist]');
    const empty = $('[data-cempty]');
    const commentHtml = (c, fresh) => {
      const d = new Date(c.date);
      return `<li class="cmt${fresh ? ' is-new' : ''}">
        ${avatar(c.name, 'cmt__av')}
        <div class="cmt__main">
          <p class="cmt__top"><b class="cmt__name">${esc(c.name)}</b><time class="cmt__time" datetime="${d.toISOString()}" title="${esc(longDate(d))}">${ago(d)}</time>${c.approved ? '' : '<span class="cmt__pending">Aguardando moderação</span>'}</p>
          <p class="cmt__body">${esc(c.body)}</p>
        </div>
      </li>`;
    };
    const renderList = (items) => {
      list.innerHTML = items.map((c) => commentHtml(c)).join('');
      empty.hidden = items.length > 0;
    };
    Store.comments(p.slug).then(renderList).catch((e) => {
      console.error('[Blog] comentários', e);
      empty.hidden = false;
      empty.textContent = 'Não foi possível carregar os comentários agora.';
    });

    const form = $('[data-cform]');
    const name = $('#c-nome', form);
    const text = $('#c-texto', form);
    const counter = $('[data-ccount]', form);
    const status = $('[data-cstatus]', form);
    const btn = $('[data-csubmit]', form);
    text.addEventListener('input', () => { counter.textContent = `${text.value.length}/1000`; });
    const fieldErr = (input, msg) => {
      $(`#${input.getAttribute('aria-describedby').split(' ')[0]}`).textContent = msg;
      if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      return !msg;
    };
    [name, text].forEach((el) => el.addEventListener('input', () => { if (el.hasAttribute('aria-invalid')) fieldErr(el, ''); }));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.textContent = '';
      const n = name.value.trim().replace(/\s+/g, ' ');
      const t = text.value.trim();
      const okName = fieldErr(name, n.length < 2 ? 'Informe seu nome.' : '');
      const okText = fieldErr(text, t.length < 2 ? 'Escreva seu comentário.' : '');
      if (!okName || !okText) { (okName ? text : name).focus(); return; }
      if ($('#c-site', form).value) { form.reset(); return; } // robô

      btn.classList.add('is-loading');
      btn.setAttribute('aria-busy', 'true');
      try {
        const c = await Store.comment(p.slug, n, t);
        list.insertAdjacentHTML('afterbegin', commentHtml(c, true));
        empty.hidden = true;
        if (c.approved) { stats.comments += 1; paint(); }
        text.value = '';
        counter.textContent = '0/1000';
        toast(c.approved ? 'Comentário publicado' : 'Comentário enviado para moderação');
      } catch (err) {
        status.textContent = err.message && !/^Erro \d+/.test(err.message) ? err.message : 'Não foi possível publicar agora. Tente de novo em instantes.';
      } finally {
        btn.classList.remove('is-loading');
        btn.removeAttribute('aria-busy');
      }
    });
  }

  /* ---------- Início ---------- */
  const chrome = loadChrome().then(() => true, (e) => { console.error('[Blog] navbar/rodapé', e); return false; });
  const page = document.body.dataset.page;
  const run = page === 'post' ? articlePage : listPage;
  run().catch((e) => {
    console.error('[Blog]', e);
    const slot = $('[data-post], [data-blog-list]');
    slot.removeAttribute('aria-busy');
    $('[data-load-error]')?.removeAttribute('hidden');
    $$('[data-skeleton]').forEach((el) => el.remove());
  }).finally(async () => {
    if (await chrome) loadMain(); // main.js depende da navbar/modal injetados
  });
})();
