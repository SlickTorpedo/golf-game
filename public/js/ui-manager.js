// Random name generator
const adjectives = [
    "swift", "silent", "crimson", "frozen", "golden", "shattered", "wandering", "hidden",
    "ancient", "blazing", "mystic", "electric", "velvet", "iron", "crystal", "shadow",
    "lunar", "cosmic", "wild", "noble", "clever", "brave", "stark", "vivid",
    "pale", "bold", "quiet", "fierce", "gentle", "twisted", "smooth", "rough",
    "sharp", "dull", "bright", "dark", "toxic", "pure", "lost", "found"
];

const nouns = [
    "falcon", "mountain", "river", "storm", "blade", "ember", "phantom", "echo",
    "compass", "raven", "thunder", "whisper", "mirror", "forge", "hunter", "comet",
    "serpent", "fortress", "wolf", "titan", "spark", "horizon", "viper", "orchid",
    "anchor", "prism", "cipher", "nomad", "phoenix", "specter", "glacier", "tempest",
    "oracle", "wraith", "beacon", "pilgrim", "chimera", "obsidian", "atlas", "meteor"
];

function generateRandomName() {
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    // Capitalize first letter of each word
    const capitalizedAdj = adjective.charAt(0).toUpperCase() + adjective.slice(1);
    const capitalizedNoun = noun.charAt(0).toUpperCase() + noun.slice(1);
    return `${capitalizedAdj} ${capitalizedNoun}`;
}

export function getPlayerName() {
    const input = UI.elements.playerNameInput;
    const trimmedValue = input.value.trim();
    return trimmedValue || input.placeholder || 'Player';
}

// UI State Management
export const UI = {
    screens: {
        mainMenu: document.getElementById('main-menu'),
        joinRoom: document.getElementById('join-room-screen'),
        lobby: document.getElementById('lobby-screen'),
        game: document.getElementById('game-screen')
    },
    elements: {
        playerNameInput: document.getElementById('player-name'),
        roomCodeInput: document.getElementById('room-code'),
        displayRoomCode: document.getElementById('display-room-code'),
        playerList: document.getElementById('player-list'),
        playerCount: document.getElementById('player-count'),
        notification: document.getElementById('notification'),
        scoreboardList: document.getElementById('scoreboard-list'),
        currentHole: document.getElementById('current-hole'),
        strokeCount: document.getElementById('stroke-count'),
        parValue: document.getElementById('par-value'),
        turnIndicator: document.getElementById('turn-indicator'),
        cameraMode: document.getElementById('camera-mode'),
        scoreboardPanel: document.getElementById('scoreboard-panel')
    },
    buttons: {
        createRoom: document.getElementById('create-room-btn'),
        joinRoom: document.getElementById('join-room-btn'),
        joinConfirm: document.getElementById('join-confirm-btn'),
        joinBack: document.getElementById('join-back-btn'),
        startGame: document.getElementById('start-game-btn'),
        leaveRoom: document.getElementById('leave-room-btn'),
        camera: document.getElementById('camera-btn'),
        scoreboardToggle: document.getElementById('scoreboard-toggle-btn')
    },
    audio: {
        lobbyMusic: document.getElementById('lobby-music'),
        gameMusic: document.getElementById('game-music'),
        playerJoinedSfx: document.getElementById('player-joined-sfx'),
        playerLeftSfx: document.getElementById('player-left-sfx'),
        ballHitSfx: document.getElementById('ball-hit-sfx'),
        ballWhooshSfx: document.getElementById('ball-whoosh-sfx'),
        scoreSfx: document.getElementById('score-sfx'),
        gameFinishedSfx: document.getElementById('game-finished-sfx'),
        pickupSfx: document.getElementById('pickup-sfx'),
        boostSfx: document.getElementById('boost-sfx'),
        bounceSfx: document.getElementById('bounce-sfx'),
        bumpSfx: document.getElementById('bump-sfx'),
        ballHitVariations: [], // Will be populated with different pitch versions
        proximityAudio: null // Created dynamically for powerup proximity
    },
    volumeControls: {
        toggleBtn: document.getElementById('volume-toggle-btn'),
        panel: document.getElementById('volume-controls'),
        masterSlider: document.getElementById('master-volume'),
        musicSlider: document.getElementById('music-volume'),
        sfxSlider: document.getElementById('sfx-volume'),
        masterValue: document.getElementById('master-volume-value'),
        musicValue: document.getElementById('music-volume-value'),
        sfxValue: document.getElementById('sfx-volume-value')
    }
};

// Screen navigation
export function showScreen(screenName, audioManager) {
    Object.values(UI.screens).forEach(screen => screen.classList.remove('active'));
    UI.screens[screenName].classList.add('active');
    
    // Handle music based on screen
    if (screenName === 'lobby') {
        audioManager.playLobbyMusic();
        audioManager.stopGameMusic();
    } else if (screenName === 'game') {
        audioManager.stopLobbyMusic();
        audioManager.playGameMusic();
    } else {
        audioManager.stopLobbyMusic();
        audioManager.stopGameMusic();
    }
}

// Show notification
export function showNotification(message, duration = 3000) {
    UI.elements.notification.textContent = message;
    UI.elements.notification.classList.add('show');
    setTimeout(() => {
        UI.elements.notification.classList.remove('show');
    }, duration);
}

// Update player list
export function updatePlayerList(players, socketId) {
    UI.elements.playerList.innerHTML = '';
    UI.elements.playerCount.textContent = players.length;
    
    players.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item' + (player.isHost ? ' host' : '');
        playerItem.innerHTML = `
            <span class="player-name">${player.name}</span>
            ${player.isHost ? '<span class="player-badge">HOST</span>' : ''}
        `;
        UI.elements.playerList.appendChild(playerItem);
    });
    
    // Enable start button if current player is host and enough players
    const isCurrentPlayerHost = players.find(p => p.id === socketId)?.isHost;
    UI.buttons.startGame.disabled = !(isCurrentPlayerHost && players.length >= 1);
}

// Update scoreboard
export function updateScoreboard(players) {
    UI.elements.scoreboardList.innerHTML = '';
    
    players.forEach((player, index) => {
        const scoreItem = document.createElement('div');
        scoreItem.className = 'score-item' + (index === 0 ? ' current' : '');
        scoreItem.innerHTML = `
            <span class="player-name">${player.name}</span>
            <span class="score">${player.strokes || 0}</span>
        `;
        UI.elements.scoreboardList.appendChild(scoreItem);
    });
}

// Initialize random name placeholder
export function initializeNamePlaceholder() {
    const randomName = generateRandomName();
    UI.elements.playerNameInput.placeholder = randomName;
}

// Update camera mode display
export function updateCameraMode(mode) {
    UI.elements.cameraMode.textContent = `Camera ${mode}`;
}
