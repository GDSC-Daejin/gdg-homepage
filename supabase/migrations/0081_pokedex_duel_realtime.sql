grant select on public.pokemon_duels to authenticated;

create policy "pokemon_duels: participants read"
on public.pokemon_duels for select to authenticated
using (auth.uid() = challenger_id or auth.uid() = opponent_id);

alter publication supabase_realtime add table public.pokemon_duels;
