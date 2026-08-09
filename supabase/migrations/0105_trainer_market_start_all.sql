insert into public.trainer_point_logs (user_id, amount, reason)
select id, 500, 'signup'
from public.profiles
where status = 'active' and role <> 'applicant'
  and not exists (
    select 1
    from public.trainer_point_logs
    where trainer_point_logs.user_id = profiles.id and reason = 'signup'
  );
