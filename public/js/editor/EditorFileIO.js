// EditorFileIO.js - Handles map saving/loading and playtest functionality

export class EditorFileIO {
    constructor(editor) {
        this.editor = editor;
    }
    
    // Deduplicate arrays in map data to prevent duplicate objects
    deduplicateMapData(mapData) {
        const deduplicateArray = (array) => {
            if (!array || !Array.isArray(array)) return [];
            
            const uniqueItems = [];
            const seen = new Set();
            
            for (const item of array) {
                const key = JSON.stringify(item);
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueItems.push(item);
                }
            }
            
            return uniqueItems;
        };
        
        // Helper to deduplicate a single level/hole
        const processLevel = (level) => {
            if (level.walls) level.walls = deduplicateArray(level.walls);
            if (level.ramps) level.ramps = deduplicateArray(level.ramps);
            if (level.powerupSpawns) level.powerupSpawns = deduplicateArray(level.powerupSpawns);
            if (level.fans) level.fans = deduplicateArray(level.fans);
            if (level.bouncePads) level.bouncePads = deduplicateArray(level.bouncePads);
            if (level.bumpers) level.bumpers = deduplicateArray(level.bumpers);
        };
        
        // Deduplicate single-level maps
        processLevel(mapData);
        
        // Handle multi-level maps with "levels" array
        if (mapData.levels && Array.isArray(mapData.levels)) {
            mapData.levels.forEach(level => processLevel(level));
        }
        
        // Handle multi-level maps with "holes" array
        if (mapData.holes && Array.isArray(mapData.holes)) {
            mapData.holes.forEach(hole => processLevel(hole));
        }
    }
    
    showSaveModal() {
        document.getElementById('save-modal').classList.remove('hidden');
        document.getElementById('map-name').value = this.editor.state.mapData.name;
        document.getElementById('map-name').focus();
    }
    
    async saveMap() {
        const mapName = document.getElementById('map-name').value.trim();
        if (!mapName) {
            alert('Please enter a map name');
            return;
        }
        
        this.editor.state.mapData.name = mapName;
        
        const saveData = this.editor.multiLevelManager ? 
            this.editor.multiLevelManager.getMapData() : 
            this.editor.state.mapData;
        saveData.name = mapName;
        
        // Deduplicate all arrays before saving
        this.deduplicateMapData(saveData);
        
        try {
            const response = await fetch('/api/save-map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveData)
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
                    item.addEventListener('click', () => this.loadMap(map.fileName));
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
            
            this.editor.state.mapData.name = mapData.name;
            
            if (this.editor.multiLevelManager) {
                this.editor.multiLevelManager.loadMapData(mapData);
            } else {
                this.editor.scene.objects.forEach(obj => this.editor.scene.scene.remove(obj));
                this.editor.scene.objects = [];
                
                this.editor.state.mapData = mapData;
                
                this.editor.objects.createStartPoint();
                this.editor.objects.createHole();
                
                mapData.walls.forEach(wall => {
                    this.editor.objects.createWall(wall.position, wall.size, wall.rotationY || 0, wall.color);
                });
                
                mapData.ramps.forEach(ramp => {
                    this.editor.objects.createRamp(ramp.position, ramp.size, ramp.rotationY, ramp.angle, ramp.color);
                });
                
                mapData.powerupSpawns.forEach(spawn => {
                    this.editor.objects.createPowerupSpawn(spawn.position, spawn.color);
                });
                
                if (mapData.fans) {
                    mapData.fans.forEach(fan => {
                        this.editor.objects.createFan(fan.position, fan.rotationY || 0, fan.angle || 0, fan.strength || 10);
                    });
                }
            }
            
            document.getElementById('map-list-modal').classList.add('hidden');
            
            this.editor.history.history = [];
            this.editor.history.historyIndex = -1;
            this.editor.history.saveHistory('load_map');
            
            alert('Map loaded successfully!');
        } catch (error) {
            console.error('Error loading map:', error);
            alert('Error loading map');
        }
    }
    
    newMap() {
        if (!confirm('Create a new map? This will clear the current map.')) return;
        
        // Reset multi-level manager to start fresh with 1 level
        if (this.editor.multiLevelManager) {
            this.editor.multiLevelManager.levels = [this.editor.multiLevelManager.createDefaultLevel()];
            this.editor.multiLevelManager.currentLevelIndex = 0;
            this.editor.multiLevelManager.renderLevelList();
        }
        
        // Clear all objects from the scene
        this.editor.scene.objects.forEach(obj => {
            if (obj.userData.type !== 'start' && obj.userData.type !== 'hole') {
                this.editor.scene.scene.remove(obj);
            }
        });
        
        this.editor.scene.objects = this.editor.scene.objects.filter(obj => 
            obj.userData.type === 'start' || obj.userData.type === 'hole'
        );
        
        // Reset map data
        this.editor.state.mapData = {
            name: 'Untitled Map',
            startPoint: { x: 0, y: 0, z: 30 },
            hole: { x: 0, y: 0, z: -30, radius: 1.2 },
            walls: [],
            ramps: [],
            powerupSpawns: [],
            fans: [],
            bouncePads: [],
            bumpers: [],
            speedBoosts: [],
            settings: {
                skyColor: 0x87CEEB,
                groundColor: 0x228B22,
                gravity: -30
            }
        };
        
        // Update map name input
        const mapNameInput = document.getElementById('map-name-input');
        if (mapNameInput) {
            mapNameInput.value = 'Untitled Map';
        }
        
        // Reset start and hole positions
        const startObj = this.editor.scene.objects.find(o => o.userData.type === 'start');
        if (startObj) {
            startObj.position.set(0, 1, 30);
        }
        
        const holeObj = this.editor.scene.objects.find(o => o.userData.type === 'hole');
        if (holeObj) {
            holeObj.position.set(0, 0.25, -30);
        }
        
        this.editor.state.selectedObject = null;
        this.editor.ui.updatePropertiesPanel();
        
        this.editor.history.history = [];
        this.editor.history.historyIndex = -1;
        this.editor.history.saveHistory('new_map');
    }
    
    playTest() {
        const mapName = '_playtest_';
        
        const saveData = this.editor.multiLevelManager ? 
            this.editor.multiLevelManager.getMapData() : 
            this.editor.state.mapData;
        saveData.name = mapName;
        
        fetch('/api/save-map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saveData)
        }).then(() => {
            window.open(`/index.html?playtest=true&map=${mapName}`, '_blank');
        });
    }
}
