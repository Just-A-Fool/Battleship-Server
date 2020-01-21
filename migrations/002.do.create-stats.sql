begin;
create table if not exists stats (
    id integer primary key generated by default as identity not null,
    userid integer references users(id) on delete cascade not null,
    wins smallint default 0,
    losses smallint default 0
);
commit;