const { WebSocketServer, WebSocket } = require('ws');
const {v4: uuidv4} = require('uuid');
const path = require('path');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 2013;

app.use(express.static(`${__dirname}/static`));

const {createServer} = require('http');
const server = createServer(app);

const wss = new WebSocketServer({ server });

const connections = [];

const broadcastConnections = (data, isBinary=false) => {
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data, { binary: isBinary });
        }
    });
}

const broadcastFromSender = (data, sender) => {
    connections.forEach((connection) => {
        if(connection !== sender) {
            connection.send(data);
        }
    });
}

wss.on('connection', function connection(ws) {
    connections.push(ws);
    ws._connId = `conn-${uuidv4()}`;

    console.log(`${ws._connId} has connected!`);

    ws.send(JSON.stringify({ type: 'connection', id: ws._connId }));

    const ids = connections.map((connection) => connection._connId);
    broadcastConnections(JSON.stringify({type: 'ids', ids}));

    ws.on('close', () => {
        const closingConnectionIndex = connections.indexOf(ws);
        connections.splice(closingConnectionIndex, 1);

        const ids = connections.map((connection) => connection._connId);
        broadcastConnections(JSON.stringify({type: 'ids', ids}));
    });

    ws.on('message', function message(data) {
        broadcastFromSender(data.toString(), ws);
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}!`);
});