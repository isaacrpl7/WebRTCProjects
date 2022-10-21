const {v4: uuidv4} = require('uuid');
const path = require('path');
const express = require('express');
const app = express();
var jwt = require('jsonwebtoken');
var dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 2013;

app.use('/static', express.static(`${__dirname}/static`));
app.use(express.json())

const {createServer} = require('http');
const server = createServer(app);

app.get('/', (req, res) => {
    const roomId = uuidv4();
    res.redirect('/'+roomId);
});

// store the connections from clients here
var clients = {};

app.get('/connect', auth, (req, res) => {
    if (req.headers.accept !== 'text/event-stream') {
        return res.sendStatus(404);
    }
    

    // write the event stream headers
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    // setup a client
    let client = {
        id: req.user.id, //client id
        user: req.user,
        emit: (event, data) => {
            res.write(`id: ${uuidv4()}\n`); //event id
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    };

    clients[client.id] = client;

    // emit the connected state
    client.emit('connected', { user: req.user });
    console.log(client.user.username + ' has connected!');

    req.on('close', () => {
        disconnected(client);
    });
});

app.get('/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'static/index.html'));
});


var rooms = {};
// removes the client from the client map
function disconnected(client) {
    console.log(client.id + ' has disconnected!');
    delete clients[client.id];
    for (let roomId in rooms) { // for each room, search the room with the client
        let room = rooms[roomId];
        // if the peer is still on the room, delete the peer and warn the others
        if (room[client.id]) {
            delete room[client.id];
            for (let peerId in room) {
                console.log('Emmiting to ' + peerId);
                clients[peerId].emit('remove-peer', { peer: client.user, roomId });
            }
        }
        // delete a room if it has 0 clients/peers/users
        if (Object.keys(room).length === 0) {
            delete rooms[roomId];
        }
    }
}

app.post('/:roomId/join', auth, (req, res) => {
    let roomId = req.params.roomId;

    // if the room is already in room and also the user, it has already entered the room
    if (rooms[roomId] && rooms[roomId][req.user.id]) {
        return res.sendStatus(200);
    }
    // if room is not in room, add it and the value is an object
    if (!rooms[roomId]) {
        rooms[roomId] = {};
        console.log(roomId + ' room added to rooms keys');
    }

    // for each user in this room
    for (let peerId in rooms[roomId]) {
        if (clients[peerId] && clients[req.user.id]) {
            // Server will emit to each user in this room the add peer with my user
            clients[peerId].emit('add-peer', { peer: req.user, roomId, offer: false });
            // Server will emit to the new user the add peer with every user within the room
            clients[req.user.id].emit('add-peer', { peer: clients[peerId].user, roomId, offer: true });
        }
    }

    rooms[roomId][req.user.id] = true;
    console.log(req.user.id + ' user added to room ' + roomId + ' keys');
    return res.sendStatus(200);
});

// Relay (pick and pass) data from user (peer) to peer
app.post('/relay/:peerId/:event', auth, (req, res) => {
    let {peerId, event} = req.params;
    let {user, body} = req;
    // destination: peer in url param
    // source: user
    if (clients[peerId]) {
        clients[peerId].emit(event, { peer: user, data: body });
    }
    return res.sendStatus(200);
});


// middleware to authenticate
function auth(req, res, next) {
    let token;
    // Retrieving the token
    if (req.headers.authorization) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }
    if (typeof token !== 'string') {
        return res.sendStatus(401);
    }

    // verifying if the token is registered and if so, attach the user to the request
    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
}

// registering
app.post('/access', (req, res) => {
    const { username } = req.body
    if (!username) {
        return res.sendStatus(403);
    }
    const user = {
        id: uuidv4(),
        username
    };

    // register token
    const token = jwt.sign(user, process.env.TOKEN_SECRET, { expiresIn: '3600s' });
    return res.json(token);
});


server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}!`);
});