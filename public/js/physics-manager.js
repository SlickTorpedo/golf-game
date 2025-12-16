import * as CANNON from 'https://cdn.skypack.dev/cannon-es';
import * as THREE from 'three';

export class PhysicsManager {
    constructor(scene) {
        this.scene = scene;
        this.world = new CANNON.World();
        
        // Set gravity (stronger for more weight and faster falling)
        this.world.gravity.set(0, -20, 0);
        this.defaultGravity = -20;
        
        // Active powerup effects
        this.activePowerupEffects = {
            superBoost: false,
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
                friction: 0.6, // Higher friction slows ball down more
                restitution: 0.2, // Lower bounciness
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
        
        console.log('⚙️ Physics world initialized');
    }
    
    initializeWorld() {
        // Set gravity
        this.world.gravity.set(0, -9.82, 0);
        
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
                restitution: 0.2,
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
    
    createGroundBody(holePosition = null, holeRadius = 0) {
        // Create ONE continuous ground - no segmentation!
        const groundSize = 100;
        const groundThickness = 5.0;
        
        const ground = new CANNON.Body({
            mass: 0,
            material: this.groundMaterial,
            position: new CANNON.Vec3(0, -groundThickness / 2, 0)
        });
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
            linearDamping: 0.75, // Air resistance - stops a bit faster
            angularDamping: 0.1 // Low rotational damping for natural rolling
        });
        body.addShape(shape);
        body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
        
        // Enable Continuous Collision Detection (CCD) to prevent tunneling at high speeds
        body.ccdSpeedThreshold = 1; // Enable CCD when speed exceeds 1 unit/s
        body.ccdIterations = 10; // Number of CCD iterations for accuracy
        
        this.world.addBody(body);
        this.meshToBody.set(mesh, body);
        
        console.log('⚽ Ball physics body created with CCD at:', mesh.position);
        return body;
    }
    
    createWall(position, size) {
        // Create visual mesh
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const material = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            roughness: 0.8,
            metalness: 0.2
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y, position.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        
        // Create physics body
        const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
        const body = new CANNON.Body({
            mass: 0, // Static
            material: this.wallMaterial
        });
        body.addShape(shape);
        body.position.set(position.x, position.y, position.z);
        
        this.world.addBody(body);
        this.meshToBody.set(mesh, body);
        this.wallBodies.push(body);
        
        console.log('🧱 Wall created at:', position);
        return { mesh, body };
    }
    
    createRamp(position, size, rotationY = 0, angle = 15) {
        // Create visual mesh
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const material = new THREE.MeshLambertMaterial({
            color: 0x6b8e23 // Olive green for ramps
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y, position.z);
        
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
                modifiedImpulse.x *= 5;
                modifiedImpulse.y *= 5;
                modifiedImpulse.z *= 5;
                console.log('💥 SUPER BOOST ACTIVATED! 5X POWER + CRAZY BOUNCES!');
                this.activePowerupEffects.superBoost = false;
                // Keep crazy bounces active for 8 seconds after shot
                setTimeout(() => {
                    this.resetBounceModifier();
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
                        cm.restitution = 3.0; // 3x wall bounce for controlled chaos
                    }
                });
                console.log('💥 Super Boost ready for next shot! 5X POWER + CRAZY BOUNCES!');
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
    
    update(deltaTime) {
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
                // Speed cap: adjust these values to change max speeds
                const normalMaxSpeed = 100;
                const superBoostMaxSpeed = 100; // Can be increased later if needed
                const maxSpeed = this.activePowerupEffects.superBoost ? superBoostMaxSpeed : normalMaxSpeed;
                const speed = body.velocity.length();
                
                if (speed > maxSpeed) {
                    body.velocity.scale(maxSpeed / speed, body.velocity);
                }
                
                // Add energy loss over time to prevent infinite bouncing
                // Apply stronger damping during super bounce to prevent soft-lock
                if (this.activePowerupEffects.superBounce && speed > 5) {
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
                
                // If ball is NOT over ground and has a safe position, teleport back
                if (!isOverGround && this.lastSafePositions.has(mesh) && body.holeSettling !== 2) {
                    const safePos = this.lastSafePositions.get(mesh);
                    console.log('🚀 Ball went off map! Teleporting back to:', safePos);
                    body.position.copy(safePos);
                    body.velocity.set(0, 0, 0);
                    body.angularVelocity.set(0, 0, 0);
                }
                
                // Safety check: if ball falls below floor (except in hole), teleport it back up
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
            
            mesh.position.copy(body.position);
            mesh.quaternion.copy(body.quaternion);
        });
    }
    
    getBallVelocity(mesh) {
        const body = this.meshToBody.get(mesh);
        if (body) {
            return body.velocity;
        }
        return null;
    }
}
