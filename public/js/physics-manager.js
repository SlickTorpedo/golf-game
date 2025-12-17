import * as CANNON from 'https://cdn.skypack.dev/cannon-es';
import * as THREE from 'three';

export class PhysicsManager {
    constructor(scene, audioManager = null) {
        this.scene = scene;
        this.audioManager = audioManager;
        this.world = new CANNON.World();
        
        // Set gravity (stronger for more weight and faster falling)
        this.world.gravity.set(0, -30, 0);
        this.defaultGravity = -30;
        
        // Active powerup effects
        this.activePowerupEffects = {
            superBoost: false,
            superBoostBouncing: false,
            featherBall: false,
            superBounce: false,
            stickyBall: false
        };
        
        // Improve collision detection with higher quality settings
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 20; // Increased from 10 for better accuracy
        this.world.solver.tolerance = 0.001; // Tighter tolerance for more accurate collisions
        this.world.allowSleep = true;
        this.world.defaultContactMaterial.contactEquationStiffness = 1e9;
        this.world.defaultContactMaterial.contactEquationRelaxation = 4;
        
        // Materials for different surfaces
        this.groundMaterial = new CANNON.Material('ground');
        this.ballMaterial = new CANNON.Material('ball');
        this.wallMaterial = new CANNON.Material('wall');
        
        // Contact materials (define friction/restitution between materials)
        const ballGroundContact = new CANNON.ContactMaterial(
            this.ballMaterial,
            this.groundMaterial,
            {
                friction: 0.9, // Higher friction slows ball down more
                restitution: 0.5, // Realistic bouncing - ball bounces a few times
                contactEquationStiffness: 1e8,
                contactEquationRelaxation: 3
            }
        );
        
        const ballWallContact = new CANNON.ContactMaterial(
            this.ballMaterial,
            this.wallMaterial,
            {
                friction: 0.0, // No friction - walls are perfectly smooth
                restitution: 0.95, // Slightly less than perfect to prevent extreme speeds
                contactEquationStiffness: 1e9,
                contactEquationRelaxation: 4
            }
        );
        
        this.world.addContactMaterial(ballGroundContact);
        this.world.addContactMaterial(ballWallContact);
        
        // Map to track Three.js meshes and their physics bodies
        this.meshToBody = new Map();
        
        // Store references to ground bodies for cleanup
        this.groundBodies = [];
        this.wallBodies = [];
        
        // Track last safe position (over ground) for each ball
        this.lastSafePositions = new Map();
        
        // Track last shot position for teleport
        this.lastShotPosition = null;
        
        // Setup collision listeners
        this.setupCollisionListeners();
        
        console.log('⚙️ Physics world initialized');
    }
    
    setupCollisionListeners() {
        // Bounce pad and bumper collision listener with cooldown
        this.world.addEventListener('beginContact', (event) => {
            const bodyA = event.bodyA;
            const bodyB = event.bodyB;
            
            // Check if collision is between ball and bounce pad
            let ball = null;
            let bouncePad = null;
            
            if (bodyA.isBouncePad && bodyB.shapes[0] && bodyB.shapes[0].radius === 0.5) {
                bouncePad = bodyA;
                ball = bodyB;
            } else if (bodyB.isBouncePad && bodyA.shapes[0] && bodyA.shapes[0].radius === 0.5) {
                bouncePad = bodyB;
                ball = bodyA;
            }
            
            // Check if collision is between ball and wall
            let wallBall = null;
            let wall = null;
            
            if (bodyA.mass === 0 && !bodyA.isBouncePad && !bodyA.isBumper && !bodyA.isSpeedBoost && 
                bodyB.shapes[0] && bodyB.shapes[0].radius === 0.5) {
                wall = bodyA;
                wallBall = bodyB;
            } else if (bodyB.mass === 0 && !bodyB.isBouncePad && !bodyB.isBumper && !bodyB.isSpeedBoost && 
                       bodyA.shapes[0] && bodyA.shapes[0].radius === 0.5) {
                wall = bodyB;
                wallBall = bodyA;
            }
            
            if (wallBall && wall) {
                // Initialize cooldown timer if not exists
                if (!wallBall.wallCollisionCooldown) {
                    wallBall.wallCollisionCooldown = 0;
                }
                
                // Only play sound if cooldown expired and ball is moving fast enough
                const now = Date.now();
                const speed = wallBall.velocity.length();
                if (now - wallBall.wallCollisionCooldown > 100 && speed > 3) {
                    wallBall.wallCollisionCooldown = now;
                    
                    // Play collision sound
                    if (this.audioManager) {
                        this.audioManager.playCollisionSound();
                    }
                }
            }
            
            if (ball && bouncePad) {
                // Initialize cooldown timer if not exists
                if (!ball.bouncePadCooldown) {
                    ball.bouncePadCooldown = 0;
                }
                
                // Only bounce if cooldown expired
                const now = Date.now();
                if (now - ball.bouncePadCooldown > 500) {
                    // Store current horizontal velocity
                    const currentVelX = ball.velocity.x;
                    const currentVelZ = ball.velocity.z;
                    
                    // Replace only Y velocity, keep horizontal momentum
                    ball.velocity.y = bouncePad.bounceStrength;
                    ball.velocity.x = currentVelX;
                    ball.velocity.z = currentVelZ;
                    
                    ball.bouncePadCooldown = now;
                    console.log('🟢 Bounce pad triggered! Y velocity set to:', bouncePad.bounceStrength);
                    
                    // Play bounce sound
                    if (this.audioManager) {
                        this.audioManager.playBounceSound();
                    }
                }
            }
            
            // Check if collision is between ball and lava
            let lavaBall = null;
            let lava = null;
            
            if (bodyA.isLava && bodyB.shapes[0] && bodyB.shapes[0].radius === 0.5) {
                lava = bodyA;
                lavaBall = bodyB;
            } else if (bodyB.isLava && bodyA.shapes[0] && bodyA.shapes[0].radius === 0.5) {
                lava = bodyB;
                lavaBall = bodyA;
            }
            
            if (lavaBall && lava && this.lastShotPosition) {
                console.log('🔥 Ball hit lava! Teleporting back to last shot position');
                
                // Teleport ball back to last shot position
                lavaBall.position.copy(this.lastShotPosition);
                lavaBall.velocity.set(0, 0, 0);
                lavaBall.angularVelocity.set(0, 0, 0);
                lavaBall.wakeUp();
                
                // Play burn sound
                if (this.audioManager) {
                    this.audioManager.playBurnSound();
                }
            }
            
            // Check if collision is between ball and bumper
            let bumperBall = null;
            let bumper = null;
            
            if (bodyA.isBumper && bodyB.shapes[0] && bodyB.shapes[0].radius === 0.5) {
                bumper = bodyA;
                bumperBall = bodyB;
            } else if (bodyB.isBumper && bodyA.shapes[0] && bodyA.shapes[0].radius === 0.5) {
                bumper = bodyB;
                bumperBall = bodyA;
            }
            
            if (bumperBall && bumper) {
                // Initialize cooldown timer if not exists
                if (!bumperBall.bumperCooldown) {
                    bumperBall.bumperCooldown = 0;
                }
                
                // Only push if cooldown expired
                const now = Date.now();
                if (now - bumperBall.bumperCooldown > 500) {
                    // Calculate radial direction from bumper center to ball
                    const dx = bumperBall.position.x - bumper.position.x;
                    const dz = bumperBall.position.z - bumper.position.z;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    
                    if (distance > 0) {
                        // Normalize direction
                        const dirX = dx / distance;
                        const dirZ = dz / distance;
                        
                        // Apply MUCH stronger radial push - 4x multiplier for powerful launch
                        const pushStrength = bumper.pushStrength * 4;
                        bumperBall.velocity.x = dirX * pushStrength;
                        bumperBall.velocity.z = dirZ * pushStrength;
                        // Minimal upward velocity - focus on horizontal push
                        bumperBall.velocity.y = pushStrength * 0.15;
                        
                        bumperBall.bumperCooldown = now;
                        console.log('🔴 Bumper triggered! Push velocity:', pushStrength, 'direction:', dirX, dirZ);
                        
                        // Play bump sound
                        if (this.audioManager) {
                            this.audioManager.playBumpSound();
                        }
                    }
                }
            }
            
            // Speed boost collision
            if ((bodyA.isSpeedBoost && bodyB.shapes[0] && bodyB.shapes[0].radius === 0.5) ||
                (bodyB.isSpeedBoost && bodyA.shapes[0] && bodyA.shapes[0].radius === 0.5)) {
                
                const ball = bodyA.isSpeedBoost ? bodyB : bodyA;
                const speedBoost = bodyA.isSpeedBoost ? bodyA : bodyB;
                
                // Initialize cooldown timer if not exists
                if (!ball.speedBoostCooldown) {
                    ball.speedBoostCooldown = 0;
                }
                
                // Only boost if cooldown expired
                const now = Date.now();
                if (now - ball.speedBoostCooldown > 500) {
                    // Calculate direction based on speed boost rotation
                    const rotationRad = (speedBoost.boostRotationY * Math.PI) / 180;
                    const dirX = -Math.sin(rotationRad);
                    const dirZ = -Math.cos(rotationRad);
                    
                    // Apply directional boost
                    const boostStrength = speedBoost.boostStrength;
                    ball.velocity.x = dirX * boostStrength;
                    ball.velocity.z = dirZ * boostStrength;
                    // Keep Y velocity or add small upward component
                    ball.velocity.y = Math.max(ball.velocity.y, 2);
                    
                    ball.speedBoostCooldown = now;
                    console.log('⚡ Speed boost triggered! Velocity:', boostStrength, 'direction:', speedBoost.boostRotationY, '°');
                    
                    // Play boost sound
                    if (this.audioManager) {
                        this.audioManager.playBoostSound();
                    }
                }
            }
        });
    }
    
    initializeWorld() {
        // Set gravity
        this.world.gravity.set(0, -30, 0);
        
        // Improve collision detection with higher quality settings
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 20;
        this.world.solver.tolerance = 0.001;
        this.world.allowSleep = true;
        this.world.defaultContactMaterial.contactEquationStiffness = 1e9;
        this.world.defaultContactMaterial.contactEquationRelaxation = 4;
        
        // Materials for different surfaces
        this.groundMaterial = new CANNON.Material('ground');
        this.ballMaterial = new CANNON.Material('ball');
        this.wallMaterial = new CANNON.Material('wall');
        this.rampMaterial = new CANNON.Material('ramp');
        
        // Contact materials
        const ballGroundContact = new CANNON.ContactMaterial(
            this.ballMaterial,
            this.groundMaterial,
            {
                friction: 0.6,
                restitution: 0.5,
                contactEquationStiffness: 1e8,
                contactEquationRelaxation: 3
            }
        );
        
        const ballWallContact = new CANNON.ContactMaterial(
            this.ballMaterial,
            this.wallMaterial,
            {
                friction: 0.0,
                restitution: 0.95,
                contactEquationStiffness: 1e9,
                contactEquationRelaxation: 4
            }
        );
        
        const ballRampContact = new CANNON.ContactMaterial(
            this.ballMaterial,
            this.rampMaterial,
            {
                friction: 0.8,  // High friction for rolling up
                restitution: 0.1, // Low bounce
                contactEquationStiffness: 1e8,
                contactEquationRelaxation: 3
            }
        );
        
        this.world.addContactMaterial(ballGroundContact);
        this.world.addContactMaterial(ballWallContact);
        this.world.addContactMaterial(ballRampContact);
        this.world.addContactMaterial(ballRampContact);
        
        // Setup collision listeners for bounce pads and bumpers
        this.setupCollisionListeners();
    }
    
    destroyPhysicsWorld() {
        console.log('💥 Destroying physics world...');
        
        // Remove all bodies from world
        while (this.world.bodies.length > 0) {
            this.world.removeBody(this.world.bodies[0]);
        }
        
        // Clear all references
        this.meshToBody.clear();
        this.groundBodies = [];
        this.wallBodies = [];
        
        // Clear contact materials
        this.world.contactmaterials = [];
        
        console.log('✅ Physics world destroyed');
    }
    
    clearCustomObjects() {
        console.log('🧹 Clearing custom map objects from physics...');
        
        // Remove all bodies except ground, walls (boundary), and balls
        const bodiesToRemove = [];
        this.world.bodies.forEach(body => {
            // Keep ground, boundary walls, and balls
            if (!body.isGround && !body.isBoundaryWall && !body.isBall) {
                bodiesToRemove.push(body);
            }
        });
        
        bodiesToRemove.forEach(body => {
            this.world.removeBody(body);
        });
        
        console.log(`✅ Removed ${bodiesToRemove.length} custom objects from physics`);
    }
    
    setGravity(gravity) {
        this.defaultGravity = gravity;
        this.world.gravity.set(0, gravity, 0);
        console.log('⚖️ Gravity set to:', gravity);
    }
    
    rebuildPhysicsWorld() {
        console.log('🔨 Rebuilding physics world from scratch...');
        
        // Destroy existing world
        this.destroyPhysicsWorld();
        
        // Create fresh world
        this.world = new CANNON.World();
        this.meshToBody = new Map();
        this.groundBodies = [];
        this.wallBodies = [];
        
        // Initialize with fresh settings
        this.initializeWorld();
        
        // Warm up the physics world with a few steps to ensure proper initialization
        for (let i = 0; i < 5; i++) {
            this.world.step(1 / 60);
        }
        
        console.log('✅ Physics world rebuilt and warmed up');
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
    
    createGroundBody(holePosition = null, holeRadius = 0) {
        // Create ONE continuous ground - no segmentation!
        const groundSize = 100;
        const groundThickness = 5.0;
        
        const ground = new CANNON.Body({
            mass: 0,
            material: this.groundMaterial,
            position: new CANNON.Vec3(0, -groundThickness / 2, 0)
        });
        ground.isGround = true; // Mark as ground for identification
        ground.addShape(new CANNON.Box(new CANNON.Vec3(groundSize / 2, groundThickness / 2, groundSize / 2)));
        this.world.addBody(ground);
        this.groundBodies.push(ground);
        
        console.log('🌍 Continuous ground physics body created');
        return ground;
    }
    
    createGroundWithHole(holePosition, holeRadius) {
        // Just store hole info - no need to cut anything out
        // Ball will pass through ground when over the hole
        this.holePosition = holePosition;
        this.holeRadius = holeRadius;
        
        console.log('⛳ Hole position registered at', holePosition);
    }
    
    createBallBody(mesh, mass = 1) {
        const shape = new CANNON.Sphere(0.5); // Ball radius
        const body = new CANNON.Body({
            mass: mass,
            material: this.ballMaterial,
            linearDamping: 0.9, // Air resistance - stops a bit faster
            angularDamping: 0.3 // Rotational damping to slow rolling
        });
        body.isBall = true; // Mark as ball for identification
        body.addShape(shape);
        body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
        
        // Enable Continuous Collision Detection (CCD) to prevent tunneling at high speeds
        body.ccdSpeedThreshold = 0.1; // Enable CCD at very low speeds to catch everything
        body.ccdIterations = 20; // Increased iterations for better accuracy
        
        this.world.addBody(body);
        this.meshToBody.set(mesh, body);
        
        console.log('⚽ Ball physics body created with CCD at:', mesh.position);
        return body;
    }
    
    createWall(position, size, rotationY = 0, color = 0x8b4513, isBoundary = false) {
        // Create visual mesh
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const wallTexture = this.createWallTexture(color);
        wallTexture.repeat.set(Math.max(1, size.x / 2), Math.max(1, size.y / 2));
        const material = new THREE.MeshStandardMaterial({
            color: color,
            map: wallTexture,
            roughness: 0.8,
            metalness: 0.2,
            // Make boundary walls invisible
            transparent: isBoundary,
            opacity: isBoundary ? 0 : 1
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.y = (rotationY * Math.PI) / 180;
        mesh.position.set(position.x, position.y, position.z);
        mesh.castShadow = !isBoundary; // Don't cast shadows if invisible
        mesh.receiveShadow = !isBoundary; // Don't receive shadows if invisible
        // Tag boundary walls differently so they don't get removed
        mesh.userData.type = isBoundary ? 'boundary-wall' : 'wall';
        this.scene.add(mesh);
        
        // Create physics body
        const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
        const body = new CANNON.Body({
            mass: 0, // Static
            material: this.wallMaterial
        });
        body.isBoundaryWall = isBoundary; // Mark boundary walls
        body.addShape(shape);
        body.position.set(position.x, position.y, position.z);
        
        // Apply rotation to physics body
        const rotationRad = (rotationY * Math.PI) / 180;
        body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotationRad);
        
        this.world.addBody(body);
        this.meshToBody.set(mesh, body);
        this.wallBodies.push(body);
        
        console.log('🧱 Wall created at:', position, 'rotation:', rotationY);
        return { mesh, body };
    }
    
    createRamp(position, size, rotationY = 0, angle = 15, color = 0x6b8e23) {
        // Create visual mesh
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const material = new THREE.MeshLambertMaterial({
            color: color
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y, position.z);
        mesh.userData.type = 'ramp'; // Tag for removal
        
        // Rotate the mesh for ramp angle (in radians)
        const angleRad = (angle * Math.PI) / 180;
        mesh.rotation.z = angleRad; // Tilt on Z axis
        mesh.rotation.y = (rotationY * Math.PI) / 180; // Direction the ramp faces
        
        this.scene.add(mesh);
        
        // Create physics body
        const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
        const body = new CANNON.Body({
            mass: 0, // Static
            material: this.rampMaterial // Use ramp material for better rolling
        });
        body.addShape(shape);
        body.position.set(position.x, position.y, position.z);
        
        // Apply same rotation to physics body
        body.quaternion.setFromEuler(0, (rotationY * Math.PI) / 180, angleRad);
        
        this.world.addBody(body);
        this.meshToBody.set(mesh, body);
        this.wallBodies.push(body);
        
        console.log('🛝 Ramp created at:', position, 'angle:', angle, 'degrees');
        return { mesh, body };
    }
    
    applyImpulse(mesh, impulse) {
        const body = this.meshToBody.get(mesh);
        if (body) {
            let modifiedImpulse = { ...impulse };
            
            // Apply super boost if active
            if (this.activePowerupEffects.superBoost) {
                modifiedImpulse.x *= 3;
                modifiedImpulse.y *= 3;
                modifiedImpulse.z *= 3;
                console.log('💥 SUPER BOOST ACTIVATED! 3X POWER + CRAZY BOUNCES!');
                this.activePowerupEffects.superBoost = false;
                // Track that super boost bouncing is active
                this.activePowerupEffects.superBoostBouncing = true;
                // Keep crazy bounces active for 8 seconds after shot
                setTimeout(() => {
                    this.resetBounceModifier();
                    this.activePowerupEffects.superBoostBouncing = false;
                    console.log('💥 Super Boost bounce effect ended');
                }, 8000);
            }
            
            // Apply feather ball if active (reduce gravity temporarily)
            if (this.activePowerupEffects.featherBall) {
                this.world.gravity.set(0, -8, 0); // Much lighter gravity
                console.log('🪶 Feather Ball activated!');
                
                // Reset gravity after 3 seconds
                setTimeout(() => {
                    this.world.gravity.set(0, this.defaultGravity, 0);
                    this.activePowerupEffects.featherBall = false;
                    console.log('🪶 Feather Ball effect ended');
                }, 3000);
            }
            
            // Apply impulse at center of mass
            body.applyImpulse(
                new CANNON.Vec3(modifiedImpulse.x, modifiedImpulse.y, modifiedImpulse.z),
                new CANNON.Vec3(0, 0, 0)
            );
            console.log('💨 Applied impulse:', modifiedImpulse);
        }
    }
    
    /**
     * Apply powerup effect based on type
     */
    applyPowerupEffect(powerupType) {
        if (!powerupType) return;
        
        switch (powerupType.id) {
            case 'super_boost':
                this.activePowerupEffects.superBoost = true;
                // Also increase wall bounce for crazy knockback
                this.world.contactmaterials.forEach(cm => {
                    if (cm.materials.includes(this.ballMaterial) && cm.materials.includes(this.wallMaterial)) {
                        cm.restitution = 3.0; // 3x wall bounce for maximum chaos
                    }
                });
                console.log('💥 Super Boost ready for next shot! 3X POWER + CRAZY BOUNCES!');
                break;
                
            case 'feather_ball':
                this.activePowerupEffects.featherBall = true;
                console.log('🪶 Feather Ball ready for next shot!');
                break;
                
            case 'super_bounce':
                this.activePowerupEffects.superBounce = true;
                this.applyBounceModifier(2.5); // 2.5x bounce - reduced to prevent infinite loops
                console.log('🏀 Super Bounce activated! (2.5x bounce)');
                // Reset after 8 seconds
                setTimeout(() => {
                    if (this.activePowerupEffects.superBounce) {
                        this.resetBounceModifier();
                        this.activePowerupEffects.superBounce = false;
                        console.log('🏀 Super Bounce effect ended');
                    }
                }, 8000);
                break;
                
            case 'sticky_ball':
                this.activePowerupEffects.stickyBall = true;
                this.applyBounceModifier(0.05); // Almost no bounce (5% of normal)
                console.log('🍯 Sticky Ball activated! (No bounce)');
                // Reset after 8 seconds
                setTimeout(() => {
                    if (this.activePowerupEffects.stickyBall) {
                        this.resetBounceModifier();
                        this.activePowerupEffects.stickyBall = false;
                        console.log('🍯 Sticky Ball effect ended');
                    }
                }, 8000);
                break;
                
            case 'mulligan':
                // Mulligan will be handled by shot mechanics (teleport to last position)
                console.log('⏪ Mulligan ready! Will undo last shot');
                break;
                
            case 'double_shot':
                // Double shot will be handled by shot mechanics (allow shooting while moving)
                console.log('⏩ Double Shot ready! Can shoot while moving');
                break;
                
            case 'free_shot':
                // Free shot will be handled by shot mechanics (next shot doesn't count)
                console.log('🆓 Free Shot ready! Next shot is free');
                break;
        }
    }
    
    /**
     * Modify ball bounce (restitution)
     */
    applyBounceModifier(multiplier) {
        // Find and modify ball contact materials
        this.world.contactmaterials.forEach(cm => {
            if (cm.materials.includes(this.ballMaterial)) {
                cm.restitution *= multiplier;
            }
        });
    }
    
    /**
     * Reset ball bounce to default
     */
    resetBounceModifier() {
        // Reset to defaults
        this.world.contactmaterials.forEach(cm => {
            if (cm.materials.includes(this.ballMaterial) && cm.materials.includes(this.groundMaterial)) {
                cm.restitution = 0.7; // Default from constructor
            }
            if (cm.materials.includes(this.ballMaterial) && cm.materials.includes(this.wallMaterial)) {
                cm.restitution = 0.6; // Default from constructor
            }
        });
    }
    
    /**
     * Check if a powerup effect is active
     */
    hasActiveEffect(effectName) {
        return this.activePowerupEffects[effectName] === true;
    }
    
    createBouncePad(position, strength, radius) {
        // Create a thin cylinder body for the bounce pad
        const shape = new CANNON.Cylinder(radius, radius, 0.3, 16);
        const body = new CANNON.Body({
            mass: 0, // Static
            position: new CANNON.Vec3(position.x, position.y, position.z),
            collisionResponse: false // Make it a sensor - detect collisions but don't apply forces
        });
        body.addShape(shape);
        
        // Rotate to be horizontal
        body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        
        // Store bounce pad data
        body.isBouncePad = true;
        body.bounceStrength = strength;
        
        this.world.addBody(body);
        console.log('🟢 Bounce pad physics body created at:', position);
        return body;
    }
    
    createBumper(position, strength = 15, radius = 1) {
        // Create cylinder body for bumper
        const shape = new CANNON.Cylinder(radius, radius, 0.5, 32);
        const body = new CANNON.Body({
            mass: 0, // Static
            position: new CANNON.Vec3(position.x, position.y, position.z),
            collisionResponse: false // Make it a sensor - detect collisions but don't apply physical forces
        });
        body.addShape(shape);
        
        // Rotate to be upright
        body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        
        // Store bumper data
        body.isBumper = true;
        body.pushStrength = strength;
        
        this.world.addBody(body);
        console.log('🔴 Bumper physics body created at:', position, 'strength:', strength);
        return body;
    }
    
    createSpeedBoost(position, strength = 30, rotationY = 0, radius = 0.8) {
        // Create cylinder body for speed boost
        const shape = new CANNON.Cylinder(radius, radius, 0.2, 32);
        const body = new CANNON.Body({
            mass: 0, // Static
            position: new CANNON.Vec3(position.x, position.y, position.z),
            collisionResponse: false // Make it a sensor - detect collisions but don't apply physical forces
        });
        body.addShape(shape);
        
        // Rotate to be horizontal
        body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        
        // Store speed boost data with direction
        body.isSpeedBoost = true;
        body.boostStrength = strength;
        body.boostRotationY = rotationY;
        
        this.world.addBody(body);
        console.log('💨 Speed boost physics body created at:', position, 'strength:', strength);
        return body;
    }
    
    createLava(position, width = 5, depth = 5) {
        // Create box body for lava pool
        const shape = new CANNON.Box(new CANNON.Vec3(width / 2, 0.1, depth / 2));
        const body = new CANNON.Body({
            mass: 0, // Static
            position: new CANNON.Vec3(position.x, position.y, position.z),
            collisionResponse: false // Make it a sensor - detect collisions but don't apply physical forces
        });
        body.addShape(shape);
        
        // Store lava data
        body.isLava = true;
        
        this.world.addBody(body);
        console.log('🔥 Lava pool physics body created at:', position, 'size:', width, 'x', depth);
        return body;
    }
    
    createSpinner(position, length = 8, speed = 1) {
        // Create rotating box body for spinner blade
        const shape = new CANNON.Box(new CANNON.Vec3(length / 2, 0.2, 0.5));
        const body = new CANNON.Body({
            mass: 0, // Static/kinematic
            position: new CANNON.Vec3(position.x, position.y + 0.5, position.z),
            type: CANNON.Body.KINEMATIC // Kinematic bodies move but aren't affected by forces
        });
        body.addShape(shape);
        
        // Store spinner data
        body.isSpinner = true;
        body.spinnerLength = length;
        body.spinnerSpeed = speed * 0.02; // Radians per frame
        body.spinnerAngle = 0;
        
        this.world.addBody(body);
        
        // Store for rotation update
        if (!this.spinnerBodies) this.spinnerBodies = [];
        this.spinnerBodies.push(body);
        
        console.log('🌀 Spinner physics body created at:', position, 'length:', length, 'speed:', speed);
        return body;
    }
    
    update(deltaTime) {
        // Update spinner rotations
        if (this.spinnerBodies) {
            this.spinnerBodies.forEach(body => {
                // Rotate the spinner body
                body.spinnerAngle += body.spinnerSpeed;
                body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), body.spinnerAngle);
            });
        }
        
        // Apply fan forces to balls
        if (this.sceneManager && this.sceneManager.fans) {
            this.meshToBody.forEach((body, mesh) => {
                // Only apply to balls (spheres with radius 0.5)
                if (body.shapes[0] && body.shapes[0].radius === 0.5) {
                    this.sceneManager.fans.forEach(fan => {
                        const fanPos = fan.group.position;
                        const ballPos = body.position;
                        
                        // Get fan direction (forward direction of the fan)
                        const fanRotation = fan.group.rotation;
                        
                        // Convert THREE.js Euler to direction vector
                        const direction = new CANNON.Vec3(
                            Math.sin(fanRotation.y) * Math.cos(fanRotation.x),
                            -Math.sin(fanRotation.x),
                            Math.cos(fanRotation.y) * Math.cos(fanRotation.x)
                        );
                        
                        // Calculate vector from fan to ball
                        const dx = ballPos.x - fanPos.x;
                        const dy = ballPos.y - fanPos.y;
                        const dz = ballPos.z - fanPos.z;
                        
                        // Project ball position onto fan direction (distance along the line)
                        const distanceAlong = dx * direction.x + dy * direction.y + dz * direction.z;
                        
                        // Only affect balls in front of fan (positive direction) within range
                        const maxRange = 12;
                        if (distanceAlong > 0 && distanceAlong < maxRange) {
                            // Calculate perpendicular distance from fan's centerline
                            const projectionX = fanPos.x + direction.x * distanceAlong;
                            const projectionY = fanPos.y + direction.y * distanceAlong;
                            const projectionZ = fanPos.z + direction.z * distanceAlong;
                            
                            const perpDist = Math.sqrt(
                                Math.pow(ballPos.x - projectionX, 2) +
                                Math.pow(ballPos.y - projectionY, 2) +
                                Math.pow(ballPos.z - projectionZ, 2)
                            );
                            
                            // Only push if ball is within narrow corridor (3 units from centerline)
                            const corridorWidth = 3;
                            if (perpDist < corridorWidth) {
                                // Force decreases with distance along and perpendicular distance
                                const alongFalloff = 1 - (distanceAlong / maxRange);
                                const perpFalloff = 1 - (perpDist / corridorWidth);
                                const forceMagnitude = fan.strength * alongFalloff * perpFalloff;
                                
                                // Apply force in fan direction
                                const force = direction.scale(forceMagnitude);
                                body.applyForce(force, body.position);
                            }
                        }
                    });
                }
            });
        }
        
        // Check if ball is over hole and apply downward force to make it fall
        if (this.holePosition && this.holeRadius && this.groundBodies.length > 0) {
            this.meshToBody.forEach((body, mesh) => {
                // Only check balls (spheres with radius 0.5)
                if (body.shapes[0] && body.shapes[0].radius === 0.5) {
                    const dx = body.position.x - this.holePosition.x;
                    const dz = body.position.z - this.holePosition.z;
                    const distance2D = Math.sqrt(dx * dx + dz * dz);
                    
                    // Track if ball is in settling phase
                    if (!body.holeSettling) {
                        body.holeSettling = 0;
                    }
                    
                    // If ball is over hole and near ground level, let it fall
                    // Trigger EARLIER (y < 0.8) to avoid hitting funnel edges
                    // Only allow entry if NOT already settling (prevents bounce loop)
                    if (distance2D < this.holeRadius && body.position.y < 0.8 && body.position.y > 0 && body.holeSettling === 0) {
                        // Disable collision with ground only while ball enters hole
                        console.log('🕳️ Ball entering hole - disabling collision');
                        body.collisionFilterGroup = 2; // Different collision group
                        body.collisionFilterMask = 0; // Don't collide with anything
                        // Apply downward pull if not falling fast enough
                        if (body.velocity.y > -1) {
                            body.velocity.y = -2;
                        }
                        body.holeSettling = 1; // Mark as entering (prevents re-entry)
                    } else if (body.collisionFilterGroup === 2 && body.position.y <= 0 && body.holeSettling === 1) {
                        // Ball has entered hole (below ground) - teleport to safe position and kill velocity
                        console.log('⬇️ Ball scored! Teleporting to hole bottom at Y: -1.5');
                        // Teleport to center of hole bottom (prevents collision overlap bounce)
                        body.position.set(this.holePosition.x, -1.5, this.holePosition.z);
                        body.velocity.set(0, 0, 0);
                        body.angularVelocity.set(0, 0, 0);
                        // Keep collision disabled - ball is scored and settled
                        body.holeSettling = 2; // Mark as complete
                    } else if (body.holeSettling === 2) {
                        // Ball is settled in hole - lock position and velocity
                        body.position.set(this.holePosition.x, -1.5, this.holePosition.z);
                        body.velocity.set(0, 0, 0);
                        body.angularVelocity.set(0, 0, 0);
                    } else if (body.collisionFilterGroup === 2 && distance2D >= this.holeRadius) {
                        // Ball moved away from hole horizontally - restore collision
                        console.warn('⚠️ Ball escaped hole horizontally! Restoring collision');
                        body.collisionFilterGroup = 1;
                        body.collisionFilterMask = -1;
                        body.holeSettling = 0;
                    }
                }
            });
        }
        
        // Step the physics world with more substeps for high-speed collisions
        this.world.step(1 / 60, deltaTime, 10); // Increased substeps from 3 to 10
        
        // Update Three.js meshes from physics bodies
        this.meshToBody.forEach((body, mesh) => {
            // Cap ball velocity to prevent tunneling and infinite loops
            if (body.shapes[0] && body.shapes[0].radius === 0.5) { // Is a ball
                // Store previous position for tunneling check
                if (!body.previousPosition) {
                    body.previousPosition = body.position.clone();
                }
                
                // Speed cap: adjust these values to change max speeds
                const normalMaxSpeed = 100;
                const superBoostBouncingMaxSpeed = 90; // Higher cap now that tunneling is fixed
                const maxSpeed = this.activePowerupEffects.superBoostBouncing ? superBoostBouncingMaxSpeed : normalMaxSpeed;
                const speed = body.velocity.length();
                
                if (speed > maxSpeed) {
                    body.velocity.scale(maxSpeed / speed, body.velocity);
                }
                
                // Anti-tunneling raycast check for high speeds
                if (speed > 20) {
                    const ray = new CANNON.Ray(body.previousPosition, body.position);
                    const result = new CANNON.RaycastResult();
                    ray.intersectWorld(this.world, {
                        mode: CANNON.Ray.ALL,
                        result: result,
                        skipBackfaces: false,
                        collisionFilterMask: -1,
                        from: body.previousPosition,
                        to: body.position,
                        callback: (result) => {
                            // If we hit a wall between previous and current position
                            if (result.body && result.body !== body && result.body.mass === 0) {
                                // Teleport back to just before the wall
                                const hitPoint = result.hitPointWorld;
                                const normal = result.hitNormalWorld;
                                // Place ball slightly away from wall along normal
                                body.position.copy(hitPoint).vadd(normal.scale(0.6), body.position);
                                // Reflect velocity
                                const dot = body.velocity.dot(normal);
                                body.velocity.vsub(normal.scale(2 * dot), body.velocity);
                                console.log('🛑 Prevented tunneling! Teleported ball back');
                            }
                        }
                    });
                }
                
                // Update previous position for next frame
                body.previousPosition.copy(body.position);
                
                // Add energy loss over time to prevent infinite bouncing
                // Apply light damping during super boost bouncing (tunneling is now prevented by raycast)
                if (this.activePowerupEffects.superBoostBouncing && speed > 5) {
                    const dampingFactor = 0.995; // Light damping - anti-tunneling handles the rest
                    body.velocity.scale(dampingFactor, body.velocity);
                } else if (this.activePowerupEffects.superBounce && speed > 5) {
                    const dampingFactor = 0.992; // Stronger damping during super bounce
                    body.velocity.scale(dampingFactor, body.velocity);
                } else if (speed > 100) { // Normal damping for high speeds
                    const dampingFactor = 0.998; // Slight energy loss per frame
                    body.velocity.scale(dampingFactor, body.velocity);
                }
                
                // Check if ball is over valid ground (within play area bounds)
                const playAreaSize = 100;
                const halfSize = playAreaSize / 2;
                const isOverGround = body.position.x >= -halfSize && body.position.x <= halfSize &&
                                   body.position.z >= -halfSize && body.position.z <= halfSize &&
                                   body.position.y >= -2; // Allow slight dip below ground
                
                // If ball is over ground and not in hole, save this as safe position
                if (isOverGround && body.holeSettling !== 2) {
                    if (!this.lastSafePositions.has(mesh)) {
                        this.lastSafePositions.set(mesh, new CANNON.Vec3());
                    }
                    this.lastSafePositions.get(mesh).copy(body.position);
                }
                
                // If ball is NOT over ground, teleport to last shot position
                if (!isOverGround && body.holeSettling !== 2) {
                    let teleportPos = null;
                    
                    if (this.lastShotPosition) {
                        // Try to find ground below the shot position
                        teleportPos = this.findGroundBelow(this.lastShotPosition);
                        
                        // If no ground directly below, find nearest ground
                        if (!teleportPos) {
                            console.log('⚠️ No ground below shot position, searching for nearest ground...');
                            teleportPos = this.findNearestGround(this.lastShotPosition);
                        }
                        
                        if (teleportPos) {
                            console.log('🚀 Ball went off map! Teleporting to shot position:', teleportPos);
                        }
                    }
                    
                    // Fallback to last safe position if we couldn't find ground near shot position
                    if (!teleportPos && this.lastSafePositions.has(mesh)) {
                        teleportPos = this.lastSafePositions.get(mesh);
                        console.log('🚀 Ball went off map! Using fallback safe position:', teleportPos);
                    }
                    
                    if (teleportPos) {
                        body.position.copy(teleportPos);
                        body.velocity.set(0, 0, 0);
                        body.angularVelocity.set(0, 0, 0);
                    }
                }
                
                // Safety check: if ball falls below floor (except in hole), teleport it back up
                // Don't apply if ball has scored (holeSettling === 2)
                if (body.holeSettling !== 2) {
                    const dx = body.position.x - (this.holePosition?.x || 99999);
                    const dz = body.position.z - (this.holePosition?.z || 99999);
                    const distance2D = Math.sqrt(dx * dx + dz * dz);
                    const notInHole = distance2D > (this.holeRadius || 0) + 2;
                    
                    if (body.position.y < -0.5 && notInHole) {
                        console.warn('⚠️ Ball clipped through floor! Teleporting back up');
                        body.position.y = 1;
                        body.velocity.set(0, 0, 0);
                        body.angularVelocity.set(0, 0, 0);
                    }
                }
            }
            
            mesh.position.copy(body.position);
            mesh.quaternion.copy(body.quaternion);
        });
    }
    
    setLastShotPosition(position) {
        // Store the position where the shot was taken from
        this.lastShotPosition = new CANNON.Vec3(position.x, position.y, position.z);
        console.log('📍 Last shot position saved:', this.lastShotPosition);
    }
    
    findGroundBelow(position) {
        // Cast a ray downward from position to find ground
        const rayStart = new CANNON.Vec3(position.x, position.y + 10, position.z);
        const rayEnd = new CANNON.Vec3(position.x, -10, position.z);
        const result = new CANNON.RaycastResult();
        
        this.world.raycastClosest(rayStart, rayEnd, {}, result);
        
        if (result.hasHit) {
            // Return position slightly above the ground
            return new CANNON.Vec3(
                result.hitPointWorld.x,
                result.hitPointWorld.y + 2,
                result.hitPointWorld.z
            );
        }
        
        return null;
    }
    
    findNearestGround(position) {
        // Search in a spiral pattern for the nearest ground
        const searchRadius = 20;
        const steps = 8;
        
        for (let radius = 2; radius <= searchRadius; radius += 2) {
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / steps) {
                const testX = position.x + Math.cos(angle) * radius;
                const testZ = position.z + Math.sin(angle) * radius;
                const testPos = new CANNON.Vec3(testX, position.y, testZ);
                
                const ground = this.findGroundBelow(testPos);
                if (ground) {
                    console.log('🎯 Found nearest ground at:', ground);
                    return ground;
                }
            }
        }
        
        return null;
    }
    
    getBallVelocity(mesh) {
        const body = this.meshToBody.get(mesh);
        if (body) {
            return body.velocity;
        }
        return null;
    }
}
