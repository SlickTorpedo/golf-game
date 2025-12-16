import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class MapEditor {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.selectedTool = null;
        this.selectedObject = null;
        this.objects = [];
        this.gridHelper = null;
        this.gridSnap = true;
        this.gridSize = 1;
        
        // Map data
        this.mapData = {
            name: 'Untitled Map',
            startPoint: { x: 0, y: 0, z: 30 },
            hole: { x: 0, y: 0, z: -30, radius: 1.2 },
            walls: [],
            ramps: [],
            powerupSpawns: []
        };
        
        this.init();
        this.setupEventListeners();
        this.animate();
    }
    
    init() {
        // Setup Three.js scene
        const canvas = document.getElementById('editor-canvas');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            canvas.parentElement.clientWidth / canvas.parentElement.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 50, 50);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(canvas.parentElement.clientWidth, canvas.parentElement.clientHeight);
        
        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);
        
        // Ground
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x2d5016 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Grid
        this.gridHelper = new THREE.GridHelper(100, 100, 0x444444, 0x222222);
        this.scene.add(this.gridHelper);
        
        // Create initial objects
        this.createStartPoint();
        this.createHole();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    createStartPoint() {
        const geometry = new THREE.ConeGeometry(0.8, 2, 16);
        const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        const startMesh = new THREE.Mesh(geometry, material);
        startMesh.position.set(
            this.mapData.startPoint.x,
            1,
            this.mapData.startPoint.z
        );
        startMesh.userData = { type: 'start', data: this.mapData.startPoint };
        this.scene.add(startMesh);
        this.objects.push(startMesh);
    }
    
    createHole() {
        const geometry = new THREE.CylinderGeometry(
            this.mapData.hole.radius,
            this.mapData.hole.radius,
            0.5,
            32
        );
        const material = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const holeMesh = new THREE.Mesh(geometry, material);
        holeMesh.position.set(
            this.mapData.hole.x,
            0.25,
            this.mapData.hole.z
        );
        holeMesh.userData = { type: 'hole', data: this.mapData.hole };
        this.scene.add(holeMesh);
        this.objects.push(holeMesh);
    }
    
    createWall(position, size) {
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const wall = new THREE.Mesh(geometry, material);
        wall.position.set(position.x, position.y, position.z);
        
        const wallData = { position, size };
        wall.userData = { type: 'wall', data: wallData };
        
        this.scene.add(wall);
        this.objects.push(wall);
        this.mapData.walls.push(wallData);
        
        return wall;
    }
    
    createRamp(position, size, rotationY, angle) {
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const material = new THREE.MeshLambertMaterial({ color: 0x6b8e23 });
        const ramp = new THREE.Mesh(geometry, material);
        ramp.position.set(position.x, position.y, position.z);
        
        const angleRad = (angle * Math.PI) / 180;
        ramp.rotation.z = angleRad;
        ramp.rotation.y = (rotationY * Math.PI) / 180;
        
        const rampData = { position, size, rotationY, angle };
        ramp.userData = { type: 'ramp', data: rampData };
        
        this.scene.add(ramp);
        this.objects.push(ramp);
        this.mapData.ramps.push(rampData);
        
        return ramp;
    }
    
    createPowerupSpawn(position) {
        const geometry = new THREE.SphereGeometry(0.5, 16, 16);
        const material = new THREE.MeshLambertMaterial({ 
            color: 0xff00ff,
            transparent: true,
            opacity: 0.6
        });
        const spawn = new THREE.Mesh(geometry, material);
        spawn.position.set(position.x, position.y, position.z);
        
        const spawnData = { position };
        spawn.userData = { type: 'powerup_spawn', data: spawnData };
        
        this.scene.add(spawn);
        this.objects.push(spawn);
        this.mapData.powerupSpawns.push(spawnData);
        
        return spawn;
    }
    
    setupEventListeners() {
        // Palette buttons
        document.querySelectorAll('.palette-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.palette-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedTool = btn.dataset.type;
            });
        });
        
        // Toolbar buttons
        document.getElementById('new-map').addEventListener('click', () => this.newMap());
        document.getElementById('save-map').addEventListener('click', () => this.showSaveModal());
        document.getElementById('load-map').addEventListener('click', () => this.showLoadModal());
        document.getElementById('play-test').addEventListener('click', () => this.playTest());
        
        // Viewport controls
        document.getElementById('view-top').addEventListener('click', () => this.setTopView());
        document.getElementById('view-angle').addEventListener('click', () => this.setAngleView());
        document.getElementById('grid-snap').addEventListener('change', (e) => {
            this.gridSnap = e.target.checked;
        });
        document.getElementById('grid-size').addEventListener('change', (e) => {
            this.gridSize = parseFloat(e.target.value);
        });
        
        // Canvas click
        this.renderer.domElement.addEventListener('click', (e) => this.onCanvasClick(e));
        
        // Save modal
        document.getElementById('confirm-save').addEventListener('click', () => this.saveMap());
        document.getElementById('cancel-save').addEventListener('click', () => {
            document.getElementById('save-modal').classList.add('hidden');
        });
        
        // Load modal
        document.getElementById('close-modal').addEventListener('click', () => {
            document.getElementById('map-list-modal').classList.add('hidden');
        });
        
        // Delete key
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.selectedObject) {
                this.deleteSelectedObject();
            }
        });
    }
    
    onCanvasClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        // Check if clicking on an object
        const intersects = raycaster.intersectObjects(this.objects);
        
        if (intersects.length > 0) {
            this.selectObject(intersects[0].object);
            return;
        }
        
        // Place new object
        if (this.selectedTool) {
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersectPoint = new THREE.Vector3();
            raycaster.ray.intersectPlane(groundPlane, intersectPoint);
            
            if (this.gridSnap) {
                intersectPoint.x = Math.round(intersectPoint.x / this.gridSize) * this.gridSize;
                intersectPoint.z = Math.round(intersectPoint.z / this.gridSize) * this.gridSize;
            }
            
            this.placeObject(intersectPoint);
        }
    }
    
    placeObject(position) {
        let obj;
        
        switch (this.selectedTool) {
            case 'wall':
                obj = this.createWall(
                    { x: position.x, y: 1, z: position.z },
                    { x: 4, y: 2, z: 4 }
                );
                break;
                
            case 'ramp':
                obj = this.createRamp(
                    { x: position.x, y: 0.3, z: position.z },
                    { x: 8, y: 0.5, z: 6 },
                    0,
                    15
                );
                break;
                
            case 'powerup_spawn':
                obj = this.createPowerupSpawn({ x: position.x, y: 1, z: position.z });
                break;
                
            case 'start':
                // Move existing start point
                const startObj = this.objects.find(o => o.userData.type === 'start');
                if (startObj) {
                    startObj.position.x = position.x;
                    startObj.position.z = position.z;
                    this.mapData.startPoint.x = position.x;
                    this.mapData.startPoint.z = position.z;
                }
                break;
                
            case 'hole':
                // Move existing hole
                const holeObj = this.objects.find(o => o.userData.type === 'hole');
                if (holeObj) {
                    holeObj.position.x = position.x;
                    holeObj.position.z = position.z;
                    this.mapData.hole.x = position.x;
                    this.mapData.hole.z = position.z;
                }
                break;
        }
        
        if (obj) {
            this.selectObject(obj);
        }
    }
    
    selectObject(obj) {
        // Remove highlight from previous selection
        if (this.selectedObject) {
            this.selectedObject.material.emissive = new THREE.Color(0x000000);
        }
        
        this.selectedObject = obj;
        this.selectedObject.material.emissive = new THREE.Color(0x444444);
        
        this.updatePropertiesPanel();
    }
    
    updatePropertiesPanel() {
        const panel = document.getElementById('properties-content');
        
        if (!this.selectedObject) {
            panel.innerHTML = '<p class="hint">Select an object to edit its properties</p>';
            return;
        }
        
        const type = this.selectedObject.userData.type;
        const data = this.selectedObject.userData.data;
        
        let html = `<h3>${type.toUpperCase()}</h3>`;
        
        html += `<div class="property-group">
            <label>Position</label>
            <div class="property-row">
                <input type="number" id="prop-x" value="${this.selectedObject.position.x.toFixed(2)}" step="0.5">
                <input type="number" id="prop-y" value="${this.selectedObject.position.y.toFixed(2)}" step="0.5">
                <input type="number" id="prop-z" value="${this.selectedObject.position.z.toFixed(2)}" step="0.5">
            </div>
        </div>`;
        
        if (type === 'wall' || type === 'ramp') {
            html += `<div class="property-group">
                <label>Size</label>
                <div class="property-row">
                    <input type="number" id="prop-size-x" value="${data.size.x}" step="0.5" min="0.5">
                    <input type="number" id="prop-size-y" value="${data.size.y}" step="0.5" min="0.5">
                    <input type="number" id="prop-size-z" value="${data.size.z}" step="0.5" min="0.5">
                </div>
            </div>`;
        }
        
        if (type === 'ramp') {
            html += `<div class="property-group">
                <label>Rotation Y (degrees)</label>
                <input type="number" id="prop-rotation" value="${data.rotationY}" step="15" min="0" max="360">
            </div>`;
            
            html += `<div class="property-group">
                <label>Angle (degrees)</label>
                <input type="number" id="prop-angle" value="${data.angle}" step="5" min="5" max="45">
            </div>`;
        }
        
        if (type === 'hole') {
            html += `<div class="property-group">
                <label>Radius</label>
                <input type="number" id="prop-radius" value="${data.radius}" step="0.1" min="0.5" max="3">
            </div>`;
        }
        
        html += `<button class="btn-danger" id="delete-object">🗑️ Delete Object</button>`;
        
        panel.innerHTML = html;
        
        // Add event listeners for property changes
        this.setupPropertyListeners();
    }
    
    setupPropertyListeners() {
        const posX = document.getElementById('prop-x');
        const posY = document.getElementById('prop-y');
        const posZ = document.getElementById('prop-z');
        
        if (posX) posX.addEventListener('change', () => this.updateObjectProperty('position', 'x', parseFloat(posX.value)));
        if (posY) posY.addEventListener('change', () => this.updateObjectProperty('position', 'y', parseFloat(posY.value)));
        if (posZ) posZ.addEventListener('change', () => this.updateObjectProperty('position', 'z', parseFloat(posZ.value)));
        
        const sizeX = document.getElementById('prop-size-x');
        const sizeY = document.getElementById('prop-size-y');
        const sizeZ = document.getElementById('prop-size-z');
        
        if (sizeX) sizeX.addEventListener('change', () => this.updateObjectSize('x', parseFloat(sizeX.value)));
        if (sizeY) sizeY.addEventListener('change', () => this.updateObjectSize('y', parseFloat(sizeY.value)));
        if (sizeZ) sizeZ.addEventListener('change', () => this.updateObjectSize('z', parseFloat(sizeZ.value)));
        
        const rotation = document.getElementById('prop-rotation');
        if (rotation) rotation.addEventListener('change', () => this.updateRampRotation(parseFloat(rotation.value)));
        
        const angle = document.getElementById('prop-angle');
        if (angle) angle.addEventListener('change', () => this.updateRampAngle(parseFloat(angle.value)));
        
        const radius = document.getElementById('prop-radius');
        if (radius) radius.addEventListener('change', () => this.updateHoleRadius(parseFloat(radius.value)));
        
        const deleteBtn = document.getElementById('delete-object');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.deleteSelectedObject());
    }
    
    updateObjectProperty(prop, axis, value) {
        if (this.selectedObject) {
            this.selectedObject[prop][axis] = value;
            if (this.selectedObject.userData.data[prop]) {
                this.selectedObject.userData.data[prop][axis] = value;
            }
        }
    }
    
    updateObjectSize(axis, value) {
        if (this.selectedObject && this.selectedObject.userData.data.size) {
            this.selectedObject.userData.data.size[axis] = value;
            this.selectedObject.geometry.dispose();
            this.selectedObject.geometry = new THREE.BoxGeometry(
                this.selectedObject.userData.data.size.x,
                this.selectedObject.userData.data.size.y,
                this.selectedObject.userData.data.size.z
            );
        }
    }
    
    updateRampRotation(value) {
        if (this.selectedObject && this.selectedObject.userData.type === 'ramp') {
            this.selectedObject.userData.data.rotationY = value;
            const angleRad = (this.selectedObject.userData.data.angle * Math.PI) / 180;
            this.selectedObject.rotation.y = (value * Math.PI) / 180;
            this.selectedObject.rotation.z = angleRad;
        }
    }
    
    updateRampAngle(value) {
        if (this.selectedObject && this.selectedObject.userData.type === 'ramp') {
            this.selectedObject.userData.data.angle = value;
            const angleRad = (value * Math.PI) / 180;
            this.selectedObject.rotation.z = angleRad;
        }
    }
    
    updateHoleRadius(value) {
        if (this.selectedObject && this.selectedObject.userData.type === 'hole') {
            this.selectedObject.userData.data.radius = value;
            this.mapData.hole.radius = value;
            this.selectedObject.geometry.dispose();
            this.selectedObject.geometry = new THREE.CylinderGeometry(value, value, 0.5, 32);
        }
    }
    
    deleteSelectedObject() {
        if (!this.selectedObject) return;
        
        const type = this.selectedObject.userData.type;
        
        // Can't delete start point or hole
        if (type === 'start' || type === 'hole') {
            alert('Cannot delete start point or hole. You can only move them.');
            return;
        }
        
        // Remove from scene
        this.scene.remove(this.selectedObject);
        
        // Remove from objects array
        const index = this.objects.indexOf(this.selectedObject);
        if (index > -1) {
            this.objects.splice(index, 1);
        }
        
        // Remove from map data
        const data = this.selectedObject.userData.data;
        if (type === 'wall') {
            const wallIndex = this.mapData.walls.indexOf(data);
            if (wallIndex > -1) this.mapData.walls.splice(wallIndex, 1);
        } else if (type === 'ramp') {
            const rampIndex = this.mapData.ramps.indexOf(data);
            if (rampIndex > -1) this.mapData.ramps.splice(rampIndex, 1);
        } else if (type === 'powerup_spawn') {
            const spawnIndex = this.mapData.powerupSpawns.indexOf(data);
            if (spawnIndex > -1) this.mapData.powerupSpawns.splice(spawnIndex, 1);
        }
        
        this.selectedObject = null;
        this.updatePropertiesPanel();
    }
    
    setTopView() {
        this.camera.position.set(0, 70, 0);
        this.camera.lookAt(0, 0, 0);
        this.controls.update();
    }
    
    setAngleView() {
        this.camera.position.set(40, 50, 40);
        this.camera.lookAt(0, 0, 0);
        this.controls.update();
    }
    
    newMap() {
        if (!confirm('Create a new map? This will clear the current map.')) return;
        
        // Clear all objects except start and hole
        this.objects.forEach(obj => {
            if (obj.userData.type !== 'start' && obj.userData.type !== 'hole') {
                this.scene.remove(obj);
            }
        });
        
        this.objects = this.objects.filter(obj => 
            obj.userData.type === 'start' || obj.userData.type === 'hole'
        );
        
        // Reset map data
        this.mapData = {
            name: 'Untitled Map',
            startPoint: { x: 0, y: 0, z: 30 },
            hole: { x: 0, y: 0, z: -30, radius: 1.2 },
            walls: [],
            ramps: [],
            powerupSpawns: []
        };
        
        // Reset start and hole positions
        const startObj = this.objects.find(o => o.userData.type === 'start');
        if (startObj) {
            startObj.position.set(0, 1, 30);
        }
        
        const holeObj = this.objects.find(o => o.userData.type === 'hole');
        if (holeObj) {
            holeObj.position.set(0, 0.25, -30);
        }
        
        this.selectedObject = null;
        this.updatePropertiesPanel();
    }
    
    showSaveModal() {
        document.getElementById('save-modal').classList.remove('hidden');
        document.getElementById('map-name').value = this.mapData.name;
        document.getElementById('map-name').focus();
    }
    
    async saveMap() {
        const mapName = document.getElementById('map-name').value.trim();
        if (!mapName) {
            alert('Please enter a map name');
            return;
        }
        
        this.mapData.name = mapName;
        
        try {
            const response = await fetch('/api/save-map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.mapData)
            });
            
            if (response.ok) {
                alert('Map saved successfully!');
                document.getElementById('save-modal').classList.add('hidden');
            } else {
                alert('Failed to save map');
            }
        } catch (error) {
            console.error('Error saving map:', error);
            alert('Error saving map');
        }
    }
    
    async showLoadModal() {
        try {
            const response = await fetch('/api/maps');
            const maps = await response.json();
            
            const mapList = document.getElementById('map-list');
            mapList.innerHTML = '';
            
            if (maps.length === 0) {
                mapList.innerHTML = '<p class="hint">No saved maps found</p>';
            } else {
                maps.forEach(map => {
                    const item = document.createElement('div');
                    item.className = 'map-item';
                    item.innerHTML = `
                        <div>
                            <div class="map-item-name">${map.name}</div>
                            <div class="map-item-date">${new Date(map.lastModified).toLocaleDateString()}</div>
                        </div>
                    `;
                    item.addEventListener('click', () => this.loadMap(map.name));
                    mapList.appendChild(item);
                });
            }
            
            document.getElementById('map-list-modal').classList.remove('hidden');
        } catch (error) {
            console.error('Error loading maps:', error);
            alert('Error loading maps');
        }
    }
    
    async loadMap(mapName) {
        try {
            const response = await fetch(`/api/map/${encodeURIComponent(mapName)}`);
            const mapData = await response.json();
            
            // Clear current map
            this.objects.forEach(obj => this.scene.remove(obj));
            this.objects = [];
            
            // Load new map data
            this.mapData = mapData;
            
            // Recreate objects
            this.createStartPoint();
            this.createHole();
            
            mapData.walls.forEach(wall => {
                this.createWall(wall.position, wall.size);
            });
            
            mapData.ramps.forEach(ramp => {
                this.createRamp(ramp.position, ramp.size, ramp.rotationY, ramp.angle);
            });
            
            mapData.powerupSpawns.forEach(spawn => {
                this.createPowerupSpawn(spawn.position);
            });
            
            document.getElementById('map-list-modal').classList.add('hidden');
            alert('Map loaded successfully!');
        } catch (error) {
            console.error('Error loading map:', error);
            alert('Error loading map');
        }
    }
    
    playTest() {
        // Save current map and open game in new tab
        const mapName = '_playtest_';
        this.mapData.name = mapName;
        
        fetch('/api/save-map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.mapData)
        }).then(() => {
            window.open(`/index.html?map=${mapName}`, '_blank');
        });
    }
    
    onWindowResize() {
        const viewport = document.getElementById('viewport');
        this.camera.aspect = viewport.clientWidth / viewport.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize editor when page loads
window.addEventListener('DOMContentLoaded', () => {
    new MapEditor();
});
