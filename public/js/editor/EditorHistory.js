// EditorHistory.js - Manages undo/redo history

export class EditorHistory {
    constructor(editor) {
        this.editor = editor;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
    }
    
    saveHistory(actionType) {
        const snapshot = {
            actionType: actionType,
            mapData: JSON.parse(JSON.stringify(this.editor.state.mapData)),
            timestamp: Date.now()
        };
        
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        this.history.push(snapshot);
        
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }
    
    saveState(state, action = 'edit') {
        // Remove any states after current index (for branching undo)
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Deep clone the state
        const snapshot = {
            action: action,
            timestamp: Date.now(),
            data: JSON.parse(JSON.stringify(state))
        };
        
        this.history.push(snapshot);
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
        
        console.log(`📝 History saved: ${action} (${this.historyIndex + 1}/${this.history.length})`);
    }
    
    undo() {
        if (this.historyIndex <= 0) {
            console.log('Nothing to undo');
            return;
        }
        
        this.historyIndex--;
        this.restoreState(this.history[this.historyIndex]);
    }
    
    redo() {
        if (this.historyIndex >= this.history.length - 1) {
            console.log('Nothing to redo');
            return;
        }
        
        this.historyIndex++;
        this.restoreState(this.history[this.historyIndex]);
    }
    
    restoreState(snapshot) {
        this.editor.scene.objects.forEach(obj => {
            this.editor.scene.scene.remove(obj);
        });
        this.editor.scene.objects = [];
        
        this.editor.state.mapData = JSON.parse(JSON.stringify(snapshot.mapData));
        
        this.editor.objects.createStartPoint();
        this.editor.objects.createHole();
        
        this.editor.state.mapData.walls.forEach(wall => {
            const obj = this.editor.objects.createWall(wall.position, wall.size, wall.rotationY || 0, wall.color);
            this.editor.scene.scene.add(obj);
            this.editor.scene.objects.push(obj);
            this.editor.state.mapData.walls.push(wall);
        });
        
        this.editor.state.mapData.ramps.forEach(ramp => {
            const obj = this.editor.objects.createRamp(ramp.position, ramp.size, ramp.rotationY, ramp.angle, ramp.color);
            this.editor.scene.scene.add(obj);
            this.editor.scene.objects.push(obj);
        });
        
        this.editor.state.mapData.powerupSpawns.forEach(spawn => {
            const obj = this.editor.objects.createPowerupSpawn(spawn.position, spawn.color);
            this.editor.scene.scene.add(obj);
            this.editor.scene.objects.push(obj);
        });
        
        if (this.editor.state.mapData.fans) {
            this.editor.state.mapData.fans.forEach(fan => {
                const obj = this.editor.objects.createFan(fan.position, fan.rotationY || 0, fan.angle || 0, fan.strength || 10);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
            });
        }
        
        if (this.editor.state.mapData.bouncePads) {
            this.editor.state.mapData.bouncePads.forEach(pad => {
                const obj = this.editor.objects.createBouncePad(pad.position, pad.rotationY || 0, pad.strength || 20);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
            });
        }
        
        if (this.editor.state.mapData.bumpers) {
            this.editor.state.mapData.bumpers.forEach(bumper => {
                const obj = this.editor.objects.createBumper(bumper.position, bumper.rotationY || 0, bumper.strength || 15);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
            });
        }
        
        if (this.editor.state.mapData.speedBoosts) {
            this.editor.state.mapData.speedBoosts.forEach(boost => {
                const obj = this.editor.objects.createSpeedBoost(boost.position, boost.rotationY || 0, boost.strength || 30);
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
            });
        }
        
        if (!this.editor.state.mapData.settings) {
            this.editor.state.mapData.settings = {
                skyColor: 0x87CEEB,
                groundColor: 0x228B22,
                gravity: -30
            };
        }
        this.editor.ui.applyMapSettings();
        this.editor.ui.updatePropertiesPanel();
    }
    
    canUndo() {
        return this.historyIndex > 0;
    }
    
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }
}
