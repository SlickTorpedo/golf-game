import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'https://cdn.skypack.dev/cannon-es';
import { updateScoreboard, updateCameraMode } from './ui-manager.js';
import { ShotMechanics } from './shot-mechanics.js';
import { PhysicsManager } from './physics-manager.js';
import { PowerupManager } from './powerup-manager.js';

export class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.gameInitialized = false;
        
        this.localBall = null;
        this.playerBalls = new Map();
        this.playerColors = [0xffffff, 0xff6b6b, 0x4ecdc4, 0xffe66d];
        
        this.shotMechanics = null;
        this.socket = null;
        this.physicsManager = null;
        this.powerupManager = null;
        this.audioManager = null;
        this.lastTime = performance.now();
        
        // Camera system
        this.cameraMode = 1; // 1 = follow ball, 2 = bird's eye overview
        this.followCameraDistance = 12; // Distance from ball
        this.followCameraHeight = 6; // Height above ball
        this.overviewCameraHeight = 50; // Bird's eye height
        this.cameraTransitioning = false;
        this.targetCameraPosition = new THREE.Vector3();
        this.targetControlsTarget = new THREE.Vector3();
        
        // Game state tracking
        this.playersScored = new Set();
        this.totalPlayers = 0;
        this.localPlayerId = null;
        this.ballGlowLight = null; // Visual indicator for powerup effects
        
        // Multi-hole support
        this.currentHoleIndex = 0;
        this.holes = [];
        this.playerScores = new Map(); // Track strokes per player per hole
        this.isTransitioningLevels = false; // Prevent double level transitions
        this.allowHoleCheck = true; // Prevent hole checking during level transitions
        
        // Multiplayer sync
        this.lastSyncTime = 0;
        this.syncInterval = 50; // Sync every 50ms (20 times per second)
        this.remotePlayerTargets = new Map(); // Target positions for smooth interpolation
        
        // Fan tracking for animation
        this.fans = [];
        
        // Bounce pad tracking for physics
        this.bouncePads = [];
        
        // Bumper tracking for physics
        this.bumpers = [];
        
        // Speed boost tracking for physics
        this.speedBoosts = [];
    }
    

    
    loadHole(holeIndex) {
        if (holeIndex < 0 || holeIndex >= this.holes.length) {
            console.error('Invalid hole index:', holeIndex);
            return;
        }
        
        const hole = this.holes[holeIndex];
        console.log(`⛳ Loading Hole ${hole.number} (Par ${hole.par})`);
        
        // Create walls from hole
        if (hole.walls) {
            hole.walls.forEach(wall => {
                this.physicsManager.createWall(wall.position, wall.size, wall.rotationY || 0, wall.color);
            });
        }
        
        // Create ramps from hole
        if (hole.ramps) {
            hole.ramps.forEach(ramp => {
                this.physicsManager.createRamp(ramp.position, ramp.size, ramp.rotationY, ramp.angle, ramp.color);
            });
        }
        
        // Create fans from hole
        if (hole.fans) {
            hole.fans.forEach(fan => {
                this.createFan(fan.position, fan.rotationY || 0, fan.angle || 0, fan.strength || 10);
            });
        }
        
        // Create bounce pads from hole
        if (hole.bouncePads) {
            hole.bouncePads.forEach(pad => {
                this.createBouncePad(pad.position, pad.rotationY || 0, pad.strength || 20);
            });
        }
        
        // Create bumpers from hole
        if (hole.bumpers) {
            hole.bumpers.forEach(bumper => {
                this.createBumper(bumper.position, bumper.rotationY || 0, bumper.strength || 15);
            });
        }
        
        // Create speed boosts from hole
        if (hole.speedBoosts) {
            hole.speedBoosts.forEach(boost => {
                this.createSpeedBoost(boost.position, boost.rotationY || 0, boost.strength || 50);
            });
        }
        
        // Create hole
        this.createHole(hole.hole);
        
        // Update UI
        const holeElement = document.getElementById('current-hole');
        const parElement = document.getElementById('par-value');
        if (holeElement) holeElement.textContent = hole.number;
        if (parElement) parElement.textContent = hole.par;
    }
    
    loadDefaultHole() {
        console.log('🗺️ Using default hole');
        // Add some obstacles inside
        this.physicsManager.createWall({ x: 10, y: 1, z: 10 }, { x: 4, y: 2, z: 4 });
        this.physicsManager.createWall({ x: -15, y: 1, z: -15 }, { x: 3, y: 2, z: 6 });
        this.physicsManager.createWall({ x: -10, y: 1, z: 15 }, { x: 5, y: 2, z: 2 });
        
        // Add ramps
        this.physicsManager.createRamp({ x: 15, y: 0.3, z: -5 }, { x: 8, y: 0.5, z: 6 }, 90, 20);
        this.physicsManager.createRamp({ x: -20, y: 0.4, z: 0 }, { x: 10, y: 0.5, z: 8 }, 0, 25);
        this.physicsManager.createRamp({ x: 0, y: 0.3, z: -20 }, { x: 6, y: 0.5, z: 10 }, 180, 15);
        this.physicsManager.createRamp({ x: -5, y: 0.5, z: -10 }, { x: 8, y: 0.5, z: 5 }, 270, 30);
        
        // Create hole
        this.createHole({ x: 25, y: 0, z: -25, radius: 1.2 });
        
        // Update UI
        const holeElement = document.getElementById('current-hole');
        const parElement = document.getElementById('par-value');
        if (holeElement) holeElement.textContent = 1;
        if (parElement) parElement.textContent = 3;
    }
    
    initGame(players, localPlayerId, socket, audioManager, mapData = null) {
        if (this.gameInitialized) return;
        this.gameInitialized = true;
        this.socket = socket;
        this.audioManager = audioManager;
        this.totalPlayers = players.length;
        this.localPlayerId = localPlayerId;
        
        // Set map data (expecting new multi-level format)
        this.mapData = mapData;
        this.holes = mapData?.levels || mapData?.holes || [];
        this.currentHoleIndex = 0;
        
        // If no map data provided, log error but continue with default
        if (!mapData || this.holes.length === 0) {
            console.warn('⚠️ No map data provided or empty levels, will use default hole');
        }
        
        // Initialize player scores
        players.forEach(player => {
            this.playerScores.set(player.id, {
                name: player.name,
                holeStrokes: [], // Strokes per hole
                totalStrokes: 0
            });
        });
        
        console.log('🎮 Initializing game with', players.length, 'players');
        console.log('🗺️ Map:', this.mapData?.name || 'Default');
        console.log(`⛳ Course has ${this.holes.length} hole(s)`);
        const container = document.getElementById('game-canvas');
        
        if (!container) {
            console.error('❌ Game canvas container not found!');
            return;
        }
        
        // Scene with space background
        console.log('🎨 Creating Three.js scene');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0e27); // Deep space blue
        this.scene.fog = new THREE.Fog(0x0a0e27, 80, 250);
        
        // Physics
        console.log('⚙️ Creating physics manager');
        this.physicsManager = new PhysicsManager(this.scene, this.audioManager);
        this.physicsManager.sceneManager = this; // Give physics access to fans
        
        // Powerups
        console.log('💎 Creating powerup manager');
        this.powerupManager = new PowerupManager(this.scene, this.audioManager);
        this.powerupManager.setSocket(socket);
        this.powerupManager.setPlayers(players, localPlayerId);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        // Start in follow mode, will be positioned after ball creation
        this.camera.position.set(0, this.followCameraHeight, this.followCameraDistance);
        
        // High quality renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = false; // No shadows for performance
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.LinearToneMapping;
        this.renderer.toneMappingExposure = 1.4; // Brighter, more vibrant
        container.appendChild(this.renderer.domElement);
        
        // Controls
        console.log('🎮 Setting up orbit controls');
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = false; // Disable panning (X/Y movement)
        this.controls.minDistance = 5;
        this.controls.maxDistance = 30;
        this.controls.maxPolarAngle = Math.PI / 2.2; // Don't go below ground
        this.controls.minPolarAngle = Math.PI / 6; // Don't get too flat
        this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
        
        // Configure mouse buttons: right-click for rotation, middle for zoom
        this.controls.mouseButtons = {
            LEFT: null,  // Disable left-click
            MIDDLE: THREE.MOUSE.DOLLY,  // Middle button for zoom
            RIGHT: THREE.MOUSE.ROTATE   // Right-click for rotation
        };
        
        this.controls.enabled = false; // Start disabled, enable on right-click
        
        // Stylized lighting setup - arcade look with depth but no shadows
        console.log('💡 Setting up stylized lighting');
        
        // Ambient light for base illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        this.scene.add(ambientLight);
        
        // Strong directional light from above-front for cartoon shading
        const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
        mainLight.position.set(5, 50, 20);
        this.scene.add(mainLight);
        
        // Side fill light for better form definition
        const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
        fillLight.position.set(-30, 30, -10);
        this.scene.add(fillLight);
        
        // Back light for rim lighting effect
        const backLight = new THREE.DirectionalLight(0xffffff, 0.8);
        backLight.position.set(0, 20, -30);
        this.scene.add(backLight);
        
        // Create space environment with stars, asteroids, and characters
        console.log('🌌 Creating space environment');
        this.createSpaceEnvironment();
        
        // Ground - plane with checkered pattern
        console.log('🌱 Creating ground plane');
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x5cb85c, // Brighter, more saturated green
            map: this.createCheckeredTexture(0x5cb85c)
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        this.ground = ground; // Store reference for later color updates
        this.scene.add(ground);
        
        // Create physics ground (will be updated with hole position later)
        this.physicsManager.createGroundBody();
        
        // Create perimeter walls around entire play area
        console.log('🧱 Creating boundary walls');
        const wallHeight = 4;
        const wallThickness = 1;
        const playAreaSize = 100; // Match ground plane size
        const halfSize = playAreaSize / 2;
        
        // North wall (back)
        this.physicsManager.createWall(
            { x: 0, y: wallHeight / 2, z: -halfSize },
            { x: playAreaSize, y: wallHeight, z: wallThickness },
            0, 0x8b4513, true
        );
        
        // South wall (front)
        this.physicsManager.createWall(
            { x: 0, y: wallHeight / 2, z: halfSize },
            { x: playAreaSize, y: wallHeight, z: wallThickness },
            0, 0x8b4513, true
        );
        
        // West wall (left)
        this.physicsManager.createWall(
            { x: -halfSize, y: wallHeight / 2, z: 0 },
            { x: wallThickness, y: wallHeight, z: playAreaSize },
            0, 0x8b4513, true
        );
        
        // East wall (right)
        this.physicsManager.createWall(
            { x: halfSize, y: wallHeight / 2, z: 0 },
            { x: wallThickness, y: wallHeight, z: playAreaSize },
            0, 0x8b4513, true
        );
        
        // Load the first hole
        if (this.holes.length > 0) {
            this.loadHole(this.currentHoleIndex);
        } else {
            console.log('🗺️ No holes in map, using default');
            this.loadDefaultHole();
        }
        
        this.applyMapSettings();
        
        // Get current hole data for ball placement and powerups
        const currentHole = this.holes[this.currentHoleIndex];
        
        // Create balls for all players
        console.log('⚽ Creating player balls');
        const startPoint = currentHole?.startPoint || { x: 0, y: 3, z: 30 };
        players.forEach((player, index) => {
            // Position players at start point with slight offset for multiple players
            const position = {
                x: startPoint.x + (index * 2) - (players.length - 1),
                y: startPoint.y || 3,
                z: startPoint.z + (index * 0.5)
            };
            this.createPlayerBall(player.id, position, index, localPlayerId);
        });
        
        // Set initial camera position (Camera 1: Follow ball)
        if (this.localBall) {
            const ballPos = this.localBall.position;
            this.camera.position.set(
                ballPos.x,
                ballPos.y + this.followCameraHeight,
                ballPos.z + this.followCameraDistance
            );
            this.controls.target.copy(ballPos);
            this.controls.update();
        }
        

        
        // Setup shot mechanics
        this.shotMechanics = new ShotMechanics(
            this.scene, 
            this.camera, 
            this.renderer, 
            this.controls,
            this.localBall,
            socket,
            window.audioManager,
            this.physicsManager,
            this.powerupManager
        );
        
        // Handle window resize
        // Store resize handler so we can remove it later
        this.resizeHandler = () => this.onWindowResize();
        window.addEventListener('resize', this.resizeHandler);
        
        // Update UI
        console.log('📊 Updating initial scoreboard with', players.length, 'players');
        updateScoreboard(players);
        
        // Spawn powerups
        console.log('💎 Spawning powerups');
        const powerupPositions = currentHole?.powerupSpawns?.map(spawn => spawn.position) || null;
        this.powerupManager.spawnPowerups(powerupPositions);
        
        // Start animation loop
        console.log('🎬 Starting animation loop');
        this.animate();
        
        console.log('✅ Game initialization complete!');
    }
    
    createPlayerBall(playerId, position, colorIndex, localPlayerId) {
        const ballGeometry = new THREE.SphereGeometry(0.5, 64, 64);
        const ballMaterial = new THREE.MeshStandardMaterial({ 
            color: this.playerColors[colorIndex % this.playerColors.length],
            roughness: 0.3,
            metalness: 0.15,
            envMapIntensity: 0.5
        });
        const ball = new THREE.Mesh(ballGeometry, ballMaterial);
        ball.position.set(position.x, position.y, position.z);
        ball
        ball
        
        // Add stripe pattern to make rolling visible
        const stripeGeometry = new THREE.TorusGeometry(0.5, 0.05, 16, 64);
        const stripeMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 0.4,
            metalness: 0.1
        });
        const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe.rotation.x = Math.PI / 2;
        ball.add(stripe);
        
        // Add another stripe perpendicular
        const stripe2 = stripe.clone();
        stripe2.rotation.y = Math.PI / 2;
        ball.add(stripe2);
        
        this.scene.add(ball);
        
        // Only create physics body for LOCAL player - remote players are visual only
        if (playerId === localPlayerId) {
            this.physicsManager.createBallBody(ball, 1);
            this.localBall = ball;
            if (this.shotMechanics) {
                this.shotMechanics.setLocalBall(ball);
            }
            
            // Add point light for powerup visual effects (initially off)
            this.ballGlowLight = new THREE.PointLight(0xffffff, 0, 3);
            this.ballGlowLight.visible = false;
            ball.add(this.ballGlowLight);
        }
        
        this.playerBalls.set(playerId, ball);
        
        return ball;
    }
    
    createSpaceEnvironment() {
        this.spaceObjects = [];
        
        // Create starfield - lots of twinkling stars
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 500;
        const starPositions = new Float32Array(starCount * 3);
        const starSizes = new Float32Array(starCount);
        
        for (let i = 0; i < starCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const height = (Math.random() - 0.5) * 100 + 30;
            const distance = 60 + Math.random() * 80;
            
            starPositions[i * 3] = Math.cos(angle) * distance;
            starPositions[i * 3 + 1] = height;
            starPositions[i * 3 + 2] = Math.sin(angle) * distance;
            starSizes[i] = Math.random() * 2 + 0.5;
        }
        
        starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
        
        const starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.5,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });
        
        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.stars);
        this.spaceObjects.push({ mesh: this.stars, type: 'stars' });
        
        // Create asteroids - various sizes rotating
        const asteroidCount = 12;
        for (let i = 0; i < asteroidCount; i++) {
            const size = Math.random() * 2 + 1;
            const geometry = new THREE.DodecahedronGeometry(size, 0);
            const material = new THREE.MeshStandardMaterial({
                color: 0x8b7355,
                roughness: 1.0,
                metalness: 0
            });
            const asteroid = new THREE.Mesh(geometry, material);
            
            const angle = (i / asteroidCount) * Math.PI * 2;
            const distance = 70 + Math.random() * 30;
            const height = (Math.random() - 0.5) * 40 + 25;
            
            asteroid.position.set(
                Math.cos(angle) * distance,
                height,
                Math.sin(angle) * distance
            );
            
            asteroid.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            this.scene.add(asteroid);
            this.spaceObjects.push({
                mesh: asteroid,
                type: 'asteroid',
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 0.02,
                    y: (Math.random() - 0.5) * 0.02,
                    z: (Math.random() - 0.5) * 0.02
                }
            });
        }
        
        // Create fun floating characters
        const characters = [
            { emoji: '👽', color: 0x00ff00 },
            { emoji: '🚀', color: 0xff6b6b },
            { emoji: '🛸', color: 0x4ecdc4 },
            { emoji: '🌙', color: 0xffe66d },
            { emoji: '🪐', color: 0xff9ff3 },
            { emoji: '👾', color: 0xb388ff },
            { emoji: '🌟', color: 0xffd700 },
            { emoji: '☄️', color: 0xff5252 }
        ];
        
        characters.forEach((char, i) => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            ctx.font = '100px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(char.emoji, 64, 64);
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ 
                map: texture,
                transparent: true
            });
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(4, 4, 1);
            
            const angle = (i / characters.length) * Math.PI * 2;
            const distance = 65 + Math.random() * 25;
            const height = (Math.random() - 0.5) * 60 + 30;
            
            sprite.position.set(
                Math.cos(angle) * distance,
                height,
                Math.sin(angle) * distance
            );
            
            this.scene.add(sprite);
            this.spaceObjects.push({
                mesh: sprite,
                type: 'character',
                baseY: height,
                bobSpeed: 0.5 + Math.random() * 1.5,
                bobAmount: 2 + Math.random() * 3,
                rotationSpeed: (Math.random() - 0.5) * 0.01,
                orbitSpeed: (Math.random() - 0.5) * 0.0003,
                orbitRadius: distance,
                orbitAngle: angle
            });
        });
        
        // Add some colored nebula clouds
        const cloudCount = 8;
        for (let i = 0; i < cloudCount; i++) {
            const geometry = new THREE.SphereGeometry(8 + Math.random() * 5, 16, 16);
            const colors = [0xff69b4, 0x9370db, 0x00ced1, 0xff6347, 0x7fff00];
            const material = new THREE.MeshBasicMaterial({
                color: colors[i % colors.length],
                transparent: true,
                opacity: 0.15,
                side: THREE.BackSide
            });
            const cloud = new THREE.Mesh(geometry, material);
            
            const angle = (i / cloudCount) * Math.PI * 2;
            const distance = 80 + Math.random() * 40;
            const height = (Math.random() - 0.5) * 50 + 20;
            
            cloud.position.set(
                Math.cos(angle) * distance,
                height,
                Math.sin(angle) * distance
            );
            
            this.scene.add(cloud);
            this.spaceObjects.push({
                mesh: cloud,
                type: 'nebula',
                pulseSpeed: 0.5 + Math.random(),
                basescale: 1
            });
        }
    }
    
    updateSpaceEnvironment(deltaTime) {
        if (!this.spaceObjects) return;
        
        const time = Date.now() * 0.001;
        
        this.spaceObjects.forEach(obj => {
            if (obj.type === 'asteroid') {
                // Rotate asteroids
                obj.mesh.rotation.x += obj.rotationSpeed.x;
                obj.mesh.rotation.y += obj.rotationSpeed.y;
                obj.mesh.rotation.z += obj.rotationSpeed.z;
            } else if (obj.type === 'character') {
                // Bob up and down
                obj.mesh.position.y = obj.baseY + Math.sin(time * obj.bobSpeed) * obj.bobAmount;
                
                // Slight rotation
                obj.mesh.material.rotation += obj.rotationSpeed;
                
                // Orbit around the map
                obj.orbitAngle += obj.orbitSpeed;
                obj.mesh.position.x = Math.cos(obj.orbitAngle) * obj.orbitRadius;
                obj.mesh.position.z = Math.sin(obj.orbitAngle) * obj.orbitRadius;
            } else if (obj.type === 'nebula') {
                // Pulse nebula clouds
                const pulse = 1 + Math.sin(time * obj.pulseSpeed) * 0.2;
                obj.mesh.scale.set(pulse, pulse, pulse);
            } else if (obj.type === 'stars') {
                // Gentle twinkle effect
                obj.mesh.material.opacity = 0.6 + Math.sin(time * 2) * 0.2;
            }
        });
    }
    
    createCheckeredTexture(baseColor) {
        // Create a canvas for the checkered pattern
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Convert hex color to RGB
        const color = new THREE.Color(baseColor);
        const r = Math.floor(color.r * 255);
        const g = Math.floor(color.g * 255);
        const b = Math.floor(color.b * 255);
        
        // Create darker version (multiply by 0.85 for subtle effect)
        const r2 = Math.floor(r * 0.85);
        const g2 = Math.floor(g * 0.85);
        const b2 = Math.floor(b * 0.85);
        
        const lightColor = `rgb(${r}, ${g}, ${b})`;
        const darkColor = `rgb(${r2}, ${g2}, ${b2})`;
        
        // Draw checkerboard pattern (8x8 grid = 32x32 pixel squares)
        const squareSize = 32;
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? lightColor : darkColor;
                ctx.fillRect(x * squareSize, y * squareSize, squareSize, squareSize);
            }
        }
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(10, 10); // Repeat 10 times across the 100x100 ground
        
        return texture;
    }
    
    createWallTexture(baseColor) {
        // Create a canvas for subtle randomized pattern
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Convert hex color to RGB
        const color = new THREE.Color(baseColor);
        const r = Math.floor(color.r * 255);
        const g = Math.floor(color.g * 255);
        const b = Math.floor(color.b * 255);
        
        // Base color
        const baseColorStr = `rgb(${r}, ${g}, ${b})`;
        ctx.fillStyle = baseColorStr;
        ctx.fillRect(0, 0, 256, 256);
        
        // Add subtle randomized checkered accents (spread out)
        const cellSize = 32;
        for (let y = 0; y < 256; y += cellSize) {
            for (let x = 0; x < 256; x += cellSize) {
                // Only draw accent on some cells randomly
                if (Math.random() > 0.6) {
                    // Slightly darker or lighter shade
                    const variation = Math.random() > 0.5 ? 0.92 : 0.85;
                    const r2 = Math.floor(r * variation);
                    const g2 = Math.floor(g * variation);
                    const b2 = Math.floor(b * variation);
                    ctx.fillStyle = `rgb(${r2}, ${g2}, ${b2})`;
                    ctx.fillRect(x, y, cellSize, cellSize);
                }
            }
        }
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        return texture;
    }
    
    applyMapSettings(settings = null) {
        const mapSettings = settings || (this.mapData && this.mapData.settings) || {
            skyColor: 0x87CEEB,
            groundColor: 0x228B22,
            gravity: -30
        };
        
        // Apply sky color
        this.scene.background = new THREE.Color(mapSettings.skyColor);
        if (this.scene.fog) {
            this.scene.fog.color = new THREE.Color(mapSettings.skyColor);
        }
        
        // Apply ground color and update checkered texture
        if (this.ground && this.ground.material) {
            this.ground.material.color = new THREE.Color(mapSettings.groundColor);
            this.ground.material.map = this.createCheckeredTexture(mapSettings.groundColor);
            this.ground.material.needsUpdate = true;
        }
        
        // Apply gravity to physics world
        if (this.physicsManager) {
            this.physicsManager.setGravity(mapSettings.gravity);
        }
        
        console.log('✅ Map settings applied - Sky:', mapSettings.skyColor.toString(16), 'Ground:', mapSettings.groundColor.toString(16), 'Gravity:', mapSettings.gravity);
    }
    
    createFan(position, rotationY = 0, angle = 0, strength = 10) {
        // Create fan group
        const fanGroup = new THREE.Group();
        
        // Housing cylinder
        const housingGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 32);
        const housingMaterial = new THREE.MeshLambertMaterial({ color: 0x404040 });
        const housing = new THREE.Mesh(housingGeometry, housingMaterial);
        housing.rotation.x = Math.PI / 2;
        fanGroup.add(housing);
        
        // Grille - positioned behind the blades
        const grilleGeometry = new THREE.TorusGeometry(1.3, 0.05, 8, 32);
        const grilleMaterial = new THREE.MeshLambertMaterial({ color: 0x606060 });
        const grille = new THREE.Mesh(grilleGeometry, grilleMaterial);
        grille.position.z = 0.2;  // Moved back from 0.3
        fanGroup.add(grille);
        
        // Cross bars - positioned behind the blades
        const crossBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), grilleMaterial);
        crossBar1.position.z = 0.2;  // Moved back from 0.3
        fanGroup.add(crossBar1);
        
        const crossBar2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.1), grilleMaterial);
        crossBar2.position.z = 0.2;  // Moved back from 0.3
        fanGroup.add(crossBar2);
        
        // Spinning blades - now in front of the grille
        const bladesGroup = new THREE.Group();
        const bladeGeometry = new THREE.BoxGeometry(0.15, 1.8, 0.05);
        const bladeMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
        
        for (let i = 0; i < 3; i++) {
            const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
            blade.rotation.z = (i * Math.PI * 2) / 3;
            bladesGroup.add(blade);
        }
        
        bladesGroup.position.z = 0.35;  // Moved forward from 0.15 to be in front
        fanGroup.add(bladesGroup);
        
        // Create particle system
        const particleCount = 30;
        const particleGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        const particleVelocities = [];
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 1.2;
            particlePositions[i * 3] = Math.cos(angle) * radius;
            particlePositions[i * 3 + 1] = Math.sin(angle) * radius;
            particlePositions[i * 3 + 2] = Math.random() * 5;
            particleVelocities.push(Math.random() * 0.5 + 0.5);
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: 0x88ccff,
            size: 0.15,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending
        });
        
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        particles.userData.velocities = particleVelocities;
        fanGroup.add(particles);
        
        // Position and rotate
        fanGroup.position.set(position.x, position.y, position.z);
        fanGroup.rotation.y = (rotationY * Math.PI) / 180;
        fanGroup.rotation.x = (angle * Math.PI) / 180;
        fanGroup.userData.type = 'fan'; // Tag for removal
        
        this.scene.add(fanGroup);
        
        // Store for animation and physics
        this.fans.push({
            group: fanGroup,
            blades: bladesGroup,
            particles: particles,
            strength: strength,
            direction: new THREE.Vector3(0, 0, 1).applyEuler(fanGroup.rotation)
        });
        
        console.log('🌀 Fan created at:', position, 'strength:', strength);
        return fanGroup;
    }
    
    createBouncePad(position, rotationY = 0, strength = 20) {
        const padGroup = new THREE.Group();
        
        // Base platform
        const baseGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.3, 32);
        const baseMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            roughness: 0.8,
            metalness: 0.2
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        padGroup.add(base);
        
        // Bounce surface (green, slightly smaller)
        const surfaceGeometry = new THREE.CylinderGeometry(1.3, 1.3, 0.1, 32);
        const surfaceMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x00ff00,
            roughness: 0.3,
            metalness: 0.1,
            emissive: 0x00ff00,
            emissiveIntensity: 0.2
        });
        const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
        surface.position.y = 0.2;
        padGroup.add(surface);
        
        // Spring indicator lines
        const lineMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.5
        });
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2;
            const line = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.5, 0.1),
                lineMaterial
            );
            line.position.x = Math.cos(angle) * 0.8;
            line.position.z = Math.sin(angle) * 0.8;
            line.position.y = -0.1;
            padGroup.add(line);
        }
        
        padGroup.position.set(position.x, position.y, position.z);
        padGroup.rotation.y = (rotationY * Math.PI) / 180;
        padGroup.userData.type = 'bouncePad'; // Tag for removal
        
        this.scene.add(padGroup);
        
        // Store for physics
        this.bouncePads.push({
            group: padGroup,
            position: position,
            strength: strength,
            radius: 1.5
        });
        
        // Add physics body for collision
        this.physicsManager.createBouncePad(position, strength, 1.5);
        
        console.log('🟢 Bounce pad created at:', position, 'strength:', strength);
        return padGroup;
    }
    
    createBumper(position, rotationY = 0, strength = 15) {
        const bumperGroup = new THREE.Group();
        
        // Base disc
        const baseGeometry = new THREE.CylinderGeometry(1, 1, 0.5, 32);
        const baseMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x990000,
            roughness: 0.5,
            metalness: 0.3
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        bumperGroup.add(base);
        
        // Top ring (glowing)
        const ringGeometry = new THREE.TorusGeometry(0.9, 0.1, 16, 32);
        const ringMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.8,
            roughness: 0.3
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.y = 0.3;
        ring.rotation.x = Math.PI / 2;
        bumperGroup.add(ring);
        
        // Warning stripes
        const stripeMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.3
        });
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI * 2) / 8;
            const stripe = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.6, 0.05),
                stripeMaterial
            );
            stripe.position.x = Math.cos(angle) * 0.8;
            stripe.position.z = Math.sin(angle) * 0.8;
            stripe.rotation.y = angle;
            bumperGroup.add(stripe);
        }
        
        bumperGroup.position.set(position.x, position.y, position.z);
        bumperGroup.rotation.y = (rotationY * Math.PI) / 180;
        bumperGroup.userData.type = 'bumper'; // Tag for removal
        
        this.scene.add(bumperGroup);
        
        // Store for physics
        this.bumpers.push({
            group: bumperGroup,
            position: position,
            strength: strength,
            radius: 1
        });
        
        // Add physics body for collision
        this.physicsManager.createBumper(position, strength, 1);
        
        console.log('🔴 Bumper created at:', position, 'strength:', strength);
        return bumperGroup;
    }
    
    createSpeedBoost(position, rotationY = 0, strength = 50) {
        const boostGroup = new THREE.Group();
        
        // Base pad (bright yellow rectangle)
        const baseGeometry = new THREE.BoxGeometry(1.5, 0.2, 2.5);
        const baseMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.4,
            roughness: 0.3,
            metalness: 0.6
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        boostGroup.add(base);
        
        // Direction arrows (3 simple arrows pointing forward)
        const arrowMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.7
        });
        
        for (let i = 0; i < 3; i++) {
            const zOffset = 0.7 - (i * 0.7); // Top to bottom
            
            // Arrow main line (shaft)
            const shaft = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.05, 0.5),
                arrowMaterial
            );
            shaft.position.y = 0.15;
            shaft.position.z = zOffset;
            boostGroup.add(shaft);
            
            // Left 45-degree piece (arrow head left side)
            const leftPiece = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.05, 0.25),
                arrowMaterial
            );
            leftPiece.rotation.y = -Math.PI / 4; // -45 degrees
            leftPiece.position.y = 0.15;
            leftPiece.position.x = -0.09;
            leftPiece.position.z = zOffset - 0.34;
            boostGroup.add(leftPiece);
            
            // Right 45-degree piece (arrow head right side)
            const rightPiece = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.05, 0.25),
                arrowMaterial
            );
            rightPiece.rotation.y = Math.PI / 4; // 45 degrees
            rightPiece.position.y = 0.15;
            rightPiece.position.x = 0.09;
            rightPiece.position.z = zOffset - 0.34;
            boostGroup.add(rightPiece);
        }
        
        boostGroup.position.set(position.x, position.y, position.z);
        boostGroup.rotation.y = (rotationY * Math.PI) / 180;
        boostGroup.userData.type = 'speedBoost'; // Tag for removal
        
        this.scene.add(boostGroup);
        
        // Store for physics
        this.speedBoosts.push({
            group: boostGroup,
            position: position,
            strength: strength,
            rotationY: rotationY
        });
        
        // Add physics body for collision
        this.physicsManager.createSpeedBoost(position, strength, rotationY, 0.8);
        
        console.log('⚡ Speed boost created at:', position, 'strength:', strength, 'direction:', rotationY);
        return boostGroup;
    }
    
    createHole(position) {
        const holeRadius = 1.2;
        const holeDepth = 0.8;
        const slopeFunnelDepth = 0.5;
        
        // Black circle at ground level to show the hole opening
        const holeOpeningGeometry = new THREE.CircleGeometry(holeRadius, 32);
        const holeOpeningMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x000000,
            roughness: 1.0
        });
        const holeOpening = new THREE.Mesh(holeOpeningGeometry, holeOpeningMaterial);
        holeOpening.rotation.x = -Math.PI / 2;
        holeOpening.position.set(position.x, position.y + 0.01, position.z);
        holeOpening.userData.type = 'hole-visual';
        this.scene.add(holeOpening);
        
        // Thin rim ring around hole edge
        const rimGeometry = new THREE.RingGeometry(holeRadius - 0.02, holeRadius + 0.08, 32);
        const rimMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2a2a2a,
            roughness: 0.7
        });
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.rotation.x = -Math.PI / 2;
        rim.position.set(position.x, position.y + 0.02, position.z);
        rim.userData.type = 'hole-visual';
        this.scene.add(rim);
        
        // Sloped funnel/cup leading into hole - solid cylinder with slope
        const funnelTopRadius = holeRadius;
        const funnelBottomRadius = holeRadius * 0.65;
        const funnelGeometry = new THREE.CylinderGeometry(funnelBottomRadius, funnelTopRadius, slopeFunnelDepth, 32);
        const funnelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1a4d1a,
            roughness: 1.0
        });
        const funnel = new THREE.Mesh(funnelGeometry, funnelMaterial);
        funnel.position.set(position.x, position.y - slopeFunnelDepth/2, position.z);
        funnel.userData.type = 'hole-visual';
        this.scene.add(funnel);
        
        // NO PHYSICS for funnel or flag - let the ball roll through freely!
        
        // Create ground cutout for hole so ball can actually fall through
        this.physicsManager.createGroundWithHole(position, holeRadius);
        
        // Dark cylinder for deep hole interior
        const holeGeometry = new THREE.CylinderGeometry(funnelBottomRadius * 0.95, funnelBottomRadius * 0.95, holeDepth, 32);
        const holeMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x0a0a0a,
            roughness: 1.0
        });
        const hole = new THREE.Mesh(holeGeometry, holeMaterial);
        hole.position.set(position.x, position.y - slopeFunnelDepth - holeDepth/2, position.z);
        hole.userData.type = 'hole-visual';
        this.scene.add(hole);
        
        // Create visible hole bottom
        const holeBottomY = position.y - slopeFunnelDepth - holeDepth;
        const bottomGeometry = new THREE.CircleGeometry(funnelBottomRadius * 0.9, 32);
        const bottomMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a,
            roughness: 0.9
        });
        const bottom = new THREE.Mesh(bottomGeometry, bottomMaterial);
        bottom.rotation.x = -Math.PI / 2;
        bottom.position.set(position.x, holeBottomY + 0.02, position.z);
        bottom.userData.type = 'hole-visual';
        this.scene.add(bottom);
        
        // Create LARGE and THICK catch area physics - much bigger than visible hole
        // This catches the ball from any angle as it falls through
        const catchAreaSize = holeRadius * 2; // 2x the hole opening size
        const bottomThickness = 3.0; // Very thick to catch fast-falling balls
        const holeBottomBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(catchAreaSize, bottomThickness / 2, catchAreaSize)),
            material: this.physicsManager.groundMaterial
        });
        holeBottomBody.position.set(position.x, holeBottomY - bottomThickness / 2, position.z);
        this.physicsManager.world.addBody(holeBottomBody);
        
        console.log('🥅 Large catch area created at Y:', holeBottomY, 'Size:', catchAreaSize * 2);
        
        // Flagstick (NO PHYSICS - visual only)
        const poleGeometry = new THREE.CylinderGeometry(0.04, 0.04, 3.5, 8);
        const poleMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xeeeeee,
            roughness: 0.3,
            metalness: 0.6
        });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.set(position.x, position.y + 1.75, position.z);
        pole.userData = { type: 'hole-visual', subtype: 'pole' };
        this.scene.add(pole);
        
        // Flag (NO PHYSICS - visual only)
        const flagGeometry = new THREE.PlaneGeometry(0.8, 0.6);
        const flagMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            side: THREE.DoubleSide,
            roughness: 0.7
        });
        const flag = new THREE.Mesh(flagGeometry, flagMaterial);
        flag.position.set(position.x + 0.4, position.y + 3.2, position.z);
        flag.userData = { type: 'hole-visual', subtype: 'flag' };
        this.scene.add(flag);
        
        // NO physics body for flag/pole - they are visual only!
        
        // Store hole data
        this.hole = {
            position: position,
            radius: holeRadius,
            funnelRadius: funnelTopRadius,
            flag: flag,
            funnelDepth: slopeFunnelDepth,
            bottomY: holeBottomY,
            scored: false
        };
        
        console.log('⛳ Hole created at', position);
    }
    
    updateHoleVisual(holeData) {
        // Remove old hole visuals
        const objectsToRemove = [];
        this.scene.children.forEach(child => {
            if (child.userData && child.userData.type === 'hole-visual') {
                objectsToRemove.push(child);
            }
        });
        
        objectsToRemove.forEach(obj => {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
        
        // Create new hole at new position
        this.createHole(holeData);
    }
    
    removePlayerBall(playerId) {
        const ball = this.playerBalls.get(playerId);
        if (ball) {
            this.scene.remove(ball);
            this.playerBalls.delete(playerId);
        }
    }
    
    updateRemotePlayerPosition(playerId, position, rotation) {
        // Store target position for smooth interpolation
        this.remotePlayerTargets.set(playerId, {
            position: new THREE.Vector3(position.x, position.y, position.z),
            rotation: rotation ? new THREE.Vector3(rotation.x, rotation.y, rotation.z) : null,
            timestamp: performance.now()
        });
    }
    
    cycleCamera() {
        this.cameraMode = this.cameraMode === 1 ? 2 : 1;
        console.log('📷 Camera mode changed to:', this.cameraMode);
        updateCameraMode(this.cameraMode);
        
        if (this.cameraMode === 1) {
            // Camera 1: Follow ball
            console.log('📷 Animating to follow ball camera');
            this.startCameraTransition(1);
        } else {
            // Camera 2: Bird's eye overview
            console.log('📷 Animating to bird\'s eye overview camera');
            this.startCameraTransition(2);
        }
    }
    
    startCameraTransition(targetMode) {
        this.cameraTransitioning = true;
        
        if (targetMode === 1 && this.localBall) {
            // Target: Follow ball position
            const ballPos = this.localBall.position;
            this.targetCameraPosition.set(
                ballPos.x,
                ballPos.y + this.followCameraHeight,
                ballPos.z + this.followCameraDistance
            );
            this.targetControlsTarget.copy(ballPos);
            this.controls.minDistance = 5;
            this.controls.maxDistance = 30;
        } else {
            // Target: Overview position
            const mapCenter = new THREE.Vector3(0, 0, -15);
            this.targetCameraPosition.set(
                mapCenter.x,
                this.overviewCameraHeight,
                mapCenter.z + 20
            );
            this.targetControlsTarget.copy(mapCenter);
            this.controls.minDistance = 20;
            this.controls.maxDistance = 80;
        }
    }

    
    checkBallInHole() {
        if (this.hole.scored) return; // Already scored
        if (!this.allowHoleCheck) {
            return; // Don't check during level transitions
        }
        
        const ballPos = this.localBall.position;
        const holePos = this.hole.position;
        
        // Calculate 2D distance (x and z only)
        const dx = ballPos.x - holePos.x;
        const dz = ballPos.z - holePos.z;
        const distance2D = Math.sqrt(dx * dx + dz * dz);
        
        // Debug logging when ball is near hole
        if (distance2D < 10) {
            console.log(`🎯 Ball at (${ballPos.x.toFixed(1)}, ${ballPos.y.toFixed(1)}, ${ballPos.z.toFixed(1)}), Hole at (${holePos.x}, ${holePos.y}, ${holePos.z}), Distance: ${distance2D.toFixed(2)}`);
        }
        
        // Check if ball is in hole and has settled at the bottom
        if (distance2D < this.hole.radius * 0.8 && ballPos.y <= this.hole.bottomY + 0.6) {
            const ballBody = this.physicsManager.meshToBody.get(this.localBall);
            if (ballBody) {
                const speed = ballBody.velocity.length();
                
                // Ball has scored!
                if (speed < 2.0 && !this.hole.scored) {
                    this.hole.scored = true;
                    const strokes = this.shotMechanics ? this.shotMechanics.getStrokeCount() : 0;
                    if (strokes === 1) {
                        console.log('🎉 HOLE IN ONE!');
                    } else {
                        console.log(`🎉 Ball in hole! Strokes: ${strokes}`);
                    }
                    
                    // Stop the ball
                    ballBody.velocity.set(0, 0, 0);
                    ballBody.angularVelocity.set(0, 0, 0);
                    
                    // Disable shot controls for this player
                    if (this.shotMechanics) {
                        this.shotMechanics.disable();
                        console.log('🔒 Controls disabled - Ball is in hole!');
                    }
                    
                    // Track this player as scored
                    this.playersScored.add(this.localPlayerId);
                    
                    // Play score sound
                    if (window.audioManager) {
                        window.audioManager.playScoreSound();
                    }
                    
                    // Emit score event to all clients for confetti
                    if (this.socket) {
                        this.socket.emit('player-scored', {
                            playerId: this.localPlayerId,
                            position: holePos
                        });
                    }
                    
                    // Trigger confetti animation locally
                    this.createConfetti(holePos);
                    
                    // Check if all players have finished
                    this.checkGameCompletion();
                }
            }
        }
    }
    
    checkGameCompletion() {
        console.log(`📊 Players scored: ${this.playersScored.size}/${this.totalPlayers}`);
        
        // Prevent double transitions from local + network events
        if (this.isTransitioningLevels) {
            console.log('⏸️ Already transitioning levels, skipping...');
            return;
        }
        
        if (this.playersScored.size >= this.totalPlayers) {
            // Check if there are more holes/levels to play
            if (this.currentHoleIndex < this.holes.length - 1) {
                console.log(`⛳ Level complete! Moving to next level (${this.currentHoleIndex + 2}/${this.holes.length})`);
                
                // Set transition flag
                this.isTransitioningLevels = true;
                
                // Don't play game finished sound - just level complete
                // Game finished sound only plays when ALL levels are done
                
                // Advance to next hole after delay
                setTimeout(() => {
                    this.advanceToNextHole();
                    // Reset flag after transition
                    this.isTransitioningLevels = false;
                }, 3000);
            } else {
                console.log('🏁 All levels finished! Game complete!');
                
                // Set transition flag to prevent restart spam
                this.isTransitioningLevels = true;
                
                // Play game finished sound and stop music
                if (window.audioManager) {
                    window.audioManager.playGameFinishedSound();
                }
                
                // Return to lobby after a delay
                setTimeout(() => {
                    console.log('🎮 Returning to lobby...');
                    
                    // Stop animation loop
                    if (this.animationId) {
                        cancelAnimationFrame(this.animationId);
                        this.animationId = null;
                    }
                    
                    // Remove resize event listener
                    if (this.resizeHandler) {
                        window.removeEventListener('resize', this.resizeHandler);
                        this.resizeHandler = null;
                    }
                    
                    // Clean up game renderer to free resources
                    if (this.renderer) {
                        this.renderer.dispose();
                        const canvas = this.renderer.domElement;
                        if (canvas && canvas.parentNode) {
                            canvas.parentNode.removeChild(canvas);
                        }
                        this.renderer = null;
                    }
                    
                    // Clean up scene
                    if (this.scene) {
                        this.scene.clear();
                        this.scene = null;
                    }
                    
                    // Reset other components
                    this.physicsManager = null;
                    this.powerupManager = null;
                    this.shotMechanics = null;
                    this.controls = null;
                    
                    // Reset game initialization flag so game can be restarted
                    this.gameInitialized = false;
                    
                    // Reset game state flag
                    if (window.networkManager) {
                        window.networkManager.gameState.gameStarted = false;
                    }
                    
                    // Switch back to lobby screen
                    document.getElementById('game-screen').classList.remove('active');
                    document.getElementById('lobby-screen').classList.add('active');
                    
                    // Reset transition flag
                    this.isTransitioningLevels = false;
                    
                    console.log('✅ Returned to lobby - ready for new game');
                }, 5000);
            }
        }
    }
    
    advanceToNextHole() {
        console.log('➡️ Advancing to next level...');
        
        // Reset hole scored flag
        if (this.hole) {
            this.hole.scored = false;
        }
        
        // Reset players scored for next hole
        this.playersScored.clear();
        
        // Increment hole index
        this.currentHoleIndex++;
        
        // Validate hole index
        if (this.currentHoleIndex >= this.holes.length) {
            console.error('❌ Invalid hole index:', this.currentHoleIndex);
            return;
        }
        
        // Clear all map objects from scene and physics
        this.clearMapObjects();
        
        // Load next hole
        this.loadHole(this.currentHoleIndex);
        
        // Get next hole data
        const nextHole = this.holes[this.currentHoleIndex];
        if (!nextHole) {
            console.error('❌ No hole data for index:', this.currentHoleIndex);
            return;
        }
        
        const startPos = nextHole.startPoint;
        // Use a proper height - y should be 3 for ball spawn, not 0 or 1
        const ballStartY = (startPos.y !== undefined && startPos.y > 0) ? startPos.y : 3;
        
        console.log(`🗺️ Next hole data:`, nextHole);
        console.log(`🏁 Resetting ball to start: (${startPos.x}, ${ballStartY}, ${startPos.z})`);
        console.log(`⛳ Hole position should be:`, nextHole.hole);
        
        // Disable hole checking during ball reset
        this.allowHoleCheck = false;
        
        // The hole was already created by loadHole, no need to create it again
        // (updateHoleVisual was creating a duplicate)
        
        // Reset all player balls
        this.playerBalls.forEach((ballMesh, playerId) => {
            // Get physics body from meshToBody Map
            const ballBody = this.physicsManager.meshToBody.get(ballMesh);
            
            if (ballBody) {
                // CRITICAL: Reset hole settling state so physics doesn't lock ball to old hole
                ballBody.holeSettling = 0;
                ballBody.collisionFilterGroup = 1;
                ballBody.collisionFilterMask = -1;
                
                // Reset physics body position and velocity
                ballBody.position.set(startPos.x, ballStartY, startPos.z);
                ballBody.velocity.set(0, 0, 0);
                ballBody.angularVelocity.set(0, 0, 0);
                ballBody.quaternion.set(0, 0, 0, 1);
                
                // CRITICAL: Wake up the physics body to apply the position change
                ballBody.wakeUp();
                
                console.log('📍 Ball physics reset to:', ballBody.position);
            }
            
            // Reset mesh position and rotation
            ballMesh.position.set(startPos.x, ballStartY, startPos.z);
            ballMesh.quaternion.set(0, 0, 0, 1);
            
            // Clear active powerup effects for this player
            if (this.powerupManager && this.powerupManager.activeEffects) {
                this.powerupManager.activeEffects.delete(playerId);
            }
        });
        
        // Reset stroke counter for new level
        if (this.shotMechanics) {
            this.shotMechanics.resetStrokeCount();
        }
        
        // Re-enable controls and hole checking after physics settles
        setTimeout(() => {
            this.allowHoleCheck = true;
            if (this.shotMechanics) {
                this.shotMechanics.enable();
                console.log('🔓 Controls re-enabled for next level!');
            }
        }, 1000); // Wait 1 second for physics to fully settle
        
        // Update UI to show new hole number and par
        const holeElement = document.getElementById('current-hole');
        const parElement = document.getElementById('par-value');
        if (holeElement) holeElement.textContent = nextHole.number || (this.currentHoleIndex + 1);
        if (parElement) parElement.textContent = nextHole.par || 3;
        
        // Spawn powerups for new hole
        if (this.powerupManager) {
            this.powerupManager.spawnPowerups(nextHole.powerupSpawns || []);
        }
        
        console.log(`✅ Level ${this.currentHoleIndex + 1} loaded!`);
    }
    
    clearMapObjects() {
        // Remove all custom map objects from physics
        this.physicsManager.clearCustomObjects();
        
        // Remove visual objects (walls, ramps, hole visuals, etc.) from scene
        const objectsToRemove = [];
        this.scene.children.forEach(child => {
            if (child.userData && (
                child.userData.type === 'wall' ||
                child.userData.type === 'ramp' ||
                child.userData.type === 'fan' ||
                child.userData.type === 'bouncePad' ||
                child.userData.type === 'bumper' ||
                child.userData.type === 'speedBoost' ||
                child.userData.type === 'hole-visual' // Remove hole visuals too!
            )) {
                objectsToRemove.push(child);
            }
        });
        
        objectsToRemove.forEach(obj => {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(mat => mat.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
        
        // Clear object reference arrays
        this.bouncePads = [];
        this.bumpers = [];
        this.speedBoosts = [];
        this.fans = [];
        
        console.log(`🧹 Cleared ${objectsToRemove.length} map objects from scene`);
    }
    
    restartGame() {
        console.log('♻️ Restarting game - rebuilding physics world...');
        
        // Reset game state
        this.hole.scored = false;
        this.playersScored.clear();
        
        // Completely rebuild physics world from scratch
        this.physicsManager.rebuildPhysicsWorld();
        
        // Recreate ground body
        this.physicsManager.createGroundBody();
        this.physicsManager.createGroundWithHole(this.hole.position, 1.2);
        
        // Recreate perimeter walls
        const wallHeight = 4;
        const wallThickness = 1;
        const playAreaSize = 100;
        const halfSize = playAreaSize / 2;
        
        this.physicsManager.createWall(
            { x: 0, y: wallHeight / 2, z: -halfSize },
            { x: playAreaSize, y: wallHeight, z: wallThickness }
        );
        this.physicsManager.createWall(
            { x: 0, y: wallHeight / 2, z: halfSize },
            { x: playAreaSize, y: wallHeight, z: wallThickness }
        );
        this.physicsManager.createWall(
            { x: -halfSize, y: wallHeight / 2, z: 0 },
            { x: wallThickness, y: wallHeight, z: playAreaSize }
        );
        this.physicsManager.createWall(
            { x: halfSize, y: wallHeight / 2, z: 0 },
            { x: wallThickness, y: wallHeight, z: playAreaSize }
        );
        
        // Remove old visual meshes for fans, bounce pads, and bumpers
        if (this.fans) {
            this.fans.forEach(fan => {
                if (fan.group) this.scene.remove(fan.group);
            });
        }
        if (this.bouncePads) {
            this.bouncePads.forEach(pad => {
                if (pad.group) this.scene.remove(pad.group);
            });
        }
        if (this.bumpers) {
            this.bumpers.forEach(bumper => {
                if (bumper.group) this.scene.remove(bumper.group);
            });
        }
        if (this.speedBoosts) {
            this.speedBoosts.forEach(boost => {
                if (boost.group) this.scene.remove(boost.group);
            });
        }
        
        // Clear tracking arrays
        this.fans = [];
        this.bouncePads = [];
        this.bumpers = [];
        this.speedBoosts = [];
        
        // Recreate map objects - either from mapData or use defaults
        if (this.mapData) {
            console.log(`🗺️ Recreating custom map: ${this.mapData.name}`);
            
            // Recreate walls from map
            if (this.mapData.walls) {
                this.mapData.walls.forEach(wall => {
                    this.physicsManager.createWall(wall.position, wall.size, wall.rotationY || 0, wall.color);
                });
            }
            
            // Recreate ramps from map
            if (this.mapData.ramps) {
                this.mapData.ramps.forEach(ramp => {
                    this.physicsManager.createRamp(ramp.position, ramp.size, ramp.rotationY, ramp.angle, ramp.color);
                });
            }
            
            // Recreate fans from map
            if (this.mapData.fans) {
                this.mapData.fans.forEach(fan => {
                    this.createFan(fan.position, fan.rotationY || 0, fan.strength || 10);
                });
            }
            
            // Recreate bounce pads from map
            if (this.mapData.bouncePads) {
                this.mapData.bouncePads.forEach(pad => {
                    this.createBouncePad(pad.position, pad.rotationY || 0, pad.strength || 20);
                });
            }
            
            // Recreate bumpers from map
            if (this.mapData.bumpers) {
                this.mapData.bumpers.forEach(bumper => {
                    this.createBumper(bumper.position, bumper.rotationY || 0, bumper.strength || 15);
                });
            }
            
            // Recreate speed boosts from map
            if (this.mapData.speedBoosts) {
                this.mapData.speedBoosts.forEach(boost => {
                    this.createSpeedBoost(boost.position, boost.rotationY || 0, boost.strength || 50);
                });
            }
        } else {
            console.log('🗺️ Recreating default map');
            // Recreate obstacles
            this.physicsManager.createWall({ x: 10, y: 1, z: 10 }, { x: 4, y: 2, z: 4 });
            this.physicsManager.createWall({ x: -15, y: 1, z: -15 }, { x: 3, y: 2, z: 6 });
            this.physicsManager.createWall({ x: -10, y: 1, z: 15 }, { x: 5, y: 2, z: 2 });
            
            // Recreate ramps
            this.physicsManager.createRamp({ x: 15, y: 0.3, z: -5 }, { x: 8, y: 0.5, z: 6 }, 90, 20);
            this.physicsManager.createRamp({ x: -20, y: 0.4, z: 0 }, { x: 10, y: 0.5, z: 8 }, 0, 25);
            this.physicsManager.createRamp({ x: 0, y: 0.3, z: -20 }, { x: 6, y: 0.5, z: 10 }, 180, 15);
            this.physicsManager.createRamp({ x: -5, y: 0.5, z: -10 }, { x: 8, y: 0.5, z: 5 }, 270, 30);
        }
        
        // Recreate large and thick catch area under hole
        const catchAreaSize = 1.2 * 2; // 2x the hole radius
        const catchAreaThickness = 3.0; // Very thick to catch fast balls
        const holeBottomBody = new CANNON.Body({
            mass: 0,
            position: new CANNON.Vec3(this.hole.position.x, this.hole.bottomY - catchAreaThickness / 2 + 0.25, this.hole.position.z)
        });
        holeBottomBody.addShape(new CANNON.Box(new CANNON.Vec3(catchAreaSize, catchAreaThickness / 2, catchAreaSize)));
        this.physicsManager.world.addBody(holeBottomBody);
        
        // Reset all balls to starting positions
        const mapStartPoint = this.mapData?.startPoint || { x: 0, y: 3, z: 30 };
        this.playerBalls.forEach((ball, playerId) => {
            const startPos = playerId === this.localPlayerId ? 
                mapStartPoint : 
                { x: mapStartPoint.x + Math.random() * 10 - 5, y: mapStartPoint.y || 3, z: mapStartPoint.z + Math.random() * 5 };
            
            // Move ball mesh to start position FIRST
            ball.position.set(startPos.x, startPos.y, startPos.z);
            ball.quaternion.set(0, 0, 0, 1);
            ball.rotation.set(0, 0, 0);
            
            // Only create physics body for local player
            if (playerId === this.localPlayerId) {
                // Create fresh physics body at the mesh's current position
                const body = this.physicsManager.createBallBody(ball, 1);
                // Update localBall reference
                this.localBall = ball;
                console.log('🔄 Local ball recreated at:', startPos);
            }
        });
        
        // Reset stroke counter
        if (this.shotMechanics) {
            this.shotMechanics.resetStrokeCount();
        }
        
        // Give physics world time to settle before re-enabling controls
        setTimeout(() => {
            if (this.shotMechanics) {
                this.shotMechanics.enable();
                console.log('🔓 Controls re-enabled!');
            }
        }, 100);
        
        // Reset camera
        if (this.localBall) {
            const ballPos = this.localBall.position;
            this.camera.position.set(
                ballPos.x,
                ballPos.y + this.followCameraHeight,
                ballPos.z + this.followCameraDistance
            );
            this.controls.target.copy(ballPos);
            this.controls.update();
        }
        
        console.log('✅ Game restarted!');
    }
    
    createConfetti(position) {
        // Clear any existing confetti first
        if (this.confettiParticles && this.confettiParticles.length > 0) {
            for (const particle of this.confettiParticles) {
                this.scene.remove(particle);
                if (particle.geometry) particle.geometry.dispose();
                if (particle.material) particle.material.dispose();
            }
            this.confettiParticles = [];
        }
        
        const particleCount = 100;
        const particles = [];
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        
        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.1, 8, 8);
            const material = new THREE.MeshStandardMaterial({ 
                color: colors[Math.floor(Math.random() * colors.length)]
            });
            const particle = new THREE.Mesh(geometry, material);
            
            // Start at hole position with wider spread
            particle.position.set(
                position.x + (Math.random() - 0.5) * 1,
                position.y + 3 + Math.random() * 2, // Start higher with randomness
                position.z + (Math.random() - 0.5) * 1
            );
            
            // Random velocity - stronger outward burst
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 15,
                Math.random() * 20 + 10,
                (Math.random() - 0.5) * 15
            );
            
            particle.gravity = -30;
            particle.life = 2.5; // 2.5 seconds
            particle.bounced = false; // Track if particle has bounced
            
            this.scene.add(particle);
            particles.push(particle);
        }
        
        // Store particles for animation
        this.confettiParticles = particles;
        this.confettiStartTime = performance.now();
        
        console.log('🎊 Confetti created!');
    }
    
    updateCamera() {
        // Handle camera transition animation
        if (this.cameraTransitioning) {
            const lerpSpeed = 0.045; // Smooth, cinematic transition
            this.camera.position.lerp(this.targetCameraPosition, lerpSpeed);
            this.controls.target.lerp(this.targetControlsTarget, lerpSpeed);
            
            // Check if transition is complete
            if (this.camera.position.distanceTo(this.targetCameraPosition) < 0.5) {
                this.cameraTransitioning = false;
                console.log('✅ Camera transition complete');
            }
        }
        
        // Camera 1: Follow ball movement in 3D space
        if (this.cameraMode === 1 && this.localBall && !this.cameraTransitioning) {
            // Calculate where camera should be relative to ball
            const ballPos = this.localBall.position;
            
            // Get current camera offset from target
            const currentOffset = new THREE.Vector3().subVectors(
                this.camera.position,
                this.controls.target
            );
            
            // Maintain the offset but follow the ball
            const desiredCameraPos = new THREE.Vector3().addVectors(
                ballPos,
                currentOffset
            );
            
            // Smoothly move camera and target to follow ball
            this.camera.position.lerp(desiredCameraPos, 0.15);
            this.controls.target.lerp(ballPos, 0.15);
        }
        // Camera 2: Target stays at map center (no updates needed)
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Calculate delta time
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // Update space environment
        this.updateSpaceEnvironment(deltaTime);
        
        // Update physics
        if (this.physicsManager) {
            this.physicsManager.update(deltaTime);
        }
        
        // Animate fans
        this.fans.forEach(fan => {
            if (fan.blades) {
                fan.blades.rotation.z += 0.1;
            }
            
            if (fan.particles) {
                const positions = fan.particles.geometry.attributes.position.array;
                const velocities = fan.particles.userData.velocities;
                
                for (let i = 0; i < positions.length / 3; i++) {
                    positions[i * 3 + 2] += velocities[i] * 0.05;
                    
                    if (positions[i * 3 + 2] > 5) {
                        positions[i * 3 + 2] = 0;
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.random() * 1.2;
                        positions[i * 3] = Math.cos(angle) * radius;
                        positions[i * 3 + 1] = Math.sin(angle) * radius;
                    }
                }
                
                fan.particles.geometry.attributes.position.needsUpdate = true;
            }
        });
        
        // Update powerups
        if (this.powerupManager && this.localBall) {
            this.powerupManager.update(deltaTime, this.localBall.position);
        }
        
        // Update visual effects for active powerups
        const indicator = document.getElementById('active-powerup-indicator');
        const indicatorText = document.getElementById('active-powerup-text');
        
        if (this.localBall && this.ballGlowLight && this.physicsManager) {
            let activeEffect = null;
            
            // Check for active powerup effects
            if (this.physicsManager.hasActiveEffect('superBounce')) {
                this.ballGlowLight.visible = true;
                this.ballGlowLight.color.setHex(0xFF6B6B);
                this.ballGlowLight.intensity = 2 + Math.sin(Date.now() * 0.01) * 0.5;
                activeEffect = { name: '🏀 SUPER BOUNCE ACTIVE', class: 'super-bounce' };
            } else if (this.physicsManager.hasActiveEffect('stickyBall')) {
                this.ballGlowLight.visible = true;
                this.ballGlowLight.color.setHex(0xFFA500);
                this.ballGlowLight.intensity = 1.5 + Math.sin(Date.now() * 0.01) * 0.3;
                activeEffect = { name: '🍯 STICKY BALL ACTIVE', class: 'sticky-ball' };
            } else if (this.physicsManager.hasActiveEffect('featherBall')) {
                this.ballGlowLight.visible = true;
                this.ballGlowLight.color.setHex(0x87CEEB);
                this.ballGlowLight.intensity = 1.8 + Math.sin(Date.now() * 0.01) * 0.4;
                activeEffect = { name: '🪶 FEATHER BALL ACTIVE', class: 'feather-ball' };
            } else if (this.physicsManager.hasActiveEffect('superBoost')) {
                this.ballGlowLight.visible = true;
                this.ballGlowLight.color.setHex(0xFF0000);
                this.ballGlowLight.intensity = 3.5 + Math.sin(Date.now() * 0.02) * 1.0;
                activeEffect = { name: '💥 SUPER BOOST ACTIVE', class: 'super-boost' };
            } else {
                this.ballGlowLight.visible = false;
            }
            
            // Update UI indicator
            if (activeEffect) {
                indicator.style.display = 'block';
                indicatorText.textContent = activeEffect.name;
                indicator.className = 'active-powerup-indicator ' + activeEffect.class;
            } else {
                indicator.style.display = 'none';
            }
        }
        
        // Sync local player position to server
        if (this.localBall && this.socket && currentTime - this.lastSyncTime > this.syncInterval) {
            const ballBody = this.physicsManager.meshToBody.get(this.localBall);
            if (ballBody && ballBody.velocity.length() > 0.05) {
                this.socket.emit('update-position', {
                    position: {
                        x: this.localBall.position.x,
                        y: this.localBall.position.y,
                        z: this.localBall.position.z
                    },
                    rotation: {
                        x: this.localBall.rotation.x,
                        y: this.localBall.rotation.y,
                        z: this.localBall.rotation.z
                    }
                });
                this.lastSyncTime = currentTime;
            }
        }
        
        // Smoothly interpolate remote players to their target positions
        this.remotePlayerTargets.forEach((target, playerId) => {
            const ball = this.playerBalls.get(playerId);
            if (ball && playerId !== this.localPlayerId) {
                // Smooth lerp to target position (higher value for faster sync)
                ball.position.lerp(target.position, 0.5);
                if (target.rotation) {
                    ball.rotation.x += (target.rotation.x - ball.rotation.x) * 0.5;
                    ball.rotation.y += (target.rotation.y - ball.rotation.y) * 0.5;
                    ball.rotation.z += (target.rotation.z - ball.rotation.z) * 0.5;
                }
            }
        });
        
        // Check if ball is in hole
        if (this.hole && this.localBall) {
            this.checkBallInHole();
        }
        
        // Update confetti particles
        if (this.confettiParticles && this.confettiParticles.length > 0) {
            const elapsed = (performance.now() - this.confettiStartTime) / 1000;
            
            for (let i = this.confettiParticles.length - 1; i >= 0; i--) {
                const particle = this.confettiParticles[i];
                
                // Update particle physics
                particle.velocity.y += particle.gravity * deltaTime;
                particle.position.x += particle.velocity.x * deltaTime;
                particle.position.y += particle.velocity.y * deltaTime;
                particle.position.z += particle.velocity.z * deltaTime;
                
                // Add rotation for visual effect
                particle.rotation.x += particle.velocity.x * deltaTime;
                particle.rotation.z += particle.velocity.z * deltaTime;
                
                // Bounce off ground once
                if (particle.position.y < 0 && particle.velocity.y < 0 && !particle.bounced) {
                    particle.position.y = 0;
                    particle.velocity.y *= -0.4; // Bounce with energy loss
                    particle.velocity.x *= 0.7; // Friction
                    particle.velocity.z *= 0.7;
                    particle.bounced = true;
                }
                
                // Fade out
                particle.material.opacity = 1 - (elapsed / particle.life);
                particle.material.transparent = true;
                
                // Remove if expired or fell far below ground
                if (elapsed > particle.life || particle.position.y < -3) {
                    this.scene.remove(particle);
                    if (particle.geometry) particle.geometry.dispose();
                    if (particle.material) particle.material.dispose();
                    this.confettiParticles.splice(i, 1);
                }
            }
        }
        
        this.updateCamera();
        
        if (this.controls) {
            this.controls.update();
        }
        
        if (this.shotMechanics) {
            this.shotMechanics.updateArrowAnimation();
        }
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    onWindowResize() {
        // Don't resize if renderer/camera have been cleaned up
        if (!this.renderer || !this.camera) return;
        
        const container = document.getElementById('game-canvas');
        if (!container) return;
        
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }
    
    getLocalBall() {
        return this.localBall;
    }
}
