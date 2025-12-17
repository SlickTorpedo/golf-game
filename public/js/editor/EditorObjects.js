// EditorObjects.js - Handles creation of all map objects

import * as THREE from 'three';

export class EditorObjects {
    constructor(scene) {
        this.scene = scene;
        this.fanBlades = [];
    }
    
    createStartPoint(position = { x: 0, y: 0, z: 30 }) {
        const geometry = new THREE.ConeGeometry(0.8, 2, 16);
        const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        const startMesh = new THREE.Mesh(geometry, material);
        startMesh.position.set(position.x, 1, position.z);
        startMesh.userData = { type: 'start', data: position };
        return startMesh;
    }
    
    createHole(position = { x: 0, y: 0, z: -30, radius: 1.2 }) {
        const geometry = new THREE.CylinderGeometry(position.radius, position.radius, 0.5, 32);
        const material = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const holeMesh = new THREE.Mesh(geometry, material);
        holeMesh.position.set(position.x, 0.25, position.z);
        holeMesh.userData = { type: 'hole', data: position };
        return holeMesh;
    }
    
    createWall(position, size, rotationY = 0, color = 0x8B4513) {
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const actualColor = (color !== undefined && color !== null) ? color : 0x8B4513;
        const wallTexture = this.createWallTexture(actualColor);
        wallTexture.repeat.set(Math.max(1, size.x / 2), Math.max(1, size.y / 2));
        const material = new THREE.MeshLambertMaterial({ 
            color: actualColor,
            map: wallTexture
        });
        const wall = new THREE.Mesh(geometry, material);
        wall.position.set(position.x, position.y, position.z);
        wall.rotation.y = (rotationY * Math.PI) / 180;
        
        const wallData = { position, size, rotationY, color: actualColor };
        wall.userData = { type: 'wall', data: wallData };
        
        return wall;
    }
    
    createRamp(position, size, rotationY, angle, color = 0x6b8e23) {
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const actualColor = (color !== undefined && color !== null) ? color : 0x6b8e23;
        const material = new THREE.MeshLambertMaterial({ color: actualColor });
        const ramp = new THREE.Mesh(geometry, material);
        ramp.position.set(position.x, position.y, position.z);
        
        const angleRad = (angle * Math.PI) / 180;
        ramp.rotation.z = angleRad;
        ramp.rotation.y = (rotationY * Math.PI) / 180;
        
        const rampData = { position, size, rotationY, angle, color: actualColor };
        ramp.userData = { type: 'ramp', data: rampData };
        
        return ramp;
    }
    
    createPowerupSpawn(position, color = 0xff00ff) {
        const geometry = new THREE.SphereGeometry(0.5, 16, 16);
        const actualColor = (color !== undefined && color !== null) ? color : 0xff00ff;
        const material = new THREE.MeshLambertMaterial({ 
            color: actualColor,
            transparent: true,
            opacity: 0.6
        });
        const spawn = new THREE.Mesh(geometry, material);
        spawn.position.set(position.x, position.y, position.z);
        
        const spawnData = { position, color: actualColor };
        spawn.userData = { type: 'powerup_spawn', data: spawnData };
        
        return spawn;
    }
    
    createFan(position, rotationY = 0, angle = 0, strength = 10) {
        const fanGroup = new THREE.Group();
        
        // Housing cylinder
        const housingGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 32);
        const housingMaterial = new THREE.MeshLambertMaterial({ color: 0x404040 });
        const housing = new THREE.Mesh(housingGeometry, housingMaterial);
        housing.rotation.x = Math.PI / 2;
        fanGroup.add(housing);
        
        // Grille (front)
        const grilleGeometry = new THREE.TorusGeometry(1.3, 0.05, 8, 32);
        const grilleMaterial = new THREE.MeshLambertMaterial({ color: 0x606060 });
        const grille = new THREE.Mesh(grilleGeometry, grilleMaterial);
        grille.position.z = 0.3;
        fanGroup.add(grille);
        
        // Inner grille cross
        const crossBar1 = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 2.4, 0.1),
            grilleMaterial
        );
        crossBar1.position.z = 0.3;
        fanGroup.add(crossBar1);
        
        const crossBar2 = new THREE.Mesh(
            new THREE.BoxGeometry(2.4, 0.1, 0.1),
            grilleMaterial
        );
        crossBar2.position.z = 0.3;
        fanGroup.add(crossBar2);
        
        // Spinning blades
        const bladesGroup = new THREE.Group();
        const bladeGeometry = new THREE.BoxGeometry(0.15, 1.8, 0.05);
        const bladeMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xcccccc,
            side: THREE.DoubleSide
        });
        
        for (let i = 0; i < 3; i++) {
            const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
            blade.rotation.z = (i * Math.PI * 2) / 3;
            bladesGroup.add(blade);
        }
        
        bladesGroup.position.z = 0.15;
        fanGroup.add(bladesGroup);
        
        // Create particle system for wind effect
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
        
        // Position and rotate the fan group
        fanGroup.position.set(position.x, position.y, position.z);
        fanGroup.rotation.y = (rotationY * Math.PI) / 180;
        fanGroup.rotation.x = (angle * Math.PI) / 180;
        
        const fanData = { position, rotationY, angle, strength };
        fanGroup.userData = { 
            type: 'fan', 
            data: fanData,
            blades: bladesGroup,
            particles: particles
        };
        
        this.fanBlades.push(bladesGroup);
        
        return fanGroup;
    }
    
    createBouncePad(position, rotationY = 0, strength = 20) {
        const padGroup = new THREE.Group();
        
        // Base platform
        const baseGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.3, 32);
        const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        padGroup.add(base);
        
        // Bounce surface (green, slightly smaller)
        const surfaceGeometry = new THREE.CylinderGeometry(1.3, 1.3, 0.1, 32);
        const surfaceMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
        surface.position.y = 0.2;
        padGroup.add(surface);
        
        // Spring indicator lines
        const lineMaterial = new THREE.MeshLambertMaterial({ color: 0xffff00 });
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
        
        const padData = { position, rotationY, strength };
        padGroup.userData = { 
            type: 'bounce_pad',
            data: padData
        };
        
        return padGroup;
    }
    
    createBumper(position, rotationY = 0, strength = 15) {
        const bumperGroup = new THREE.Group();
        
        // Base disc
        const baseGeometry = new THREE.CylinderGeometry(1, 1, 0.5, 32);
        const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x990000 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        bumperGroup.add(base);
        
        // Top ring (glowing)
        const ringGeometry = new THREE.TorusGeometry(0.9, 0.1, 16, 32);
        const ringMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.y = 0.3;
        ring.rotation.x = Math.PI / 2;
        bumperGroup.add(ring);
        
        // Warning stripes
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI * 2) / 8;
            const stripe = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.6, 0.05),
                new THREE.MeshLambertMaterial({ color: 0xffff00 })
            );
            stripe.position.x = Math.cos(angle) * 0.8;
            stripe.position.z = Math.sin(angle) * 0.8;
            stripe.rotation.y = angle;
            bumperGroup.add(stripe);
        }
        
        bumperGroup.position.set(position.x, position.y, position.z);
        bumperGroup.rotation.y = (rotationY * Math.PI) / 180;
        
        const bumperData = { position, rotationY, strength };
        bumperGroup.userData = { 
            type: 'bumper',
            data: bumperData
        };
        
        return bumperGroup;
    }
    
    createSpeedBoost(position, rotationY = 0, strength = 50) {
        const boostGroup = new THREE.Group();
        
        // Base pad (bright yellow)
        const baseGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 32);
        const baseMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.7
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        boostGroup.add(base);
        
        // Direction arrows (3 arrows pointing forward)
        const arrowMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff6600,
            emissive: 0xff6600,
            emissiveIntensity: 0.8
        });
        
        for (let i = 0; i < 3; i++) {
            // Arrow shaft
            const shaft = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.05, 0.4),
                arrowMaterial
            );
            shaft.position.y = 0.15;
            shaft.position.z = -0.2 + (i * 0.25);
            boostGroup.add(shaft);
            
            // Arrow head (triangle)
            const head = new THREE.Mesh(
                new THREE.ConeGeometry(0.12, 0.2, 3),
                arrowMaterial
            );
            head.rotation.x = Math.PI / 2;
            head.position.y = 0.15;
            head.position.z = -0.4 + (i * 0.25);
            boostGroup.add(head);
        }
        
        boostGroup.position.set(position.x, position.y, position.z);
        boostGroup.rotation.y = (rotationY * Math.PI) / 180;
        
        const boostData = { position, rotationY, strength };
        boostGroup.userData = { 
            type: 'speedBoost',
            data: boostData
        };
        
        return boostGroup;
    }
    
    // Texture generation methods
    
    createCheckeredTexture(baseColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        const color = new THREE.Color(baseColor);
        const r = Math.floor(color.r * 255);
        const g = Math.floor(color.g * 255);
        const b = Math.floor(color.b * 255);
        
        const r2 = Math.floor(r * 0.85);
        const g2 = Math.floor(g * 0.85);
        const b2 = Math.floor(b * 0.85);
        
        const lightColor = `rgb(${r}, ${g}, ${b})`;
        const darkColor = `rgb(${r2}, ${g2}, ${b2})`;
        
        const squareSize = 32;
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? lightColor : darkColor;
                ctx.fillRect(x * squareSize, y * squareSize, squareSize, squareSize);
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(10, 10);
        
        return texture;
    }
    
    createWallTexture(baseColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        const color = new THREE.Color(baseColor);
        const r = Math.floor(color.r * 255);
        const g = Math.floor(color.g * 255);
        const b = Math.floor(color.b * 255);
        
        const baseColorStr = `rgb(${r}, ${g}, ${b})`;
        ctx.fillStyle = baseColorStr;
        ctx.fillRect(0, 0, 256, 256);
        
        // Add subtle randomized checkered accents
        const cellSize = 32;
        for (let y = 0; y < 256; y += cellSize) {
            for (let x = 0; x < 256; x += cellSize) {
                if (Math.random() > 0.6) {
                    const variation = Math.random() > 0.5 ? 0.92 : 0.85;
                    const r2 = Math.floor(r * variation);
                    const g2 = Math.floor(g * variation);
                    const b2 = Math.floor(b * variation);
                    ctx.fillStyle = `rgb(${r2}, ${g2}, ${b2})`;
                    ctx.fillRect(x, y, cellSize, cellSize);
                }
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        return texture;
    }
    
    // Animation helper
    animateFans() {
        this.fanBlades.forEach(blades => {
            if (blades) {
                blades.rotation.z += 0.1;
            }
        });
    }
    
    // Clear all fan blade references
    clearFanBlades() {
        this.fanBlades = [];
    }
}
