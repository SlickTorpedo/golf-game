// editor-multi-hole.js - Adds multi-level support to the map editor

export class MultiLevelManager {
    constructor(mapEditor) {
        this.editor = mapEditor;
        this.currentLevelIndex = 0;
        this.levels = [this.createDefaultLevel()];
        
        this.init();
    }
    
    init() {
        this.renderLevelList();
        this.setupEventListeners();
    }
    
    createDefaultLevel(number = 1) {
        return {
            number: number,
            name: `Level ${number}`,
            par: 3,
            startPoint: { x: 0, y: 0, z: 30 },
            hole: { x: 0, y: 0, z: -30, radius: 1.2 },
            walls: [],
            ramps: [],
            powerupSpawns: [],
            fans: [],
            bouncePads: [],
            bumpers: [],
            speedBoosts: [],
            lava: [],
            spinners: []
        };
    }
    
    setupEventListeners() {
        document.getElementById('add-level').addEventListener('click', () => {
            this.addLevel();
        });
        
        document.getElementById('edit-level-name')?.addEventListener('click', () => {
            this.promptRenameCurrentLevel();
        });
        
        document.getElementById('current-level-par')?.addEventListener('change', (e) => {
            this.updateCurrentLevelPar(parseInt(e.target.value));
        });
        
        document.getElementById('map-name-input')?.addEventListener('change', (e) => {
            this.updateMapName(e.target.value);
        });
    }
    
    renderLevelList() {
        const levelList = document.getElementById('level-list');
        levelList.innerHTML = '';
        
        this.levels.forEach((level, index) => {
            const item = document.createElement('div');
            item.className = 'level-item' + (index === this.currentLevelIndex ? ' active' : '');
            item.innerHTML = `
                <div class="level-item-info">
                    <div class="level-item-number">${level.name || `Level ${level.number}`}</div>
                    <div class="level-item-par">Par ${level.par}</div>
                </div>
                ${this.levels.length > 1 ? `<button class="level-item-delete">×</button>` : ''}
            `;
            
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('level-item-delete')) {
                    this.switchLevel(index);
                }
            });
            
            const deleteBtn = item.querySelector('.level-item-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteLevel(index);
                });
            }
            
            levelList.appendChild(item);
        });
        
        // Update the current level display
        this.updateCurrentLevelDisplay();
    }
    
    updateCurrentLevelDisplay() {
        const level = this.levels[this.currentLevelIndex];
        const nameDisplay = document.getElementById('current-level-name');
        const parInput = document.getElementById('current-level-par');
        
        if (nameDisplay) {
            nameDisplay.textContent = level.name || `Level ${level.number}`;
        }
        if (parInput) {
            parInput.value = level.par;
        }
    }
    
    updateMapName(name) {
        if (name && name.trim()) {
            this.editor.state.mapData.name = name.trim();
            console.log(`🗺️ Map renamed to: ${name}`);
        }
    }
    
    addLevel() {
        const levelNumber = this.levels.length + 1;
        const newLevel = this.createDefaultLevel(levelNumber);
        
        // Offset start/hole positions so they don't overlap
        newLevel.startPoint.x += this.levels.length * 20;
        newLevel.hole.x += this.levels.length * 20;
        
        this.levels.push(newLevel);
        this.renderLevelList();
        this.switchLevel(this.levels.length - 1);
        
        console.log(`🎮 Added ${newLevel.name} (Par ${newLevel.par})`);
    }
    
    promptRenameCurrentLevel() {
        const level = this.levels[this.currentLevelIndex];
        const newName = prompt('Enter level name:', level.name || `Level ${level.number}`);
        
        if (newName && newName.trim()) {
            level.name = newName.trim();
            this.renderLevelList();
            console.log(`✏️ Renamed to: ${level.name}`);
        }
    }
    
    updateCurrentLevelPar(newPar) {
        if (newPar >= 1 && newPar <= 10) {
            this.levels[this.currentLevelIndex].par = newPar;
            this.renderLevelList();
            console.log(`🎮 Updated par to ${newPar}`);
        }
    }
    
    deleteLevel(index) {
        if (this.levels.length === 1) {
            alert('Cannot delete the last level');
            return;
        }
        
        const levelName = this.levels[index].name || `Level ${this.levels[index].number}`;
        if (!confirm(`Delete ${levelName}?`)) {
            return;
        }
        
        this.levels.splice(index, 1);
        
        // Renumber levels
        this.levels.forEach((level, i) => {
            level.number = i + 1;
        });
        
        // Switch to previous level if we deleted the current one
        if (index === this.currentLevelIndex) {
            this.currentLevelIndex = Math.max(0, index - 1);
        } else if (index < this.currentLevelIndex) {
            this.currentLevelIndex--;
        }
        
        this.renderLevelList();
        this.loadLevel(this.currentLevelIndex);
        
        console.log(`🗑️ Deleted level, ${this.levels.length} remaining`);
    }
    
    switchLevel(index) {
        if (index === this.currentLevelIndex) return;
        
        // Save current level data
        this.saveCurrentLevelData();
        
        // Switch to new level
        this.currentLevelIndex = index;
        this.loadLevel(index);
        this.renderLevelList();
        
        const levelName = this.levels[index].name || `Level ${this.levels[index].number}`;
        console.log(`🔄 Switched to ${levelName}`);
    }
    
    saveCurrentLevelData() {
        const level = this.levels[this.currentLevelIndex];
        
        // Save all object arrays from editor's mapData
        level.startPoint = { ...this.editor.state.mapData.startPoint };
        level.hole = { ...this.editor.state.mapData.hole };
        level.walls = JSON.parse(JSON.stringify(this.editor.state.mapData.walls));
        level.ramps = JSON.parse(JSON.stringify(this.editor.state.mapData.ramps));
        level.powerupSpawns = JSON.parse(JSON.stringify(this.editor.state.mapData.powerupSpawns));
        level.fans = JSON.parse(JSON.stringify(this.editor.state.mapData.fans || []));
        level.bouncePads = JSON.parse(JSON.stringify(this.editor.state.mapData.bouncePads || []));
        level.bumpers = JSON.parse(JSON.stringify(this.editor.state.mapData.bumpers || []));
        level.speedBoosts = JSON.parse(JSON.stringify(this.editor.state.mapData.speedBoosts || []));
        level.lava = JSON.parse(JSON.stringify(this.editor.state.mapData.lava || []));
        level.spinners = JSON.parse(JSON.stringify(this.editor.state.mapData.spinners || []));
    }
    
    loadLevel(index) {
        const level = this.levels[index];
        
        // Clear current scene
        this.editor.scene.objects.forEach(obj => this.editor.scene.scene.remove(obj));
        this.editor.scene.objects = [];
        this.editor.scene.fanBlades = [];
        
        // Load level data into editor
        this.editor.state.mapData.startPoint = { ...level.startPoint };
        this.editor.state.mapData.hole = { ...level.hole };
        this.editor.state.mapData.walls = [];
        this.editor.state.mapData.ramps = [];
        this.editor.state.mapData.powerupSpawns = [];
        this.editor.state.mapData.fans = [];
        this.editor.state.mapData.bouncePads = [];
        this.editor.state.mapData.bumpers = [];
        this.editor.state.mapData.speedBoosts = [];
        this.editor.state.mapData.lava = [];
        this.editor.state.mapData.spinners = [];
        
        // Recreate objects
        this.editor.objects.createStartPoint();
        this.editor.objects.createHole();
        
        level.walls.forEach(wall => {
            const obj = this.editor.objects.createWall(wall.position, wall.size, wall.rotationY || 0, wall.color);
            this.editor.scene.scene.add(obj);
            this.editor.scene.objects.push(obj);
            this.editor.state.mapData.walls.push(obj.userData.data);
        });
        
        level.ramps.forEach(ramp => {
            const obj = this.editor.objects.createRamp(ramp.position, ramp.size, ramp.rotationY, ramp.angle, ramp.color);
            this.editor.scene.scene.add(obj);
            this.editor.scene.objects.push(obj);
            this.editor.state.mapData.ramps.push(obj.userData.data);
        });
        
        level.powerupSpawns.forEach(spawn => {
            const obj = this.editor.objects.createPowerupSpawn(spawn.position, spawn.color);
            this.editor.scene.scene.add(obj);
            this.editor.scene.objects.push(obj);
            this.editor.state.mapData.powerupSpawns.push(obj.userData.data);
        });
        
        if (level.fans) {
            level.fans.forEach(fan => {
                const obj = this.editor.objects.createFan(fan.position, fan.rotationY || 0, fan.angle || 0, fan.strength || 10);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
                this.editor.state.mapData.fans.push(obj.userData.data);
            });
        }
        
        if (level.bouncePads) {
            level.bouncePads.forEach(pad => {
                const obj = this.editor.objects.createBouncePad(pad.position, pad.rotationY || 0, pad.strength || 20);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
                this.editor.state.mapData.bouncePads.push(obj.userData.data);
            });
        }
        
        if (level.bumpers) {
            level.bumpers.forEach(bumper => {
                const obj = this.editor.objects.createBumper(bumper.position, bumper.rotationY || 0, bumper.strength || 15);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
                this.editor.state.mapData.bumpers.push(obj.userData.data);
            });
        }
        
        if (level.speedBoosts) {
            level.speedBoosts.forEach(boost => {
                const obj = this.editor.objects.createSpeedBoost(boost.position, boost.rotationY || 0, boost.strength || 50);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
                this.editor.state.mapData.speedBoosts.push(obj.userData.data);
            });
        }
        
        if (level.lava) {
            level.lava.forEach(lavaPool => {
                const obj = this.editor.objects.createLava(lavaPool.position, lavaPool.rotationY || 0, lavaPool.width || 5, lavaPool.depth || 5);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
                this.editor.state.mapData.lava.push(obj.userData.data);
            });
        }
        
        if (level.spinners) {
            level.spinners.forEach(spinner => {
                const obj = this.editor.objects.createSpinner(spinner.position, spinner.rotationY || 0, spinner.length || 8, spinner.speed || 1);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
                this.editor.state.mapData.spinners.push(obj.userData.data);
            });
        }
        
        // Clear selection
        this.editor.state.clearSelection();
        this.editor.ui.updatePropertiesPanel();
    }
    
    getMapData() {
        // Save current level before exporting
        this.saveCurrentLevelData();
        
        return {
            name: this.editor.state.mapData.name,
            levels: this.levels,
            settings: this.editor.state.mapData.settings
        };
    }
    
    loadMapData(mapData) {
        // Update map name input
        const mapNameInput = document.getElementById('map-name-input');
        if (mapNameInput) {
            mapNameInput.value = mapData.name || 'Untitled Map';
        }
        
        // Load map with levels array (new format) or holes array (old format)
        const levelsData = mapData.levels || mapData.holes;
        if (levelsData && Array.isArray(levelsData)) {
            this.levels = levelsData;
            this.currentLevelIndex = 0;
            this.renderLevelList();
            this.loadLevel(0);
        } else {
            // Legacy format - single level
            const singleLevel = {
                number: 1,
                name: 'Level 1',
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
            this.levels = [singleLevel];
            this.currentLevelIndex = 0;
            this.renderLevelList();
            this.loadLevel(0);
        }
        
        // Ensure all loaded levels have names
        this.levels.forEach(level => {
            if (!level.name) {
                level.name = `Level ${level.number}`;
            }
        });
        
        // Load settings
        if (mapData.settings) {
            this.editor.state.mapData.settings = mapData.settings;
            this.editor.ui.applyMapSettings();
        }
    }
}
