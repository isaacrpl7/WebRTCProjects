const {v4: uuidv4} = require('uuid');
const path = require('path');
const express = require('express');
const app = express();
var jwt = require('jsonwebtoken');
require('dotenv').config({path:__dirname+'/../.env'});
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 3000;

app.use('/static', express.static(`${__dirname}/static`));
app.use(express.json())

const {createServer} = require('http');
const server = createServer(app);

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req, clt) => {
    auth(req, ws, () => {console.log(`${req.user.username} está conectado no WS!`);});
    //ws._connId = req.user.id;
    // setup a client
    let client = {
        id: req.user.id, //client id
        user: req.user,
        ws
    };
    clients[client.id] = client;
    ws.send(JSON.stringify({type: 'connected', user: req.user }));

    ws.on('close', () => {
        const client = findClienByWS(ws);
        disconnected(client);
    });
});
function findClienByWS(ws){
    let clientObj = null
    Object.keys(clients).forEach(client_id => {
        const client = clients[client_id]['ws'] === ws ? clients[client_id] : null;
        if(client !== null)
            clientObj = client;
    })
    return clientObj;
}

app.get('/', (req, res) => {
    const roomId = uuidv4();
    res.redirect('/'+roomId);
});

// store the connections from clients here
var clients = {};

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
                clients[peerId].ws.send(JSON.stringify({type: 'remove-peer', peer: client.user, roomId }));
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
            clients[peerId].ws.send(JSON.stringify({ type: 'add-peer', peer: req.user, roomId, offer: false }));
            // Server will emit to the new user the add peer with every user within the room
            clients[req.user.id].ws.send(JSON.stringify({ type: 'add-peer', peer: clients[peerId].user, roomId, offer: true }));
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
        clients[peerId].ws.send(JSON.stringify({ type: event, peer: user, data: body }));
    }
    return res.sendStatus(200);
});


// middleware to authenticate
function auth(req, res, next) {
    let token;
    // Retrieving the token
    if (req.headers.authorization) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
        token = req.query.token;
    } else if(req.url.split('token=').length > 1) {
        token = req.url.split('token=')[1]
    }
    if (typeof token !== 'string') {
        return res instanceof WebSocket ? res.close() : res.sendStatus(401);
    }

    // verifying if the token is registered and if so, attach the user to the request
    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
        if (err) {
            return res instanceof WebSocket ? res.close() : res.sendStatus(403);
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