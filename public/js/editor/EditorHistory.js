// EditorHistory.js - Manages undo/redo history

export class EditorHistory {
    constructor(editor) {
        this.editor = editor;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        this.isRestoring = false; // Flag to prevent saving during restore
    }
    
    // Save current state AFTER making changes
    saveHistory(actionType) {
        // Don't save history while we're restoring a previous state
        if (this.isRestoring) {
            return;
        }
        
        // Remove any future history if we're not at the end (branching)
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Deep clone the current state
        const snapshot = {
            actionType: actionType,
            mapData: JSON.parse(JSON.stringify(this.editor.state.mapData)),
            timestamp: Date.now()
        };
        
        this.history.push(snapshot);
        this.historyIndex++;
        
        // Limit history size (remove oldest)
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
        
        console.log(`📝 Saved state: ${actionType} (${this.historyIndex + 1}/${this.history.length})`);
    }
    
    undo() {
        if (this.historyIndex <= 0) {
            console.log('⚠️ Nothing to undo');
            return;
        }
        
        this.historyIndex--;
        console.log(`⏪ Undo to: ${this.history[this.historyIndex].actionType} (${this.historyIndex + 1}/${this.history.length})`);
        this.restoreState(this.history[this.historyIndex]);
    }
    
    redo() {
        if (this.historyIndex >= this.history.length - 1) {
            console.log('⚠️ Nothing to redo');
            return;
        }
        
        this.historyIndex++;
        console.log(`⏩ Redo to: ${this.history[this.historyIndex].actionType} (${this.historyIndex + 1}/${this.history.length})`);
        this.restoreState(this.history[this.historyIndex]);
    }
    
    restoreState(snapshot) {
        // Set flag to prevent saving during restoration
        this.isRestoring = true;
        
        try {
            // Clear all existing scene objects
            this.editor.scene.objects.forEach(obj => {
                this.editor.scene.scene.remove(obj);
            });
            this.editor.scene.objects = [];
            
            // Deep clone the snapshot data to avoid reference issues
            this.editor.state.mapData = JSON.parse(JSON.stringify(snapshot.mapData));
            
            // Ensure all required arrays exist
            if (!this.editor.state.mapData.walls) this.editor.state.mapData.walls = [];
            if (!this.editor.state.mapData.ramps) this.editor.state.mapData.ramps = [];
            if (!this.editor.state.mapData.powerupSpawns) this.editor.state.mapData.powerupSpawns = [];
            if (!this.editor.state.mapData.fans) this.editor.state.mapData.fans = [];
            if (!this.editor.state.mapData.bouncePads) this.editor.state.mapData.bouncePads = [];
            if (!this.editor.state.mapData.bumpers) this.editor.state.mapData.bumpers = [];
            if (!this.editor.state.mapData.speedBoosts) this.editor.state.mapData.speedBoosts = [];
            if (!this.editor.state.mapData.lava) this.editor.state.mapData.lava = [];
            if (!this.editor.state.mapData.spinners) this.editor.state.mapData.spinners = [];
            
            // Recreate start point and hole
            this.editor.objects.createStartPoint();
            this.editor.objects.createHole();
            
            // Recreate all walls
            this.editor.state.mapData.walls.forEach(wall => {
                const obj = this.editor.objects.createWall(wall.position, wall.size, wall.rotationY || 0, wall.color);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
            });
            
            // Recreate all ramps
            this.editor.state.mapData.ramps.forEach(ramp => {
                const obj = this.editor.objects.createRamp(ramp.position, ramp.size, ramp.rotationY, ramp.angle, ramp.color);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
            });
            
            // Recreate all powerup spawns
            this.editor.state.mapData.powerupSpawns.forEach(spawn => {
                const obj = this.editor.objects.createPowerupSpawn(spawn.position, spawn.color);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
            });
            
            // Recreate all fans
            this.editor.state.mapData.fans.forEach(fan => {
                const obj = this.editor.objects.createFan(fan.position, fan.rotationY || 0, fan.angle || 0, fan.strength || 10);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
            });
            
            // Recreate all bounce pads
            this.editor.state.mapData.bouncePads.forEach(pad => {
                const obj = this.editor.objects.createBouncePad(pad.position, pad.rotationY || 0, pad.strength || 20);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
            });
            
            // Recreate all bumpers
            this.editor.state.mapData.bumpers.forEach(bumper => {
                const obj = this.editor.objects.createBumper(bumper.position, bumper.rotationY || 0, bumper.strength || 15);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
            });
            
            // Recreate all speed boosts
            this.editor.state.mapData.speedBoosts.forEach(boost => {
                const obj = this.editor.objects.createSpeedBoost(boost.position, boost.rotationY || 0, boost.strength || 30);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
            });
            
            // Recreate all lava pools
            if (this.editor.state.mapData.lava) {
                this.editor.state.mapData.lava.forEach(lavaPool => {
                    const obj = this.editor.objects.createLava(lavaPool.position, lavaPool.rotationY || 0, lavaPool.width || 5, lavaPool.depth || 5);
                    this.editor.scene.scene.add(obj);
                    this.editor.scene.objects.push(obj);
                });
            }
            
            // Recreate all spinners
            if (this.editor.state.mapData.spinners) {
                this.editor.state.mapData.spinners.forEach(spinner => {
                    const obj = this.editor.objects.createSpinner(spinner.position, spinner.rotationY || 0, spinner.radius || 8, spinner.speed || 1);
                    this.editor.scene.scene.add(obj);
                    this.editor.scene.objects.push(obj);
                });
            }
            
            // Ensure settings exist
            if (!this.editor.state.mapData.settings) {
                this.editor.state.mapData.settings = {
                    skyColor: 0x87CEEB,
                    groundColor: 0x228B22,
                    gravity: -30
                };
            }
            
            // Apply settings and update UI
            this.editor.ui.applyMapSettings();
            this.editor.ui.updatePropertiesPanel();
            
            // Clear selection
            if (this.editor.state.selectedObject) {
                this.editor.state.deselectObject();
            }
            
        } finally {
            // Always reset the flag
            this.isRestoring = false;
        }
    }
    
    canUndo() {
        return this.historyIndex > 0;
    }
    
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }
}
