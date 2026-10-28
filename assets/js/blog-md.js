/* =============================================================
   PriceFleet — Blog · Markdown → HTML
   Cobre o subconjunto usado pelo CMS: títulos, parágrafos, negrito,
   itálico, links, imagens, listas, citações, tabelas e separadores.
   Artigos colados como texto puro (sem marcação) também são
   estruturados: linhas recuadas viram lista e linhas curtas após
   um separador viram subtítulos.
   ============================================================= */
(function (global) {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const slugify = (s) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'secao';
  const plain = (s) => String(s).replace(/\*\*|__|[*_`]/g, '').trim();
  const safeUrl = (u) => (/^(https?:|mailto:|tel:)/i.test(u) || !/^[a-z][a-z0-9+.-]*:/i.test(u) ? u : '');

  function inline(src) {
    let s = esc(src);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => {
      const u = safeUrl(url);
      return u ? `<img src="${u}" alt="${alt}" loading="lazy" decoding="async">` : '';
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => {
      const u = safeUrl(url);
      if (!u) return txt;
      const ext = /^https?:/i.test(u) && !/pricefleet\.com\.br/i.test(u);
      return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ''}>${txt}</a>`;
    });
    s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__(?=\S)([\s\S]*?\S)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])\*(?=\S)([^*]*?\S)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[\s(])_(?=\S)([^_]*?\S)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
    return s;
  }

  function parse(src) {
    const lines = String(src).replace(/\r\n?/g, '\n').replace(/ /g, ' ').split('\n');
    const isMd = /^(#{1,6}\s|\s{0,3}[-*+]\s|\s{0,3}\d+[.)]\s|\s{0,3}>|\s*\|)/m.test(src) || /\*\*\S/.test(src);
    const isBlank = (l) => !l.trim();
    const isHr = (l) => /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l);
    const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    const isSep = (l) => /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*(:?-{3,}:?\s*)?\|?\s*$/.test(l);
    const isHead = (l) => /^#{1,6}\s/.test(l);
    const isQuote = (l) => /^\s{0,3}>/.test(l);
    const listItem = (l) => {
      let m = l.match(/^\s{0,3}[-*+•]\s+(.*)$/);
      if (m) return { ord: false, text: m[1] };
      m = l.match(/^\s{0,3}(\d+)[.)]\s+(.*)$/);
      if (m) return { ord: true, text: m[2], n: +m[1] };
      m = !isMd && l.match(/^(?: {2,}|\t)(\S.*)$/);
      if (m) return { ord: false, text: m[1] };
      return null;
    };
    const cells = (r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

    const blocks = [];
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (isBlank(l)) { i++; continue; }
      if (isHr(l)) { blocks.push({ t: 'hr' }); i++; continue; }

      const h = l.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (h) { blocks.push({ t: 'h', level: h[1].length, text: h[2] }); i++; continue; }

      if (isRow(l) && isSep(lines[i + 1] || '')) {
        const head = cells(l);
        const align = cells(lines[i + 1]).map((c) => (/:$/.test(c) ? (/^:/.test(c) ? 'center' : 'right') : ''));
        const rows = [];
        i += 2;
        while (i < lines.length && isRow(lines[i])) rows.push(cells(lines[i++]));
        blocks.push({ t: 'table', head, align, rows });
        continue;
      }

      if (isQuote(l)) {
        const buf = [];
        while (i < lines.length && isQuote(lines[i])) buf.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
        const paras = buf.join('\n').split(/\n\s*\n/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean);
        blocks.push({ t: 'quote', paras });
        continue;
      }

      const first = listItem(l);
      if (first) {
        const items = [];
        while (i < lines.length) {
          const cur = lines[i];
          if (isBlank(cur)) {
            let j = i + 1;
            while (j < lines.length && isBlank(lines[j])) j++;
            const nx = j < lines.length && listItem(lines[j]);
            if (nx && nx.ord === first.ord) { i = j; continue; }
            break;
          }
          const it = listItem(cur);
          if (it && it.ord === first.ord) { items.push(it.text.trim()); i++; continue; }
          if (!it && isMd && /^\s+\S/.test(cur) && items.length) { items[items.length - 1] += ` ${cur.trim()}`; i++; continue; }
          break;
        }
        blocks.push({ t: first.ord ? 'ol' : 'ul', items, start: first.n || 1 });
        continue;
      }

      // Parágrafo. Em texto puro cada linha é um parágrafo (a quebra é intencional).
      if (!isMd) { blocks.push({ t: 'p', text: l.trim() }); i++; continue; }
      const buf = [l.trim()];
      i++;
      while (i < lines.length && !isBlank(lines[i]) && !isHr(lines[i]) && !isHead(lines[i])
        && !isQuote(lines[i]) && !listItem(lines[i]) && !isRow(lines[i])) buf.push(lines[i++].trim());
      blocks.push({ t: 'p', text: buf.join(' ') });
    }
    return { blocks, isMd };
  }

  function render(src, title = '') {
    const { blocks, isMd } = parse(src);
    const norm = (s) => fold(plain(s)).replace(/[^a-z0-9]+/g, '');

    // O CMS às vezes repete o título no início do conteúdo: remove.
    const nt = norm(title);
    while (blocks.length && /^(h|p)$/.test(blocks[0].t) && norm(blocks[0].text).length > 8 && nt.includes(norm(blocks[0].text))) blocks.shift();
    while (blocks.length && blocks[0].t === 'hr') blocks.shift();

    // Texto puro: linha curta, sem pontuação final e seguida de um parágrafo de verdade
    // vira subtítulo. Uma ou duas palavras (ex.: "PriceFleet") viram subtítulo menor.
    // Linhas de fluxo ("↓"), rótulos ("Prazo: 36 meses") e frases entre aspas ficam como texto.
    if (!isMd) {
      const hasWords = (b) => b && /\p{L}{2}/u.test(b.text || '');
      // De trás para frente: "Sobre as empresas" pode vir antes de outro subtítulo.
      for (let k = blocks.length - 1; k >= 0; k--) {
        const b = blocks[k];
        const prev = blocks[k - 1];
        const next = blocks[k + 1];
        const afterHr = prev && prev.t === 'hr';
        if (b.t !== 'p' || b.text.length > 100 || !/^["“]?\p{Lu}/u.test(b.text) || /[.,;:!?…]["”']?$/.test(b.text) || /\|/.test(b.text)) continue;
        if (!next || !(next.t === 'p' && (afterHr || next.text.length >= 40) || next.t === 'ul' || (next.t === 'h' && next.level === 3))) continue;
        if (prev && prev.t === 'p' && !hasWords(prev)) continue;
        const words = b.text.split(/\s+/).length;
        if (!afterHr && words > 2 && /\d/.test(b.text)) continue;
        b.t = 'h';
        b.level = words <= 2 && !afterHr ? 3 : 2;
      }
    }

    // Níveis de título: o maior usado no artigo vira h2 (o h1 é o título da página).
    const levels = [...new Set(blocks.filter((b) => b.t === 'h').map((b) => b.level))].sort();
    blocks.forEach((b) => { if (b.t === 'h') b.tag = `h${Math.min(4, 2 + levels.indexOf(b.level))}`; });

    // Parágrafos inteiramente em negrito, em sequência, formam um destaque.
    const out = [];
    blocks.forEach((b) => {
      const strong = b.t === 'p' && /^\*\*[^*]+\*\*$/.test(b.text) && plain(b.text).length >= 25;
      const last = out[out.length - 1];
      if (strong && last && last.t === 'hl') last.paras.push(b.text);
      else if (strong) out.push({ t: 'hl', paras: [b.text] });
      else out.push(b);
    });

    const toc = [];
    const used = new Set();
    const uid = (t) => {
      const base = slugify(plain(t));
      let id = base;
      let n = 2;
      while (used.has(id)) id = `${base}-${n++}`;
      used.add(id);
      return id;
    };
    const paras = (list) => list.map((p) => `<p>${inline(p)}</p>`).join('');

    const html = out.map((b) => {
      switch (b.t) {
        case 'hr': return '<hr>';
        case 'h': {
          const id = uid(b.text);
          if (b.tag === 'h2') toc.push({ id, text: esc(plain(b.text)) });
          return `<${b.tag} id="${id}">${inline(b.text)}</${b.tag}>`;
        }
        case 'hl': return `<div class="callout">${paras(b.paras.map(plain))}</div>`;
        case 'quote': return `<blockquote>${paras(b.paras)}</blockquote>`;
        case 'ul': return `<ul>${b.items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`;
        case 'ol': return `<ol${b.start > 1 ? ` style="counter-reset:li ${b.start - 1}"` : ''}>${b.items.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`;
        case 'table': {
          const al = (k) => (b.align[k] ? ` style="text-align:${b.align[k]}"` : '');
          const head = b.head.map((c, k) => `<th scope="col"${al(k)}>${inline(c)}</th>`).join('');
          const rows = b.rows.map((r) => `<tr>${r.map((c, k) => (k === 0 ? `<th scope="row"${al(k)}>${inline(c)}</th>` : `<td${al(k)}>${inline(c)}</td>`)).join('')}</tr>`).join('');
          return `<div class="prose__table" role="region" aria-label="Tabela" tabindex="0"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
        }
        default: {
          const p = inline(b.text);
          return /^<img [^>]+>$/.test(p) ? `<figure>${p}</figure>` : `<p>${p}</p>`;
        }
      }
    }).join('\n');

    return { html, toc };
  }

  global.PFMarkdown = { render, esc, fold, slugify };
})(typeof window !== 'undefined' ? window : globalThis);
