-- Track when the admin notification email for a support request was sent,
-- so retries and duplicate client calls can never double-email the team.
alter table public.support_requests
  add column if not exists notified_at timestamptz;
