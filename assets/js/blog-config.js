/* =============================================================
   PriceFleet — Blog · configuração
   Único arquivo a editar para trocar a origem dos artigos ou
   conectar o armazenamento de curtidas, visualizações e comentários.
   Detalhes em docs/BLOG.md.
   ============================================================= */
window.PF_BLOG = {
  // Artigos: no domínio oficial, a API pública do CMS atual (novos artigos aparecem sozinhos).
  // Fora dele (GitHub Pages, localhost), o snapshot gerado por `node scripts/sync-blog.mjs`.
  api: '/api/v1/public/posts',
  apiHosts: ['www.pricefleet.com.br', 'pricefleet.com.br'],
  snapshot: 'content/blog/posts.json',

  // URLs públicas (canonical, Open Graph e imagens com caminho relativo no CMS).
  siteUrl: 'https://www.pricefleet.com.br',
  imageBase: 'https://www.pricefleet.com.br',

  // Curtidas, visualizações e comentários.
  // [validar] provider 'supabase' + url + anonKey = dados compartilhados entre todos os visitantes
  // (rodar supabase/blog.sql antes). Vazio = salvos só no navegador de quem interage.
  store: { provider: '', url: '', anonKey: '' },
};
