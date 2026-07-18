-- Web Push subscriptions (one row per browser/device the user opted into)
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: select own rows"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push_subscriptions: insert own rows"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions: update own rows"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "push_subscriptions: delete own rows"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);
