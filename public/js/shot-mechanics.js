import * as THREE from 'three';

export class ShotMechanics {
    constructor(scene, camera, renderer, controls, localBall, socket, audioManager, physicsManager, powerupManager) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;
        this.localBall = localBall;
        this.socket = socket;
        this.audioManager = audioManager;
        this.physicsManager = physicsManager;
        this.powerupManager = powerupManager;
        
        this.isDragging = false;
        this.dragStart = new THREE.Vector3();
        this.dragCurrent = new THREE.Vector3();
        this.powerArrows = [];
        this.arrowAnimationTime = 0;
        this.isRightDragging = false;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.disabled = false; // Control state
        this.strokeCount = 0;
        this.lastShotPosition = null; // For mulligan
        this.doubleShot = false; // For double shot powerup
        this.freeShot = false; // For free shot powerup
        
        // Create invisible hit zone around ball for easier clicking
        const hitZoneGeometry = new THREE.SphereGeometry(2, 16, 16);
        const hitZoneMaterial = new THREE.MeshBasicMaterial({ 
            visible: false 
        });
        this.hitZone = new THREE.Mesh(hitZoneGeometry, hitZoneMaterial);
        this.hitZone.position.copy(this.localBall.position);
        this.scene.add(this.hitZone);
        
        this.createAimIndicators();
        this.setupEventListeners();
    }
    
    setLocalBall(ball) {
        this.localBall = ball;
    }
    
    createAimIndicators() {
        // Create 10 arrow sprites as flat triangular shapes
        for (let i = 0; i < 10; i++) {
            // Create a triangle pointing upward in 2D space
            const shape = new THREE.Shape();
            shape.moveTo(0, 0.5);      // Top point
            shape.lineTo(-0.3, -0.3);  // Bottom left
            shape.lineTo(0.3, -0.3);   // Bottom right
            shape.lineTo(0, 0.5);      // Back to top
            
            const arrowGeometry = new THREE.ShapeGeometry(shape);
            const arrowMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff88,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            });
            const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
            arrow.rotation.x = -Math.PI / 2; // Lay flat on ground
            arrow.visible = false;
            this.powerArrows.push(arrow);
            this.scene.add(arrow);
        }
    }
    
    setupEventListeners() {
        const canvas = this.renderer.domElement;
        
        canvas.addEventListener('mousedown', (e) => this.onShootStart(e));
        canvas.addEventListener('mousemove', (e) => this.onShootDrag(e));
        canvas.addEventListener('mouseup', (e) => this.onShootEnd(e));
        
        canvas.addEventListener('touchstart', (e) => this.onShootStart(e));
        canvas.addEventListener('touchmove', (e) => this.onShootDrag(e));
        canvas.addEventListener('touchend', (e) => this.onShootEnd(e));
        
        // Prevent context menu on right-click
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    getGroundIntersection(clientX, clientY) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersectPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.groundPlane, intersectPoint);
        return intersectPoint;
    }
    
    onShootStart(event) {
        if (!this.localBall) return;
        
        // Check for powerup activation
        if (this.powerupManager && this.powerupManager.hasActivePowerup()) {
            const activePowerup = this.powerupManager.getCurrentActivePowerup();
            if (activePowerup) {
                // Handle special powerups
                if (activePowerup.id === 'mulligan' && this.lastShotPosition) {
                    // Teleport back to last shot position
                    const ballBody = this.physicsManager.meshToBody.get(this.localBall);
                    if (ballBody) {
                        ballBody.position.copy(this.lastShotPosition);
                        ballBody.velocity.set(0, 0, 0);
                        ballBody.angularVelocity.set(0, 0, 0);
                        console.log('⏪ Mulligan used! Teleported back to:', this.lastShotPosition);
                    }
                    this.powerupManager.getActivePowerup(); // Clear it
                    return;
                } else if (activePowerup.id === 'double_shot') {
                    this.doubleShot = true;
                    console.log('⏩ Double Shot activated! Can shoot while moving for 10 seconds');
                    this.powerupManager.getActivePowerup(); // Clear it
                    
                    // Double shot lasts for 10 seconds
                    setTimeout(() => {
                        this.doubleShot = false;
                        console.log('⏹️ Double Shot expired');
                    }, 10000)
                } else if (activePowerup.id === 'free_shot') {
                    this.freeShot = true;
                    console.log('🆓 Free Shot activated!');
                    this.powerupManager.getActivePowerup(); // Clear it
                }
            }
        }
        
        // Ignore if controls are disabled
        if (this.disabled && event.button === 0) {
            console.log('🚫 Controls are disabled');
            return;
        }
        
        // Right-click (button 2) enables camera rotation
        if (event.button === 2) {
            console.log('🎥 Right-click: enabling camera rotation');
            this.isRightDragging = true;
            this.controls.enabled = true;
            return;
        }
        
        // Left-click (button 0) for shooting
        if (event.button !== 0 && !event.touches) return;
        
        event.preventDefault();
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        let clientX, clientY;
        
        if (event.touches) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update hit zone position
        this.hitZone.position.copy(this.localBall.position);
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        // Check both the actual ball and the hit zone buffer
        const intersects = this.raycaster.intersectObjects([this.localBall, this.hitZone]);
        
        if (intersects.length > 0) {
            // Check if ball is still moving horizontally (unless double shot is active)
            // Only check X and Z velocity, ignore Y to allow shooting while bouncing vertically
            const velocity = this.physicsManager.getBallVelocity(this.localBall);
            if (!this.doubleShot && velocity) {
                const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
                if (horizontalSpeed > 0.5) {
                    console.log('⏸️ Cannot shoot - ball is still moving horizontally!');
                    return;
                }
            }
            
            console.log('🎯 Started dragging from ball position:', this.localBall.position);
            this.isDragging = true;
            this.dragStart.copy(this.localBall.position);
            // Temporarily disable controls while aiming/shooting
            this.controls.enabled = false;
        } else {
            // Clicked elsewhere, enable controls for camera rotation
            this.controls.enabled = true;
        }
    }
    
    onShootDrag(event) {
        // If right-dragging, let OrbitControls handle it
        if (this.isRightDragging) {
            return;
        }
        
        if (!this.isDragging || !this.localBall) return;
        
        // Keep hit zone synced with ball
        this.hitZone.position.copy(this.localBall.position);
        
        event.preventDefault();
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        let clientX, clientY;
        
        if (event.touches) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        // Get ground intersection point
        const groundPoint = this.getGroundIntersection(clientX, clientY);
        if (!groundPoint) return;
        
        this.dragCurrent.copy(groundPoint);
        
        // Calculate direction vector on ground plane
        const direction = new THREE.Vector3()
            .subVectors(this.dragStart, this.dragCurrent)
            .setY(0);
        
        const distance = direction.length();
        const maxDistance = 15; // Max pull distance in world units
        const clampedDistance = Math.min(distance, maxDistance);
        
        if (distance > 0.5) {
            // Calculate how many arrows to show based on power
            const powerPercent = (clampedDistance / maxDistance) * 100;
            const numArrows = Math.max(1, Math.ceil((powerPercent / 100) * 10));
            
            // Calculate direction for arrow positioning
            const arrowDirection = direction.clone().normalize();
            
            // Show and position arrows
            for (let i = 0; i < this.powerArrows.length; i++) {
                if (i < numArrows) {
                    this.powerArrows[i].visible = true;
                    
                    // Position arrows in front of ball along drag direction
                    const distanceFromBall = 1.5 + (i * 0.8);
                    const bobOffset = Math.sin(this.arrowAnimationTime + i * 0.5) * 0.1;
                    
                    const arrowPos = new THREE.Vector3()
                        .copy(this.localBall.position)
                        .addScaledVector(arrowDirection, distanceFromBall + bobOffset);
                    
                    // Keep arrow at ball's Y position (centered on ball)
                    arrowPos.y = this.localBall.position.y;
                    this.powerArrows[i].position.copy(arrowPos);
                    
                    // Keep the flat rotation and point arrow away from ball
                    this.powerArrows[i].rotation.x = -Math.PI / 2;
                    this.powerArrows[i].rotation.y = 0;
                    this.powerArrows[i].rotation.z = Math.atan2(arrowDirection.x, arrowDirection.z) + Math.PI;
                    
                    // Pulse opacity
                    const pulseOpacity = 0.6 + Math.sin(this.arrowAnimationTime * 2 + i * 0.3) * 0.2;
                    this.powerArrows[i].material.opacity = pulseOpacity;
                } else {
                    this.powerArrows[i].visible = false;
                }
            }
        } else {
            // Hide all arrows when not dragging enough
            this.powerArrows.forEach(arrow => arrow.visible = false);
        }
    }
    
    onShootEnd(event) {
        // Handle right-click release
        if (this.isRightDragging) {
            this.isRightDragging = false;
            // Keep controls enabled for future right-clicks
            return;
        }
        
        if (!this.isDragging || !this.localBall) return;
        
        event.preventDefault();
        this.isDragging = false;
        this.controls.enabled = true;
        
        const direction = new THREE.Vector3()
            .subVectors(this.dragStart, this.dragCurrent)
            .setY(0);
        
        const distance = direction.length();
        
        if (distance > 0.5) {
            const maxDistance = 15;
            let power = Math.min(distance / maxDistance, 1.0);
            
            // Apply exponential curve for more dramatic power scaling
            // Using power^1.5 gives better feel - small drags still go far, full power is crazy
            power = Math.pow(power, 1.5);
            
            direction.normalize();
            const velocity = direction.multiplyScalar(power * 50); // Increased from 30 to 50
            
            console.log('⛳ Shooting with power:', (power * 100).toFixed(0) + '%', 'velocity:', velocity);
            
            // Play hit sound
            if (this.audioManager) {
                this.audioManager.playBallHitSound();
            }
            
            this.applyShot(velocity, power);
        }
        
        // Hide all arrows
        this.powerArrows.forEach(arrow => arrow.visible = false);
    }
    
    applyShot(velocity, power) {
        // Save current position for mulligan
        this.lastShotPosition = this.localBall.position.clone();
        
        // Play whoosh sound for stronger shots
        if (power > 0.5 && this.audioManager) {
            this.audioManager.playBallWhooshSound();
        }
        
        // Increment stroke count (unless free shot)
        if (!this.freeShot) {
            this.strokeCount++;
            this.updateStrokeDisplay();
            console.log('⛳ Stroke count:', this.strokeCount);
        } else {
            console.log('🆓 Free shot - stroke not counted!');
            this.freeShot = false; // Reset after use
        }
        
        // Don't reset double shot here - it lasts for a duration
        
        // Check and apply active powerup effect
        if (this.powerupManager && this.powerupManager.hasActivePowerup()) {
            const activePowerup = this.powerupManager.getActivePowerup();
            if (activePowerup) {
                this.physicsManager.applyPowerupEffect(activePowerup);
            }
        }
        
        // Apply physics impulse instead of manually moving the ball
        const impulseStrength = 15; // Adjust for feel
        const impulse = {
            x: velocity.x * impulseStrength,
            y: 0,
            z: velocity.z * impulseStrength
        };
        
        this.physicsManager.applyImpulse(this.localBall, impulse);
        
        // Start position update loop to sync with server
        const updatePosition = () => {
            const ballVelocity = this.physicsManager.getBallVelocity(this.localBall);
            
            if (ballVelocity && ballVelocity.length() > 0.1) {
                this.socket.emit('update-position', {
                    position: {
                        x: this.localBall.position.x,
                        y: this.localBall.position.y,
                        z: this.localBall.position.z
                    }
                });
                
                requestAnimationFrame(updatePosition);
            }
        };
        
        updatePosition();
    }
    
    disable() {
        this.disabled = true;
        // Hide all arrows
        this.powerArrows.forEach(arrow => arrow.visible = false);
        this.isDragging = false;
    }
    
    enable() {
        this.disabled = false;
    }
    
    updateArrowAnimation() {
        // Continuously update animation time for smooth bobbing/pulsing
        this.arrowAnimationTime += 0.05;
        
        // Update visible arrows with animation
        this.powerArrows.forEach((arrow, i) => {
            if (arrow.visible) {
                // Update bobbing position
                const bobOffset = Math.sin(this.arrowAnimationTime + i * 0.5) * 0.1;
                // Get the base position (stored direction would be needed, so recalculate from current position)
                const currentY = arrow.position.y;
                const baseY = 0.15;
                arrow.position.y = baseY + bobOffset;
                
                // Update pulsing opacity
                const pulseOpacity = 0.6 + Math.sin(this.arrowAnimationTime * 2 + i * 0.3) * 0.2;
                arrow.material.opacity = pulseOpacity;
            }
        });
    }
    
    updateStrokeDisplay() {
        const strokeElement = document.getElementById('stroke-count');
        if (strokeElement) {
            strokeElement.textContent = this.strokeCount;
        }
    }
    
    getStrokeCount() {
        return this.strokeCount;
    }
    
    resetStrokeCount() {
        this.strokeCount = 0;
        this.updateStrokeDisplay();
    }
}
