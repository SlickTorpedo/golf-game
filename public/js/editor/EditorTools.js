// EditorTools.js - Handles tool selection, preview, placement, and manipulation

import * as THREE from 'three';

export class EditorTools {
    constructor(editor) {
        this.editor = editor;
        this.selectedTool = null;
        this.previewMesh = null;
        this.previewRotation = 0;
        this.previewAngle = 0;
        this.previewColor = null;
        this.snappedRotation = null;
        this.placementAltitude = 0;
        
        // Extrude mode
        this.isExtruding = false;
        this.extrudeStartPoint = null;
        this.extrudeObject = null;
        this.extrudeDirection = null;
        this.extrudeInitialSize = null;
        this.extrudeInitialPosition = null;
        this.extrudeInitialData = null;
        
        // Move mode
        this.isMoving = false;
        this.moveObject = null;
        this.moveStartPoint = null;
        this.moveInitialPosition = null;
        this.moveInitialPositions = null;
        this.moveOffset = null;
        
        // Paint bucket tool
        this.paintColor = 0x8B4513;
        
        // Face highlighting
        this.faceHighlight = null;
        
        // Paste preview
        this.isPastePreviewing = false;
        this.pastePreviewMeshes = [];
        this.pastePreviewRotation = 0;
    }
    
    setTool(toolName) {
        this.selectedTool = toolName;
        this.hidePreview();
        
        // Update button active states
        document.querySelectorAll('.palette-item').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.type === toolName) {
                btn.classList.add('active');
            }
        });
        
        this.editor.ui.updatePlacementControls();
    }
    
    placeObject(position) {
        let obj = null;
        
        switch (this.selectedTool) {
            case 'wall':
                obj = this.editor.objects.createWall(
                    position,
                    { x: 4, y: 2, z: 4 },
                    this.previewRotation,
                    this.previewColor !== null ? this.previewColor : 0x8B4513
                );
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
                this.editor.state.mapData.walls.push(obj.userData.data);
                break;
            case 'ramp':
                obj = this.editor.objects.createRamp(
                    position,
                    { x: 8, y: 0.5, z: 6 },
                    this.previewRotation,
                    this.previewAngle || 15,
                    this.previewColor !== null ? this.previewColor : 0x6b8e23
                );
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
                this.editor.state.mapData.ramps.push(obj.userData.data);
                break;
            case 'powerup_spawn':
                obj = this.editor.objects.createPowerupSpawn(
                    position,
                    this.previewColor !== null ? this.previewColor : 0xff00ff
                );
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
                this.editor.state.mapData.powerupSpawns.push(obj.userData.data);
                break;
            case 'fan':
                obj = this.editor.objects.createFan(
                    position,
                    this.snappedRotation !== null ? this.snappedRotation : this.previewRotation,
                    this.previewAngle || 0,
                    10
                );
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
                if (!this.editor.state.mapData.fans) this.editor.state.mapData.fans = [];
                this.editor.state.mapData.fans.push(obj.userData.data);
                break;
            case 'bounce_pad':
                obj = this.editor.objects.createBouncePad(
                    position,
                    this.previewRotation,
                    20
                );
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
                if (!this.editor.state.mapData.bouncePads) this.editor.state.mapData.bouncePads = [];
                this.editor.state.mapData.bouncePads.push(obj.userData.data);
                break;
            case 'bumper':
                obj = this.editor.objects.createBumper(
                    position,
                    this.previewRotation,
                    15
                );
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
                if (!this.editor.state.mapData.bumpers) this.editor.state.mapData.bumpers = [];
                this.editor.state.mapData.bumpers.push(obj.userData.data);
                break;
            case 'speedBoost':
                obj = this.editor.objects.createSpeedBoost(
                    position,
                    this.previewRotation,
                    50
                );
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
                if (!this.editor.state.mapData.speedBoosts) this.editor.state.mapData.speedBoosts = [];
                this.editor.state.mapData.speedBoosts.push(obj.userData.data);
                break;
            case 'lava':
                obj = this.editor.objects.createLava(
                    position,
                    this.previewRotation,
                    5,
                    5
                );
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
                if (!this.editor.state.mapData.lava) this.editor.state.mapData.lava = [];
                this.editor.state.mapData.lava.push(obj.userData.data);
                break;
            case 'spinner':
                obj = this.editor.objects.createSpinner(
                    position,
                    this.previewRotation,
                    8,
                    1
                );
                this.editor.scene.scene.add(obj);
                this.editor.scene.objects.push(obj);
                if (!this.editor.state.mapData.spinners) this.editor.state.mapData.spinners = [];
                this.editor.state.mapData.spinners.push(obj.userData.data);
                break;
            case 'start':
                const startObj = this.editor.scene.objects.find(o => o.userData.type === 'start');
                if (startObj) {
                    startObj.position.set(position.x, 1, position.z);
                    this.editor.state.mapData.startPoint.x = position.x;
                    this.editor.state.mapData.startPoint.z = position.z;
                    this.editor.state.selectObject(startObj);
                    this.editor.history.saveHistory('move_start');
                }
                break;
            case 'hole':
                const holeObj = this.editor.scene.objects.find(o => o.userData.type === 'hole');
                if (holeObj) {
                    holeObj.position.set(position.x, 0.25, position.z);
                    this.editor.state.mapData.hole.x = position.x;
                    this.editor.state.mapData.hole.z = position.z;
                    this.editor.state.selectObject(holeObj);
                    this.editor.history.saveHistory('move_hole');
                }
                break;
        }
        
        if (obj) {
            this.editor.state.selectObject(obj);
            this.editor.history.saveHistory('place');
        }
    }
    
    createPreviewMesh(type) {
        let geometry, material, mesh;
        const transparentMaterial = new THREE.MeshLambertMaterial({
            transparent: true,
            opacity: 0.5
        });
        
        switch (type) {
            case 'wall':
                geometry = new THREE.BoxGeometry(4, 2, 4);
                material = transparentMaterial.clone();
                material.color = new THREE.Color(this.previewColor !== null ? this.previewColor : 0x8B4513);
                mesh = new THREE.Mesh(geometry, material);
                break;
            case 'ramp':
                geometry = new THREE.BoxGeometry(8, 0.5, 6);
                material = transparentMaterial.clone();
                material.color = new THREE.Color(this.previewColor !== null ? this.previewColor : 0x6b8e23);
                mesh = new THREE.Mesh(geometry, material);
                mesh.rotation.z = ((this.previewAngle || 15) * Math.PI) / 180;
                break;
            case 'powerup_spawn':
                geometry = new THREE.CylinderGeometry(1, 1, 0.5, 16);
                material = transparentMaterial.clone();
                material.color = new THREE.Color(this.previewColor !== null ? this.previewColor : 0xff00ff);
                mesh = new THREE.Mesh(geometry, material);
                break;
            case 'fan':
                // Create a simple preview (full fan is complex)
                const fanGroup = new THREE.Group();
                const housingGeom = new THREE.CylinderGeometry(1.5, 1.5, 1, 16);
                const housingMat = transparentMaterial.clone();
                housingMat.color = new THREE.Color(0x4a4a4a);
                const housing = new THREE.Mesh(housingGeom, housingMat);
                housing.rotation.x = Math.PI / 2;
                fanGroup.add(housing);
                mesh = fanGroup;
                break;
            case 'bounce_pad':
                const padGroup = new THREE.Group();
                const springGeom = new THREE.CylinderGeometry(0.8, 0.8, 1.5, 8);
                const springMat = transparentMaterial.clone();
                springMat.color = new THREE.Color(0xff69b4);
                const spring = new THREE.Mesh(springGeom, springMat);
                spring.position.y = 0.75;
                padGroup.add(spring);
                mesh = padGroup;
                break;
            case 'bumper':
                geometry = new THREE.SphereGeometry(1, 16, 16);
                material = transparentMaterial.clone();
                material.color = new THREE.Color(0xff6b6b);
                mesh = new THREE.Mesh(geometry, material);
                break;
            case 'speedBoost':
                const boostGroup = new THREE.Group();
                const boostGeom = new THREE.BoxGeometry(2, 0.2, 4);
                const boostMat = transparentMaterial.clone();
                boostMat.color = new THREE.Color(0xffff00);
                const boostBase = new THREE.Mesh(boostGeom, boostMat);
                boostBase.position.y = 0.1;
                boostGroup.add(boostBase);
                mesh = boostGroup;
                break;
            case 'lava':
                const lavaGroup = new THREE.Group();
                const lavaGeom = new THREE.PlaneGeometry(5, 5);
                const lavaMat = transparentMaterial.clone();
                lavaMat.color = new THREE.Color(0xff4500);
                const lavaPlane = new THREE.Mesh(lavaGeom, lavaMat);
                lavaPlane.rotation.x = -Math.PI / 2;
                lavaPlane.position.y = 0.1;
                lavaGroup.add(lavaPlane);
                mesh = lavaGroup;
                break;
            case 'spinner':
                const spinnerGroup = new THREE.Group();
                const spinnerGeom = new THREE.BoxGeometry(8, 0.4, 1);
                const spinnerMat = transparentMaterial.clone();
                spinnerMat.color = new THREE.Color(0x333333);
                const spinnerBlade = new THREE.Mesh(spinnerGeom, spinnerMat);
                spinnerBlade.position.y = 0.5;
                spinnerGroup.add(spinnerBlade);
                mesh = spinnerGroup;
                break;
            case 'start':
                geometry = new THREE.SphereGeometry(0.5, 16, 16);
                material = transparentMaterial.clone();
                material.color = new THREE.Color(0x00ff00);
                mesh = new THREE.Mesh(geometry, material);
                break;
            case 'hole':
                const holeGroup = new THREE.Group();
                const holeGeom = new THREE.CylinderGeometry(0.5, 0.5, 0.5, 16);
                const holeMat = transparentMaterial.clone();
                holeMat.color = new THREE.Color(0x000000);
                const holeCyl = new THREE.Mesh(holeGeom, holeMat);
                holeCyl.position.y = 0.25;
                holeGroup.add(holeCyl);
                mesh = holeGroup;
                break;
        }
        
        if (mesh) {
            mesh.userData = { type: 'preview' };
        }
        
        return mesh;
    }
    
    updatePreview(position, rotationY = null) {
        if (!this.selectedTool) {
            this.hidePreview();
            return;
        }
        
        if (!this.previewMesh || this.previewMesh.userData.type !== this.selectedTool) {
            this.hidePreview();
            
            if (this.previewMesh) {
                this.editor.scene.scene.remove(this.previewMesh);
            }
            
            this.previewMesh = this.createPreviewMesh(this.selectedTool);
            this.previewMesh.userData.type = this.selectedTool;
            this.editor.scene.scene.add(this.previewMesh);
        }
        
        if (this.previewMesh) {
            this.previewMesh.position.copy(position);
            if (position.y !== undefined) {
                this.previewMesh.position.y = position.y;
            }
            if (rotationY !== null) {
                this.previewMesh.rotation.y = rotationY;
            }
        }
    }
    
    hidePreview() {
        if (this.previewMesh) {
            this.editor.scene.scene.remove(this.previewMesh);
            
            if (this.previewMesh.geometry) {
                this.previewMesh.geometry.dispose();
            }
            if (this.previewMesh.material) {
                this.previewMesh.material.dispose();
            }
            
            if (this.previewMesh.children) {
                this.previewMesh.children.forEach(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }
            
            this.previewMesh = null;
        }
        this.clearFaceHighlight();
    }
    
    rotateObject() {
        if (this.isPastePreviewing) {
            this.pastePreviewRotation = (this.pastePreviewRotation + 45) % 360;
            this.rotatePastePreview();
        } else if (this.previewMesh) {
            this.previewRotation = (this.previewRotation + 45) % 360;
            this.previewMesh.rotation.y = (this.previewRotation * Math.PI) / 180;
            this.editor.ui.updatePlacementControls();
        } else if (this.editor.state.selectedObject) {
            const type = this.editor.state.selectedObject.userData.type;
            if (type === 'wall') {
                const currentRotation = this.editor.state.selectedObject.userData.data.rotationY || 0;
                const newRotation = (currentRotation + 45) % 360;
                this.editor.ui.updateWallRotation(newRotation);
                this.editor.ui.updatePropertiesPanel();
            } else if (type === 'ramp') {
                const currentRotation = this.editor.state.selectedObject.userData.data.rotationY || 0;
                const newRotation = (currentRotation + 45) % 360;
                this.editor.ui.updateRampRotation(newRotation);
                this.editor.ui.updatePropertiesPanel();
            }
        }
    }
    
    updatePreviewRotation(value) {
        this.previewRotation = value;
        if (this.previewMesh && (this.selectedTool === 'wall' || this.selectedTool === 'ramp')) {
            this.previewMesh.rotation.y = (value * Math.PI) / 180;
        }
    }
    
    updatePreviewAngle(value) {
        this.previewAngle = value;
        if (this.previewMesh && this.selectedTool === 'ramp') {
            this.previewMesh.rotation.z = (value * Math.PI) / 180;
        }
    }
    
    updatePreviewColor(hexColor) {
        this.previewColor = parseInt(hexColor.replace('#', ''), 16);
        if (this.previewMesh) {
            this.previewMesh.material.color.setHex(this.previewColor);
        }
    }
    
    paintObject(object) {
        const type = object.userData.type;
        
        if (type === 'start' || type === 'hole') {
            return;
        }
        
        if (type !== 'wall' && type !== 'ramp' && type !== 'powerup_spawn') {
            return;
        }
        
        object.material.color.setHex(this.paintColor);
        object.userData.data.color = this.paintColor;
        
        // For walls, regenerate the texture with the new color
        if (type === 'wall' && object.material.map) {
            const oldTexture = object.material.map;
            const newTexture = this.editor.objects.createWallTexture(this.paintColor);
            newTexture.repeat.copy(oldTexture.repeat);
            object.material.map = newTexture;
            object.material.needsUpdate = true;
            oldTexture.dispose();
        }
    }
    
    updatePaintColor(hexColor) {
        this.paintColor = parseInt(hexColor.replace('#', ''), 16);
    }
    
    highlightFace(intersect, targetObject) {
        this.clearFaceHighlight();
        
        if (!intersect.face) return;
        
        const face = intersect.face;
        const normal = face.normal.clone();
        const worldNormal = normal.transformDirection(intersect.object.matrixWorld);
        
        const absX = Math.abs(worldNormal.x);
        const absY = Math.abs(worldNormal.y);
        const absZ = Math.abs(worldNormal.z);
        
        const data = targetObject.userData.data;
        if (!data || !data.size) return;
        
        const size = data.size;
        const position = targetObject.position;
        const rotation = targetObject.rotation;
        
        let planeWidth, planeHeight;
        let planePosition = position.clone();
        let planeRotation = new THREE.Euler();
        
        if (absY > absX && absY > absZ) {
            planeWidth = size.x;
            planeHeight = size.z;
            planeRotation.set(Math.PI / 2, 0, 0);
            planePosition.y += (worldNormal.y > 0) ? size.y / 2 : -size.y / 2;
        } else if (absX > absZ) {
            planeWidth = size.z;
            planeHeight = size.y;
            planeRotation.set(0, Math.PI / 2, 0);
            const offset = new THREE.Vector3((worldNormal.x > 0 ? 1 : -1) * size.x / 2, 0, 0);
            offset.applyEuler(rotation);
            planePosition.add(offset);
        } else {
            planeWidth = size.x;
            planeHeight = size.y;
            planeRotation.set(0, 0, 0);
            const offset = new THREE.Vector3(0, 0, (worldNormal.z > 0 ? 1 : -1) * size.z / 2);
            offset.applyEuler(rotation);
            planePosition.add(offset);
        }
        
        const highlightGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
        const highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthTest: false
        });
        
        this.faceHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
        this.faceHighlight.position.copy(planePosition);
        this.faceHighlight.rotation.copy(rotation);
        this.faceHighlight.rotateX(planeRotation.x);
        this.faceHighlight.rotateY(planeRotation.y);
        this.faceHighlight.rotateZ(planeRotation.z);
        this.faceHighlight.renderOrder = 999;
        this.editor.scene.scene.add(this.faceHighlight);
    }
    
    clearFaceHighlight() {
        if (this.faceHighlight) {
            this.editor.scene.scene.remove(this.faceHighlight);
            this.faceHighlight.geometry.dispose();
            this.faceHighlight.material.dispose();
            this.faceHighlight = null;
        }
    }
    
    // Paste preview methods
    createPastePreview() {
        this.clearPastePreview();
        
        if (this.editor.state.clipboard.length === 0) {
            return;
        }
        
        this.pastePreviewMeshes = [];
        const transparentMaterial = new THREE.MeshLambertMaterial({
            transparent: true,
            opacity: 0.5,
            emissive: new THREE.Color(0x444444)
        });
        
        this.editor.state.clipboard.forEach(item => {
            let mesh;
            
            if (item.type === 'wall') {
                const geometry = new THREE.BoxGeometry(item.data.size.x, item.data.size.y, item.data.size.z);
                const material = transparentMaterial.clone();
                material.color = new THREE.Color(item.data.color || 0x8B4513);
                mesh = new THREE.Mesh(geometry, material);
                mesh.rotation.y = ((item.data.rotationY || 0) * Math.PI) / 180;
            } else if (item.type === 'ramp') {
                const geometry = new THREE.BoxGeometry(item.data.size.x, item.data.size.y, item.data.size.z);
                const material = transparentMaterial.clone();
                material.color = new THREE.Color(item.data.color || 0x6b8e23);
                mesh = new THREE.Mesh(geometry, material);
                mesh.rotation.y = ((item.data.rotationY || 0) * Math.PI) / 180;
                mesh.rotation.z = ((item.data.angle || 0) * Math.PI) / 180;
            } else if (item.type === 'powerup_spawn') {
                const geometry = new THREE.CylinderGeometry(1, 1, 0.5, 16);
                const material = transparentMaterial.clone();
                material.color = new THREE.Color(item.data.color || 0xff00ff);
                mesh = new THREE.Mesh(geometry, material);
            } else if (item.type === 'fan') {
                const fanGroup = new THREE.Group();
                const housingGeom = new THREE.CylinderGeometry(1.5, 1.5, 1, 16);
                const housingMat = transparentMaterial.clone();
                housingMat.color = new THREE.Color(0x4a4a4a);
                const housing = new THREE.Mesh(housingGeom, housingMat);
                housing.rotation.x = Math.PI / 2;
                fanGroup.add(housing);
                mesh = fanGroup;
            }
            
            if (mesh) {
                mesh.userData.itemData = item;
                mesh.userData.relativeX = item.data.position.x - this.editor.state.clipboard[0].data.position.x;
                mesh.userData.relativeZ = item.data.position.z - this.editor.state.clipboard[0].data.position.z;
                mesh.position.y = item.data.position.y;
                this.pastePreviewMeshes.push(mesh);
                this.editor.scene.scene.add(mesh);
            }
        });
        
        this.isPastePreviewing = true;
    }
    
    updatePastePreview(position) {
        this.pastePreviewMeshes.forEach(mesh => {
            const relX = mesh.userData.rotatedRelX !== undefined ? mesh.userData.rotatedRelX : mesh.userData.relativeX;
            const relZ = mesh.userData.rotatedRelZ !== undefined ? mesh.userData.rotatedRelZ : mesh.userData.relativeZ;
            
            mesh.position.x = position.x + relX;
            mesh.position.z = position.z + relZ;
        });
    }
    
    clearPastePreview() {
        this.pastePreviewMeshes.forEach(mesh => {
            this.editor.scene.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        this.pastePreviewMeshes = [];
    }
    
    rotatePastePreview() {
        const rotationRad = (this.pastePreviewRotation * Math.PI) / 180;
        
        this.pastePreviewMeshes.forEach(mesh => {
            const relX = mesh.userData.relativeX;
            const relZ = mesh.userData.relativeZ;
            
            const cos = Math.cos(rotationRad);
            const sin = Math.sin(rotationRad);
            const newRelX = relX * cos - relZ * sin;
            const newRelZ = relX * sin + relZ * cos;
            
            mesh.userData.rotatedRelX = newRelX;
            mesh.userData.rotatedRelZ = newRelZ;
            
            const item = mesh.userData.itemData;
            if (item.type === 'wall' || item.type === 'ramp') {
                const originalRotY = (item.data.rotationY || 0) * Math.PI / 180;
                mesh.rotation.y = originalRotY + rotationRad;
            }
        });
    }
    
    commitPaste(position) {
        this.editor.state.clearSelection();
        
        this.pastePreviewMeshes.forEach(mesh => {
            const item = mesh.userData.itemData;
            const newPos = {
                x: mesh.position.x,
                y: item.data.position.y,
                z: mesh.position.z
            };
            
            let newObj;
            const originalRotY = item.data.rotationY || 0;
            const newRotY = (originalRotY + this.pastePreviewRotation) % 360;
            
            if (item.type === 'wall') {
                newObj = this.editor.objects.createWall(newPos, { ...item.data.size }, newRotY, item.data.color);
                this.editor.scene.scene.add(newObj);
                this.editor.scene.objects.push(newObj);
                this.editor.state.mapData.walls.push(newObj.userData.data);
            } else if (item.type === 'ramp') {
                newObj = this.editor.objects.createRamp(newPos, { ...item.data.size }, newRotY, item.data.angle, item.data.color);
                this.editor.scene.scene.add(newObj);
                this.editor.scene.objects.push(newObj);
                this.editor.state.mapData.ramps.push(newObj.userData.data);
            } else if (item.type === 'powerup_spawn') {
                newObj = this.editor.objects.createPowerupSpawn(newPos, item.data.color);
                this.editor.scene.scene.add(newObj);
                this.editor.scene.objects.push(newObj);
                this.editor.state.mapData.powerupSpawns.push(newObj.userData.data);
            } else if (item.type === 'fan') {
                newObj = this.editor.objects.createFan(newPos, newRotY, item.data.angle || 0, item.data.strength || 10);
                this.editor.scene.scene.add(newObj);
                this.editor.scene.objects.push(newObj);
                if (!this.editor.state.mapData.fans) this.editor.state.mapData.fans = [];
                this.editor.state.mapData.fans.push(newObj.userData.data);
            }
            
            if (newObj) {
                this.editor.state.selectedObjects.add(newObj);
                if (newObj.material && newObj.material.emissive) {
                    newObj.material.emissive = new THREE.Color(0x444444);
                } else if (newObj.children) {
                    newObj.children.forEach(child => {
                        if (child.material && child.material.emissive) {
                            child.material.emissive = new THREE.Color(0x444444);
                        }
                    });
                }
            }
        });
        
        if (this.editor.state.selectedObjects.size > 0) {
            this.editor.state.selectedObject = Array.from(this.editor.state.selectedObjects)[0];
        }
        
        this.clearPastePreview();
        this.isPastePreviewing = false;
        
        this.editor.ui.updatePropertiesPanel();
        this.editor.history.saveHistory('paste');
        
        console.log(`📋 Pasted ${this.editor.state.clipboard.length} object(s)`);
    }
    
    pasteObjects() {
        if (this.editor.state.clipboard.length === 0) {
            console.log('📋 Nothing to paste');
            return;
        }
        
        // Enter paste preview mode
        this.isPastePreviewing = true;
        this.editor.state.clearSelection();
        this.createPastePreview();
        
        console.log(`📋 Paste mode activated - click to place ${this.editor.state.clipboard.length} object(s)`);
    }
    
    createPastePreview() {
        // Clear any existing preview
        this.clearPastePreview();
        
        // Reset paste preview rotation
        this.pastePreviewRotation = 0;
        
        // Calculate center of clipboard objects
        let centerX = 0, centerZ = 0;
        this.editor.state.clipboard.forEach(item => {
            centerX += item.data.position.x;
            centerZ += item.data.position.z;
        });
        centerX /= this.editor.state.clipboard.length;
        centerZ /= this.editor.state.clipboard.length;
        
        // Create preview meshes
        this.editor.state.clipboard.forEach(item => {
            let geometry, material, mesh;
            
            // Calculate relative position from center
            const relX = item.data.position.x - centerX;
            const relZ = item.data.position.z - centerZ;
            
            if (item.type === 'wall') {
                geometry = new THREE.BoxGeometry(item.data.size.x, item.data.size.y, item.data.size.z);
                material = new THREE.MeshLambertMaterial({ 
                    color: item.data.color || 0x8B4513,
                    transparent: true,
                    opacity: 0.3
                });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = item.data.position.y;
                mesh.rotation.y = ((item.data.rotationY || 0) * Math.PI) / 180;
            } else if (item.type === 'ramp') {
                geometry = new THREE.BoxGeometry(item.data.size.x, item.data.size.y, item.data.size.z);
                material = new THREE.MeshLambertMaterial({ 
                    color: item.data.color || 0x6b8e23,
                    transparent: true,
                    opacity: 0.3
                });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = item.data.position.y;
                mesh.rotation.z = ((item.data.angle || 0) * Math.PI) / 180;
                mesh.rotation.y = ((item.data.rotationY || 0) * Math.PI) / 180;
            } else if (item.type === 'powerup_spawn') {
                geometry = new THREE.SphereGeometry(0.5, 16, 16);
                material = new THREE.MeshLambertMaterial({ 
                    color: item.data.color || 0xff00ff,
                    transparent: true,
                    opacity: 0.3
                });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = item.data.position.y;
            }
            
            if (mesh) {
                mesh.userData.relativeX = relX;
                mesh.userData.relativeZ = relZ;
                mesh.userData.itemData = item;
                this.pastePreviewMeshes.push(mesh);
                this.editor.scene.scene.add(mesh);
            }
        });
    }
    
    updatePastePreview(position) {
        this.pastePreviewMeshes.forEach(mesh => {
            // Use rotated position if available, otherwise use original relative position
            const relX = mesh.userData.rotatedRelX !== undefined ? mesh.userData.rotatedRelX : mesh.userData.relativeX;
            const relZ = mesh.userData.rotatedRelZ !== undefined ? mesh.userData.rotatedRelZ : mesh.userData.relativeZ;
            
            mesh.position.x = position.x + relX;
            mesh.position.z = position.z + relZ;
        });
    }
    
    rotatePastePreview() {
        const rotationRad = (this.pastePreviewRotation * Math.PI) / 180;
        
        this.pastePreviewMeshes.forEach(mesh => {
            const relX = mesh.userData.relativeX;
            const relZ = mesh.userData.relativeZ;
            
            // Rotate relative position around center
            const cos = Math.cos(rotationRad);
            const sin = Math.sin(rotationRad);
            const newRelX = relX * cos - relZ * sin;
            const newRelZ = relX * sin + relZ * cos;
            
            mesh.userData.rotatedRelX = newRelX;
            mesh.userData.rotatedRelZ = newRelZ;
            
            // Also rotate the mesh itself for walls/ramps
            const item = mesh.userData.itemData;
            if (item.type === 'wall' || item.type === 'ramp') {
                const originalRotY = (item.data.rotationY || 0) * Math.PI / 180;
                mesh.rotation.y = originalRotY + rotationRad;
            }
        });
    }
}
