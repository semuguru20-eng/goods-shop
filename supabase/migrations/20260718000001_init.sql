-- Products catalog
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price integer not null,
  image_url text,
  created_at timestamptz not null default now()
);

-- Orders / payments
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  user_email text not null,
  product_id uuid not null references public.products(id),
  order_name text not null,
  amount integer not null,
  toss_order_id text not null unique,
  toss_payment_key text,
  status text not null default 'pending' check (status in ('pending','paid','failed','canceled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.products enable row level security;
alter table public.orders enable row level security;

create policy "products readable by anyone"
  on public.products for select
  using (true);

create policy "orders: own rows or admin"
  on public.orders for select
  using (auth.uid() = user_id or auth.jwt() ->> 'email' = 'admin@admin.com');

create policy "orders: insert own pending order"
  on public.orders for insert
  with check (auth.uid() = user_id and status = 'pending');
