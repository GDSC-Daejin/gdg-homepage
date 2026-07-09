create or replace function public.admin_publish_notice(p_notice uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update notices set published = true, published_at = now() where id = p_notice;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.log_audit('publish_notice', p_notice::text, '{}'::jsonb);
end $$;

revoke execute on function public.admin_publish_notice(uuid) from public, anon;
grant execute on function public.admin_publish_notice(uuid) to authenticated;
