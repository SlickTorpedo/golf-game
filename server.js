const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure maps directory exists
const MAPS_DIR = path.join(__dirname, 'maps');
fs.mkdir(MAPS_DIR, { recursive: true }).catch(console.error);

// Game state management
const rooms = new Map();
const playerRooms = new Map(); // Track which room each player is in

// Generate random 6-character room code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Check if code already exists
    if (rooms.has(code)) {
        return generateRoomCode();
    }
    return code;
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Create room
    socket.on('create-room', async (data) => {
        const { playerName } = data;
        const roomCode = generateRoomCode();
        
        const room = {
            code: roomCode,
            host: socket.id,
            players: [{
                id: socket.id,
                name: playerName,
                isHost: true,
                position: { x: 0, y: 0.5, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                score: 0,
                strokes: 0
            }],
            gameStarted: false,
            currentHole: 1,
            maxPlayers: 4,
            mapData: null // Will be set when game starts
        };
        
        rooms.set(roomCode, room);
        playerRooms.set(socket.id, roomCode);
        socket.join(roomCode);
        
        console.log(`Room ${roomCode} created by ${playerName}`);
        
        socket.emit('room-created', {
            roomCode,
            players: room.players
        });
    });

    // Join room
    socket.on('join-room', (data) => {
        const { roomCode, playerName } = data;
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('join-error', { message: 'Room not found' });
            return;
        }
        
        if (room.players.length >= room.maxPlayers) {
            socket.emit('join-error', { message: 'Room is full' });
            return;
        }
        
        if (room.gameStarted) {
            socket.emit('join-error', { message: 'Game already started' });
            return;
        }
        
        const player = {
            id: socket.id,
            name: playerName,
            isHost: false,
            position: { x: room.players.length * 2, y: 0.5, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            score: 0,
            strokes: 0
        };
        
        room.players.push(player);
        playerRooms.set(socket.id, roomCode);
        socket.join(roomCode);
        
        console.log(`${playerName} joined room ${roomCode}`);
        
        // Notify all players in room
        io.to(roomCode).emit('player-joined', {
            players: room.players,
            newPlayer: player
        });
    });

    // Start game
    socket.on('start-game', async (data) => {
        const roomCode = playerRooms.get(socket.id);
        const room = rooms.get(roomCode);
        
        if (!room || room.host !== socket.id) {
            return;
        }
        
        // Load map if requested (for when host changes map before starting)
        if (data && data.mapName && data.mapName !== room.mapData?.name) {
            try {
                // Find map file by scanning all JSON files for matching name
                const files = await fs.readdir(MAPS_DIR);
                const jsonFiles = files.filter(f => f.endsWith('.json'));
                
                let mapFound = false;
                for (const file of jsonFiles) {
                    const filePath = path.join(MAPS_DIR, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const mapData = JSON.parse(content);
                    
                    if (mapData.name === data.mapName) {
                        room.mapData = mapData;
                        console.log(`Loaded map: ${data.mapName} from file: ${file}`);
                        mapFound = true;
                        break;
                    }
                }
                
                if (!mapFound) {
                    console.error(`Map not found: ${data.mapName}`);
                }
            } catch (error) {
                console.error(`Error loading map ${data.mapName}:`, error);
                // Use existing map or default
            }
        }
        
        room.gameStarted = true;
        
        console.log(`Game started in room ${roomCode} with map: ${room.mapData?.name || 'default'}`);
        
        io.to(roomCode).emit('game-started', {
            players: room.players,
            mapData: room.mapData
        });
    });

    // Update player position
    socket.on('update-position', (data) => {
        const roomCode = playerRooms.get(socket.id);
        const room = rooms.get(roomCode);
        
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.position = data.position;
            player.rotation = data.rotation || player.rotation;
            
            // Broadcast to all other players in room
            socket.to(roomCode).emit('player-moved', {
                playerId: socket.id,
                position: data.position,
                rotation: data.rotation
            });
        }
    });

    // Player shot
    socket.on('player-shot', (data) => {
        const roomCode = playerRooms.get(socket.id);
        const room = rooms.get(roomCode);
        
        if (!room) return;
        
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.strokes++;
            
            // Broadcast shot to all players
            io.to(roomCode).emit('player-shot-made', {
                playerId: socket.id,
                power: data.power,
                direction: data.direction,
                strokes: player.strokes
            });
        }
    });
    
    // Player scored
    socket.on('player-scored', (data) => {
        const roomCode = playerRooms.get(socket.id);
        const room = rooms.get(roomCode);
        
        if (!room) return;
        
        console.log(`Player ${socket.id} scored in room ${roomCode}`);
        
        // Broadcast score to all players in room (including sender for confetti sync)
        io.to(roomCode).emit('player-scored', {
            playerId: socket.id,
            position: data.position
        });
    });

    // Powerup collected
    socket.on('powerup-collected', (data) => {
        const roomCode = playerRooms.get(socket.id);
        const room = rooms.get(roomCode);
        
        if (!room) return;
        
        console.log(`Player ${socket.id} collected powerup ${data.powerupId} in room ${roomCode}`);
        
        // Broadcast to all players in room
        io.to(roomCode).emit('powerup-collected', {
            playerId: socket.id,
            powerupId: data.powerupId
        });
    });

    // Apply powerup to player
    socket.on('apply-powerup', (data) => {
        const roomCode = playerRooms.get(socket.id);
        const room = rooms.get(roomCode);
        
        if (!room) return;
        
        console.log(`Player ${socket.id} applied ${data.powerupType.name} to ${data.targetPlayerId} in room ${roomCode}`);
        
        // Broadcast to all players in room
        io.to(roomCode).emit('powerup-applied', {
            sourcePlayerId: socket.id,
            targetPlayerId: data.targetPlayerId,
            powerupType: data.powerupType
        });
    });

    // Leave room
    socket.on('leave-room', () => {
        handlePlayerLeave(socket);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        handlePlayerLeave(socket);
    });

    function handlePlayerLeave(socket) {
        const roomCode = playerRooms.get(socket.id);
        if (!roomCode) return;
        
        const room = rooms.get(roomCode);
        if (!room) return;
        
        // Remove player from room
        room.players = room.players.filter(p => p.id !== socket.id);
        playerRooms.delete(socket.id);
        socket.leave(roomCode);
        
        console.log(`Player ${socket.id} left room ${roomCode}`);
        
        // If room is empty, delete it
        if (room.players.length === 0) {
            rooms.delete(roomCode);
            console.log(`Room ${roomCode} deleted (empty)`);
        } else {
            // If host left, assign new host
            if (room.host === socket.id) {
                room.host = room.players[0].id;
                room.players[0].isHost = true;
                console.log(`New host for room ${roomCode}: ${room.host}`);
            }
            
            // Notify remaining players
            io.to(roomCode).emit('player-left', {
                players: room.players,
                playerId: socket.id
            });
        }
    }
});

// Map Editor API endpoints
app.post('/api/save-map', async (req, res) => {
    try {
        const mapData = req.body;
        const fileName = `${mapData.name}.json`;
        const filePath = path.join(MAPS_DIR, fileName);
        
        await fs.writeFile(filePath, JSON.stringify(mapData, null, 2));
        console.log(`Map saved: ${fileName}`);
        
        res.json({ success: true, message: 'Map saved successfully' });
    } catch (error) {
        console.error('Error saving map:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/maps', async (req, res) => {
    try {
        const files = await fs.readdir(MAPS_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        const maps = await Promise.all(jsonFiles.map(async (file) => {
            try {
                const filePath = path.join(MAPS_DIR, file);
                const stats = await fs.stat(filePath);
                const content = await fs.readFile(filePath, 'utf8');
                const mapData = JSON.parse(content);
                
                // Use the actual map name from the JSON file
                return {
                    name: mapData.name || file.replace('.json', ''),
                    fileName: file,
                    lastModified: stats.mtime
                };
            } catch (error) {
                console.error(`Error reading map file ${file}:`, error);
                return null;
            }
        }));
        
        // Filter out any null entries from failed reads
        res.json(maps.filter(m => m !== null));
    } catch (error) {
        console.error('Error listing maps:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/map/:name', async (req, res) => {
    try {
        const fileName = `${req.params.name}.json`;
        const filePath = path.join(MAPS_DIR, fileName);
        
        const content = await fs.readFile(filePath, 'utf8');
        const mapData = JSON.parse(content);
        
        res.json(mapData);
    } catch (error) {
        console.error('Error loading map:', error);
        res.status(404).json({ success: false, error: 'Map not found' });
    }
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Map editor available at http://localhost:${PORT}/editor.html`);
});
