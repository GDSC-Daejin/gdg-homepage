-- 회원 완전 삭제(auth 계정까지) 지원
-- profiles(id)를 참조하면서 삭제 규칙이 없는(no action) FK는 삭제를 막는다.
-- 작성자/승인자 류 컬럼(nullable)이므로 전부 on delete set null 로 전환.

do $$
declare r record;
begin
  for r in
    select c.conname, c.conrelid::regclass::text as tbl, a.attname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.profiles'::regclass
      and c.confdeltype = 'a'          -- no action
      and array_length(c.conkey, 1) = 1
      and not a.attnotnull
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references public.profiles(id) on delete set null',
      r.tbl, r.conname, r.attname
    );
  end loop;
end $$;
