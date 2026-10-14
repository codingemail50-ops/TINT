-- Friend requests: only the person RECEIVING a request can accept or decline it.
-- Idempotent -- safe to re-run. Run in the Supabase SQL Editor (choose
-- "Run without RLS" if it asks; this file creates no tables).
--
-- Before this file:
--   * any signed-in user could insert a request that was already 'accepted',
--     which put them in the other person's friends list without asking, and
--   * the SENDER of a request could update it too, so they could accept
--     their own request.
-- The app only ever showed Accept to the recipient, but the database did not
-- enforce it, and anyone with an account can call the database directly.
--
-- Run this AFTER 20261009_*.sql. Do not re-run older schema files over it.

-- 1. A new request must come from you and start out pending.
drop policy if exists "send requests as yourself" on public.friend_requests;
create policy "send requests as yourself"
  on public.friend_requests for insert
  with check (
    auth.uid() = from_user
    and status = 'pending'
    and responded_at is null
  );

-- 2. Only the recipient can accept or decline.
drop policy if exists "respond to requests you're part of" on public.friend_requests;
drop policy if exists "recipient responds to requests" on public.friend_requests;
create policy "recipient responds to requests"
  on public.friend_requests for update
  using (auth.uid() = to_user)
  with check (auth.uid() = to_user and status in ('accepted', 'declined'));

-- 3. Nobody can rewrite who a request is between, or when it was made.
--    (Only status and responded_at can ever be updated.)
revoke update on public.friend_requests from anon, authenticated;
grant update (status, responded_at) on public.friend_requests to authenticated;

-- Unchanged on purpose: both sides can still read a request they are part of,
-- and both sides can still delete one (cancel a sent request, or unfriend).
