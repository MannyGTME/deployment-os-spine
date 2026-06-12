create table if not exists public.client_onboarding (
  client_id uuid primary key default gen_random_uuid(),
  client_name text not null,
  sales_notes text,
  tech_reality_score int check (tech_reality_score between 1 and 10),
  flagged_risks jsonb,
  status text default 'Pending' check (status in ('Pending', 'Escalated', 'Clear')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter publication supabase_realtime add table public.client_onboarding;

alter table public.client_onboarding enable row level security;

create policy "Allow public read for demo"
  on public.client_onboarding for select
  using (true);
