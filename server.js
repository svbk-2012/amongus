const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Game state
const rooms = new Map();
const players = new Map();

// Room management
class Room {
    constructor(code) {
        this.code = code;
        this.players = new Map();
        this.gameState = 'lobby'; // lobby, playing, ended
        this.impostors = [];
        this.tasks = new Map();
        this.eliminated = [];
        this.host = null;
    }

    addPlayer(player) {
        this.players.set(player.id, player);
        if (!this.host) {
            this.host = player.id;
        }
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        if (this.host === playerId && this.players.size > 0) {
            this.host = this.players.keys().next().value;
        }
    }

    getPlayerCount() {
        return this.players.size;
    }

    getAvailableColors() {
        const usedColors = Array.from(this.players.values()).map(p => p.color);
        const allColors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'cyan', 'pink', 'brown', 'white', 'black'];
        return allColors.filter(color => !usedColors.includes(color));
    }

    startGame() {
        if (this.players.size < 2) return false;
        
        this.gameState = 'playing';
        const playerArray = Array.from(this.players.values());
        const impostorCount = Math.max(1, Math.floor(playerArray.length / 4));
        
        // Select impostors
        const shuffled = [...playerArray].sort(() => Math.random() - 0.5);
        this.impostors = shuffled.slice(0, impostorCount);
        
        // Assign roles
        playerArray.forEach(player => {
            player.isImpostor = this.impostors.includes(player);
            player.isAlive = true;
            player.x = Math.random() * 600 + 100;
            player.y = Math.random() * 400 + 100;
        });

        return true;
    }

    eliminatePlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            player.isAlive = false;
            this.eliminated.push(playerId);
            return true;
        }
        return false;
    }

    checkWinCondition() {
        const aliveImpostors = Array.from(this.players.values()).filter(p => p.isAlive && p.isImpostor);
        const aliveCrewmates = Array.from(this.players.values()).filter(p => p.isAlive && !p.isImpostor);

        if (aliveImpostors.length === 0) {
            this.gameState = 'ended';
            return 'crewmates';
        } else if (aliveImpostors.length >= aliveCrewmates.length) {
            this.gameState = 'ended';
            return 'impostors';
        }

        return null;
    }
}

// WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    const playerId = uuidv4();
    players.set(playerId, { ws, room: null });

    console.log(`Player ${playerId} connected`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handlePlayerMessage(playerId, data);
        } catch (error) {
            console.error('Invalid message:', error);
        }
    });

    ws.on('close', () => {
        handlePlayerDisconnect(playerId);
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({
        type: 'connected',
        playerId: playerId
    }));
});

function handlePlayerMessage(playerId, data) {
    const player = players.get(playerId);
    if (!player) return;

    switch (data.type) {
        case 'createRoom':
            createRoom(playerId, data.playerName);
            break;

        case 'joinRoom':
            joinRoom(playerId, data.roomCode, data.playerName);
            break;

        case 'leaveRoom':
            leaveRoom(playerId);
            break;

        case 'startGame':
            startGameInRoom(playerId);
            break;

        case 'playerMove':
            updatePlayerPosition(playerId, data.x, data.y);
            break;

        case 'vote':
            handleVote(playerId, data.targetId);
            break;

        case 'chat':
            handleChat(playerId, data.message);
            break;
    }
}

function createRoom(playerId, playerName) {
    const roomCode = generateRoomCode();
    const room = new Room(roomCode);
    const playerData = {
        id: playerId,
        name: playerName,
        color: room.getAvailableColors()[0] || 'red',
        isImpostor: false,
        isAlive: true,
        x: 400,
        y: 300
    };

    room.addPlayer(playerData);
    rooms.set(roomCode, room);

    const player = players.get(playerId);
    player.room = roomCode;

    // Send room creation response
    player.ws.send(JSON.stringify({
        type: 'roomCreated',
        roomCode: roomCode,
        players: Array.from(room.players.values())
    }));

    broadcastToRoom(roomCode, {
        type: 'playerJoined',
        player: playerData
    }, playerId);
}

function joinRoom(playerId, roomCode, playerName) {
    const room = rooms.get(roomCode);
    if (!room) {
        players.get(playerId).ws.send(JSON.stringify({
            type: 'error',
            message: 'Room not found'
        }));
        return;
    }

    if (room.getPlayerCount() >= 10) {
        players.get(playerId).ws.send(JSON.stringify({
            type: 'error',
            message: 'Room is full'
        }));
        return;
    }

    const playerData = {
        id: playerId,
        name: playerName,
        color: room.getAvailableColors()[0] || 'red',
        isImpostor: false,
        isAlive: true,
        x: 400 + Math.random() * 100 - 50,
        y: 300 + Math.random() * 100 - 50
    };

    room.addPlayer(playerData);
    const player = players.get(playerId);
    player.room = roomCode;

    // Send room join response
    player.ws.send(JSON.stringify({
        type: 'roomJoined',
        roomCode: roomCode,
        players: Array.from(room.players.values()),
        isHost: room.host === playerId
    }));

    broadcastToRoom(roomCode, {
        type: 'playerJoined',
        player: playerData
    }, playerId);
}

function leaveRoom(playerId) {
    const player = players.get(playerId);
    if (!player || !player.room) return;

    const room = rooms.get(player.room);
    if (room) {
        room.removePlayer(playerId);
        
        broadcastToRoom(player.room, {
            type: 'playerLeft',
            playerId: playerId
        });

        if (room.getPlayerCount() === 0) {
            rooms.delete(player.room);
        }
    }

    player.room = null;
}

function startGameInRoom(playerId) {
    const player = players.get(playerId);
    if (!player || !player.room) return;

    const room = rooms.get(player.room);
    if (!room || room.host !== playerId) return;

    if (room.startGame()) {
        broadcastToRoom(player.room, {
            type: 'gameStarted',
            players: Array.from(room.players.values())
        });
    }
}

function updatePlayerPosition(playerId, x, y) {
    const player = players.get(playerId);
    if (!player || !player.room) return;

    const room = rooms.get(player.room);
    if (!room) return;

    const roomPlayer = room.players.get(playerId);
    if (roomPlayer && roomPlayer.isAlive) {
        roomPlayer.x = x;
        roomPlayer.y = y;

        broadcastToRoom(player.room, {
            type: 'playerMoved',
            playerId: playerId,
            x: x,
            y: y
        }, playerId);
    }
}

function handleVote(playerId, targetId) {
    const player = players.get(playerId);
    if (!player || !player.room) return;

    const room = rooms.get(player.room);
    if (!room || room.gameState !== 'playing') return;

    // Simple voting - just eliminate the target
    if (room.eliminatePlayer(targetId)) {
        broadcastToRoom(player.room, {
            type: 'playerEliminated',
            playerId: targetId
        });

        const winner = room.checkWinCondition();
        if (winner) {
            broadcastToRoom(player.room, {
                type: 'gameEnded',
                winner: winner
            });
        }
    }
}

function handleChat(playerId, message) {
    const player = players.get(playerId);
    if (!player || !player.room) return;

    const room = rooms.get(player.room);
    if (!room) return;

    const roomPlayer = room.players.get(playerId);
    if (!roomPlayer) return;

    broadcastToRoom(player.room, {
        type: 'chat',
        playerId: playerId,
        playerName: roomPlayer.name,
        message: message,
        timestamp: Date.now()
    });
}

function broadcastToRoom(roomCode, message, excludePlayerId = null) {
    const room = rooms.get(roomCode);
    if (!room) return;

    room.players.forEach((player, playerId) => {
        if (playerId !== excludePlayerId) {
            const playerConnection = players.get(playerId);
            if (playerConnection && playerConnection.ws.readyState === WebSocket.OPEN) {
                playerConnection.ws.send(JSON.stringify(message));
            }
        }
    });
}

function handlePlayerDisconnect(playerId) {
    const player = players.get(playerId);
    if (player) {
        leaveRoom(playerId);
        players.delete(playerId);
    }
    console.log(`Player ${playerId} disconnected`);
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// HTTP server for serving static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/room/:code', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start servers
app.listen(PORT, () => {
    console.log(`HTTP server running on port ${PORT}`);
});

console.log(`WebSocket server running on port 8080`);
console.log(`Game available at http://localhost:${PORT}`);
