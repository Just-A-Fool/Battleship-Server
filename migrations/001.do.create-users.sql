begin;
create table if not exists users (
    id integer primary key generated by default as identity not null,
    username varchar(20) unique not null,
    password char(60) not null
);
commit;