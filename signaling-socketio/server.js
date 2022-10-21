//const static = require('node-static');
const http = require('http');

const express = require('express');
const app = express();

const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    // Convenience function to log server messages to the client
    function log() {
        const array = ['>>> Message from server: '];
        for (let i = 0; i < arguments.length; i++) {
            array.push(arguments[i]);
        }
        socket.emit('log', array);
    }

    socket.on('message', (message) => {
        log('Got message:', message);
        // For a real app, would be room only (not broadcast)
        socket.broadcast.emit('message', message);
    });

    socket.on('create or join', (room) => {
        const roomExists = io.sockets.adapter.rooms.has(room);

        const numClients = roomExists ? io.sockets.adapter.rooms.get(room).size : 0;

        log('Room ' + room + ' has ' + numClients + ' client(s)');
        log('Request to create or join room ' + room);

        if (numClients === 0) {
            socket.join(room);
            socket.emit('created', [room]);
        } else if (numClients === 1) {
            console.log('entrando na sala');
            socket.join(room);
            console.log('emitindo broadcast');
            io.to(room).emit('broadcast joined', socket.id + ' joined room ' + room);
            io.emit('broadcast joined', socket.id + ' joined room ' + room);
            socket.broadcast.emit('broadcast joined', socket.id +
            ' joined room ' + room);
        } else { // max two clients
            socket.emit('full', room);
        }
        socket.emit('emit(): client ' + socket.id +
            ' joined room ' + room);
        console.log('finalized');
    });

});

app.listen(2013, () => {
    console.log('Listening on port 2013!');
});