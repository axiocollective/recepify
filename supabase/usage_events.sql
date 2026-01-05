create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  request_id uuid,
  event_type text not null,
  source text,
  model_provider text,
  model_name text,
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  tokens_total integer not null default 0,
  tokens_weighted integer not null default 0,
  ai_credits_used integer not null default 0,
  import_credits_used integer not null default 0,
  cost_usd double precision,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_usage_events_owner on public.usage_events (owner_id);
create index if not exists idx_usage_events_created_at on public.usage_events (created_at);
create index if not exists idx_usage_events_request on public.usage_events (request_id);
create index if not exists idx_usage_events_type on public.usage_events (event_type);
