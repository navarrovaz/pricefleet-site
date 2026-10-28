-- =============================================================
-- PriceFleet — Blog · curtidas, visualizações e comentários
-- Rodar uma vez no SQL Editor do projeto Supabase. Depois, em
-- assets/js/blog-config.js: store: { provider: 'supabase', url, anonKey }.
--
-- Segurança: o site usa apenas a chave pública (anon). As tabelas
-- não aceitam escrita direta; tudo passa pelas funções abaixo, que
-- validam os dados. Leitura pública só de comentários aprovados.
-- =============================================================

-- Visualizações por artigo
create table if not exists public.blog_post_stats (
  slug        text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{0,199}$'),
  views       bigint not null default 0,
  updated_at  timestamptz not null default now()
);

-- Uma curtida por navegador (identificador anônimo gerado no site)
create table if not exists public.blog_likes (
  slug        text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,199}$'),
  voter       uuid not null,
  created_at  timestamptz not null default now(),
  primary key (slug, voter)
);

-- Comentários. Para moderar antes de publicar: alter column approved set default false.
create table if not exists public.blog_comments (
  id           bigint generated always as identity primary key,
  slug         text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,199}$'),
  author_name  text not null check (char_length(author_name) between 2 and 80),
  body         text not null check (char_length(body) between 2 and 1000),
  approved     boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists blog_comments_slug_idx on public.blog_comments (slug, created_at desc);

-- Limite de envio de comentários (hash do IP, guardado por 1 dia; não é exposto)
create table if not exists public.blog_comment_rate (
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists blog_comment_rate_idx on public.blog_comment_rate (ip_hash, created_at);

alter table public.blog_post_stats   enable row level security;
alter table public.blog_likes        enable row level security;
alter table public.blog_comments     enable row level security;
alter table public.blog_comment_rate enable row level security;

drop policy if exists "comentarios aprovados sao publicos" on public.blog_comments;
create policy "comentarios aprovados sao publicos" on public.blog_comments
  for select to anon, authenticated using (approved);

revoke all on public.blog_post_stats, public.blog_likes, public.blog_comment_rate from anon, authenticated;
revoke insert, update, delete on public.blog_comments from anon, authenticated;
grant select on public.blog_comments to anon, authenticated;

-- Estatísticas de um ou mais artigos (+ se este navegador já curtiu)
create or replace function public.blog_stats(p_slugs text[], p_voter uuid default null)
returns table (slug text, views bigint, likes bigint, comments bigint, liked boolean)
language sql stable security definer set search_path = public as $$
  select s.slug,
         coalesce((select v.views from blog_post_stats v where v.slug = s.slug), 0),
         (select count(*) from blog_likes l where l.slug = s.slug),
         (select count(*) from blog_comments c where c.slug = s.slug and c.approved),
         p_voter is not null and exists (select 1 from blog_likes l where l.slug = s.slug and l.voter = p_voter)
  from unnest(p_slugs[1:50]) as s(slug);
$$;

-- +1 visualização (o site conta uma por artigo a cada sessão do navegador)
create or replace function public.blog_view(p_slug text)
returns bigint
language sql volatile security definer set search_path = public as $$
  insert into blog_post_stats as s (slug, views) values (p_slug, 1)
  on conflict (slug) do update set views = s.views + 1, updated_at = now()
  returning s.views;
$$;

-- Curtir / descurtir; devolve o total de curtidas do artigo
create or replace function public.blog_like(p_slug text, p_voter uuid, p_on boolean)
returns bigint
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_on then
    insert into blog_likes (slug, voter) values (p_slug, p_voter) on conflict do nothing;
  else
    delete from blog_likes l where l.slug = p_slug and l.voter = p_voter;
  end if;
  return (select count(*) from blog_likes l where l.slug = p_slug);
end;
$$;

-- Publicar comentário (até 3 a cada 10 minutos por IP)
create or replace function public.blog_comment(p_slug text, p_name text, p_body text)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  v_ip   text := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1);
  v_hash text := md5('pf-blog:' || v_ip);
  v_row  blog_comments;
begin
  if (select count(*) from blog_comment_rate r
      where r.ip_hash = v_hash and r.created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'Você enviou vários comentários seguidos. Tente de novo em alguns minutos.';
  end if;

  insert into blog_comments (slug, author_name, body)
  values (p_slug, btrim(regexp_replace(p_name, '\s+', ' ', 'g')), btrim(p_body))
  returning * into v_row;

  insert into blog_comment_rate (ip_hash) values (v_hash);
  delete from blog_comment_rate r where r.created_at < now() - interval '1 day';

  return json_build_object('id', v_row.id, 'slug', v_row.slug, 'author_name', v_row.author_name,
                           'body', v_row.body, 'approved', v_row.approved, 'created_at', v_row.created_at);
end;
$$;

revoke all on function public.blog_stats(text[], uuid), public.blog_view(text),
  public.blog_like(text, uuid, boolean), public.blog_comment(text, text, text) from public;
grant execute on function public.blog_stats(text[], uuid), public.blog_view(text),
  public.blog_like(text, uuid, boolean), public.blog_comment(text, text, text) to anon, authenticated;
