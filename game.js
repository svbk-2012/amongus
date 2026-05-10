class AmongUsBrowserGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
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
        this.bots = [];
        
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
        this.generatePlayerId();
    }

    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });
    }

    generatePlayerId() {
        this.playerId = 'player_' + Math.random().toString(36).substr(2, 9);
    }

    setupEventListeners() {
        // Menu buttons
        document.getElementById('createBtn').addEventListener('click', () => this.createRoom());
        document.getElementById('joinBtn').addEventListener('click', () => this.joinRoom());
        
        // Game controls
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('addBotBtn').addEventListener('click', () => this.addBot());
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

    createRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        if (!playerName) {
            this.showNotification('Please enter your name');
            return;
        }

        this.roomCode = this.generateRoomCode();
        this.isHost = true;
        this.localPlayer = {
            id: this.playerId,
            name: playerName,
            color: this.getAvailableColor(),
            isImpostor: false,
            isAlive: true,
            x: 400,
            y: 300
        };

        this.players.set(this.playerId, this.localPlayer);
        this.switchToGame();
        this.addChatMessage('System', `Room created: ${this.roomCode}`, 'system');
        this.addChatMessage('System', 'Waiting for players...', 'system');
    }

    joinRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();

        if (!playerName) {
            this.showNotification('Please enter your name');
            return;
        }

        if (!roomCode) {
            this.showNotification('Please enter a room code');
            return;
        }

        // Simulate joining existing room (in real version, this would connect to server)
        this.roomCode = roomCode;
        this.isHost = false;
        this.localPlayer = {
            id: this.playerId,
            name: playerName,
            color: this.getAvailableColor(),
            isImpostor: false,
            isAlive: true,
            x: 400 + Math.random() * 100 - 50,
            y: 300 + Math.random() * 100 - 50
        };

        this.players.set(this.playerId, this.localPlayer);
        
        // Simulate existing players in room
        this.simulateExistingPlayers();
        
        this.switchToGame();
        this.addChatMessage('System', `Joined room: ${this.roomCode}`, 'system');
        document.getElementById('startGameBtn').disabled = !this.isHost;
    }

    simulateExistingPlayers() {
        // Simulate 1-3 other players already in room
        const numPlayers = Math.floor(Math.random() * 3) + 1;
        const botNames = ['Alex', 'Sam', 'Jordan', 'Casey', 'Morgan'];
        
        for (let i = 0; i < numPlayers; i++) {
            const botPlayer = {
                id: `bot_${i}`,
                name: botNames[i],
                color: this.getAvailableColor(),
                isImpostor: false,
                isAlive: true,
                x: 400 + Math.random() * 200 - 100,
                y: 300 + Math.random() * 200 - 100
            };
            
            this.players.set(botPlayer.id, botPlayer);
            this.bots.push(botPlayer);
        }
    }

    addBot() {
        if (this.players.size >= 10) {
            this.showNotification('Room is full!');
            return;
        }

        const botNames = ['Alex', 'Sam', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Riley', 'Avery'];
        const availableNames = botNames.filter(name => 
            !Array.from(this.players.values()).some(p => p.name === name)
        );

        if (availableNames.length === 0) return;

        const botPlayer = {
            id: `bot_${Date.now()}`,
            name: availableNames[0],
            color: this.getAvailableColor(),
            isImpostor: false,
            isAlive: true,
            x: 400 + Math.random() * 200 - 100,
            y: 300 + Math.random() * 200 - 100
        };

        this.players.set(botPlayer.id, botPlayer);
        this.bots.push(botPlayer);
        
        this.updatePlayerList();
        this.addChatMessage('System', `${botPlayer.name} joined the room`, 'system');

        // Simulate bot movement
        this.startBotMovement(botPlayer);
    }

    startBotMovement(bot) {
        setInterval(() => {
            if (this.gameState !== 'playing' || !bot.isAlive) return;

            // Random movement
            bot.x += (Math.random() - 0.5) * 4;
            bot.y += (Math.random() - 0.5) * 4;

            // Keep in bounds
            bot.x = Math.max(50, Math.min(this.canvas.width - 50, bot.x));
            bot.y = Math.max(50, Math.min(this.canvas.height - 50, bot.y));
        }, 100);
    }

    getAvailableColor() {
        const usedColors = Array.from(this.players.values()).map(p => p.color);
        const allColors = Object.keys(this.colors);
        const availableColors = allColors.filter(color => !usedColors.includes(color));
        return availableColors.length > 0 ? availableColors[0] : 'grey';
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    switchToGame() {
        document.getElementById('menuScreen').classList.add('hidden');
        document.getElementById('gameUI').classList.remove('hidden');
        this.gameState = 'lobby';
        
        document.getElementById('roomCodeDisplay').textContent = this.roomCode;
        document.getElementById('gameStatus').textContent = 'Lobby';
        this.updatePlayerList();
        this.startGameLoop();
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
        if (!this.isHost || this.gameState === 'playing') return;

        if (this.players.size < 2) {
            this.showNotification('Need at least 2 players to start!');
            return;
        }

        this.gameState = 'playing';
        this.selectImpostors();
        this.updatePlayerList();
        
        document.getElementById('gameStatus').textContent = 'Playing';
        document.getElementById('startGameBtn').disabled = true;
        
        if (this.localPlayer.isImpostor) {
            this.addChatMessage('System', 'You are an IMPOSTOR!', 'system', true);
        } else {
            this.addChatMessage('System', 'You are a CREWMATE!', 'system', true);
        }

        this.addChatMessage('System', 'Game started! Find the impostors!', 'system');
    }

    selectImpostors() {
        const numImpostors = Math.max(1, Math.floor(this.players.size / 4));
        const shuffled = [...Array.from(this.players.values())].sort(() => Math.random() - 0.5);
        const impostors = shuffled.slice(0, numImpostors);
        
        this.players.forEach(player => {
            player.isImpostor = impostors.includes(player);
        });
    }

    leaveRoom() {
        this.returnToMenu();
    }

    returnToMenu() {
        this.gameState = 'menu';
        this.roomCode = null;
        this.isHost = false;
        this.players.clear();
        this.bots = [];
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
        
        if (message) {
            this.addChatMessage(this.localPlayer.name, message, 'player');
            input.value = '';
            
            // Simulate bot responses
            if (Math.random() < 0.3) {
                setTimeout(() => {
                    const bot = this.bots[Math.floor(Math.random() * this.bots.length)];
                    if (bot) {
                        const responses = [
                            'I saw someone near medbay!',
                            'Where was everyone?',
                            'I think I know who it is...',
                            'Let\'s vote them out!',
                            'I was doing tasks whole time!',
                            'Anyone see anything suspicious?'
                        ];
                        const response = responses[Math.floor(Math.random() * responses.length)];
                        this.addChatMessage(bot.name, response, 'player');
                    }
                }, 1000 + Math.random() * 2000);
            }
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

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <h3 style="color: #ff6b6b; margin-bottom: 10px;">Notification</h3>
            <p>${message}</p>
            <button onclick="this.parentElement.remove()" style="margin-top: 15px; padding: 10px 20px; background: #ff6b6b; color: white; border: none; border-radius: 5px; cursor: pointer;">OK</button>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
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
        }

        // Update camera to follow local player
        this.camera.x = this.localPlayer.x - this.canvas.width / 2;
        this.camera.y = this.localPlayer.y - this.canvas.height / 2;
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
                    player.isAlive = false;
                    this.addChatMessage('System', `${player.name} was voted out!`, 'system');
                    this.updatePlayerList();
                    
                    // Check win condition
                    this.checkWinCondition();
                }
            }
        });
    }

    checkWinCondition() {
        const aliveImpostors = Array.from(this.players.values()).filter(p => p.isAlive && p.isImpostor);
        const aliveCrewmates = Array.from(this.players.values()).filter(p => p.isAlive && !p.isImpostor);

        if (aliveImpostors.length === 0) {
            this.gameState = 'ended';
            document.getElementById('gameStatus').textContent = 'Crewmates Win!';
            this.addChatMessage('System', 'Game ended! Crewmates win!', 'system');
        } else if (aliveImpostors.length >= aliveCrewmates.length) {
            this.gameState = 'ended';
            document.getElementById('gameStatus').textContent = 'Impostors Win!';
            this.addChatMessage('System', 'Game ended! Impostors win!', 'system');
        }
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new AmongUsBrowserGame();
});
