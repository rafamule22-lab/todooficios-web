-- Blog de TodoOficios.es: posts generados semanalmente (borrador) y revisados a mano antes de publicar.

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null,
  content_html text not null,
  category text not null,
  oficio text not null,
  meta_description text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists blog_posts_status_published_at_idx
  on public.blog_posts (status, published_at desc);

alter table public.blog_posts enable row level security;

-- Lectura pública SOLO de posts publicados. No hay políticas de insert/update/delete
-- para "anon": todas las escrituras las hace el bot generador con la service_role key,
-- que salta RLS por completo. El navegador nunca puede crear ni modificar posts.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'blog_posts'
      and policyname = 'blog_posts_select_published'
  ) then
    create policy blog_posts_select_published
      on public.blog_posts
      for select
      to anon
      using (status = 'published');
  end if;
end $$;
