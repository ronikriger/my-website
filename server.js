const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store for rooms and their state
const rooms = new Map();

// Pomodoro timer configuration (in milliseconds)
const POMODORO_TIME = 25 * 60 * 1000; // 25 minutes
const SHORT_BREAK = 5 * 60 * 1000;    // 5 minutes
const LONG_BREAK = 15 * 60 * 1000;    // 15 minutes

class Room {
    constructor(id, creatorName) {
        this.id = id;
        this.creator = creatorName;
        this.participants = new Map();
        this.timerState = {
            isRunning: false,
            currentSession: 'focus', // 'focus', 'shortBreak', 'longBreak'
            timeRemaining: POMODORO_TIME,
            sessionsCompleted: 0,
            startTime: null,
            endTime: null
        };
        this.stats = {
            totalFocusTime: 0,
            totalSessions: 0,
            participantCount: 0
        };
    }

    addParticipant(socketId, name) {
        this.participants.set(socketId, {
            id: socketId,
            name: name,
            joinedAt: Date.now(),
            sessionsCompleted: 0,
            totalFocusTime: 0,
            isActive: true
        });
        this.stats.participantCount = this.participants.size;
    }

    removeParticipant(socketId) {
        this.participants.delete(socketId);
        this.stats.participantCount = this.participants.size;
    }

    startTimer() {
        this.timerState.isRunning = true;
        this.timerState.startTime = Date.now();
        this.timerState.endTime = this.timerState.startTime + this.timerState.timeRemaining;
    }

    pauseTimer() {
        if (this.timerState.isRunning) {
            this.timerState.isRunning = false;
            this.timerState.timeRemaining = Math.max(0, this.timerState.endTime - Date.now());
        }
    }

    completeSession() {
        this.timerState.sessionsCompleted++;
        this.stats.totalSessions++;

        // Update participant stats
        this.participants.forEach(participant => {
            if (this.timerState.currentSession === 'focus') {
                participant.sessionsCompleted++;
                participant.totalFocusTime += POMODORO_TIME;
                this.stats.totalFocusTime += POMODORO_TIME;
            }
        });

        // Determine next session type
        if (this.timerState.currentSession === 'focus') {
            if (this.timerState.sessionsCompleted % 4 === 0) {
                this.timerState.currentSession = 'longBreak';
                this.timerState.timeRemaining = LONG_BREAK;
            } else {
                this.timerState.currentSession = 'shortBreak';
                this.timerState.timeRemaining = SHORT_BREAK;
            }
        } else {
            this.timerState.currentSession = 'focus';
            this.timerState.timeRemaining = POMODORO_TIME;
        }

        this.timerState.isRunning = false;
    }

    getRoomState() {
        return {
            id: this.id,
            creator: this.creator,
            participants: Array.from(this.participants.values()),
            timerState: this.timerState,
            stats: this.stats
        };
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/room/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

app.post('/api/rooms', (req, res) => {
    const { creatorName } = req.body;
    const roomId = uuidv4().substring(0, 8);
    const room = new Room(roomId, creatorName || 'Anonymous');
    rooms.set(roomId, room);

    res.json({ roomId, room: room.getRoomState() });
});

app.get('/api/rooms/:roomId', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }
    res.json({ room: room.getRoomState() });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (data) => {
        const { roomId, userName } = data;
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        socket.join(roomId);
        room.addParticipant(socket.id, userName || 'Anonymous');

        // Send current room state to the joining user
        socket.emit('room-state', room.getRoomState());

        // Notify other participants
        socket.to(roomId).emit('participant-joined', {
            participant: room.participants.get(socket.id),
            roomState: room.getRoomState()
        });
    });

    socket.on('start-timer', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);

        if (!room) return;

        room.startTimer();
        io.to(roomId).emit('timer-started', room.getRoomState());
    });

    socket.on('pause-timer', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);

        if (!room) return;

        room.pauseTimer();
        io.to(roomId).emit('timer-paused', room.getRoomState());
    });

    socket.on('complete-session', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);

        if (!room) return;

        room.completeSession();
        io.to(roomId).emit('session-completed', room.getRoomState());
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Remove from all rooms
        rooms.forEach((room, roomId) => {
            if (room.participants.has(socket.id)) {
                room.removeParticipant(socket.id);
                socket.to(roomId).emit('participant-left', {
                    socketId: socket.id,
                    roomState: room.getRoomState()
                });

                // Clean up empty rooms
                if (room.participants.size === 0) {
                    rooms.delete(roomId);
                }
            }
        });
    });
});

// Timer update interval
setInterval(() => {
    rooms.forEach((room, roomId) => {
        if (room.timerState.isRunning) {
            const now = Date.now();
            room.timerState.timeRemaining = Math.max(0, room.timerState.endTime - now);

            // Auto-complete session when timer reaches 0
            if (room.timerState.timeRemaining <= 0) {
                room.completeSession();
                io.to(roomId).emit('session-completed', room.getRoomState());
            } else {
                io.to(roomId).emit('timer-update', room.timerState);
            }
        }
    });
}, 1000); // Update every second

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Silent Pomodoro Room server running on port ${PORT}`);
}); 