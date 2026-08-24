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
  note text,                     -- 다녀옴으로 바꿀 때 남기는 한 줄 평가 (본인만 조회, RLS로 보호됨)
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

-- 이미 위 create table을 실행해서 테이블이 있는 경우, 아래 한 줄만 추가로 실행하세요.
-- alter table public.bookmarks add column note text;

-- 인기 맛집/인기 랭킹(popular-restaurants.js)이 호출하는 RPC. 가게별 담긴 횟수를 집계해서 반환한다.
-- user_id·note 등 개인 식별 정보는 반환하지 않는 집계값이라 RLS를 우회(security definer)해도 안전하다.
-- 이미 프로젝트에 만들어 둔 함수가 있다면 create or replace라 덮어써도 무방합니다.
create or replace function public.get_top_bookmarked_places(limit_count int default 6)
returns table (
  place_id text,
  place_name text,
  category text,
  address text,
  lat double precision,
  lng double precision,
  save_count bigint
)
language sql
security definer
set search_path = public
as $$
  select place_id, place_name, category, address, lat, lng, count(*) as save_count
  from public.bookmarks
  group by place_id, place_name, category, address, lat, lng
  order by save_count desc
  limit limit_count;
$$;
