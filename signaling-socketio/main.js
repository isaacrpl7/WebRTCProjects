/** CLIENT CODE */
let isInitiator;

room = prompt('Enter room name:');

const socket = io();

if (room !== '') {
    console.log('Joining room ' + room);
    socket.emit('create or join', room);
}

socket.on('full', (room) => {
    console.log('Room ' + room + ' is full');
});

socket.on('empty', (room) => {
    isInitiator = true;
    console.log('Room ' + room + ' is empty');
});

socket.on('created', (room) => {
    console.log('Room ' + room + ' has been created successfully!');
});

socket.on('broadcast joined', (msg) => {
    console.log(msg);
});

socket.on('join', (room) => {
    console.log('Making request to join room ' + room);
    console.log('You are the initiator!');
});

socket.on('log', (array) => {
    console.log.apply(console, array);
});