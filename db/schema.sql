-- ============================================================
-- Bridge — database schema
-- Run this in Supabase: Project → SQL Editor → New Query → Run
-- (or via DataGrip once connected to your Supabase Postgres instance)
-- ============================================================

-- ---------- extensions ----------
create extension if not exists "uuid-ossp";

-- ---------- profiles ----------
-- Extends Supabase's built-in auth.users with app-specific fields.
-- A row is created automatically for every new signup via the trigger below.
create table if not exists profiles (
                                      id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'student' check (role in ('student', 'counselor', 'admin')),
  created_at timestamptz not null default now()
  );

-- Auto-create a profile row whenever someone signs up
create or replace function handle_new_user()
returns trigger as $$
begin
insert into public.profiles (id, full_name)
values (new.id, new.raw_user_meta_data->>'full_name');
return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- opportunities ----------
create table if not exists opportunities (
                                           id uuid primary key default uuid_generate_v4(),
  title text not null,
  org text not null,
  type text not null check (type in ('internship', 'scholarship', 'mentorship', 'volunteer', 'program')),
  cost text not null check (cost in ('free', 'paid')),
  remote boolean not null default false,
  location text not null,
  eligibility text not null,
  deadline date,
  deadline_label text, -- for display when deadline isn't a strict date, e.g. "Rolling", "Ongoing"
  description text not null,
  source_url text, -- link to the real application
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
  );

create index if not exists idx_opportunities_status on opportunities(status);
create index if not exists idx_opportunities_type on opportunities(type);
create index if not exists idx_opportunities_deadline on opportunities(deadline);

-- keep updated_at current
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
return new;
end;
$$ language plpgsql;

drop trigger if exists trg_opportunities_updated_at on opportunities;
create trigger trg_opportunities_updated_at
  before update on opportunities
  for each row execute function set_updated_at();

-- ---------- saved_opportunities ----------
create table if not exists saved_opportunities (
                                                 user_id uuid not null references profiles(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
  );

-- ============================================================
-- Row Level Security
-- Without these policies, Supabase's auto-generated API blocks
-- ALL access by default once RLS is enabled — that's what we want,
-- then we open up exactly what should be public vs. authenticated.
-- ============================================================

alter table profiles enable row level security;
alter table opportunities enable row level security;
alter table saved_opportunities enable row level security;

-- profiles: users can read their own profile; anyone can read basic profile info if needed later
create policy "Users can view their own profile"
  on profiles for select
                           using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
                           using (auth.uid() = id);

-- opportunities: anyone (including logged-out visitors) can view APPROVED opportunities
create policy "Approved opportunities are publicly viewable"
  on opportunities for select
                                using (status = 'approved');

-- opportunities: logged-in users can submit new opportunities (goes in as 'pending')
create policy "Authenticated users can submit opportunities"
  on opportunities for insert
  with check (auth.uid() is not null);

-- opportunities: submitters can view their own pending/rejected submissions too
create policy "Users can view their own submissions"
  on opportunities for select
                                       using (auth.uid() = submitted_by);

-- opportunities: only admins can approve/reject/edit
create policy "Admins can update opportunities"
  on opportunities for update
                                using (
                                exists (select 1 from profiles where id = auth.uid() and role = 'admin')
                                );

-- saved_opportunities: users can only see/manage their own saved list
create policy "Users can view their own saved opportunities"
  on saved_opportunities for select
                                      using (auth.uid() = user_id);

create policy "Users can save opportunities"
  on saved_opportunities for insert
  with check (auth.uid() = user_id);

create policy "Users can unsave opportunities"
  on saved_opportunities for delete
using (auth.uid() = user_id);

-- ============================================================
-- Seed data — a few real-shaped rows so the app has something
-- to render immediately. Replace/add to these via the table
-- editor or an admin submission flow later.
-- ============================================================

insert into opportunities
(title, org, type, cost, remote, location, eligibility, deadline, deadline_label, description, source_url, status)
values
  ('Youth Robotics Fellowship', 'BuildForward Labs', 'internship', 'free', true, 'Remote', 'Grades 9–12', '2026-09-15', null,
   '8-week paid-adjacent fellowship building robotics kits with a mentor engineer. No prior experience required.',
   null, 'approved'),
  ('First-Gen Scholars Scholarship', 'Horizon Foundation', 'scholarship', 'free', true, 'Remote application', 'High school seniors', '2026-10-01', null,
   '$2,500 award for first-generation college applicants. Essay + one recommendation letter required.',
   null, 'approved'),
  ('Community Health Mentorship', 'CareBridge Clinic', 'mentorship', 'free', false, 'Seattle, WA', 'Ages 15–19', null, 'Rolling',
   'Weekly 1:1 mentorship with a nurse or med student for students exploring healthcare careers.',
   null, 'approved');
