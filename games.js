class AmongUs2DGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.ws = null;
        this.playerId = null;
        this.roomCode = null;
        this.players = new Map();
        this.localPlayer = null;
        this.gameState = 'menu';
        this.isHost = false;
        this.animationFrame = null;
        this.camera = { x: 0, y: 0 };
        this.mouse = { x: 0, y: 0 };
        this.keys = {};
        
        this.colors = {
            red: '#ff4444',
            blue: '#4444ff',
            green: '#44ff44',
            yellow: '#ffff44',
            orange: '#ff8844',
            purple: '#ff44ff',
            cyan: '#44ffff',
            pink: '#ff88ff',
            brown: '#8b4513',
            white: '#ffffff',
            black: '#444444'
        };

        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.connectWebSocket();
    }

    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });
    }

    setupEventListeners() {
        // Menu buttons
        document.getElementById('createBtn').addEventListener('click', () => this.createRoom());
        document.getElementById('joinBtn').addEventListener('click', () => this.joinRoom());
        
        // Game controls
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('leaveBtn').addEventListener('click', () => this.leaveRoom());
        document.getElementById('chatSend').addEventListener('click', () => this.sendChat());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChat();
        });

        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // Mouse controls
        this.canvas.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.gameState === 'playing' && this.localPlayer) {
                this.handleCanvasClick(e.clientX, e.clientY);
            }
        });
    }

    connectWebSocket() {
        this.ws = new WebSocket('ws://localhost:8080');

        this.ws.onopen = () => {
            console.log('Connected to server');
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
        };

        this.ws.onclose = () => {
            console.log('Disconnected from server');
            setTimeout(() => this.connectWebSocket(), 3000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    handleServerMessage(data) {
        switch (data.type) {
            case 'connected':
                this.playerId = data.playerId;
                break;

            case 'roomCreated':
                this.handleRoomCreated(data);
                break;

            case 'roomJoined':
                this.handleRoomJoined(data);
                break;

            case 'playerJoined':
                this.handlePlayerJoined(data.player);
                break;

            case 'playerLeft':
                this.handlePlayerLeft(data.playerId);
                break;

            case 'gameStarted':
                this.handleGameStarted(data.players);
                break;

            case 'playerMoved':
                this.handlePlayerMoved(data.playerId, data.x, data.y);
                break;

            case 'playerEliminated':
                this.handlePlayerEliminated(data.playerId);
                break;

            case 'gameEnded':
                this.handleGameEnded(data.winner);
                break;

            case 'chat':
                this.handleChat(data);
                break;

            case 'error':
                this.handleError(data.message);
                break;
        }
    }

    createRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        if (!playerName) {
            alert('Please enter your name');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'createRoom',
            playerName: playerName
        }));
    }

    joinRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();

        if (!playerName) {
            alert('Please enter your name');
            return;
        }

        if (!roomCode) {
            alert('Please enter a room code');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'joinRoom',
            playerName: playerName,
            roomCode: roomCode
        }));
    }

    handleRoomCreated(data) {
        this.roomCode = data.roomCode;
        this.isHost = true;
        this.switchToGame();
        this.updatePlayers(data.players);
        document.getElementById('startGameBtn').disabled = false;
    }

    handleRoomJoined(data) {
        this.roomCode = data.roomCode;
        this.isHost = data.isHost;
        this.switchToGame();
        this.updatePlayers(data.players);
        document.getElementById('startGameBtn').disabled = !this.isHost;
    }

    handlePlayerJoined(player) {
        this.players.set(player.id, player);
        this.updatePlayerList();
        this.addChatMessage('System', `${player.name} joined the room`, 'system');
    }

    handlePlayerLeft(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            this.addChatMessage('System', `${player.name} left the room`, 'system');
            this.players.delete(playerId);
            this.updatePlayerList();
        }
    }

    handleGameStarted(playersData) {
        this.gameState = 'playing';
        this.updatePlayers(playersData);
        document.getElementById('gameStatus').textContent = 'Playing';
        document.getElementById('startGameBtn').disabled = true;
        
        if (this.localPlayer.isImpostor) {
            this.addChatMessage('System', 'You are an IMPOSTOR!', 'system', true);
        } else {
            this.addChatMessage('System', 'You are a CREWMATE!', 'system', true);
        }

        this.startGameLoop();
    }

    handlePlayerMoved(playerId, x, y) {
        const player = this.players.get(playerId);
        if (player) {
            player.targetX = x;
            player.targetY = y;
        }
    }

    handlePlayerEliminated(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            player.isAlive = false;
            this.addChatMessage('System', `${player.name} was eliminated!`, 'system');
            this.updatePlayerList();
        }
    }

    handleGameEnded(winner) {
        this.gameState = 'ended';
        document.getElementById('gameStatus').textContent = winner === 'crewmates' ? 'Crewmates Win!' : 'Impostors Win!';
        this.addChatMessage('System', `Game ended! ${winner === 'crewmates' ? 'Crewmates' : 'Impostors'} win!`, 'system');
    }

    handleChat(data) {
        this.addChatMessage(data.playerName, data.message, 'player');
    }

    handleError(message) {
        alert(message);
    }

    switchToGame() {
        document.getElementById('menuScreen').classList.add('hidden');
        document.getElementById('gameUI').classList.remove('hidden');
        this.gameState = 'lobby';
        
        document.getElementById('roomCodeDisplay').textContent = this.roomCode;
        document.getElementById('gameStatus').textContent = 'Lobby';
    }

    updatePlayers(playersData) {
        this.players.clear();
        playersData.forEach(player => {
            this.players.set(player.id, player);
            if (player.id === this.playerId) {
                this.localPlayer = player;
            }
        });
        this.updatePlayerList();
    }

    updatePlayerList() {
        const playerListContent = document.getElementById('playerListContent');
        playerListContent.innerHTML = '';

        this.players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            if (!player.isAlive) {
                playerItem.classList.add('player-dead');
            }

            const colorDiv = document.createElement('div');
            colorDiv.className = 'player-color';
            colorDiv.style.backgroundColor = this.colors[player.color] || '#ffffff';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'player-name';
            nameDiv.textContent = player.name;
            if (player.id === this.playerId) {
                nameDiv.textContent += ' (You)';
            }

            const statusDiv = document.createElement('div');
            statusDiv.className = 'player-status';
            statusDiv.textContent = player.isAlive ? 'Alive' : 'Dead';

            playerItem.appendChild(colorDiv);
            playerItem.appendChild(nameDiv);
            playerItem.appendChild(statusDiv);
            playerListContent.appendChild(playerItem);
        });

        document.getElementById('playerCount').textContent = `${this.players.size}/10`;
    }

    startGame() {
        if (this.isHost) {
            this.ws.send(JSON.stringify({ type: 'startGame' }));
        }
    }

    leaveRoom() {
        this.ws.send(JSON.stringify({ type: 'leaveRoom' }));
        this.returnToMenu();
    }

    returnToMenu() {
        this.gameState = 'menu';
        this.roomCode = null;
        this.isHost = false;
        this.players.clear();
        this.localPlayer = null;
        
        document.getElementById('menuScreen').classList.remove('hidden');
        document.getElementById('gameUI').classList.add('hidden');
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    sendChat() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (message && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'chat',
                message: message
            }));
            input.value = '';
        }
    }

    addChatMessage(sender, message, type = 'player', isPrivate = false) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        if (isPrivate) {
            messageDiv.style.background = 'rgba(255, 107, 107, 0.2)';
            messageDiv.style.border = '1px solid rgba(255, 107, 107, 0.5)';
        }

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (type === 'system') {
            messageDiv.innerHTML = `<span style="color: #ff6b6b; font-weight: bold;">${sender}:</span> <span>${message}</span> <span style="color: #666; font-size: 0.8em; margin-left: 10px;">${timestamp}</span>`;
        } else {
            messageDiv.innerHTML = `<span class="chat-sender">${sender}:</span> ${message} <span style="color: #666; font-size: 0.8em; margin-left: 10px;">${timestamp}</span>`;
        }

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    startGameLoop() {
        const gameLoop = () => {
            this.update();
            this.render();
            this.animationFrame = requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }

    update() {
        if (!this.localPlayer || this.gameState !== 'playing') return;

        // Handle movement
        const speed = 3;
        let dx = 0, dy = 0;

        if (this.keys['w'] || this.keys['arrowup']) dy = -speed;
        if (this.keys['s'] || this.keys['arrowdown']) dy = speed;
        if (this.keys['a'] || this.keys['arrowleft']) dx = -speed;
        if (this.keys['d'] || this.keys['arrowright']) dx = speed;

        if (dx !== 0 || dy !== 0) {
            this.localPlayer.x += dx;
            this.localPlayer.y += dy;

            // Keep player in bounds
            this.localPlayer.x = Math.max(50, Math.min(this.canvas.width - 50, this.localPlayer.x));
            this.localPlayer.y = Math.max(50, Math.min(this.canvas.height - 50, this.localPlayer.y));

            // Send position to server
            this.ws.send(JSON.stringify({
                type: 'playerMove',
                x: this.localPlayer.x,
                y: this.localPlayer.y
            }));
        }

        // Update camera to follow local player
        this.camera.x = this.localPlayer.x - this.canvas.width / 2;
        this.camera.y = this.localPlayer.y - this.canvas.height / 2;

        // Smooth movement for other players
        this.players.forEach(player => {
            if (player.id !== this.playerId && player.targetX !== undefined) {
                player.x += (player.targetX - player.x) * 0.1;
                player.y += (player.targetY - player.y) * 0.1;
            }
        });
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#1a1a3e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.drawGrid();

        // Draw players
        this.players.forEach(player => {
            this.drawPlayer(player);
        });

        // Draw mouse cursor
        if (this.gameState === 'playing' && this.localPlayer) {
            this.drawCursor();
        }
    }

    drawGrid() {
        const gridSize = 50;
        const startX = -this.camera.x % gridSize;
        const startY = -this.camera.y % gridSize;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;

        for (let x = startX; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = startY; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawPlayer(player) {
        const x = player.x - this.camera.x;
        const y = player.y - this.camera.y;
        const size = 30;

        // Draw shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(x, y + size + 5, size * 0.8, size * 0.3, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw body
        const color = this.colors[player.color] || '#ffffff';
        this.ctx.fillStyle = color;
        
        if (!player.isAlive) {
            this.ctx.globalAlpha = 0.5;
        }

        // Body shape (bean-like)
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw visor
        this.ctx.fillStyle = '#4a90e2';
        this.ctx.beginPath();
        this.ctx.ellipse(x, y - 5, size * 0.6, size * 0.4, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Visor shine
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(x - 5, y - 7, size * 0.2, size * 0.15, -0.3, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw backpack
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x + size * 0.8, y, size * 0.3, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw name
        this.ctx.globalAlpha = 1;
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(player.name, x, y - size - 10);

        // Draw local player indicator
        if (player.id === this.playerId) {
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(x, y, size + 5, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        this.ctx.globalAlpha = 1;
    }

    drawCursor() {
        const x = this.mouse.x;
        const y = this.mouse.y;

        this.ctx.strokeStyle = 'rgba(255, 107, 107, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 10, 0, Math.PI * 2);
        this.ctx.stroke();

        // Crosshair
        this.ctx.beginPath();
        this.ctx.moveTo(x - 15, y);
        this.ctx.lineTo(x + 15, y);
        this.ctx.moveTo(x, y - 15);
        this.ctx.lineTo(x, y + 15);
        this.ctx.stroke();
    }

    handleCanvasClick(x, y) {
        // Check if clicking on another player for voting
        this.players.forEach(player => {
            if (player.id !== this.playerId && player.isAlive) {
                const playerX = player.x - this.camera.x;
                const playerY = player.y - this.camera.y;
                const distance = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);

                if (distance < 30) {
                    // Vote for this player
                    this.ws.send(JSON.stringify({
                        type: 'vote',
                        targetId: player.id
                    }));
                }
            }
        });
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new AmongUs2DGame();
});
