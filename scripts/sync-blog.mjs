// Sincroniza os artigos do CMS do PriceFleet (API pública) para o snapshot
// usado quando o site roda fora do domínio oficial (ex.: GitHub Pages).
// No domínio oficial o blog lê a API ao vivo; este arquivo é só o fallback.
//
// Uso: node scripts/sync-blog.mjs [url-da-api]
import { mkdir, writeFile } from 'node:fs/promises';

const API = process.argv[2] || 'https://www.pricefleet.com.br/api/v1/public/posts';
const FIELDS = ['slug', 'title', 'excerpt', 'content', 'author', 'publishDate', 'image', 'category', 'readTime'];

const res = await fetch(API, { headers: { accept: 'application/json' } });
if (!res.ok) throw new Error(`${res.status} ${res.statusText} em ${API}`);
const data = await res.json();
if (!Array.isArray(data)) throw new Error('Resposta inesperada: a API deveria devolver uma lista de artigos.');

const posts = data
  .filter((p) => p && p.slug && p.title)
  .map((p) => Object.fromEntries(FIELDS.map((k) => [k, p[k] ?? ''])))
  .sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));

const file = new URL('../content/blog/posts.json', import.meta.url);
await mkdir(new URL('.', file), { recursive: true });
await writeFile(file, `${JSON.stringify({ source: API, syncedAt: new Date().toISOString(), posts }, null, 2)}\n`);
console.log(`${posts.length} artigos salvos em content/blog/posts.json`);
