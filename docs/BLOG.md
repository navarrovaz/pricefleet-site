# Blog do PriceFleet

## Como funciona

| Peça | Arquivo | Papel |
|---|---|---|
| Listagem | `blog/index.html` | Página `/blog/` com filtro por categoria, busca e todos os artigos |
| Template de artigo | `blog/artigo.html` | **Único** template para todos os artigos (`/blog/<slug>`) |
| Lógica | `assets/js/blog.js` | Carrega os artigos, monta listagem e artigo, curtidas, visualizações, comentários e compartilhamento |
| Conteúdo | `assets/js/blog-md.js` | Converte o Markdown do CMS em HTML (títulos, listas, tabelas, citações, imagens) e gera o sumário |
| Configuração | `assets/js/blog-config.js` | Origem dos artigos e armazenamento das interações |
| Estilos | `assets/css/blog.css` | Peças próprias do blog; o resto vem de `styles.css` |
| Rotas no GitHub Pages | `404.html` | Encaminha `/blog/<slug>` para o template e restaura a URL |

**Navbar, rodapé, CTA final, modal de demonstração e aviso de cookies** não são copiados: o blog lê esses
blocos do `index.html` ao abrir. Qualquer mudança na home aparece no blog automaticamente.

## De onde vêm os artigos

Os artigos continuam cadastrados no **CMS do site atual**, servidos pela API pública
`GET /api/v1/public/posts` (campos `slug`, `title`, `excerpt`, `content` em Markdown, `author`, `publishDate`,
`image`, `category`, `readTime`).

- **No domínio oficial** (`www.pricefleet.com.br`): o blog lê a API ao vivo. Artigo publicado no CMS aparece
  na listagem e ganha sua página na hora, sem mexer em código.
- **Fora dele** (GitHub Pages, localhost): a API não libera acesso de outros domínios (CORS), então o blog usa
  o snapshot `content/blog/posts.json`. Para atualizar depois de publicar um artigo no CMS:

  ```bash
  node scripts/sync-blog.mjs
  ```

  e fazer commit do `content/blog/posts.json`.

Tempo de leitura: usa o `readTime` do CMS; se vier vazio, calcula por 200 palavras/minuto.
Imagem: usa a do CMS (inteira, sem cortes); sem imagem ou com erro, mostra uma capa da marca.

## URLs

Cada artigo tem URL própria: `/blog/<slug>` (o mesmo padrão do site atual, preservando links e SEO).
Funciona ao clicar, ao abrir direto e ao atualizar a página.

- **GitHub Pages**: o `404.html` encaminha para `blog/artigo.html?slug=<slug>`, que restaura a URL bonita.
- **Servidor próprio**: configure uma reescrita para responder `200` direto, sem passar pelo 404:

  ```nginx
  location ~ ^/blog/[^/.]+$ { try_files $uri /blog/artigo.html; }
  ```

  Azure Static Web Apps (`staticwebapp.config.json`):

  ```json
  { "routes": [{ "route": "/blog/*", "rewrite": "/blog/artigo.html" }] }
  ```

  (exclua `/blog/`, `/blog/index.html` e `/blog/artigo.html` da regra se o servidor não fizer isso sozinho)

## Curtidas, visualizações e comentários

Funcionam de verdade: contam, salvam e reaparecem ao voltar. Onde ficam salvos depende de `store` em `blog-config.js`:

| `store.provider` | Onde salva | Quem vê |
|---|---|---|
| vazio (padrão hoje) | `localStorage` do navegador | Só quem interagiu. A página mostra o aviso "Ambiente de revisão" |
| `'supabase'` | Banco Postgres no Supabase | Todos os visitantes |

Regras: 1 visualização por artigo a cada sessão do navegador; 1 curtida por navegador (pode desfazer);
comentários com nome + texto (até 1.000 caracteres), sem e-mail, com campo anti-robô e limite de 3 envios a cada
10 minutos por IP.

### Ativar o banco compartilhado (Supabase)

1. Criar um projeto em supabase.com (plano gratuito atende).
2. No **SQL Editor**, rodar `supabase/blog.sql`.
3. Em **Project Settings → API**, copiar a *Project URL* e a chave *anon public* para `assets/js/blog-config.js`:

   ```js
   store: { provider: 'supabase', url: 'https://<projeto>.supabase.co', anonKey: '<chave anon>' },
   ```

A chave *anon* é pública por desenho: as tabelas não aceitam escrita direta e tudo passa por funções que validam
os dados. **Nunca** use a chave `service_role` no site.

**Moderação**: na tabela `blog_comments`, mude `approved` para `false` para esconder um comentário. Para revisar
antes de publicar, rode `alter table public.blog_comments alter column approved set default false;`. O site então
mostra "Comentário enviado para moderação".

> Alternativa: o time do backend pode implementar as mesmas 5 operações na API atual
> (`blog_stats`, `blog_view`, `blog_like`, `blog_comment` e a listagem de comentários) e trocar o adaptador em
> `blog.js` (objeto `supabase` dentro de `Store`).

## SEO

Cada artigo define título, descrição, canonical, Open Graph (com a imagem do artigo) e JSON-LD
`BlogPosting` + `BreadcrumbList`. O conteúdo é montado no navegador, como no site atual (React); o Google
renderiza JavaScript. Para pré-visualizações em redes sociais com a imagem de cada artigo, o ideal em produção é
pré-renderizar as metatags no servidor.

As páginas do blog têm `noindex` enquanto esta é uma versão de revisão. Remover no deploy oficial, junto com a home.

## Testar localmente

```bash
python scripts/dev-server.py
```

Abre em `http://127.0.0.1:5173/` e se comporta como o GitHub Pages (inclusive o `404.html`).
