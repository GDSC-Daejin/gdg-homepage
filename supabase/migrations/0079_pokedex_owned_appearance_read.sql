drop policy "pokemon_appearances: posted read" on public.pokemon_appearances;

create policy "pokemon_appearances: posted or owned read" on public.pokemon_appearances
  for select to authenticated using (
    status = 'posted'
    or public.is_admin()
    or exists (
      select 1 from public.pokemon_throws t
      where t.appearance_id = pokemon_appearances.id
        and t.user_id = auth.uid()
        and t.outcome = 'caught'
    )
  );
