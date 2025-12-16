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
        
        // Multiplayer sync
        this.lastSyncTime = 0;
        this.syncInterval = 50; // Sync every 50ms (20 times per second)
        this.remotePlayerTargets = new Map(); // Target positions for smooth interpolation
        
        // Fan tracking for animation
        this.fans = [];
        
        // Bounce pad tracking for physics
        this.bouncePads = [];
    }
    
    initGame(players, localPlayerId, socket, audioManager, mapData = null) {
        if (this.gameInitialized) return;
        this.gameInitialized = true;
        this.socket = socket;
        this.audioManager = audioManager;
        this.totalPlayers = players.length;
        this.localPlayerId = localPlayerId;
        this.mapData = mapData;
        
        console.log('🎮 Initializing game with', players.length, 'players');
        console.log('🗺️ mapData parameter received:', mapData);
        console.log('🗺️ this.mapData set to:', this.mapData);
        const container = document.getElementById('game-canvas');
        
        if (!container) {
            console.error('❌ Game canvas container not found!');
            return;
        }
        
        // Scene with realistic sky
        console.log('🎨 Creating Three.js scene');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 80, 250);
        
        // Physics
        console.log('⚙️ Creating physics manager');
        this.physicsManager = new PhysicsManager(this.scene);
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
        this.renderer.shadowMap.enabled = false; // No shadows for flat look
        this.renderer.outputEncoding = THREE.sRGBEncoding;
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
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        
        // Directional light from above for definition (no shadows)
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.6);
        mainLight.position.set(0, 50, 0);
        this.scene.add(mainLight);
        
        // Soft fill light for better form definition
        const fillLight = new THREE.DirectionalLight(0xadd8e6, 0.3);
        fillLight.position.set(-30, 20, -30);
        this.scene.add(fillLight);
        
        // Ground - simple plane (hole is shown by black circle in createHole)
        console.log('🌱 Creating ground plane');
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x5cb85c // Brighter, more saturated green
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
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
            { x: playAreaSize, y: wallHeight, z: wallThickness }
        );
        
        // South wall (front)
        this.physicsManager.createWall(
            { x: 0, y: wallHeight / 2, z: halfSize },
            { x: playAreaSize, y: wallHeight, z: wallThickness }
        );
        
        // West wall (left)
        this.physicsManager.createWall(
            { x: -halfSize, y: wallHeight / 2, z: 0 },
            { x: wallThickness, y: wallHeight, z: playAreaSize }
        );
        
        // East wall (right)
        this.physicsManager.createWall(
            { x: halfSize, y: wallHeight / 2, z: 0 },
            { x: wallThickness, y: wallHeight, z: playAreaSize }
        );
        
        // Load map objects - either from mapData or use defaults
        console.log('🗺️ Checking mapData:', this.mapData);
        console.log('🗺️ typeof mapData:', typeof this.mapData);
        console.log('🗺️ Boolean check:', !!this.mapData);
        if (this.mapData) {
            console.log(`🗺️ Loading custom map: ${this.mapData.name}`);
            
            // Create walls from map
            if (this.mapData.walls) {
                this.mapData.walls.forEach(wall => {
                    this.physicsManager.createWall(wall.position, wall.size, wall.rotationY || 0, wall.color);
                });
            }
            
            // Create ramps from map
            if (this.mapData.ramps) {
                this.mapData.ramps.forEach(ramp => {
                    this.physicsManager.createRamp(ramp.position, ramp.size, ramp.rotationY, ramp.angle, ramp.color);
                });
            }
            
            // Create fans from map
            if (this.mapData.fans) {
                this.mapData.fans.forEach(fan => {
                    this.createFan(fan.position, fan.rotationY || 0, fan.angle || 0, fan.strength || 10);
                });
            }
            
            // Create bounce pads from map
            if (this.mapData.bouncePads) {
                this.mapData.bouncePads.forEach(pad => {
                    this.createBouncePad(pad.position, pad.rotationY || 0, pad.strength || 20);
                });
            }
            
            // Create hole from map
            this.createHole(this.mapData.hole);
        } else {
            console.log('🗺️ Using default map');
            // Add some obstacles inside
            this.physicsManager.createWall({ x: 10, y: 1, z: 10 }, { x: 4, y: 2, z: 4 }); // Box obstacle
            this.physicsManager.createWall({ x: -15, y: 1, z: -15 }, { x: 3, y: 2, z: 6 }); // Another obstacle
            this.physicsManager.createWall({ x: -10, y: 1, z: 15 }, { x: 5, y: 2, z: 2 }); // Long obstacle
            
            // Add ramps for testing gravity powerups
            console.log('🛝 Creating ramps');
            this.physicsManager.createRamp({ x: 15, y: 0.3, z: -5 }, { x: 8, y: 0.5, z: 6 }, 90, 20); // Ramp facing east
            this.physicsManager.createRamp({ x: -20, y: 0.4, z: 0 }, { x: 10, y: 0.5, z: 8 }, 0, 25); // Steeper ramp facing north
            this.physicsManager.createRamp({ x: 0, y: 0.3, z: -20 }, { x: 6, y: 0.5, z: 10 }, 180, 15); // Gentle ramp facing south
            this.physicsManager.createRamp({ x: -5, y: 0.5, z: -10 }, { x: 8, y: 0.5, z: 5 }, 270, 30); // Steep ramp facing west
            
            // Create hole with flag
            console.log('⛳ Creating hole and flag');
            this.createHole({ x: 25, y: 0, z: -25 });
        }
        
        // Create balls for all players
        console.log('⚽ Creating player balls');
        const startPoint = this.mapData?.startPoint || { x: 0, y: 3, z: 30 };
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
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Update UI
        console.log('📊 Updating initial scoreboard with', players.length, 'players');
        updateScoreboard(players);
        
        // Spawn powerups
        console.log('💎 Spawning powerups');
        const powerupPositions = this.mapData?.powerupSpawns?.map(spawn => spawn.position) || null;
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
        holeOpening
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
        rim
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
        funnel
        funnel
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
        hole
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
        bottom
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
        pole
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
        flag
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
        
        const ballPos = this.localBall.position;
        const holePos = this.hole.position;
        
        // Calculate 2D distance (x and z only)
        const dx = ballPos.x - holePos.x;
        const dz = ballPos.z - holePos.z;
        const distance2D = Math.sqrt(dx * dx + dz * dz);
        
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
        
        if (this.playersScored.size >= this.totalPlayers) {
            console.log('🏁 All players finished! Game over!');
            
            // Play game finished sound and stop music
            if (window.audioManager) {
                window.audioManager.playGameFinishedSound();
            }
            
            // Show game over message after a delay
            setTimeout(() => {
                console.log('🔄 Restarting game in 3 seconds...');
                
                setTimeout(() => {
                    this.restartGame();
                    // Restart game music
                    if (window.audioManager) {
                        window.audioManager.playGameMusic();
                    }
                }, 3000);
            }, 2000);
        }
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
        const particleCount = 100;
        const particles = [];
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        
        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.1, 8, 8);
            const material = new THREE.MeshStandardMaterial({ 
                color: colors[Math.floor(Math.random() * colors.length)]
            });
            const particle = new THREE.Mesh(geometry, material);
            
            // Start at hole position, slightly above
            particle.position.set(
                position.x + (Math.random() - 0.5) * 2,
                position.y + 2,
                position.z + (Math.random() - 0.5) * 2
            );
            
            // Random velocity
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                Math.random() * 15 + 5,
                (Math.random() - 0.5) * 10
            );
            
            particle.gravity = -20;
            particle.life = 3.0; // 3 seconds
            
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
        requestAnimationFrame(() => this.animate());
        
        // Calculate delta time
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
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
                
                // Fade out
                particle.material.opacity = 1 - (elapsed / particle.life);
                particle.material.transparent = true;
                
                // Remove if expired
                if (elapsed > particle.life) {
                    this.scene.remove(particle);
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
        const container = document.getElementById('game-canvas');
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }
    
    getLocalBall() {
        return this.localBall;
    }
}
