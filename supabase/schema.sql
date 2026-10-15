-- ============================================================================
--  姜闻达回忆录 — Supabase 完整初始化脚本
--  使用方法：Supabase 控制台 -> SQL Editor -> 粘贴本文件全部内容 -> Run
--  本脚本可重复执行（使用 IF NOT EXISTS / ON CONFLICT，尽量幂等）。
--
--  安全模型：
--   * 公开访客（anon）：只能 SELECT 公开数据、读取公开 Storage 图片。
--   * 管理员（auth 登录 + profiles.is_admin = true）：可写所有业务表与照片文件。
--   * 所有写权限都在数据库 / Storage 层用 RLS 强制执行，
--     即使有人绕过前端直接调用 Supabase API，也无法写入。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. 通用：updated_at 自动维护函数
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. 管理员判定函数（SECURITY DEFINER，避免 RLS 递归）
--    返回“当前登录用户是否为管理员”。
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. profiles 表：管理员资料 / 权限
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  display_name text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 新用户注册时自动创建 profile（默认 is_admin = false）。
-- 该函数以 SECURITY DEFINER 运行，绕过 RLS 写入，用户无法自行指定管理员。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- 清理旧策略（保证可重复执行）
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_admin_select_all" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "profiles_admin_insert" on public.profiles;

-- 用户只能读取自己的 profile（前端据此判断自己是否管理员）
create policy "profiles_select_self"
  on public.profiles for select
  using (auth.uid() = id);

-- 管理员可查看全部 profile
create policy "profiles_admin_select_all"
  on public.profiles for select
  using (public.is_admin());

-- 只有管理员能插入 profile（正常由触发器自动创建）
create policy "profiles_admin_insert"
  on public.profiles for insert
  with check (public.is_admin());

-- 只有管理员能修改 is_admin / 其它人资料；
-- 普通用户即便登录，也不能把自己改成管理员。
create policy "profiles_admin_update"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- 不提供 delete 策略 => 任何人（含管理员）都无法通过 API 删除 profile。

-- ----------------------------------------------------------------------------
-- 3. albums 表：四个相册分类
-- ----------------------------------------------------------------------------
create table if not exists public.albums (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  title          text not null,
  subtitle       text,
  description    text,
  cover_photo_id uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists albums_set_updated_at on public.albums;
create trigger albums_set_updated_at
  before update on public.albums
  for each row execute function public.set_updated_at();

alter table public.albums enable row level security;

drop policy if exists "albums_public_read" on public.albums;
drop policy if exists "albums_admin_write" on public.albums;

create policy "albums_public_read"
  on public.albums for select
  to anon, authenticated
  using (true);

-- 管理员写入（insert / update / delete 统一用一条 with check 覆盖）
create policy "albums_admin_write"
  on public.albums for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. photos 表：照片元数据（不存大图，只存 Storage 路径）
-- ----------------------------------------------------------------------------
create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid not null references public.albums (id) on delete cascade,
  storage_path text not null,
  thumb_path   text,
  title        text,
  description  text,
  photo_date   date,
  sort_order   integer not null default 0,
  width        integer,
  height       integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 索引：按相册分页排序、按时间倒序
create index if not exists idx_photos_album_sort
  on public.photos (album_id, sort_order desc, created_at desc);
create index if not exists idx_photos_created_at
  on public.photos (created_at desc);

-- 一个 Storage 路径只允许出现一次（防止重复登记）
create unique index if not exists uq_photos_storage_path
  on public.photos (storage_path);

drop trigger if exists photos_set_updated_at on public.photos;
create trigger photos_set_updated_at
  before update on public.photos
  for each row execute function public.set_updated_at();

alter table public.photos enable row level security;

drop policy if exists "photos_public_read" on public.photos;
drop policy if exists "photos_admin_write" on public.photos;

create policy "photos_public_read"
  on public.photos for select
  to anon, authenticated
  using (true);

create policy "photos_admin_write"
  on public.photos for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 相册封面外键（照片删除后封面置空，由应用层兜底；这里建表后再补外键）
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'albums_cover_photo_fk'
  ) then
    alter table public.albums
      add constraint albums_cover_photo_fk
      foreign key (cover_photo_id) references public.photos (id)
      on delete set null;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 5. site_settings 表：单行网站设置（id 恒为 1）
-- ----------------------------------------------------------------------------
create table if not exists public.site_settings (
  id              smallint primary key default 1 check (id = 1),
  site_name       text not null default '姜闻达回忆录',
  nickname        text not null default '姜闻达',
  bio             text,
  hero_title      text not null default '姜闻达的78人生',
  hero_subtitle   text,
  hero_intro      text,
  hero_cover_path text,
  footer_text     text,
  updated_at      timestamptz not null default now(),
  constraint site_settings_single_row check (id = 1)
);

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

alter table public.site_settings enable row level security;

drop policy if exists "settings_public_read" on public.site_settings;
drop policy if exists "settings_admin_write" on public.site_settings;

create policy "settings_public_read"
  on public.site_settings for select
  to anon, authenticated
  using (true);

create policy "settings_admin_write"
  on public.site_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. 初始化默认数据：四个相册 + 一行设置
-- ----------------------------------------------------------------------------
insert into public.albums (slug, title, subtitle, description) values
  ('life',    '生活照片', 'LIFE',    '那些没什么大事、却闪闪发亮的日常碎片。'),
  ('campus',  '学校照片', 'CAMPUS',  '课桌、操场、走廊，以及一去不返的校园时光。'),
  ('food',    '吃饭照片', 'FOOD',    '干饭人的尊严，是认真记录每一顿饭。'),
  ('travel',  '旅游照片', 'TRAVEL',  '去没去过的地方，见没见过的云和海。')
on conflict (slug) do update
  set title = excluded.title,
      subtitle = excluded.subtitle,
      description = excluded.description;

insert into public.site_settings (
  id, site_name, nickname, bio, hero_title, hero_subtitle, hero_intro, footer_text
) values (
  1,
  '姜闻达回忆录',
  '姜闻达',
  '。',
  '姜闻达的78人生',
  '。。。。。',
  '。',
  '© 姜闻达回忆录 · 愿所有瞬间都被温柔以待 (๑•̀ㅂ•́)و'
)
on conflict (id) do nothing;

-- ============================================================================
-- 7. Storage：公开读取的 photos bucket + 受控写入策略
-- ============================================================================

-- 7.1 创建 public bucket（不存在时才创建）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  true,                                  -- 公开可读：知道网址即可展示图片
  20971520,                              -- 单文件 20MB 上限
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 20971520,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 注意：public bucket = 图片可被任何拿到文件 URL 的人访问。
-- 它不是私密存储，切勿上传证件、隐私或不愿被他人看到的照片。

-- 7.2 清理旧策略
drop policy if exists "photos_public_read" on storage.objects;
drop policy if exists "photos_admin_insert" on storage.objects;
drop policy if exists "photos_admin_update" on storage.objects;
drop policy if exists "photos_admin_delete" on storage.objects;

-- 7.3 公开读取（任何人可下载 photos bucket 内文件用于展示）
create policy "photos_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'photos');

-- 7.4 仅管理员可上传；
--     限制：目录前缀、扩展名白名单（类型 / 大小还由 bucket 配置约束）
create policy "photos_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and public.is_admin()
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
    and (
      name like 'full/%'
      or name like 'thumb/%'
      or name like 'site-assets/%'
    )
  );

-- 7.5 仅管理员可覆盖 / 更新
create policy "photos_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'photos' and public.is_admin())
  with check (bucket_id = 'photos' and public.is_admin());

-- 7.6 仅管理员可删除
create policy "photos_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos' and public.is_admin());

-- ============================================================================
-- 8. 授权唯一管理员（务必执行！）
--
--  步骤：
--   1) 先在 Supabase 控制台 Authentication -> Users -> Add user ->
--      Create new user，填入你的邮箱和一个强密码，勾选 Auto Confirm User。
--      （同时建议在 Authentication -> Providers -> Email 中关闭
--        "Allow new users to sign up"，杜绝公开注册。）
--   2) 把下面的邮箱替换成你创建的那个邮箱，取消注释并执行：
--
--  update public.profiles
--     set is_admin = true
--   where email = 'your-admin-email@example.com';
--
--  触发器会在创建用户时自动生成 profile（is_admin=false），
--  上面这条语句把它提升为管理员。请确认只授权你本人一个账号。
-- ============================================================================
