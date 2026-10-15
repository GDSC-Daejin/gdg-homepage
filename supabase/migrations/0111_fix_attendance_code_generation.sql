create or replace function public.admin_set_event_code(p_event_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  v_code := upper(substr(translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/', 'XY'), 1, 6));
  insert into event_codes (event_id, code) values (p_event_id, v_code)
    on conflict (event_id) do update set code = excluded.code, updated_at = now();
  perform public.log_audit('issue_code', p_event_id::text, '{}'::jsonb);
  return v_code;
end $$;
