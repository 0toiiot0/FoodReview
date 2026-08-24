-- "담기" 기능용 테이블. Supabase 대시보드의 SQL Editor에 붙여넣어 실행하세요.

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null,        -- 카카오 로컬 API place.id (가게 고유 번호)
  place_name text not null,
  category text,                 -- place.category_name
  address text not null,
  lat double precision not null, -- place.y
  lng double precision not null, -- place.x
  created_at timestamptz not null default now(),
  status text not null default 'planned' check (status in ('planned', 'visited')), -- 맛집 주머니: 가볼 예정/다녀옴
  unique (user_id, place_id)     -- 같은 사람이 같은 가게 중복 담기 방지
);

alter table public.bookmarks enable row level security;

create policy "bookmarks_select_own"
  on public.bookmarks for select
  using (auth.uid() = user_id);

create policy "bookmarks_insert_own"
  on public.bookmarks for insert
  with check (auth.uid() = user_id);

create policy "bookmarks_update_own"
  on public.bookmarks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "bookmarks_delete_own"
  on public.bookmarks for delete
  using (auth.uid() = user_id);
