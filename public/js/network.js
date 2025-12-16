import { UI, showScreen, showNotification, updatePlayerList, getPlayerName, initializeNamePlaceholder } from './ui-manager.js';

export class NetworkManager {
    constructor(audioManager, sceneManager) {
        this.socket = io();
        this.audioManager = audioManager;
        this.sceneManager = sceneManager;
        this.gameState = {
            roomCode: null,
            playerName: null,
            players: [],
            isHost: false,
            localPlayerId: null,
            gameStarted: false
        };
        
        // Initialize random name placeholder
        initializeNamePlaceholder();
        
        this.setupSocketEvents();
        this.setupUIEvents();
    }
    
    setupSocketEvents() {
        this.socket.on('connect', () => {
            console.log('🔌 Connected to server:', this.socket.id);
            this.gameState.localPlayerId = this.socket.id;
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            showNotification('Disconnected from server');
        });

        this.socket.on('room-created', (data) => {
            this.gameState.roomCode = data.roomCode;
            this.gameState.players = data.players;
            this.gameState.isHost = true;
            
            UI.elements.displayRoomCode.textContent = data.roomCode;
            updatePlayerList(data.players, this.socket.id);
            showScreen('lobby', this.audioManager);
            showNotification('Room created successfully!');
        });

        this.socket.on('player-joined', (data) => {
            this.gameState.players = data.players;
            updatePlayerList(data.players, this.socket.id);
            showNotification(`${data.newPlayer.name} joined the room`);
            this.audioManager.playSfx(UI.audio.playerJoinedSfx);
        });

        this.socket.on('join-error', (data) => {
            showNotification(data.message);
        });

        this.socket.on('player-left', (data) => {
            this.gameState.players = data.players;
            updatePlayerList(data.players, this.socket.id);
            this.audioManager.playSfx(UI.audio.playerLeftSfx);
            
            const localPlayer = data.players.find(p => p.id === this.socket.id);
            if (localPlayer) {
                this.gameState.isHost = localPlayer.isHost;
            }
            
            if (this.gameState.gameStarted && this.sceneManager) {
                this.sceneManager.removePlayerBall(data.playerId);
            }
        });

        this.socket.on('game-started', (data) => {
            console.log('🎮 game-started event received:', data);
            console.log('🗺️ mapData in event:', data.mapData);
            this.gameState.gameStarted = true;
            this.gameState.players = data.players;
            showScreen('game', this.audioManager);
            
            if (this.sceneManager) {
                // Pass map data to scene manager
                console.log('🗺️ About to call initGame with mapData:', data.mapData);
                this.sceneManager.initGame(this.gameState.players, this.socket.id, this.socket, this.audioManager, data.mapData);
            }
            
            const mapName = data.mapData ? data.mapData.name : 'Default Map';
            showNotification(`Game started! Playing: ${mapName}`);
        });

        this.socket.on('player-moved', (data) => {
            // console.log('📍 Player moved:', data.playerId, 'to', data.position);
            if (this.sceneManager) {
                this.sceneManager.updateRemotePlayerPosition(data.playerId, data.position, data.rotation);
            }
        });

        this.socket.on('player-shot-made', (data) => {
            console.log('Player shot:', data);
        });
        
        this.socket.on('player-scored', (data) => {
            console.log('🎉 Player scored:', data.playerId);
            // Show confetti for all clients
            if (this.sceneManager && data.position) {
                this.sceneManager.createConfetti(data.position);
                
                // Add player to scored set
                this.sceneManager.playersScored.add(data.playerId);
                
                // Check if all players finished
                this.sceneManager.checkGameCompletion();
                
                // Play score sound only if it's not the local player (they already heard it)
                if (data.playerId !== this.socket.id && this.audioManager) {
                    this.audioManager.playScoreSound();
                }
            }
        });

        this.socket.on('powerup-collected', (data) => {
            console.log('💎 Powerup collected by player:', data.playerId, 'ID:', data.powerupId);
            // Remove powerup for all clients
            if (this.sceneManager && this.sceneManager.powerupManager) {
                // Only remove visually if another player collected it
                if (data.playerId !== this.socket.id) {
                    this.sceneManager.powerupManager.removePowerupById(data.powerupId);
                }
            }
        });

        this.socket.on('powerup-applied', (data) => {
            console.log('✨ Powerup applied:', data.powerupType.name, 'to', data.targetPlayerId);
            
            // Apply the effect to the target player
            if (this.sceneManager && this.sceneManager.physicsManager) {
                // If target is local player, mark the powerup as ready
                if (data.targetPlayerId === this.socket.id) {
                    this.sceneManager.powerupManager.activePowerup = data.powerupType;
                }
                
                // Add to active effects display for all clients
                this.sceneManager.powerupManager.addActiveEffect(data.targetPlayerId, data.powerupType);
            }
        });
    }
    
    setupUIEvents() {
        // Main Menu
        UI.buttons.createRoom.addEventListener('click', () => {
            const playerName = getPlayerName();
            this.gameState.playerName = playerName;
            this.socket.emit('create-room', { playerName });
        });

        UI.buttons.joinRoom.addEventListener('click', () => {
            showScreen('joinRoom', this.audioManager);
        });

        // Join Room Screen
        UI.buttons.joinConfirm.addEventListener('click', () => {
            const roomCode = UI.elements.roomCodeInput.value.trim().toUpperCase();
            const playerName = getPlayerName();
            
            if (roomCode.length !== 6) {
                showNotification('Please enter a valid 6-digit room code');
                return;
            }
            
            this.gameState.playerName = playerName;
            this.socket.emit('join-room', { roomCode, playerName });
            showScreen('lobby', this.audioManager);
        });

        UI.buttons.joinBack.addEventListener('click', () => {
            showScreen('mainMenu', this.audioManager);
        });

        // Lobby
        UI.buttons.startGame.addEventListener('click', async () => {
            // Host selects map before starting
            if (this.gameState.isHost) {
                const mapName = await this.showMapSelection();
                if (mapName !== undefined) { // Allow null for default map
                    this.socket.emit('start-game', { mapName });
                }
                // If undefined, user cancelled
            } else {
                this.socket.emit('start-game');
            }
        });

        UI.buttons.leaveRoom.addEventListener('click', () => {
            this.socket.emit('leave-room');
            this.gameState.roomCode = null;
            this.gameState.players = [];
            this.gameState.isHost = false;
            showScreen('mainMenu', this.audioManager);
        });

        // Game Controls
        UI.buttons.camera.addEventListener('click', () => {
            if (this.sceneManager) {
                this.sceneManager.cycleCamera();
            }
        });

        // Scoreboard Toggle
        UI.buttons.scoreboardToggle.addEventListener('click', () => {
            UI.elements.scoreboardPanel.classList.toggle('show');
        });
    }
    
    async showMapSelection() {
        return new Promise(async (resolve) => {
            const modal = document.getElementById('map-selection-modal');
            const list = document.getElementById('map-selection-list');
            const cancelBtn = document.getElementById('map-selection-cancel');
            
            // Fetch available maps
            try {
                const response = await fetch('/api/maps');
                const maps = await response.json();
                
                list.innerHTML = '';
                
                // Add default map option
                const defaultItem = document.createElement('div');
                defaultItem.className = 'map-selection-item';
                defaultItem.innerHTML = `
                    <div class="map-selection-item-name">🏌️ Default Map</div>
                    <div class="map-selection-item-info">Classic golf course layout</div>
                `;
                defaultItem.addEventListener('click', () => {
                    modal.style.display = 'none';
                    resolve(null);
                });
                list.appendChild(defaultItem);
                
                // Add custom maps
                maps.forEach(map => {
                    const item = document.createElement('div');
                    item.className = 'map-selection-item';
                    
                    const date = new Date(map.lastModified).toLocaleDateString();
                    item.innerHTML = `
                        <div class="map-selection-item-name">🗺️ ${map.name}</div>
                        <div class="map-selection-item-info">Last modified: ${date}</div>
                    `;
                    
                    item.addEventListener('click', () => {
                        modal.style.display = 'none';
                        resolve(map.name);
                    });
                    
                    list.appendChild(item);
                });
                
                modal.style.display = 'flex';
                
                // Cancel button
                const onCancel = () => {
                    modal.style.display = 'none';
                    cancelBtn.removeEventListener('click', onCancel);
                    resolve(null);
                };
                cancelBtn.addEventListener('click', onCancel);
                
            } catch (error) {
                console.error('Error loading maps:', error);
                showNotification('Error loading maps');
                resolve(null);
            }
        });
    }
    
    getGameState() {
        return this.gameState;
    }
    
    getSocket() {
        return this.socket;
    }
}
