import * as THREE from 'three';

/**
 * Manages powerup spawning, animation, and collection
 */
export class PowerupManager {
    constructor(scene, audioManager) {
        this.scene = scene;
        this.audioManager = audioManager;
        this.powerups = [];
        this.proximityAudio = new Map(); // Track which powerups are playing proximity audio
        this.maxProximityVolume = 0.5; // 50% max volume
        this.proximityRange = 5; // Distance at which proximity audio starts (reduced for closer range)
        this.originalMusicVolume = null; // Store original music volume for ducking
        this.socket = null; // Socket for server sync
        this.powerupIdCounter = 0; // Unique ID for each powerup
        
        // Powerup inventory (max 3 slots)
        this.inventory = [];
        this.maxInventorySize = 3;
        this.activePowerup = null; // Currently active powerup effect
        
        // Powerup type definitions
        this.powerupTypes = {
            SUPER_BOOST: {
                id: 'super_boost',
                name: 'Super Boost',
                description: '15X POWER - NO LIMITS!',
                icon: '💥',
                color: '#FF0000'
            },
            FEATHER_BALL: {
                id: 'feather_ball',
                name: 'Feather Ball',
                description: 'Reduced gravity for next shot',
                icon: '🪶',
                color: '#87CEEB'
            },
            SUPER_BOUNCE: {
                id: 'super_bounce',
                name: 'Super Bounce',
                description: 'Ball bounces 2x higher',
                icon: '🏀',
                color: '#FF6B6B'
            },
            STICKY_BALL: {
                id: 'sticky_ball',
                name: 'Sticky Ball',
                description: 'Greatly reduced bounce',
                icon: '🍯',
                color: '#FFA500'
            },
            MULLIGAN: {
                id: 'mulligan',
                name: 'Mulligan',
                description: 'Undo last shot - teleport back',
                icon: '⏪',
                color: '#9B59B6'
            },
            DOUBLE_SHOT: {
                id: 'double_shot',
                name: 'Double Shot',
                description: 'Shoot while moving!',
                icon: '⏩',
                color: '#3498DB'
            },
            FREE_SHOT: {
                id: 'free_shot',
                name: 'Free Shot',
                description: 'Next shot doesn\'t count',
                icon: '🆓',
                color: '#2ECC71'
            }
        };
        
        this.powerupTypesList = Object.values(this.powerupTypes);
        
        // Make powerup manager globally accessible for console commands
        window.powerupManager = this;
        
        // Track players and active effects
        this.players = [];
        this.localPlayerId = null;
        this.activeEffects = new Map(); // Map of playerId -> array of active effects
        
        console.log('💎 Powerup Manager initialized');
        console.log('💡 Console commands: givePowerup("super_boost"), givePowerup("feather_ball"), givePowerup("super_bounce"), givePowerup("sticky_ball")');
    }

    /**
     * Set socket for server sync
     */
    setSocket(socket) {
        this.socket = socket;
    }
    
    /**
     * Set players list for targeting
     */
    setPlayers(players, localPlayerId) {
        this.players = players;
        this.localPlayerId = localPlayerId;
    }

    /**
     * Create a powerup at the specified position
     */
    createPowerup(position, powerupId = null, powerupType = null) {
        // Randomly assign type if not specified
        if (!powerupType) {
            const randomIndex = Math.floor(Math.random() * this.powerupTypesList.length);
            powerupType = this.powerupTypesList[randomIndex];
        }
        
        // Convert position to Vector3 if it's a plain object (from map data)
        const pos = position instanceof THREE.Vector3 ? position.clone() : new THREE.Vector3(position.x, position.y, position.z);
        
        const powerup = {
            id: powerupId !== null ? powerupId : this.powerupIdCounter++,
            type: powerupType,
            position: pos,
            mesh: null,
            canvas: null, // Canvas for animated texture
            context: null, // Canvas 2D context
            texture: null, // Three.js texture
            bobOffset: Math.random() * Math.PI * 2, // Random start phase
            rotationSpeed: 0.01,
            bobSpeed: 0.002,
            bobHeight: 0.3,
            pickupRadius: 1.5,
            collected: false,
            proximityAudioId: null
        };

        // Create canvas for animated texture
        powerup.canvas = document.createElement('canvas');
        powerup.canvas.width = 256;
        powerup.canvas.height = 256;
        powerup.context = powerup.canvas.getContext('2d');
        
        // Create texture from canvas
        powerup.texture = new THREE.CanvasTexture(powerup.canvas);
        powerup.texture.wrapS = THREE.RepeatWrapping;
        powerup.texture.wrapT = THREE.RepeatWrapping;
        
        // Create shimmering box (square, but thin)
        const boxGeometry = new THREE.BoxGeometry(1, 1, 0.5); // Width, height, depth
        
        // Box with animated texture
        const boxMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700, // Gold base
            map: powerup.texture, // Animated texture
            metalness: 0.7,
            roughness: 0.3,
            emissive: 0xffaa00,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.95
        });
        
        powerup.mesh = new THREE.Mesh(boxGeometry, boxMaterial);
        powerup.mesh.position.copy(position);
        powerup.mesh.castShadow = true;
        powerup.mesh.receiveShadow = true;
        
        // Add wireframe overlay for grid effect
        const wireframeGeometry = new THREE.EdgesGeometry(boxGeometry);
        const wireframeMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.9 
        });
        const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
        powerup.mesh.add(wireframe);

        this.scene.add(powerup.mesh);

        this.powerups.push(powerup);
        console.log('💎 Powerup created at', position);
        
        return powerup;
    }



    /**
     * Update all powerups (animation, proximity checks)
     */
    update(deltaTime, ballPosition) {
        const time = Date.now() * 0.001;

        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const powerup = this.powerups[i];
            
            if (powerup.collected) {
                continue;
            }

            // Bob animation
            const bobOffset = Math.sin(time * powerup.bobSpeed * 1000 + powerup.bobOffset) * powerup.bobHeight;
            powerup.mesh.position.y = powerup.position.y + bobOffset;

            // Spin animation
            powerup.mesh.rotation.y += powerup.rotationSpeed;
            
            // Update animated texture pattern
            if (powerup.context && powerup.texture) {
                const ctx = powerup.context;
                const canvas = powerup.canvas;
                
                // Clear canvas
                ctx.fillStyle = 'rgba(255, 215, 0, 0.1)'; // Semi-transparent gold
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw animated diagonal stripes
                const stripeWidth = 20;
                const stripeOffset = (time * 50 + powerup.bobOffset * 100) % (stripeWidth * 2);
                
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 2;
                
                for (let i = -canvas.width; i < canvas.width * 2; i += stripeWidth * 2) {
                    ctx.beginPath();
                    ctx.moveTo(i - stripeOffset, 0);
                    ctx.lineTo(i - stripeOffset + canvas.height, canvas.height);
                    ctx.stroke();
                }
                
                // Add pulsing dots
                const pulseSize = Math.sin(time * 4 + powerup.bobOffset) * 2 + 4;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                
                for (let x = 32; x < canvas.width; x += 64) {
                    for (let y = 32; y < canvas.height; y += 64) {
                        ctx.beginPath();
                        ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                
                powerup.texture.needsUpdate = true;
            }

            // Shimmer effect - pulse emissive intensity
            const shimmer = Math.sin(time * 3 + powerup.bobOffset) * 0.3 + 0.4;
            powerup.mesh.material.emissiveIntensity = shimmer;

            // Check distance to ball for collection and proximity audio
            if (ballPosition) {
                const distance = powerup.mesh.position.distanceTo(ballPosition);

                // Proximity audio
                this.updateProximityAudio(powerup, distance);

                // Collection check
                if (distance < powerup.pickupRadius) {
                    this.collectPowerup(powerup, i);
                }
            }
        }
    }

    /**
     * Handle proximity audio based on distance to ball
     */
    updateProximityAudio(powerup, distance) {
        if (distance < this.proximityRange) {
            // Calculate volume based on distance (closer = louder)
            const volume = Math.max(0, Math.min(this.maxProximityVolume, 
                this.maxProximityVolume * (1 - distance / this.proximityRange)));

            if (!powerup.proximityAudioId) {
                // Store original music volume on first powerup proximity
                if (this.originalMusicVolume === null) {
                    this.originalMusicVolume = this.audioManager.volumes.music;
                }
                // Start playing proximity audio
                powerup.proximityAudioId = this.audioManager.playProximitySound(volume);
                this.proximityAudio.set(powerup, powerup.proximityAudioId);
            } else {
                // Update existing audio volume
                this.audioManager.updateProximityVolume(powerup.proximityAudioId, volume);
            }

            // Duck music volume based on proximity sound (inverse relationship)
            const musicDuckAmount = (volume / this.maxProximityVolume) * 0.7; // Duck up to 70%
            const duckedMusicVolume = this.originalMusicVolume * (1 - musicDuckAmount);
            this.audioManager.setMusicVolume(duckedMusicVolume);
        } else if (powerup.proximityAudioId) {
            // Stop proximity audio when too far
            this.audioManager.stopProximitySound(powerup.proximityAudioId);
            powerup.proximityAudioId = null;
            this.proximityAudio.delete(powerup);

            // Restore music volume if no more proximity audio playing
            if (this.proximityAudio.size === 0 && this.originalMusicVolume !== null) {
                this.audioManager.setMusicVolume(this.originalMusicVolume);
                this.originalMusicVolume = null;
            }
        }
    }

    /**
     * Collect a powerup (play effects, remove from scene)
     */
    collectPowerup(powerup, index) {
        if (powerup.collected) return;
        
        powerup.collected = true;
        console.log('💎 Powerup collected! Type:', powerup.type.name, 'ID:', powerup.id);

        // Check if inventory is full
        const isFull = this.inventory.length >= this.maxInventorySize;

        // Notify server of powerup collection
        if (this.socket) {
            this.socket.emit('powerup-collected', { powerupId: powerup.id });
        }

        // Stop proximity audio
        if (powerup.proximityAudioId) {
            this.audioManager.stopProximitySound(powerup.proximityAudioId);
            powerup.proximityAudioId = null;
            this.proximityAudio.delete(powerup);
        }

        // Play pickup sound
        this.audioManager.playPickupSound();

        // Create explosion effect (red if inventory full, confetti if not)
        if (isFull) {
            this.createRedExplosion(powerup.mesh.position);
            console.log('❌ Inventory full! Powerup destroyed');
        } else {
            this.createExplosion(powerup.mesh.position);
            // Add to inventory
            this.addToInventory(powerup.type);
        }

        // Remove from scene
        this.scene.remove(powerup.mesh);

        // Dispose of geometries, materials, and textures
        powerup.mesh.geometry.dispose();
        if (powerup.texture) {
            powerup.texture.dispose();
        }
        powerup.mesh.material.dispose();

        // Remove from array
        this.powerups.splice(index, 1);
    }

    /**
     * Add powerup to inventory and update UI
     */
    addToInventory(powerupType) {
        if (this.inventory.length >= this.maxInventorySize) {
            console.warn('⚠️ Cannot add powerup: inventory full');
            return false;
        }
        
        this.inventory.push(powerupType);
        this.updateInventoryUI();
        console.log('✅ Added to inventory:', powerupType.name, '- Slots:', this.inventory.length + '/' + this.maxInventorySize);
        return true;
    }

    /**
     * Update UI to show current inventory
     */
    updateInventoryUI() {
        const slots = document.querySelectorAll('.powerup-slot');
        
        slots.forEach((slot, index) => {
            if (index < this.inventory.length) {
                const powerup = this.inventory[index];
                slot.classList.remove('empty');
                slot.textContent = powerup.icon;
                slot.style.borderColor = powerup.color;
                slot.style.boxShadow = `0 0 20px ${powerup.color}80`;
                slot.title = `${powerup.name}: ${powerup.description}`;
                
                // Add click handler
                slot.onclick = () => this.activatePowerup(index);
            } else {
                slot.classList.add('empty');
                slot.textContent = '';
                slot.style.borderColor = '';
                slot.style.boxShadow = '';
                slot.title = '';
                slot.onclick = null;
            }
        });
    }

    /**
     * Activate powerup from inventory - show player selection
     */
    activatePowerup(slotIndex) {
        if (slotIndex >= this.inventory.length) return;
        
        const powerupType = this.inventory[slotIndex];
        console.log('🊀 Showing player selection for:', powerupType.name);
        
        // Show player selection modal
        this.showPlayerSelection(powerupType, slotIndex);
    }
    
    /**
     * Show player selection modal
     */
    showPlayerSelection(powerupType, slotIndex) {
        const modal = document.getElementById('player-selection-modal');
        const playerList = document.getElementById('player-selection-list');
        const description = modal.querySelector('.powerup-description');
        
        // Set powerup description
        description.textContent = `${powerupType.icon} ${powerupType.name}: ${powerupType.description}`;
        
        // Clear previous list
        playerList.innerHTML = '';
        
        // Add player buttons
        this.players.forEach(player => {
            const button = document.createElement('div');
            button.className = 'player-selection-item' + (player.id === this.localPlayerId ? ' self' : '');
            button.textContent = player.name + (player.id === this.localPlayerId ? ' (You)' : '');
            button.onclick = () => {
                this.applyPowerupToPlayer(powerupType, player.id, slotIndex);
                modal.style.display = 'none';
            };
            playerList.appendChild(button);
        });
        
        // Setup cancel button
        document.getElementById('cancel-powerup').onclick = () => {
            modal.style.display = 'none';
        };
        
        // Show modal
        modal.style.display = 'flex';
    }
    
    /**
     * Apply powerup to selected player
     */
    applyPowerupToPlayer(powerupType, targetPlayerId, slotIndex) {
        console.log('✨ Applying', powerupType.name, 'to player:', targetPlayerId);
        
        // Remove from inventory
        this.inventory.splice(slotIndex, 1);
        this.updateInventoryUI();
        
        // Send to server (server will broadcast to all clients including sender)
        if (this.socket) {
            this.socket.emit('apply-powerup', {
                powerupType: powerupType,
                targetPlayerId: targetPlayerId
            });
        }
        
        // Don't add to active effects here - let the server broadcast handle it
        // This prevents duplicate effects on the local player
    }

    /**
     * Get and clear active powerup (called when applying effect)
     */
    getActivePowerup() {
        const powerup = this.activePowerup;
        this.activePowerup = null;
        return powerup;
    }

    /**
     * Check if a powerup is active
     */
    hasActivePowerup() {
        return this.activePowerup !== null;
    }
    
    /**
     * Get the current active powerup
     */
    getCurrentActivePowerup() {
        return this.activePowerup;
    }

    /**
     * Add active effect to display
     */
    addActiveEffect(playerId, powerupType) {
        if (!this.activeEffects.has(playerId)) {
            this.activeEffects.set(playerId, []);
        }
        
        const effect = {
            powerupType: powerupType,
            playerId: playerId,
            startTime: Date.now()
        };
        
        this.activeEffects.get(playerId).push(effect);
        this.updateActiveEffectsUI();
        
        // Auto-remove after duration (8 seconds for most effects)
        setTimeout(() => {
            this.removeActiveEffect(playerId, powerupType);
        }, 8000);
    }
    
    /**
     * Remove active effect
     */
    removeActiveEffect(playerId, powerupType) {
        if (!this.activeEffects.has(playerId)) return;
        
        const effects = this.activeEffects.get(playerId);
        const index = effects.findIndex(e => e.powerupType.id === powerupType.id);
        
        if (index !== -1) {
            effects.splice(index, 1);
            if (effects.length === 0) {
                this.activeEffects.delete(playerId);
            }
            this.updateActiveEffectsUI();
        }
    }
    
    /**
     * Update active effects bar UI
     */
    updateActiveEffectsUI() {
        const effectsBar = document.getElementById('active-effects-bar');
        effectsBar.innerHTML = '';
        
        this.activeEffects.forEach((effects, playerId) => {
            const player = this.players.find(p => p.id === playerId);
            const playerName = player ? player.name : 'Unknown';
            
            effects.forEach(effect => {
                const badge = document.createElement('div');
                badge.className = 'active-effect-badge';
                badge.style.borderColor = effect.powerupType.color;
                badge.style.color = effect.powerupType.color;
                
                badge.innerHTML = `
                    <span class="effect-icon">${effect.powerupType.icon}</span>
                    <span class="effect-text">
                        <span class="effect-name">${effect.powerupType.name}</span>
                        <span class="effect-player">${playerName}</span>
                    </span>
                `;
                
                effectsBar.appendChild(badge);
            });
        });
    }
    
    /**
     * Give player a powerup directly (for console commands/testing)
     * @param {string} powerupId - ID of powerup type (e.g., 'super_boost', 'feather_ball')
     */
    grantPowerup(powerupId) {
        const powerupType = this.powerupTypesList.find(p => p.id === powerupId);
        if (!powerupType) {
            console.error('❌ Unknown powerup type:', powerupId);
            console.log('Available types:', this.powerupTypesList.map(p => p.id).join(', '));
            return false;
        }
        
        if (this.inventory.length >= this.maxInventorySize) {
            console.warn('⚠️ Inventory full! Cannot add powerup');
            return false;
        }
        
        this.addToInventory(powerupType);
        console.log('✅ Granted powerup:', powerupType.name);
        return true;
    }

    /**
     * Create explosion particle effect
     */
    createExplosion(position) {
        const particleCount = 20;
        const particles = [];

        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.1, 4, 4);
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(Math.random(), 1, 0.5),
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(geometry, material);
            
            particle.position.copy(position);
            
            // Random velocity
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                Math.random() * 8 + 2,
                (Math.random() - 0.5) * 10
            );
            
            particle.life = 1.0;
            
            this.scene.add(particle);
            particles.push(particle);
        }

        // Animate particles
        const animateExplosion = () => {
            let allDead = true;
            
            particles.forEach(particle => {
                if (particle.life > 0) {
                    allDead = false;
                    
                    // Update position
                    particle.position.add(particle.velocity.clone().multiplyScalar(0.016));
                    
                    // Apply gravity
                    particle.velocity.y -= 20 * 0.016;
                    
                    // Fade out
                    particle.life -= 0.016;
                    particle.material.opacity = particle.life;
                    
                    // Shrink
                    const scale = particle.life;
                    particle.scale.set(scale, scale, scale);
                }
            });

            if (!allDead) {
                requestAnimationFrame(animateExplosion);
            } else {
                // Cleanup
                particles.forEach(particle => {
                    this.scene.remove(particle);
                    particle.geometry.dispose();
                    particle.material.dispose();
                });
            }
        };

        animateExplosion();
    }

    /**
     * Create red/fire explosion for full inventory
     */
    createRedExplosion(position) {
        const particleCount = 30;
        const particles = [];

        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.15, 4, 4);
            const material = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xFF0000 : 0xFF4500, // Red and orange
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(geometry, material);
            
            particle.position.copy(position);
            
            // Random velocity (more explosive)
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 15,
                Math.random() * 12 + 3,
                (Math.random() - 0.5) * 15
            );
            
            particle.life = 1.0;
            
            this.scene.add(particle);
            particles.push(particle);
        }

        // Animate particles
        const animateExplosion = () => {
            let allDead = true;
            
            particles.forEach(particle => {
                if (particle.life > 0) {
                    allDead = false;
                    
                    // Update position
                    particle.position.add(particle.velocity.clone().multiplyScalar(0.016));
                    
                    // Apply gravity
                    particle.velocity.y -= 0.5;
                    
                    // Fade out faster
                    particle.life -= 0.03;
                    particle.material.opacity = particle.life;
                    
                    // Shrink
                    const scale = particle.life;
                    particle.scale.set(scale, scale, scale);
                }
            });
            
            if (!allDead) {
                requestAnimationFrame(animateExplosion);
            } else {
                // Clean up
                particles.forEach(particle => {
                    this.scene.remove(particle);
                    particle.geometry.dispose();
                    particle.material.dispose();
                });
            }
        };
        
        requestAnimationFrame(animateExplosion);
    }

    /**
     * Apply powerup effect to player
     */
    applyPowerupEffect() {
        // TODO: Implement various powerup effects
        // For now, just log
        console.log('✨ Powerup effect applied!');
    }

    /**
     * Remove a powerup by ID (called when another player collects it)
     */
    removePowerupById(powerupId) {
        const index = this.powerups.findIndex(p => p.id === powerupId);
        if (index === -1) return;

        const powerup = this.powerups[index];
        console.log('💎 Removing powerup collected by another player:', powerupId);

        // Stop proximity audio if playing
        if (powerup.proximityAudioId) {
            this.audioManager.stopProximitySound(powerup.proximityAudioId);
            powerup.proximityAudioId = null;
            this.proximityAudio.delete(powerup);
        }

        // Remove from scene
        this.scene.remove(powerup.mesh);
        if (powerup.texture) {
            powerup.texture.dispose();
        }
        powerup.mesh.geometry.dispose();
        powerup.mesh.material.dispose();

        // Remove from array
        this.powerups.splice(index, 1);
    }

    /**
     * Spawn powerups at predefined locations
     * Can also accept custom positions array for level editor
     * @param {Array<THREE.Vector3>} customPositions - Optional array of custom positions
     */
    spawnPowerups(customPositions = null) {
        // Use custom positions if provided, otherwise use default course layout
        const positions = customPositions || [
            new THREE.Vector3(10, 1.5, -10),
            new THREE.Vector3(-10, 1.5, 10),
            new THREE.Vector3(15, 1.5, 5),
            new THREE.Vector3(-5, 1.5, -15),
            new THREE.Vector3(20, 1.5, 0),
            new THREE.Vector3(-20, 1.5, -5),
            new THREE.Vector3(0, 1.5, 15),
            new THREE.Vector3(5, 1.5, -20),
            new THREE.Vector3(-15, 1.5, -10),
            new THREE.Vector3(12, 1.5, 12),
            new THREE.Vector3(-8, 1.5, -8),
            new THREE.Vector3(18, 1.5, -15),
            new THREE.Vector3(-12, 1.5, 5),
            new THREE.Vector3(8, 1.5, 8),
            new THREE.Vector3(-18, 1.5, 15),
            new THREE.Vector3(0, 1.5, -10),
            new THREE.Vector3(25, 1.5, -8),
            new THREE.Vector3(-25, 1.5, -12),
            new THREE.Vector3(3, 1.5, 20),
            new THREE.Vector3(-3, 1.5, -25)
        ];

        // Create powerups with sequential IDs for consistent sync across clients
        positions.forEach((pos, index) => this.createPowerup(pos, index));
        console.log(`💎 Spawned ${positions.length} powerups`);
    }

    /**
     * Spawn a single powerup at specified coordinates (for level editor)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} z - Z coordinate
     * @returns {Object} The created powerup
     */
    spawnPowerupAt(x, y, z) {
        return this.createPowerup(new THREE.Vector3(x, y, z));
    }

    /**
     * Clear all powerups from the scene (for level editor)
     */
    clearAllPowerups() {
        while (this.powerups.length > 0) {
            const powerup = this.powerups[0];
            if (powerup.proximityAudioId) {
                this.audioManager.stopProximitySound(powerup.proximityAudioId);
            }
            this.scene.remove(powerup.mesh);
            if (powerup.texture) {
                powerup.texture.dispose();
            }
            powerup.mesh.geometry.dispose();
            powerup.mesh.material.dispose();
            this.powerups.splice(0, 1);
        }
        console.log('💎 All powerups cleared');
    }

    /**
     * Clean up all powerups
     */
    dispose() {
        this.powerups.forEach(powerup => {
            if (powerup.proximityAudioId) {
                this.audioManager.stopProximitySound(powerup.proximityAudioId);
            }
            this.scene.remove(powerup.mesh);
            if (powerup.texture) {
                powerup.texture.dispose();
            }
            powerup.mesh.geometry.dispose();
            powerup.mesh.material.dispose();
        });
        this.powerups = [];
        this.proximityAudio.clear();
        console.log('💎 Powerup Manager disposed');
    }
}
