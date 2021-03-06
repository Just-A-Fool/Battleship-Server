require('dotenv').config();
const knex = require('knex');
const app = require('../src/app');
const io = require('socket.io-client');

describe('Socket Routes', () => {
    let db;
    let testUser = { username: 'admin1', password: '$2a$10$fCWkaGbt7ZErxaxclioLteLUgg4Q3Rp09WW0s/wSLxDKYsaGYUpjG'};
    let testUser2 = { username: 'admin2', password: '$2a$10$fCWkaGbt7ZErxaxclioLteLUgg4Q3Rp09WW0s/wSLxDKYsaGYUpjG' };
    let testUser3 = { username: 'admin3', password: '$2a$10$fCWkaGbt7ZErxaxclioLteLUgg4Q3Rp09WW0s/wSLxDKYsaGYUpjG' };

    let testShips = `[{"name":"aircraftCarrier","length":5,"spaces":["A1","A2","A3","A4","A5"]},{"name":"battleship","length":4,"spaces":["A6","A7","A8","A9"]},{"name":"cruiser","length":3,"spaces":["A10","B10","C10"]},{"name":"submarine","length":3,"spaces":["D10","E10","F10"]},{"name":"defender","length":2,"spaces":["I10","H10"]}]`;
    let testShips2 = `[{"name":"aircraftCarrier","length":5,"spaces":["A1","B1","C1","D1","E1"]},{"name":"battleship","length":4,"spaces":["F1","G1","H1","I1"]},{"name":"cruiser","length":3,"spaces":["J1","J2","J3"]},{"name":"submarine","length":3,"spaces":["J4","J5","J6"]},{"name":"defender","length":2,"spaces":["J7","J8"]}]`;

    let URL = 'http://localhost:8000';
    server = require('../src/server');
    let authOptions = {
        transportOptions: {
            polling: {
                extraHeaders: {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJpYXQiOjE1NzkwMzk0NjMsInN1YiI6ImFkbWluMSJ9.pn2pMZHk3ocopmvODV4hG5t5ue9fbwjD-gwWawZY0H4'
                }
            }
        }
    };
    let authOptions2 = {
        transportOptions: {
            polling: {
                extraHeaders: {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyLCJpYXQiOjE1NzkxMTYwMTcsInN1YiI6ImFkbWluMiJ9.aj1zxaaN_NnXviDJW2dFfcI9CsklS2Lx6Y1be1VjqbE'
                }
            }
        }
    };
    let failAuthOptions = {
        transportOptions: {
            polling: {
                extraHeaders: {
                    'Authorization': 'Bearer notavalidtoken'
                }
            }
        }
    };



    before('setup db', () => {
        db = knex({
            client: 'pg',
            connection: process.env.TEST_DATABASE_URL
        });

        app.set('db', db);
    });

    before((done) => {
        db.raw('TRUNCATE room_queue, game_data, game_history, stats, users RESTART IDENTITY CASCADE');

        done();
    });


    afterEach(() => db.raw('TRUNCATE room_queue, game_data, game_history, stats, users RESTART IDENTITY CASCADE'));

    after(() => db.destroy());


    describe('Socket Auth', () => {

        beforeEach(() => {
            return db.into('users')
                .insert(testUser)
                .then(() => {
                    return db.into('room_queue')
                        .insert({ size: 0 });
                })
        });


        it('emits an error-message if improper auth headers', (done) => {
            const client = io.connect(URL, failAuthOptions);

            client.on('error', error => {
                expect(error).to.eql({ error: 'Invalid Authorization headers' });
                client.disconnect(true);
                done();
            });
        });

        it('connects properly if provided with correct auth headers', (done) => {
            const client = io.connect(URL, authOptions);

            client.on('connect', () => {
                client.disconnect(true);
                done();
            });
        });
    });

    describe('Socket join_room', () => {

        context('Nothing in queue', () => {
            beforeEach(async () => {
                await db.into('users')
                    .insert(testUser)
                    .then(() => {
                        return db.into('room_queue')
                            .insert({ size: 0 })
                    });
            });

            it('joins to a random room if provided with `random` string and nothing in queue', (done) => {


                const client = io.connect(URL, authOptions);

                client.on('connect', () => {
                    client.on('joined', data => {
                        expect(data).to.be.an('Object');
                        expect(data).to.have.all.keys('room', 'player', 'gameId');
                        expect(data.player).to.equal('player1');
                        expect(data.gameId).to.equal(1);

                        client.disconnect(true);
                        done();
                    });

                    client.emit('join_room', 'random');
                });

            });
        });



        context('One game in queue', () => {
            beforeEach(async () => {
                await db.into('users')
                    .insert([testUser, testUser2])
                    .then(() => {
                        db.into('game_history')
                            .insert({ player1: 2, room_id: 'b46c97ff-e6b1-4543-beb1-461139fa731b' })
                            .then(() => {
                                return db.into('room_queue')
                                    .insert({ size: 1, first: 1, last: 1 })
                            });
                    });
            });


            it('joins to the queued room if provided with `random` string and someone else in queue', (done) => {


                const client = io.connect(URL, authOptions);

                client.on('connect', () => {
                    client.on('joined', data => {

                        expect(data).to.be.an('Object');
                        expect(data).to.have.all.keys('room', 'player', 'gameId');
                        expect(data.player).to.equal('player2');
                        expect(data.gameId).to.equal(1);
                        expect(data.room).to.equal('b46c97ff-e6b1-4543-beb1-461139fa731b')

                        client.disconnect(true);
                        done();
                    });

                    client.emit('join_room', 'random');
                });

            });
        });




        context('Your game in queue', () => {
            beforeEach(async () => {
                await db.into('users')
                    .insert([testUser, testUser2])
                    .then(() => {
                        db.into('game_history')
                            .insert({ player1: 1, room_id: 'b46c97ff-e6b1-4543-beb1-461139fa731b' })
                            .then(() => {
                                return db.into('room_queue')
                                    .insert({ size: 1, first: 1, last: 1 })
                            });
                    });
            });

            it('errors if you try to join a queue with yourself', (done) => {
                const client = io.connect(URL, authOptions);

                client.on('connect', () => {
                    client.on('error-message', data => {
                        expect(data).to.eql({ error: 'You can only have one game in the queue at a given time. Please wait for someone else to match against you.' });

                        client.disconnect(true);
                        done();
                    });

                    client.emit('join_room', 'random');
                });
            });
        });



        context('12 active games', () => {

            let tenGames = [
                { player1: 1, player2: 2, room_id: '5e9e5bc9-1003-4653-a256-62dff4718a40' }, { player1: 1, player2: 2, room_id: '08835d9b-13e1-4738-a77f-d4847f3440c8' }, { player1: 1, player2: 2, room_id: 'bd45bf1f-7cc1-4f8a-b522-dd6e61a8b6ed' },
                { player1: 1, player2: 2, room_id: 'aa4fc501-3763-40ea-9809-26c7eed99e39' }, { player1: 1, player2: 2, room_id: '81eca796-2332-4263-8fd1-224be8d17901' }, { player1: 1, player2: 2, room_id: '8e89ba7f-eb56-498d-ac37-8e40bbbcbd76' },
                { player1: 1, player2: 2, room_id: '470bcfb7-7570-49a9-8545-e45ef544c41a' }, { player1: 1, player2: 2, room_id: '1e73fe99-8a34-4d13-896b-c77d52dabf66' }, { player1: 1, player2: 2, room_id: '234e8b82-7489-4ce6-a427-25fda43026cd' },
                { player1: 1, player2: 2, room_id: '470da57a-f37c-4740-989d-15decc0cf62f', game_status: 'complete' }, { player1: 3, player2: 2, room_id: '4c3014d4-be74-4141-a7f3-6258c31ae913' }, { player1: 1, player2: 2, room_id: 'eba53681-2798-4109-ac26-3fdeae580a7c' }]


            beforeEach(async () => {
                await db.into('users')
                    .insert([testUser, testUser2, testUser3])
                    .then(() => {
                        db.into('game_history')
                            .insert(tenGames)
                            .then(() => {
                                return db.into('room_queue')
                                    .insert({ size: 0 })
                            });
                    });
            });

            it('errors if you try to create a game if you already have 10 active games', (done) => {
                const client = io.connect(URL, authOptions);

                client.on('connect', () => {
                    client.on('error-message', data => {
                        expect(data).to.eql({ error: 'You can only have up to 10 active games at any time.' });

                        client.disconnect(true);
                        done();
                    });

                    client.emit('join_room', 'random');
                });
            });


            it('rejoins to room if allowed', (done) => {
                const client = io.connect(URL, authOptions);

                client.on('connect', () => {
                    client.on('reconnected', data => {
                        expect(data).to.eql({ room: 'bd45bf1f-7cc1-4f8a-b522-dd6e61a8b6ed' });

                        client.disconnect(true);
                        done();
                    });

                    client.emit('join_room', 'bd45bf1f-7cc1-4f8a-b522-dd6e61a8b6ed');
                });
            });


            it('errors if not allowed in room', (done) => {
                const client = io.connect(URL, authOptions);

                client.on('connect', () => {
                    client.on('error-message', data => {
                        expect(data).to.eql({ error: 'You are not allowed in this room' });

                        client.disconnect(true);
                        done();
                    });

                    client.emit('join_room', '4c3014d4-be74-4141-a7f3-6258c31ae913');
                });
            });


            it('errors if game is completed', (done) => {
                const client = io.connect(URL, authOptions);

                client.on('connect', () => {
                    client.on('error-message', data => {
                        expect(data).to.eql({ error: 'This game has already been finished' });

                        client.disconnect(true);
                        done();
                    });

                    client.emit('join_room', '470da57a-f37c-4740-989d-15decc0cf62f');
                });
            });
        });
    });

    describe('Socket in active game', () => {
        let activeGame = { player1: 1, player2: 2, room_id: '2751320b-3f1e-43c3-a1f7-d6649369659e' }

        beforeEach(async () => {
            await db.into('users')
                .insert([testUser, testUser2])
                .then(() => {
                    db.into('game_history')
                        .insert(activeGame)
                        .then(() => {
                            return db.into('room_queue')
                                .insert({ size: 0 })
                        });
                });
        });



        it('ships_ready broadcasts to opponent', function (done) {
            this.retries(3);
            const client = io.connect(URL, authOptions);
            const client2 = io.connect(URL, authOptions2);

            client.on('connect', () => {
                client.on('reconnected', () => {

                    client.on('opponent_ready', () => {
                        client.disconnect(true);
                        done();
                    });
                });

                client.emit('join_room', '2751320b-3f1e-43c3-a1f7-d6649369659e');
            });

            client2.on('connect', () => {
                client2.on('reconnected', () => {

                    client2.emit('ships_ready', '2751320b-3f1e-43c3-a1f7-d6649369659e')
                    client2.disconnect(true);
                });

                client2.emit('join_room', '2751320b-3f1e-43c3-a1f7-d6649369659e');
            });
        });

        it('send-message broadcasts to opponent', function (done) {
            this.retries(3);
            const client = io.connect(URL, authOptions);
            const client2 = io.connect(URL, authOptions2);

            client.on('connect', () => {
                client.on('reconnected', () => {

                    client.on('chat-message', (data) => {
                        expect(data).to.be.an('Object');
                        expect(data.username).to.equal('admin2');
                        expect(data.message).to.equal('This test is working');


                        client.disconnect(true);
                        done();
                    });
                });

                client.emit('join_room', '2751320b-3f1e-43c3-a1f7-d6649369659e');
            });

            client2.on('connect', () => {
                client2.on('reconnected', () => {

                    client2.emit('send-message', { room: '2751320b-3f1e-43c3-a1f7-d6649369659e', message: 'This test is working' })
                    client2.disconnect(true);
                });

                client2.emit('join_room', '2751320b-3f1e-43c3-a1f7-d6649369659e');
            });
        });





    });



    describe('Socket fire', () => {

        let games = [
            { player1: 1, player2: 2, room_id: 'a23c48a7-d380-430b-9abc-a6a6ceeeadc0' }, { player1: 1, player2: 2, room_id: '37ec2818-2f13-44af-979c-94048ce2b612', game_status: 'complete' },
            { player1: 3, player2: 2, room_id: 'bd45bf1f-7cc1-4f8a-b522-dd6e61a8b6ed' }, { player1: 1, player2: 2, room_id: '1088813e-7310-41a1-bccf-596dfbfb65c0' }, { player1: 1, player2: 2, room_id: '5b864635-1700-46c9-8bfd-3f8cb2854b63', turn: 'player2' },
            { player1: 1, player2: 2, room_id: 'fce92a33-d8c0-40bf-a08b-7bf603d32576', turn: 'player2' }
        ];

        let gameData = [
            { game_id: 1, player1_ships: testShips, player2_ships: testShips2, player1_misses: '["D8","I4"]' }, { game_id: 4, player1_ships: testShips },
            { game_id: 5, player1_ships: testShips, player2_ships: testShips2, player2_hits: '["A2","A3","A4","A5"]'}, { game_id: 6, player1_ships: testShips, player2_ships: testShips2, player2_hits: '["A2","A3","A5","A4","A6","A7","A8","A9","A10","B10","C10","D10","E10","F10","H10","I10"]' }
        ];

        beforeEach(async () => {
            await db.into('users')
                .insert([testUser, testUser2, testUser3])
                .then(() => {
                    db.into('game_history')
                        .insert(games)
                        .then(() => {
                            db.into('game_data')
                                .insert(gameData)
                                .then(() => {
                                    return db.into('room_queue')
                                        .insert({ size: 0 })
                                });
                        });
                });
        });

        it('errors if you try to fire on a game not found', (done) => {
            const client = io.connect(URL, authOptions);

            client.on('connect', () => {
                client.on('error-message', data => {
                    expect(data).to.eql({ error: 'The game you are trying to modify does not exist' });

                    client.disconnect(true);
                    done();
                });

                client.emit('fire', { target: 'A3', gameId: 9999, roomId: 1 });
            });
        });

        it('errors if you try to fire on a game that is finished', (done) => {
            const client = io.connect(URL, authOptions);

            client.on('connect', () => {
                client.on('error-message', data => {
                    expect(data).to.eql({ error: 'The game you are trying to modify has been completed' });

                    client.disconnect(true);
                    done();
                });

                client.emit('fire', { target: 'A3', gameId: 2, roomId: '37ec2818-2f13-44af-979c-94048ce2b612' });
            });
        });

        it('errors if you try to fire on a game you are not a part of', (done) => {
            const client = io.connect(URL, authOptions);

            client.on('connect', () => {
                client.on('error-message', data => {
                    expect(data).to.eql({ error: 'You are not allowed to make changes to this game' });

                    client.disconnect(true);
                    done();
                });

                client.emit('fire', { target: 'A3', gameId: 3, roomId: 'bd45bf1f-7cc1-4f8a-b522-dd6e61a8b6ed' });
            });
        });

        it('errors if you try to fire on a game while providing incorrect roomid', (done) => {
            const client = io.connect(URL, authOptions);

            client.on('connect', () => {
                client.on('error-message', data => {
                    expect(data).to.eql({ error: 'Incorrect room-id or game-id' });

                    client.disconnect(true);
                    done();
                });

                client.emit('fire', { target: 'A3', gameId: 1, roomId: '758ea570-55df-4ea6-8d27-6fa89a61a1e3' });
            });
        });


        it('errors if you try to fire on a game while opponent does not have their ships set', (done) => {
            const client = io.connect(URL, authOptions);

            client.on('connect', () => {
                client.on('error-message', data => {
                    expect(data).to.eql({ error: 'Must wait until opponent sets their ships' });

                    client.disconnect(true);
                    done();
                });

                client.emit('fire', { target: 'A3', gameId: 4, roomId: '1088813e-7310-41a1-bccf-596dfbfb65c0' });
            });
        });

        it('errors if you try to fire on a game while not your turn', (done) => {
            const client = io.connect(URL, authOptions);

            client.on('connect', () => {
                client.on('error-message', data => {
                    expect(data).to.eql({ error: 'You cannot fire when it is not your turn' });

                    client.disconnect(true);
                    done();
                });

                client.emit('fire', { target: 'A1', gameId: 5, roomId: '5b864635-1700-46c9-8bfd-3f8cb2854b63' });
            });
        });

        //----------------------------------------------------------------------------------------
        //Target tests

        it('errors if you try to fire on a target out of bounds length', (done) => {
            const client = io.connect(URL, authOptions);

            client.on('connect', () => {
                client.on('error-message', data => {
                    expect(data).to.eql({ error: 'The target youve selected is out of bounds' });

                    client.disconnect(true);
                    done();
                });

                client.emit('fire', { target: 'A', gameId: 4, roomId: '1088813e-7310-41a1-bccf-596dfbfb65c0' });
            });
        });

        it('errors if you try to fire on a target out of bounds first character not in possible firsts', (done) => {
            const client = io.connect(URL, authOptions);

            client.on('connect', () => {
                client.on('error-message', data => {
                    expect(data).to.eql({ error: 'The target youve selected is out of bounds' });

                    client.disconnect(true);
                    done();
                });

                client.emit('fire', { target: 'Z3', gameId: 4, roomId: '1088813e-7310-41a1-bccf-596dfbfb65c0' });
            });
        });

        it('errors if you try to fire on a target out of bounds second character is not a number', (done) => {
            const client = io.connect(URL, authOptions);

            client.on('connect', () => {
                client.on('error-message', data => {
                    expect(data).to.eql({ error: 'The target youve selected is out of bounds' });

                    client.disconnect(true);
                    done();
                });

                client.emit('fire', { target: 'Ab', gameId: 4, roomId: '1088813e-7310-41a1-bccf-596dfbfb65c0' });
            });
        });

        it('errors if you try to fire on a target out of bounds third character not 0', (done) => {
            const client = io.connect(URL, authOptions);

            client.on('connect', () => {
                client.on('error-message', data => {
                    expect(data).to.eql({ error: 'The target youve selected is out of bounds' });

                    client.disconnect(true);
                    done();
                });

                client.emit('fire', { target: 'A76', gameId: 4, roomId: '1088813e-7310-41a1-bccf-596dfbfb65c0' });
            });
        });

        it('errors if you try to fire on a target youve already fired upon', (done) => {
            const client = io.connect(URL, authOptions);

            client.on('connect', () => {
                client.on('error-message', data => {
                    expect(data).to.eql({ error: 'Target has already been selected' });

                    client.disconnect(true);
                    done();
                });

                client.emit('fire', { target: 'D8', gameId: 1, roomId: 'a23c48a7-d380-430b-9abc-a6a6ceeeadc0' });
            });
        });


        //---------------------------------------------------------------------------------------------

        it('fire emits successful shots and sinks ship successfully (FULL INTEGRATION)', (done) => {
            const client = io.connect(URL, authOptions);
            const client2 = io.connect(URL, authOptions2);

            client.on('connect', () => {
                client.on('reconnected', () => {

                    client.on('response', (data) => {
                        expect(data).to.be.an('Object');
                        expect(data).to.have.all.keys('result', 'ship', 'playerNum', 'target', 'sunk');
                        expect(data.result).to.equal('hit');
                        expect(data.ship).to.equal('aircraftCarrier');
                        expect(data.playerNum).to.equal('player2');
                        expect(data.sunk).to.equal(true);

                        db('game_data')
                            .select('player2_hits', 'last_move')
                            .where({ game_id: 5 })
                            .first()
                            .then(data => {
                                expect(data.player2_hits).to.equal('["A2","A3","A4","A5","A1"]');
                                expect(data.last_move).to.not.equal(null);

                                db('game_history')
                                    .select('turn')
                                    .where({ id: 5 })
                                    .first()
                                    .then(turn => {
                                        expect(turn.turn).to.equal('player1');
                                        client.disconnect(true);
                                        done();
                                    });
                            });
                    });
                });

                client.emit('join_room', '5b864635-1700-46c9-8bfd-3f8cb2854b63');
            });

            client2.on('connect', () => {
                client2.on('reconnected', () => {
                    client2.on('response', (data) => {
                        expect(data).to.be.an('Object');
                        expect(data).to.have.all.keys('result', 'ship', 'playerNum', 'target', 'sunk');
                        expect(data.result).to.equal('hit');
                        expect(data.ship).to.equal('aircraftCarrier');
                        expect(data.playerNum).to.equal('player2');
                        expect(data.sunk).to.equal(true);

                        client2.disconnect(true);
                    });

                    client2.emit('fire', { target: 'A1', gameId: 5, roomId: '5b864635-1700-46c9-8bfd-3f8cb2854b63' })
                });

                client2.emit('join_room', '5b864635-1700-46c9-8bfd-3f8cb2854b63');
            });
        });


        it('fire emits when a player has won the game (FULL INTEGRATION)', (done) => {
            const client = io.connect(URL, authOptions);
            const client2 = io.connect(URL, authOptions2);

            client.on('connect', () => {
                client.on('reconnected', () => {

                    client.on('win', (data) => {
                        expect(data).to.be.an('Object');
                        expect(data).to.have.all.keys('winner');
                        expect(data.winner).to.equal('player2');

                        db('game_data')
                            .select('winner')
                            .where({ game_id: 6 })
                            .first()
                            .then(data => {
                                expect(data.winner).to.equal('player2')

                                db('game_history')
                                    .select('game_status')
                                    .where({ id: 6 })
                                    .first()
                                    .then(data2 => {
                                        expect(data2.game_status).to.equal('complete');
                                        client.disconnect(true);
                                        done();
                                    });
                            });
                    });
                });

                client.emit('join_room', 'fce92a33-d8c0-40bf-a08b-7bf603d32576');
            });

            client2.on('connect', () => {
                client2.on('reconnected', () => {
                    client2.on('win', (data) => {
                        expect(data).to.be.an('Object');
                        expect(data).to.have.all.keys('winner');
                        expect(data.winner).to.equal('player2');

                        client2.disconnect(true);
                    });

                    client2.emit('fire', { target: 'A1', gameId: 6, roomId: 'fce92a33-d8c0-40bf-a08b-7bf603d32576' })
                });

                client2.emit('join_room', 'fce92a33-d8c0-40bf-a08b-7bf603d32576');
            });
        });

    });

    // describe('', () => {

    // });
});