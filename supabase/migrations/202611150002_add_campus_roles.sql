begin;
alter table public.career_applications drop constraint career_applications_role_id_check;
alter table public.career_applications add constraint career_applications_role_id_check check (role_id in ('quantitative-aptitude','business-risk','digital-marketing','aptitude-content','software-testing','full-stack','ui-ux-design','ai-ml','video-content','campus-outreach','data-analytics'));
commit;
