alter table public.client_onboarding
  add column if not exists commitments jsonb;
