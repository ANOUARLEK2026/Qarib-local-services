-- Qarib backend for Supabase (Postgres). Paste into SQL Editor and run once.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  role text not null default 'customer' check (role in ('customer','provider','admin')),
  created_at timestamptz default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  category text not null check (category in ('plumber','electrician','tutor','driver','mechanic','painter')),
  bio text check (char_length(bio) <= 500),
  phone text not null check (phone ~ '^[0-9]{10,15}$'),   -- international format, digits only
  base_price int not null default 0 check (base_price >= 0),
  years int not null default 0 check (years between 0 and 60),
  area text,
  lat double precision,
  lng double precision,
  available boolean not null default true,
  verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,
  created_at timestamptz default now()
);
create index on public.providers (category, status);

create table public.services (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.providers on delete cascade,
  name_en text, name_fr text, name_ar text,
  price int not null check (price >= 0)
);

-- A row here proves the customer tapped "Contact on WhatsApp". It gates reviews.
create table public.contacts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  provider_id uuid not null references public.providers on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, provider_id)
);

create table public.reviews (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.providers on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 300),
  reply text check (char_length(reply) <= 300),
  created_at timestamptz default now(),
  unique (provider_id, user_id)
);

create table public.bookings (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  provider_id uuid not null references public.providers on delete cascade,
  starts_at timestamptz not null,
  note text check (char_length(note) <= 200),
  status text not null default 'pending' check (status in ('pending','confirmed','done','cancelled')),
  created_at timestamptz default now()
);

create table public.requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  category text not null,
  description text not null check (char_length(description) <= 300),
  budget int, urgency text,
  created_at timestamptz default now()
);

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references auth.users on delete cascade,
  provider_id uuid not null references public.providers on delete cascade,
  reason text check (char_length(reason) <= 300),
  created_at timestamptz default now()
);

create table public.provider_events (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.providers on delete cascade,
  kind text not null check (kind in ('view','contact')),
  created_at timestamptz default now()
);

-- Auto-create a profile for every new sign-up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users cannot approve themselves, verify themselves or fake ratings.
create or replace function public.guard_provider() returns trigger
language plpgsql as $$
begin
  if current_setting('qarib.sys', true) = '1' or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'pending'; new.verified := false; new.rating_avg := 0; new.rating_count := 0;
  else
    new.status := old.status; new.verified := old.verified;
    new.rating_avg := old.rating_avg; new.rating_count := old.rating_count; new.user_id := old.user_id;
  end if;
  return new;
end $$;
create trigger guard_provider before insert or update on public.providers
  for each row execute function public.guard_provider();

create or replace function public.refresh_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.provider_id, old.provider_id);
begin
  perform set_config('qarib.sys', '1', true);
  update public.providers p set
    rating_avg = coalesce((select round(avg(rating), 2) from public.reviews where provider_id = pid), 0),
    rating_count = (select count(*) from public.reviews where provider_id = pid)
  where p.id = pid;
  return null;
end $$;
create trigger refresh_rating after insert or update of rating or delete on public.reviews
  for each row execute function public.refresh_rating();

-- Nearby search, sorted by real distance (haversine).
create or replace function public.nearby_providers(
  p_lat double precision, p_lng double precision, p_category text default null,
  p_max_km double precision default 25, p_min_rating numeric default 0, p_limit int default 50)
returns table (id uuid, name text, category text, bio text, phone text, base_price int, years int,
  area text, available boolean, verified boolean, rating_avg numeric, rating_count int, distance_km double precision)
language sql stable as $$
  select * from (
    select p.id, p.name, p.category, p.bio, p.phone, p.base_price, p.years, p.area, p.available,
      p.verified, p.rating_avg, p.rating_count,
      6371 * 2 * asin(sqrt(power(sin(radians(p.lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(p.lat)) * power(sin(radians(p.lng - p_lng) / 2), 2))) as distance_km
    from public.providers p
    where p.status = 'approved' and p.lat is not null
      and (p_category is null or p.category = p_category) and p.rating_avg >= p_min_rating
  ) q where distance_km <= p_max_km order by distance_km limit p_limit
$$;

-- Required by Google Play: let users delete their own account and data.
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid()
$$;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.providers enable row level security;
alter table public.services enable row level security;
alter table public.contacts enable row level security;
alter table public.reviews enable row level security;
alter table public.bookings enable row level security;
alter table public.requests enable row level security;
alter table public.reports enable row level security;
alter table public.provider_events enable row level security;

create policy "own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role <> 'admin');

create policy "see approved or own providers" on public.providers for select
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy "create own provider" on public.providers for insert with check (user_id = auth.uid());
create policy "edit own provider" on public.providers for update using (user_id = auth.uid() or public.is_admin());
create policy "delete own provider" on public.providers for delete using (user_id = auth.uid() or public.is_admin());

create policy "read services" on public.services for select
  using (exists (select 1 from public.providers p where p.id = provider_id and (p.status = 'approved' or p.user_id = auth.uid())));
create policy "manage own services" on public.services for all
  using (exists (select 1 from public.providers p where p.id = provider_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.providers p where p.id = provider_id and p.user_id = auth.uid()));

create policy "own contacts" on public.contacts for select using (user_id = auth.uid());
create policy "record contact" on public.contacts for insert with check (user_id = auth.uid());

create policy "read reviews" on public.reviews for select using (true);
create policy "review after contact" on public.reviews for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.contacts c where c.user_id = auth.uid() and c.provider_id = reviews.provider_id)
  and not exists (select 1 from public.providers p where p.id = reviews.provider_id and p.user_id = auth.uid()));
create policy "provider replies" on public.reviews for update
  using (exists (select 1 from public.providers p where p.id = provider_id and p.user_id = auth.uid()));
revoke update on public.reviews from authenticated;
grant update (reply) on public.reviews to authenticated;
create policy "delete own review" on public.reviews for delete using (user_id = auth.uid() or public.is_admin());

create policy "customer bookings" on public.bookings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "provider sees bookings" on public.bookings for select
  using (exists (select 1 from public.providers p where p.id = provider_id and p.user_id = auth.uid()));
create policy "own requests" on public.requests for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "file report" on public.reports for insert with check (reporter_id = auth.uid());
create policy "admin reads reports" on public.reports for select using (public.is_admin());
create policy "log event" on public.provider_events for insert with check (true);
create policy "owner reads events" on public.provider_events for select
  using (exists (select 1 from public.providers p where p.id = provider_id and p.user_id = auth.uid()));

-- After you sign up once, make yourself admin (replace the email):
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
-- Approve a provider:
-- update public.providers set status = 'approved' where id = '<provider id>';
