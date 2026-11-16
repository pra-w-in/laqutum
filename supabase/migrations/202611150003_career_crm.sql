begin;
-- Dedicated grants cannot be edited by applicants or ordinary signed-in users.
create table public.career_reviewers (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.career_reviewers enable row level security;
revoke all on public.career_reviewers from anon, authenticated;
grant all on public.career_reviewers to service_role;
-- Preserve the CRM's existing admin authorization at installation time.
insert into public.career_reviewers(user_id)
select user_id from public.user_progress where is_admin = true
on conflict do nothing;

create function public.list_career_applications(p_search text default '', p_role text default '', p_status text default '', p_page integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.career_reviewers where user_id=auth.uid()) then
 raise exception 'Recruitment administrator access required' using errcode='42501';
 end if;
 if p_page is null or p_page < 0 or p_page > 100000 or length(p_search)>200 then raise exception 'Invalid query'; end if;
 with matches as (
 select * from public.career_applications
 where (coalesce(p_role,'')='' or role_id=p_role)
 and (coalesce(p_status,'')='' or status=p_status)
 and (coalesce(p_search,'')='' or strpos(lower(full_name || ' ' || email || ' ' || college),lower(p_search))>0)
 ), page_rows as (select * from matches order by created_at desc,id limit 25 offset p_page*25)
 select jsonb_build_object('total',(select count(*) from matches),'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id) from page_rows p),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.list_career_applications(text,text,text,integer) from public;
grant execute on function public.list_career_applications(text,text,text,integer) to authenticated;
commit;
