alter table public.profiles
  add column featured_pokemon_id uuid references public.pokemon_catalog(id) on delete set null;

create or replace function public.set_featured_pokemon(p_pokemon uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if p_pokemon is not null and not exists (
    select 1 from pokemon_throws t
    where t.user_id = auth.uid()
      and t.pokemon_id = p_pokemon
      and t.outcome = 'caught'
  ) then
    raise exception 'POKEMON_NOT_OWNED';
  end if;

  update profiles set featured_pokemon_id = p_pokemon where id = auth.uid();
end $$;

revoke execute on function public.set_featured_pokemon(uuid) from public, anon;
grant execute on function public.set_featured_pokemon(uuid) to authenticated;
