-- 어드민이 화면에서 봇을 켜고 끌 수 있도록 쓰기 권한을 연다.
-- 부가 로직이 없는 단순 CRUD이므로 RPC 대신 정책으로 간다 (places/badges와 같은 방식).

drop policy "bots: admin read" on public.bots;

create policy "bots: admin all" on public.bots for all using (public.is_admin()) with check (public.is_admin());
