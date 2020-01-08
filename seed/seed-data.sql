begin;
truncate "users", "stats", "game_history";

insert into "users" ("username", "password", "email") 
VALUES 
    ('admin1', '$2a$10$fCWkaGbt7ZErxaxclioLteLUgg4Q3Rp09WW0s/wSLxDKYsaGYUpjG', 'someEmail@gmail.com'),
    ('admin2', '$2a$10$fCWkaGbt7ZErxaxclioLteLUgg4Q3Rp09WW0s/wSLxDKYsaGYUpjG', 'someEmail2@gmail.com');

insert into "stats" ("userid", "wins", "losses", "draws")
values
    (1, 34, 28, 1),
    (2, 0, 0, 0);


SELECT setval('users_id_seq', 1);
SELECT setval('stats_id_seq', (SELECT MAX(id) from "stats"));
SELECT setval('game_history_id_seq', (SELECT MAX(id) from "game_history"));
commit; 