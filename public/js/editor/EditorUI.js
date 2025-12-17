// EditorUI.js - Handles UI updates, properties panel, and map settings

import * as THREE from 'three';

export class EditorUI {
    constructor(editor) {
        this.editor = editor;
    }
    
    updatePropertiesPanel() {
        const panel = document.getElementById('properties-content');
        
        if (this.editor.state.selectedObjects.size > 1) {
            panel.innerHTML = `<p class="hint">${this.editor.state.selectedObjects.size} objects selected<br><br>Use Ctrl+C to copy<br>Use Delete to remove</p>`;
            return;
        }
        
        if (!this.editor.state.selectedObject) {
            panel.innerHTML = '<p class="hint">Select an object to edit its properties</p>';
            return;
        }
        
        const type = this.editor.state.selectedObject.userData.type;
        const data = this.editor.state.selectedObject.userData.data;
        
        let html = `<h3>${type.toUpperCase()}</h3>`;
        
        html += `<div class="property-group">
            <label>Position</label>
            <div class="property-row">
                <input type="number" id="prop-x" value="${this.editor.state.selectedObject.position.x.toFixed(2)}" step="0.5">
                <input type="number" id="prop-y" value="${this.editor.state.selectedObject.position.y.toFixed(2)}" step="0.5">
                <input type="number" id="prop-z" value="${this.editor.state.selectedObject.position.z.toFixed(2)}" step="0.5">
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
        
        if (type === 'wall') {
            html += `<div class="property-group">
                <label>Rotation Y (degrees)</label>
                <input type="number" id="prop-wall-rotation" value="${data.rotationY || 0}" step="15" min="0" max="360">
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
        
        if (type === 'fan') {
            html += `<div class="property-group">
                <label>Rotation Y (degrees)</label>
                <input type="number" id="prop-rotation" value="${data.rotationY || 0}" step="15" min="0" max="360">
            </div>`;
            
            html += `<div class="property-group">
                <label>Tilt Angle (degrees)</label>
                <input type="number" id="prop-angle" value="${data.angle || 0}" step="15" min="-90" max="90">
            </div>`;
            
            html += `<div class="property-group">
                <label>Force Strength</label>
                <input type="number" id="prop-strength" value="${data.strength || 10}" step="1" min="1" max="50">
            </div>`;
        }
        
        if (type === 'bounce_pad') {
            html += `<div class="property-group">
                <label>Rotation Y (degrees)</label>
                <input type="number" id="prop-rotation" value="${data.rotationY || 0}" step="15" min="0" max="360">
            </div>`;
            
            html += `<div class="property-group">
                <label>Bounce Strength</label>
                <input type="number" id="prop-strength" value="${data.strength || 20}" step="1" min="5" max="50">
            </div>`;
        }
        
        if (type === 'bumper') {
            html += `<div class="property-group">
                <label>Rotation Y (degrees)</label>
                <input type="number" id="prop-rotation" value="${data.rotationY || 0}" step="15" min="0" max="360">
            </div>`;
            
            html += `<div class="property-group">
                <label>Push Strength</label>
                <input type="number" id="prop-strength" value="${data.strength || 15}" step="1" min="5" max="40">
            </div>`;
        }
        
        if (type === 'speedBoost') {
            html += `<div class="property-group">
                <label>Rotation Y (degrees)</label>
                <input type="number" id="prop-rotation" value="${data.rotationY || 0}" step="15" min="0" max="360">
            </div>`;
            
            html += `<div class="property-group">
                <label>Speed Strength</label>
                <input type="number" id="prop-strength" value="${data.strength || 30}" step="5" min="10" max="100">
            </div>`;
        }
        
        if (type === 'hole') {
            html += `<div class="property-group">
                <label>Radius</label>
                <input type="number" id="prop-radius" value="${data.radius}" step="0.1" min="0.5" max="3">
            </div>`;
        }
        
        if (type === 'wall' || type === 'ramp' || type === 'powerup_spawn') {
            const currentColor = data.color !== undefined ? '#' + data.color.toString(16).padStart(6, '0') : 
                (type === 'wall' ? '#8B4513' : type === 'ramp' ? '#6b8e23' : '#ff00ff');
            html += `<div class="property-group">
                <label>Color</label>
                <input type="color" id="prop-color" value="${currentColor}">
            </div>`;
        }
        
        html += `<button class="btn-danger" id="delete-object">🗑️ Delete Object</button>`;
        
        panel.innerHTML = html;
        this.setupPropertyListeners();
    }
    
    setupPropertyListeners() {
        const posX = document.getElementById('prop-x');
        const posY = document.getElementById('prop-y');
        const posZ = document.getElementById('prop-z');
        
        let propertyChangeTimer;
        const debouncePropertyChange = (callback) => {
            clearTimeout(propertyChangeTimer);
            propertyChangeTimer = setTimeout(callback, 300);
        };
        
        if (posX) posX.addEventListener('change', () => debouncePropertyChange(() => this.updateObjectProperty('position', 'x', parseFloat(posX.value))));
        if (posY) posY.addEventListener('change', () => debouncePropertyChange(() => this.updateObjectProperty('position', 'y', parseFloat(posY.value))));
        if (posZ) posZ.addEventListener('change', () => debouncePropertyChange(() => this.updateObjectProperty('position', 'z', parseFloat(posZ.value))));
        
        const sizeX = document.getElementById('prop-size-x');
        const sizeY = document.getElementById('prop-size-y');
        const sizeZ = document.getElementById('prop-size-z');
        
        if (sizeX) sizeX.addEventListener('change', () => this.updateObjectSize('x', parseFloat(sizeX.value)));
        if (sizeY) sizeY.addEventListener('change', () => this.updateObjectSize('y', parseFloat(sizeY.value)));
        if (sizeZ) sizeZ.addEventListener('change', () => this.updateObjectSize('z', parseFloat(sizeZ.value)));
        
        const rotation = document.getElementById('prop-rotation');
        if (rotation) rotation.addEventListener('change', () => {
            const type = this.editor.state.selectedObject?.userData.type;
            if (type === 'ramp') {
                this.updateRampRotation(parseFloat(rotation.value));
            } else if (type === 'fan') {
                this.updateFanRotation(parseFloat(rotation.value));
            } else if (type === 'bounce_pad') {
                this.updateBouncePadRotation(parseFloat(rotation.value));
            } else if (type === 'bumper') {
                this.updateBumperRotation(parseFloat(rotation.value));
            } else if (type === 'speedBoost') {
                this.updateSpeedBoostRotation(parseFloat(rotation.value));
            }
        });
        
        const wallRotation = document.getElementById('prop-wall-rotation');
        if (wallRotation) wallRotation.addEventListener('change', () => this.updateWallRotation(parseFloat(wallRotation.value)));
        
        const angle = document.getElementById('prop-angle');
        if (angle) angle.addEventListener('change', () => {
            const type = this.editor.state.selectedObject?.userData.type;
            if (type === 'ramp') {
                this.updateRampAngle(parseFloat(angle.value));
            } else if (type === 'fan') {
                this.updateFanAngle(parseFloat(angle.value));
            }
        });
        
        const strength = document.getElementById('prop-strength');
        if (strength) strength.addEventListener('change', () => {
            const type = this.editor.state.selectedObject?.userData.type;
            if (type === 'fan') {
                this.updateFanStrength(parseFloat(strength.value));
            } else if (type === 'bounce_pad') {
                this.updateBouncePadStrength(parseFloat(strength.value));
            } else if (type === 'bumper') {
                this.updateBumperStrength(parseFloat(strength.value));
            } else if (type === 'speedBoost') {
                this.updateSpeedBoostStrength(parseFloat(strength.value));
            }
        });
        
        const radius = document.getElementById('prop-radius');
        if (radius) radius.addEventListener('change', () => this.updateHoleRadius(parseFloat(radius.value)));
        
        const color = document.getElementById('prop-color');
        if (color) color.addEventListener('change', () => this.updateObjectColor(color.value));
        
        const deleteBtn = document.getElementById('delete-object');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.editor.state.deleteSelectedObject());
    }
    
    updateObjectProperty(prop, axis, value) {
        if (this.editor.state.selectedObject) {
            this.editor.state.selectedObject[prop][axis] = value;
            if (this.editor.state.selectedObject.userData.data[prop]) {
                this.editor.state.selectedObject.userData.data[prop][axis] = value;
            }
            this.editor.history.saveHistory('modify');
        }
    }
    
    updateObjectSize(axis, value) {
        if (this.editor.state.selectedObject && this.editor.state.selectedObject.userData.data.size) {
            this.editor.state.selectedObject.userData.data.size[axis] = value;
            this.editor.state.selectedObject.geometry.dispose();
            this.editor.state.selectedObject.geometry = new THREE.BoxGeometry(
                this.editor.state.selectedObject.userData.data.size.x,
                this.editor.state.selectedObject.userData.data.size.y,
                this.editor.state.selectedObject.userData.data.size.z
            );
            this.editor.history.saveHistory('modify');
        }
    }
    
    updateRampRotation(value) {
        if (this.editor.state.selectedObject && this.editor.state.selectedObject.userData.type === 'ramp') {
            this.editor.state.selectedObject.userData.data.rotationY = value;
            const angleRad = (this.editor.state.selectedObject.userData.data.angle * Math.PI) / 180;
            this.editor.state.selectedObject.rotation.y = (value * Math.PI) / 180;
            this.editor.state.selectedObject.rotation.z = angleRad;
            this.editor.history.saveHistory('modify');
        }
    }
    
    updateWallRotation(value) {
        if (this.editor.state.selectedObject && this.editor.state.selectedObject.userData.type === 'wall') {
            this.editor.state.selectedObject.userData.data.rotationY = value;
            this.editor.state.selectedObject.rotation.y = (value * Math.PI) / 180;
            this.editor.history.saveHistory('modify');
        }
    }
    
    updateObjectColor(hexColor) {
        if (this.editor.state.selectedObject) {
            const color = parseInt(hexColor.replace('#', ''), 16);
            this.editor.state.selectedObject.material.color.setHex(color);
            this.editor.state.selectedObject.userData.data.color = color;
            this.editor.history.saveHistory('modify');
        }
    }
    
    updateRampAngle(value) {
        if (this.editor.state.selectedObject && this.editor.state.selectedObject.userData.type === 'ramp') {
            this.editor.state.selectedObject.userData.data.angle = value;
            const angleRad = (value * Math.PI) / 180;
            this.editor.state.selectedObject.rotation.z = angleRad;
            this.editor.history.saveHistory('modify');
        }
    }
    
    updateFanRotation(value) {
        if (this.editor.state.selectedObject && this.editor.state.selectedObject.userData.type === 'fan') {
            this.editor.state.selectedObject.userData.data.rotationY = value;
            this.editor.state.selectedObject.rotation.y = (value * Math.PI) / 180;
            this.editor.history.saveHistory('modify');
        }
    }
    
    updateFanAngle(value) {
        if (this.editor.state.selectedObject && this.editor.state.selectedObject.userData.type === 'fan') {
            this.editor.state.selectedObject.userData.data.angle = value;
            this.editor.state.selectedObject.rotation.x = (value * Math.PI) / 180;
            this.editor.history.saveHistory('modify');
        }
    }
    
    updateFanStrength(value) {
        if (this.editor.state.selectedObject && this.editor.state.selectedObject.userData.type === 'fan') {
            this.editor.state.selectedObject.userData.data.strength = value;
            this.editor.history.saveHistory('modify');
        }
    }
    
    updateBouncePadStrength(value) {
        if (this.editor.state.selectedObject && this.editor.state.selectedObject.userData.type === 'bounce_pad') {
            this.editor.state.selectedObject.userData.data.strength = value;
            this.editor.history.saveHistory('modify');
        }
    }
    
    updateBouncePadRotation(value) {
        if (this.editor.state.selectedObject && this.editor.state.selectedObject.userData.type === 'bounce_pad') {
            this.editor.state.selectedObject.userData.data.rotationY = value;
            this.editor.state.selectedObject.rotation.y = (value * Math.PI) / 180;
            this.editor.history.saveHistory('modify');
        }
    }
    
    updateBumperStrength(value) {
        if (this.editor.state.selectedObject && this.editor.state.selectedObject.userData.type === 'bumper') {
            this.editor.state.selectedObject.userData.data.strength = value;
            this.editor.history.saveHistory('modify');
        }
    }
    
    updateBumperRotation(value) {
        if (this.editor.state.selectedObject && this.editor.state.selectedObject.userData.type === 'bumper') {
            this.editor.state.selectedObject.userData.data.rotationY = value;
            this.editor.state.selectedObject.rotation.y = (value * Math.PI) / 180;
            this.editor.history.saveHistory('modify');
        }
    }
    
    updateSpeedBoostStrength(value) {
        if (this.editor.state.selectedObject && this.editor.state.selectedObject.userData.type === 'speedBoost') {
            this.editor.state.selectedObject.userData.data.strength = value;
            this.editor.history.saveHistory('modify');
        }
    }
    
    updateSpeedBoostRotation(value) {
        if (this.editor.state.selectedObject && this.editor.state.selectedObject.userData.type === 'speedBoost') {
            this.editor.state.selectedObject.userData.data.rotationY = value;
            this.editor.state.selectedObject.rotation.y = (value * Math.PI) / 180;
            this.editor.history.saveHistory('modify');
        }
    }
    
    updateHoleRadius(value) {
        if (this.editor.state.selectedObject && this.editor.state.selectedObject.userData.type === 'hole') {
            this.editor.state.selectedObject.userData.data.radius = value;
            this.editor.state.mapData.hole.radius = value;
            this.editor.state.selectedObject.geometry.dispose();
            this.editor.state.selectedObject.geometry = new THREE.CylinderGeometry(value, value, 0.5, 32);
            this.editor.history.saveHistory('modify');
        }
    }
    
    updatePlacementControls() {
        const panel = document.getElementById('placement-content');
        
        if (!this.editor.tools.selectedTool) {
            panel.innerHTML = '<p class="hint">Select a tool to customize placement</p>';
            return;
        }
        
        if (this.editor.tools.selectedTool === 'select') {
            panel.innerHTML = '<p class="hint">Click objects to select them</p>';
            return;
        }
        
        if (this.editor.tools.selectedTool === 'move') {
            panel.innerHTML = '<p class="hint">Click and drag to move objects<br><br>Works on all objects</p>';
            return;
        }
        
        if (this.editor.tools.selectedTool === 'extrude') {
            panel.innerHTML = '<p class="hint">Click and drag object faces to extrude<br><br>Works on walls and ramps</p>';
            return;
        }
        
        if (this.editor.tools.selectedTool === 'delete') {
            panel.innerHTML = '<p class="hint">Click objects to delete them<br><br>Cannot delete start point or hole</p>';
            return;
        }
        
        if (this.editor.tools.selectedTool === 'paint') {
            const currentColor = '#' + this.editor.tools.paintColor.toString(16).padStart(6, '0');
            let html = '<h3>PAINT BUCKET</h3>';
            html += `<div class="property-group">
                <label>Paint Color</label>
                <input type="color" id="paint-color" value="${currentColor}">
            </div>`;
            html += '<p class="hint">Click objects to paint them<br><br>Works on walls, ramps, and powerup spawns</p>';
            panel.innerHTML = html;
            
            const colorInput = document.getElementById('paint-color');
            if (colorInput) {
                colorInput.addEventListener('input', (e) => this.editor.tools.updatePaintColor(e.target.value));
            }
            return;
        }
        
        let html = `<h3>${this.editor.tools.selectedTool.toUpperCase()}</h3>`;
        
        if (this.editor.tools.selectedTool === 'wall' || this.editor.tools.selectedTool === 'ramp') {
            html += `<div class="property-group">
                <label>Rotation (degrees)</label>
                <input type="number" id="placement-rotation" value="${this.editor.tools.previewRotation}" step="15" min="0" max="360">
            </div>`;
        }
        
        if (this.editor.tools.selectedTool === 'ramp') {
            html += `<div class="property-group">
                <label>Angle (degrees)</label>
                <input type="number" id="placement-angle" value="${this.editor.tools.previewAngle}" step="5" min="5" max="45">
            </div>`;
        }
        
        if (this.editor.tools.selectedTool === 'wall' || this.editor.tools.selectedTool === 'ramp' || this.editor.tools.selectedTool === 'powerup_spawn') {
            const defaultColors = {
                wall: '#8B4513',
                ramp: '#6b8e23',
                powerup_spawn: '#ff00ff'
            };
            const currentColor = this.editor.tools.previewColor !== null ? 
                '#' + this.editor.tools.previewColor.toString(16).padStart(6, '0') : 
                defaultColors[this.editor.tools.selectedTool];
            html += `<div class="property-group">
                <label>Color</label>
                <input type="color" id="placement-color" value="${currentColor}">
            </div>`;
        }
        
        html += '<p class="hint">Press SPACE to rotate</p>';
        
        panel.innerHTML = html;
        
        const rotationInput = document.getElementById('placement-rotation');
        if (rotationInput) {
            rotationInput.addEventListener('change', (e) => this.editor.tools.updatePreviewRotation(parseFloat(e.target.value)));
        }
        
        const angleInput = document.getElementById('placement-angle');
        if (angleInput) {
            angleInput.addEventListener('change', (e) => this.editor.tools.updatePreviewAngle(parseFloat(e.target.value)));
        }
        
        const colorInput = document.getElementById('placement-color');
        if (colorInput) {
            colorInput.addEventListener('input', (e) => this.editor.tools.updatePreviewColor(e.target.value));
        }
    }
    
    updateSkyColor(colorHex) {
        const color = parseInt(colorHex.replace('#', ''), 16);
        this.editor.state.mapData.settings.skyColor = color;
        this.editor.scene.scene.background = new THREE.Color(color);
        if (this.editor.scene.scene.fog) {
            this.editor.scene.scene.fog.color = new THREE.Color(color);
        }
        console.log('🌤️ Sky color updated:', colorHex);
    }
    
    updateGroundColor(colorHex) {
        const color = parseInt(colorHex.replace('#', ''), 16);
        this.editor.state.mapData.settings.groundColor = color;
        
        if (this.editor.scene.ground && this.editor.scene.ground.material) {
            this.editor.scene.ground.material.color = new THREE.Color(color);
            this.editor.scene.ground.material.map = this.editor.scene.createCheckeredTexture(color);
            this.editor.scene.ground.material.needsUpdate = true;
        }
        console.log('🌱 Ground color updated:', colorHex);
    }
    
    updateGravity(value) {
        this.editor.state.mapData.settings.gravity = value;
        document.getElementById('map-gravity-value').textContent = value;
        console.log('⚖️ Gravity updated:', value);
    }
    
    applyMapSettings() {
        const skyColor = this.editor.state.mapData.settings.skyColor;
        this.editor.scene.scene.background = new THREE.Color(skyColor);
        if (this.editor.scene.scene.fog) {
            this.editor.scene.scene.fog.color = new THREE.Color(skyColor);
        }
        
        const groundColor = this.editor.state.mapData.settings.groundColor;
        if (this.editor.scene.ground && this.editor.scene.ground.material) {
            this.editor.scene.ground.material.color = new THREE.Color(groundColor);
            this.editor.scene.ground.material.map = this.editor.scene.createCheckeredTexture(groundColor);
            this.editor.scene.ground.material.needsUpdate = true;
        }
        
        document.getElementById('map-sky-color').value = '#' + skyColor.toString(16).padStart(6, '0');
        document.getElementById('map-ground-color').value = '#' + groundColor.toString(16).padStart(6, '0');
        document.getElementById('map-gravity').value = this.editor.state.mapData.settings.gravity;
        document.getElementById('map-gravity-value').textContent = this.editor.state.mapData.settings.gravity;
        
        console.log('✅ Map settings applied');
    }
    
    setTopView() {
        this.editor.scene.camera.position.set(0, 70, 0);
        this.editor.scene.camera.lookAt(0, 0, 0);
        this.editor.scene.controls.update();
    }
    
    setAngleView() {
        this.editor.scene.camera.position.set(40, 50, 40);
        this.editor.scene.camera.lookAt(0, 0, 0);
        this.editor.scene.controls.update();
    }
}
