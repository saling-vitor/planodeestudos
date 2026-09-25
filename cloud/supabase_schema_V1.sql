-- Plano ARQ · Supabase schema
-- Compatível com assets/js/pa-sync-v03.js
-- Pode ser executado mais de uma vez no SQL Editor.

create table if not exists public.plano_arq_sync_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_key text not null,
  contest_id text not null default 'global',
  namespace text not null default 'planoarq',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  device_id text not null default '',
  deleted boolean not null default false,
  primary key (user_id, record_key)
);

create index if not exists plano_arq_sync_records_user_updated_idx
  on public.plano_arq_sync_records (user_id, updated_at desc);

create index if not exists plano_arq_sync_records_user_contest_idx
  on public.plano_arq_sync_records (user_id, contest_id);

alter table public.plano_arq_sync_records enable row level security;

drop policy if exists "plano_arq_sync_select_own" on public.plano_arq_sync_records;
create policy "plano_arq_sync_select_own"
  on public.plano_arq_sync_records
  for select
  using (auth.uid() = user_id);

drop policy if exists "plano_arq_sync_insert_own" on public.plano_arq_sync_records;
create policy "plano_arq_sync_insert_own"
  on public.plano_arq_sync_records
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "plano_arq_sync_update_own" on public.plano_arq_sync_records;
create policy "plano_arq_sync_update_own"
  on public.plano_arq_sync_records
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "plano_arq_sync_delete_own" on public.plano_arq_sync_records;
create policy "plano_arq_sync_delete_own"
  on public.plano_arq_sync_records
  for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete
  on public.plano_arq_sync_records
  to authenticated;

revoke all
  on public.plano_arq_sync_records
  from anon;

create or replace function public.plano_arq_upsert_sync_records(p_records jsonb)
returns setof public.plano_arq_sync_records
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  uid uuid := auth.uid();
  incoming_updated_at timestamptz;
  incoming_device_id text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception 'p_records must be a JSON array';
  end if;

  for item in
    select value from jsonb_array_elements(p_records)
  loop
    if coalesce(item->>'record_key','') = '' then
      continue;
    end if;

    begin
      incoming_updated_at := coalesce(
        nullif(item->>'updated_at','')::timestamptz,
        now()
      );
    exception when others then
      incoming_updated_at := now();
    end;

    incoming_device_id := coalesce(item->>'device_id','');

    insert into public.plano_arq_sync_records (
      user_id,
      record_key,
      contest_id,
      namespace,
      payload,
      updated_at,
      device_id,
      deleted
    )
    values (
      uid,
      item->>'record_key',
      coalesce(nullif(item->>'contest_id',''),'global'),
      coalesce(nullif(item->>'namespace',''),'planoarq'),
      coalesce(item->'payload','{}'::jsonb),
      incoming_updated_at,
      incoming_device_id,
      coalesce((item->>'deleted')::boolean,false)
    )
    on conflict (user_id, record_key) do update
      set contest_id = excluded.contest_id,
          namespace = excluded.namespace,
          payload = excluded.payload,
          updated_at = excluded.updated_at,
          device_id = excluded.device_id,
          deleted = excluded.deleted
      where excluded.updated_at > public.plano_arq_sync_records.updated_at
         or (
           excluded.updated_at = public.plano_arq_sync_records.updated_at
           and excluded.device_id > public.plano_arq_sync_records.device_id
         );
  end loop;

  return query
    select r.*
    from public.plano_arq_sync_records r
    where r.user_id = uid
    order by r.updated_at asc;
end;
$$;

grant execute
  on function public.plano_arq_upsert_sync_records(jsonb)
  to authenticated;

revoke all
  on function public.plano_arq_upsert_sync_records(jsonb)
  from anon;


-- Plano ARQ · Etapa F · arquivos de edital entre dispositivos
-- Bucket privado; cada usuário acessa apenas /<auth.uid()>/...
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('plano-arq-contest-files','plano-arq-contest-files',false,83886080,array['application/pdf','text/html']::text[])
on conflict (id) do update
set public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "plano_arq_files_select_own" on storage.objects;
create policy "plano_arq_files_select_own"
on storage.objects for select to authenticated
using (
  bucket_id='plano-arq-contest-files'
  and (storage.foldername(name))[1]=(select auth.uid()::text)
);

drop policy if exists "plano_arq_files_insert_own" on storage.objects;
create policy "plano_arq_files_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id='plano-arq-contest-files'
  and (storage.foldername(name))[1]=(select auth.uid()::text)
);

drop policy if exists "plano_arq_files_update_own" on storage.objects;
create policy "plano_arq_files_update_own"
on storage.objects for update to authenticated
using (
  bucket_id='plano-arq-contest-files'
  and (storage.foldername(name))[1]=(select auth.uid()::text)
)
with check (
  bucket_id='plano-arq-contest-files'
  and (storage.foldername(name))[1]=(select auth.uid()::text)
);

drop policy if exists "plano_arq_files_delete_own" on storage.objects;
create policy "plano_arq_files_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id='plano-arq-contest-files'
  and (storage.foldername(name))[1]=(select auth.uid()::text)
);
