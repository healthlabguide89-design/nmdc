-- Starter schema only. Review and harden policies before storing patient data.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text unique,
  role text not null check (role in ('admin', 'sonographer', 'sonologist')),
  created_at timestamptz not null default now()
);

create table if not exists public.ultrasound_cases (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null,
  lab_number text not null,
  sonographer_id uuid not null references public.profiles(id),
  status text not null default 'awaiting_review'
    check (status in ('awaiting_review', 'in_review', 'changes_requested', 'approved', 'archived')),
  report_document_paths text[] not null default '{}',
  ultrasound_image_paths text[] not null default '{}',
  review_comment text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ultrasound_cases_created_at_idx
  on public.ultrasound_cases (created_at desc);
create index if not exists ultrasound_cases_status_idx
  on public.ultrasound_cases (status);
create index if not exists ultrasound_cases_sonographer_idx
  on public.ultrasound_cases (sonographer_id);

-- IMPORTANT:
-- This starter deliberately does not enable permissive RLS policies.
-- Before production use, enable RLS and add role-aware policies for:
-- 1) admin access to all cases and user management
-- 2) sonographers reading only their own cases and creating cases
-- 3) sonologists reading assigned/eligible review cases and writing review decisions
-- Also create a private Storage bucket and narrowly scoped Storage policies.
