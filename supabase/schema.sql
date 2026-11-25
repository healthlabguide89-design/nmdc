-- ULTRASOUND APP - TEMPORARY FUNCTIONAL TEST SETUP
-- IMPORTANT: These anon policies intentionally allow public test access because
-- login/role management is being developed later. Anyone who can access the public
-- website can read, add, update and delete test records/files while these policies
-- remain enabled. Use DUMMY data only. Do NOT store real patient information.
-- Replace these policies with authenticated role-based RLS before production.

create extension if not exists pgcrypto;

create table if not exists public.ultrasound_cases (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null,
  lab_number text not null,
  submitted_by text not null default 'Sonographer (test mode)',
  submitted_role text not null default 'sonographer',
  status text not null default 'awaiting_review'
    check (status in ('awaiting_review', 'in_review', 'changes_requested', 'approved', 'archived')),
  report_files jsonb not null default '[]'::jsonb,
  ultrasound_files jsonb not null default '[]'::jsonb,
  review_comment text,
  reviewed_by text,
  reviewed_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Safe migration for the earlier starter schema, if it was already run.
alter table public.ultrasound_cases add column if not exists submitted_by text not null default 'Sonographer (test mode)';
alter table public.ultrasound_cases add column if not exists submitted_role text not null default 'sonographer';
alter table public.ultrasound_cases add column if not exists report_files jsonb not null default '[]'::jsonb;
alter table public.ultrasound_cases add column if not exists ultrasound_files jsonb not null default '[]'::jsonb;
alter table public.ultrasound_cases add column if not exists review_comment text;
alter table public.ultrasound_cases add column if not exists reviewed_by text;
alter table public.ultrasound_cases add column if not exists reviewed_at timestamptz;
alter table public.ultrasound_cases add column if not exists approved_by text;
alter table public.ultrasound_cases add column if not exists approved_at timestamptz;

-- The old starter schema required a profile foreign key. Authentication is not
-- enabled in this temporary test phase, so make that legacy column optional.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ultrasound_cases' and column_name = 'sonographer_id'
  ) then
    alter table public.ultrasound_cases alter column sonographer_id drop not null;
  end if;
end $$;

create index if not exists ultrasound_cases_created_at_idx on public.ultrasound_cases (created_at desc);
create index if not exists ultrasound_cases_status_idx on public.ultrasound_cases (status);

alter table public.ultrasound_cases enable row level security;
grant usage on schema public to anon;
grant select, insert, update, delete on public.ultrasound_cases to anon;

drop policy if exists "ultrasound_test_anon_select" on public.ultrasound_cases;
drop policy if exists "ultrasound_test_anon_insert" on public.ultrasound_cases;
drop policy if exists "ultrasound_test_anon_update" on public.ultrasound_cases;
drop policy if exists "ultrasound_test_anon_delete" on public.ultrasound_cases;
create policy "ultrasound_test_anon_select" on public.ultrasound_cases for select to anon using (true);
create policy "ultrasound_test_anon_insert" on public.ultrasound_cases for insert to anon with check (true);
create policy "ultrasound_test_anon_update" on public.ultrasound_cases for update to anon using (true) with check (true);
create policy "ultrasound_test_anon_delete" on public.ultrasound_cases for delete to anon using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ultrasound-files', 'ultrasound-files', false, 52428800,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

grant select, insert, update, delete on storage.objects to anon;
drop policy if exists "ultrasound_test_anon_storage_select" on storage.objects;
drop policy if exists "ultrasound_test_anon_storage_insert" on storage.objects;
drop policy if exists "ultrasound_test_anon_storage_update" on storage.objects;
drop policy if exists "ultrasound_test_anon_storage_delete" on storage.objects;
create policy "ultrasound_test_anon_storage_select" on storage.objects for select to anon using (bucket_id = 'ultrasound-files');
create policy "ultrasound_test_anon_storage_insert" on storage.objects for insert to anon with check (bucket_id = 'ultrasound-files');
create policy "ultrasound_test_anon_storage_update" on storage.objects for update to anon using (bucket_id = 'ultrasound-files') with check (bucket_id = 'ultrasound-files');
create policy "ultrasound_test_anon_storage_delete" on storage.objects for delete to anon using (bucket_id = 'ultrasound-files');

-- Case edit tracking and database-level protection for approved cases.
alter table public.ultrasound_cases add column if not exists edited_by text;
alter table public.ultrasound_cases add column if not exists edited_at timestamptz;

create or replace function public.prevent_approved_ultrasound_case_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'approved' then
    raise exception 'Approved cases cannot be deleted.' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists ultrasound_cases_prevent_approved_delete on public.ultrasound_cases;
create trigger ultrasound_cases_prevent_approved_delete
before delete on public.ultrasound_cases
for each row execute function public.prevent_approved_ultrasound_case_delete();
