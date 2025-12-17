// EditorState.js - Manages the state of the map editor

import * as THREE from 'three';

export class EditorState {
    constructor(editor) {
        this.editor = editor;
        
        // Map data structure
        this.mapData = {
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
        
        // Selection state
        this.selectedObject = null;
        this.selectedObjects = new Set();
        
        // Clipboard for copy/paste
        this.clipboard = [];
    }
    
    selectObject(obj) {
        this.clearSelection();
        this.selectedObject = obj;
        this.selectedObjects.clear();
        this.selectedObjects.add(obj);
        
        if (this.selectedObject.material && this.selectedObject.material.emissive) {
            this.selectedObject.material.emissive = new THREE.Color(0x444444);
        } else if (this.selectedObject.children) {
            this.selectedObject.children.forEach(child => {
                if (child.material && child.material.emissive) {
                    child.material.emissive = new THREE.Color(0x444444);
                }
            });
        }
        this.editor.ui.updatePropertiesPanel();
    }
    
    toggleSelection(obj) {
        if (this.selectedObjects.has(obj)) {
            this.selectedObjects.delete(obj);
            if (obj.material && obj.material.emissive) {
                obj.material.emissive = new THREE.Color(0x000000);
            } else if (obj.children) {
                obj.children.forEach(child => {
                    if (child.material && child.material.emissive) {
                        child.material.emissive = new THREE.Color(0x000000);
                    }
                });
            }
        } else {
            this.selectedObjects.add(obj);
            if (obj.material && obj.material.emissive) {
                obj.material.emissive = new THREE.Color(0x444444);
            } else if (obj.children) {
                obj.children.forEach(child => {
                    if (child.material && child.material.emissive) {
                        child.material.emissive = new THREE.Color(0x444444);
                    }
                });
            }
        }
        
        if (this.selectedObjects.size === 0) {
            this.selectedObject = null;
        } else {
            this.selectedObject = Array.from(this.selectedObjects)[0];
        }
        
        this.editor.ui.updatePropertiesPanel();
    }
    
    clearSelection() {
        if (this.selectedObject) {
            if (this.selectedObject.material && this.selectedObject.material.emissive) {
                this.selectedObject.material.emissive = new THREE.Color(0x000000);
            } else if (this.selectedObject.children) {
                this.selectedObject.children.forEach(child => {
                    if (child.material && child.material.emissive) {
                        child.material.emissive = new THREE.Color(0x000000);
                    }
                });
            }
        }
        
        this.selectedObjects.forEach(obj => {
            if (obj.material && obj.material.emissive) {
                obj.material.emissive = new THREE.Color(0x000000);
            } else if (obj.children) {
                obj.children.forEach(child => {
                    if (child.material && child.material.emissive) {
                        child.material.emissive = new THREE.Color(0x000000);
                    }
                });
            }
        });
        
        this.selectedObject = null;
        this.selectedObjects.clear();
    }
    
    copySelected() {
        if (this.selectedObjects.size > 0) {
            this.clipboard = [];
            this.selectedObjects.forEach(obj => {
                const type = obj.userData.type;
                const data = obj.userData.data;
                
                if (type !== 'start' && type !== 'hole') {
                    this.clipboard.push({ type, data: JSON.parse(JSON.stringify(data)) });
                }
            });
            console.log(`📋 Copied ${this.clipboard.length} object(s)`);
        } else if (this.selectedObject) {
            const type = this.selectedObject.userData.type;
            const data = this.selectedObject.userData.data;
            
            if (type !== 'start' && type !== 'hole') {
                this.clipboard = [{ type, data: JSON.parse(JSON.stringify(data)) }];
                console.log(`📋 Copied ${type}`);
            }
        }
    }
    
    deleteSelectedObject() {
        if (!this.selectedObject) return;
        
        const type = this.selectedObject.userData.type;
        
        if (type === 'start' || type === 'hole') {
            alert('Cannot delete start point or hole. You can only move them.');
            return;
        }
        
        this.editor.scene.scene.remove(this.selectedObject);
        
        const index = this.editor.scene.objects.indexOf(this.selectedObject);
        if (index > -1) {
            this.editor.scene.objects.splice(index, 1);
        }
        
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
        } else if (type === 'fan') {
            const fanIndex = this.mapData.fans.indexOf(data);
            if (fanIndex > -1) {
                this.mapData.fans.splice(fanIndex, 1);
                const bladeIndex = this.editor.scene.fanBlades.indexOf(this.selectedObject.userData.blades);
                if (bladeIndex > -1) this.editor.scene.fanBlades.splice(bladeIndex, 1);
            }
        } else if (type === 'bounce_pad') {
            const padIndex = this.mapData.bouncePads.indexOf(data);
            if (padIndex > -1) this.mapData.bouncePads.splice(padIndex, 1);
        } else if (type === 'bumper') {
            const bumperIndex = this.mapData.bumpers.indexOf(data);
            if (bumperIndex > -1) this.mapData.bumpers.splice(bumperIndex, 1);
        } else if (type === 'speedBoost') {
            const boostIndex = this.mapData.speedBoosts.indexOf(data);
            if (boostIndex > -1) this.mapData.speedBoosts.splice(boostIndex, 1);
        }
        
        this.selectedObject = null;
        this.editor.ui.updatePropertiesPanel();
    }
    
    deleteSelectedObjects() {
        if (this.selectedObjects.size === 0) return;
        
        let cannotDelete = [];
        const toDelete = Array.from(this.selectedObjects);
        
        toDelete.forEach(obj => {
            const type = obj.userData.type;
            
            if (type === 'start' || type === 'hole') {
                cannotDelete.push(type);
                return;
            }
            
            this.editor.scene.scene.remove(obj);
            
            const index = this.editor.scene.objects.indexOf(obj);
            if (index > -1) {
                this.editor.scene.objects.splice(index, 1);
            }
            
            const data = obj.userData.data;
            if (type === 'wall') {
                const wallIndex = this.mapData.walls.indexOf(data);
                if (wallIndex > -1) this.mapData.walls.splice(wallIndex, 1);
            } else if (type === 'ramp') {
                const rampIndex = this.mapData.ramps.indexOf(data);
                if (rampIndex > -1) this.mapData.ramps.splice(rampIndex, 1);
            } else if (type === 'powerup_spawn') {
                const spawnIndex = this.mapData.powerupSpawns.indexOf(data);
                if (spawnIndex > -1) this.mapData.powerupSpawns.splice(spawnIndex, 1);
            } else if (type === 'fan') {
                const fanIndex = this.mapData.fans.indexOf(data);
                if (fanIndex > -1) {
                    this.mapData.fans.splice(fanIndex, 1);
                    const bladeIndex = this.editor.scene.fanBlades.indexOf(obj.userData.blades);
                    if (bladeIndex > -1) this.editor.scene.fanBlades.splice(bladeIndex, 1);
                }
            } else if (type === 'bounce_pad') {
                const padIndex = this.mapData.bouncePads.indexOf(data);
                if (padIndex > -1) this.mapData.bouncePads.splice(padIndex, 1);
            } else if (type === 'bumper') {
                const bumperIndex = this.mapData.bumpers.indexOf(data);
                if (bumperIndex > -1) this.mapData.bumpers.splice(bumperIndex, 1);
            } else if (type === 'speedBoost') {
                const boostIndex = this.mapData.speedBoosts.indexOf(data);
                if (boostIndex > -1) this.mapData.speedBoosts.splice(boostIndex, 1);
            }
        });
        
        if (cannotDelete.length > 0) {
            alert(`Cannot delete: ${cannotDelete.join(', ')}`);
        }
        
        this.clearSelection();
        this.editor.ui.updatePropertiesPanel();
        this.editor.history.saveHistory('delete_multiple');
    }
}
