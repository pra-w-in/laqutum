begin;
create table public.career_applications (
 id uuid primary key,
 created_at timestamptz not null default now(),
 role_id text not null check (role_id in ('quantitative-aptitude','business-risk')),
 full_name text not null check (char_length(trim(full_name)) between 2 and 120),
 email text not null check (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 college text not null check (char_length(trim(college)) between 2 and 200),
 department text not null check (char_length(trim(department)) between 2 and 120),
 graduation_year integer not null check (graduation_year between 2020 and 2040),
 resume_url text not null check (char_length(resume_url) <= 2000 and resume_url ~ '^https://[^[:space:]]+$'),
 motivation text not null check (char_length(trim(motivation)) between 20 and 4000),
 consent boolean not null check (consent = true),
 privacy_version text not null default '2026-11-15',
 status text not null default 'new' check (status in ('new','reviewing','shortlisted','rejected','selected'))
);
alter table public.career_applications enable row level security;
revoke all on public.career_applications from anon, authenticated;
grant all on public.career_applications to service_role;
-- No public SELECT/UPDATE/DELETE policy. Recruitment staff use Supabase Dashboard.
-- A narrow function accepts applications without exposing candidate records.
create function public.submit_career_application(p_application jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare receipt uuid;
begin
 receipt := (p_application->>'id')::uuid;
 insert into public.career_applications
 (id, role_id, full_name, email, college, department, graduation_year, resume_url, motivation, consent)
 values (receipt, p_application->>'role_id', trim(p_application->>'full_name'), lower(trim(p_application->>'email')),
 trim(p_application->>'college'), trim(p_application->>'department'), (p_application->>'graduation_year')::integer,
 trim(p_application->>'resume_url'), trim(p_application->>'motivation'), (p_application->>'consent')::boolean)
 on conflict (id) do nothing;
 return receipt;
end;
$$;
revoke all on function public.submit_career_application(jsonb) from public;
grant execute on function public.submit_career_application(jsonb) to anon, authenticated;
commit;
