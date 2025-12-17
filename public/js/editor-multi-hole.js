// editor-multi-hole.js - Adds multi-hole support to the map editor

export class MultiHoleManager {
    constructor(mapEditor) {
        this.editor = mapEditor;
        this.currentHoleIndex = 0;
        this.holes = [this.createDefaultHole()];
        
        this.init();
    }
    
    init() {
        this.renderHoleList();
        this.setupEventListeners();
    }
    
    createDefaultHole() {
        return {
            number: 1,
            par: 3,
            startPoint: { x: 0, y: 0, z: 30 },
            hole: { x: 0, y: 0, z: -30, radius: 1.2 },
            walls: [],
            ramps: [],
            powerupSpawns: [],
            fans: [],
            bouncePads: [],
            bumpers: [],
            speedBoosts: []
        };
    }
    
    setupEventListeners() {
        document.getElementById('add-hole').addEventListener('click', () => {
            this.addHole();
        });
    }
    
    renderHoleList() {
        const holeList = document.getElementById('hole-list');
        holeList.innerHTML = '';
        
        this.holes.forEach((hole, index) => {
            const item = document.createElement('div');
            item.className = 'hole-item' + (index === this.currentHoleIndex ? ' active' : '');
            item.innerHTML = `
                <div class="hole-item-info">
                    <div class="hole-item-number">Hole ${hole.number}</div>
                    <div class="hole-item-par">Par ${hole.par}</div>
                </div>
                ${this.holes.length > 1 ? `<button class="hole-item-delete">×</button>` : ''}
            `;
            
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('hole-item-delete')) {
                    this.switchHole(index);
                }
            });
            
            const deleteBtn = item.querySelector('.hole-item-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteHole(index);
                });
            }
            
            holeList.appendChild(item);
        });
    }
    
    addHole() {
        const newHole = this.createDefaultHole();
        newHole.number = this.holes.length + 1;
        newHole.par = 3;
        
        // Offset start/hole positions so they don't overlap
        newHole.startPoint.x += this.holes.length * 20;
        newHole.hole.x += this.holes.length * 20;
        
        this.holes.push(newHole);
        this.renderHoleList();
        this.switchHole(this.holes.length - 1);
        
        console.log(`⛳ Added Hole ${newHole.number} (Par ${newHole.par})`);
    }
    
    deleteHole(index) {
        if (this.holes.length === 1) {
            alert('Cannot delete the last hole');
            return;
        }
        
        if (!confirm(`Delete Hole ${this.holes[index].number}?`)) {
            return;
        }
        
        this.holes.splice(index, 1);
        
        // Renumber holes
        this.holes.forEach((hole, i) => {
            hole.number = i + 1;
        });
        
        // Switch to previous hole if we deleted the current one
        if (index === this.currentHoleIndex) {
            this.currentHoleIndex = Math.max(0, index - 1);
        } else if (index < this.currentHoleIndex) {
            this.currentHoleIndex--;
        }
        
        this.renderHoleList();
        this.loadHole(this.currentHoleIndex);
        
        console.log(`🗑️ Deleted hole, ${this.holes.length} remaining`);
    }
    
    switchHole(index) {
        if (index === this.currentHoleIndex) return;
        
        // Save current hole data
        this.saveCurrentHoleData();
        
        // Switch to new hole
        this.currentHoleIndex = index;
        this.loadHole(index);
        this.renderHoleList();
        
        console.log(`🔄 Switched to Hole ${this.holes[index].number}`);
    }
    
    saveCurrentHoleData() {
        const hole = this.holes[this.currentHoleIndex];
        
        // Save all object arrays from editor's mapData
        hole.startPoint = { ...this.editor.mapData.startPoint };
        hole.hole = { ...this.editor.mapData.hole };
        hole.walls = JSON.parse(JSON.stringify(this.editor.mapData.walls));
        hole.ramps = JSON.parse(JSON.stringify(this.editor.mapData.ramps));
        hole.powerupSpawns = JSON.parse(JSON.stringify(this.editor.mapData.powerupSpawns));
        hole.fans = JSON.parse(JSON.stringify(this.editor.mapData.fans || []));
        hole.bouncePads = JSON.parse(JSON.stringify(this.editor.mapData.bouncePads || []));
        hole.bumpers = JSON.parse(JSON.stringify(this.editor.mapData.bumpers || []));
        hole.speedBoosts = JSON.parse(JSON.stringify(this.editor.mapData.speedBoosts || []));
    }
    
    loadHole(index) {
        const hole = this.holes[index];
        
        // Clear current scene
        this.editor.objects.forEach(obj => this.editor.scene.remove(obj));
        this.editor.objects = [];
        this.editor.fanBlades = [];
        
        // Load hole data into editor
        this.editor.mapData.startPoint = { ...hole.startPoint };
        this.editor.mapData.hole = { ...hole.hole };
        this.editor.mapData.walls = [];
        this.editor.mapData.ramps = [];
        this.editor.mapData.powerupSpawns = [];
        this.editor.mapData.fans = [];
        this.editor.mapData.bouncePads = [];
        this.editor.mapData.bumpers = [];
        this.editor.mapData.speedBoosts = [];
        
        // Recreate objects
        this.editor.createStartPoint();
        this.editor.createHole();
        
        hole.walls.forEach(wall => {
            this.editor.createWall(wall.position, wall.size, wall.rotationY || 0, wall.color);
        });
        
        hole.ramps.forEach(ramp => {
            this.editor.createRamp(ramp.position, ramp.size, ramp.rotationY, ramp.angle, ramp.color);
        });
        
        hole.powerupSpawns.forEach(spawn => {
            this.editor.createPowerupSpawn(spawn.position, spawn.color);
        });
        
        if (hole.fans) {
            hole.fans.forEach(fan => {
                this.editor.createFan(fan.position, fan.rotationY || 0, fan.angle || 0, fan.strength || 10);
            });
        }
        
        if (hole.bouncePads) {
            hole.bouncePads.forEach(pad => {
                this.editor.createBouncePad(pad.position, pad.rotationY || 0, pad.strength || 20);
            });
        }
        
        if (hole.bumpers) {
            hole.bumpers.forEach(bumper => {
                this.editor.createBumper(bumper.position, bumper.rotationY || 0, bumper.strength || 15);
            });
        }
        
        if (hole.speedBoosts) {
            hole.speedBoosts.forEach(boost => {
                this.editor.createSpeedBoost(boost.position, boost.rotationY || 0, boost.strength || 50);
            });
        }
        
        // Clear selection
        this.editor.clearSelection();
        this.editor.updatePropertiesPanel();
    }
    
    getMapData() {
        // Save current hole before exporting
        this.saveCurrentHoleData();
        
        return {
            name: this.editor.mapData.name,
            holes: this.holes,
            settings: this.editor.mapData.settings
        };
    }
    
    loadMapData(mapData) {
        // Load map with holes array
        if (mapData.holes && Array.isArray(mapData.holes)) {
            this.holes = mapData.holes;
            this.currentHoleIndex = 0;
            this.renderHoleList();
            this.loadHole(0);
        } else {
            // Legacy format - single hole
            const singleHole = {
                number: 1,
                par: 3,
                startPoint: mapData.startPoint,
                hole: mapData.hole,
                walls: mapData.walls || [],
                ramps: mapData.ramps || [],
                powerupSpawns: mapData.powerupSpawns || [],
                fans: mapData.fans || [],
                bouncePads: mapData.bouncePads || [],
                bumpers: mapData.bumpers || [],
                speedBoosts: mapData.speedBoosts || []
            };
            this.holes = [singleHole];
            this.currentHoleIndex = 0;
            this.renderHoleList();
            this.loadHole(0);
        }
        
        // Load settings
        if (mapData.settings) {
            this.editor.mapData.settings = mapData.settings;
            this.editor.applyMapSettings();
        }
    }
}
