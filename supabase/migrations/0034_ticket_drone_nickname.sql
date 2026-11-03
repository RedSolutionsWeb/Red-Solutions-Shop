-- Some customers refer to their drone by a nickname rather than its
-- make/model/serial -- capture it so techs/intake can search/recognize
-- by whatever the customer actually calls it.
alter table public.tickets add column if not exists nickname text;
