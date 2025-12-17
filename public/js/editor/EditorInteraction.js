// EditorInteraction.js - Handles mouse/keyboard events and user interactions

import * as THREE from 'three';

export class EditorInteraction {
    constructor(editor) {
        this.editor = editor;
        this.lastMouseEvent = null;
        this.lastMousePosition = null;
        this.ctrlPressed = false;
        this.altitudeTimeout = null;
    }
    
    setupEventListeners() {
        const canvas = this.editor.scene.renderer.domElement;
        
        // Mouse events
        canvas.addEventListener('click', (e) => this.onCanvasClick(e));
        canvas.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));
        canvas.addEventListener('mousedown', (e) => this.onCanvasMouseDown(e));
        canvas.addEventListener('mouseup', (e) => this.onCanvasMouseUp(e));
        canvas.addEventListener('wheel', (e) => this.onCanvasWheel(e), { passive: false });
        
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            if (e.key === 'Control' || e.key === 'Meta') {
                this.ctrlPressed = true;
                this.editor.scene.controls.enableZoom = false;
            }
            
            if (e.key === 'Delete' && this.editor.state.selectedObject) {
                if (this.editor.state.selectedObjects.size > 1) {
                    this.editor.state.deleteSelectedObjects();
                } else {
                    this.editor.state.deleteSelectedObject();
                }
            } else if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                this.editor.tools.rotateObject();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.editor.history.undo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                this.editor.history.redo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                this.editor.state.copySelected();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                this.editor.tools.pasteObjects();
            } else if (e.key === 'Escape') {
                if (this.editor.tools.isPastePreviewing) {
                    e.preventDefault();
                    this.editor.tools.clearPastePreview();
                    this.editor.tools.isPastePreviewing = false;
                }
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Control' || e.key === 'Meta') {
                this.ctrlPressed = false;
                this.editor.scene.controls.enableZoom = true;
            }
        });
    }
    
    onCanvasWheel(event) {
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            
            const delta = event.deltaY > 0 ? -1 : 1;
            this.editor.tools.placementAltitude += delta;
            
            if (this.editor.tools.placementAltitude < 0) {
                this.editor.tools.placementAltitude = 0;
            }
            
            this.updateAltitudeDisplay();
            
            if (this.lastMousePosition || this.lastMouseEvent) {
                const fakeEvent = this.lastMouseEvent || {
                    clientX: this.lastMousePosition?.clientX || 0,
                    clientY: this.lastMousePosition?.clientY || 0,
                    shiftKey: this.lastMousePosition?.shiftKey || false
                };
                
                this.onCanvasMouseMove(fakeEvent);
            }
        }
    }
    
    updateAltitudeDisplay() {
        const altitudeText = this.editor.tools.placementAltitude === 0 ? 'Ground' : `Y: ${this.editor.tools.placementAltitude}`;
        
        let altDisplay = document.getElementById('altitude-display');
        if (!altDisplay) {
            altDisplay = document.createElement('div');
            altDisplay.id = 'altitude-display';
            altDisplay.style.position = 'absolute';
            altDisplay.style.bottom = '20px';
            altDisplay.style.left = '50%';
            altDisplay.style.transform = 'translateX(-50%)';
            altDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            altDisplay.style.color = '#00ffff';
            altDisplay.style.padding = '8px 16px';
            altDisplay.style.borderRadius = '4px';
            altDisplay.style.fontFamily = 'monospace';
            altDisplay.style.fontSize = '14px';
            altDisplay.style.pointerEvents = 'none';
            altDisplay.style.zIndex = '1000';
            document.body.appendChild(altDisplay);
        }
        
        altDisplay.textContent = `Altitude: ${altitudeText}`;
        altDisplay.style.display = 'block';
        
        clearTimeout(this.altitudeTimeout);
        this.altitudeTimeout = setTimeout(() => {
            if (this.editor.tools.placementAltitude === 0) {
                altDisplay.style.display = 'none';
            }
        }, 2000);
    }
    
    onCanvasClick(event) {
        if (this.editor.tools.isPastePreviewing) {
            const rect = this.editor.scene.renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, this.editor.scene.camera);
            
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersectPoint = new THREE.Vector3();
            raycaster.ray.intersectPlane(groundPlane, intersectPoint);
            
            if (this.editor.scene.gridSnap) {
                intersectPoint.x = Math.round(intersectPoint.x / this.editor.scene.gridSize) * this.editor.scene.gridSize;
                intersectPoint.z = Math.round(intersectPoint.z / this.editor.scene.gridSize) * this.editor.scene.gridSize;
            }
            
            this.editor.tools.commitPaste(intersectPoint);
            return;
        }
        
        if (this.editor.tools.selectedTool === 'extrude' || this.editor.tools.isExtruding || 
            this.editor.tools.selectedTool === 'move' || this.editor.tools.isMoving) {
            return;
        }
        
        const rect = this.editor.scene.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.editor.scene.camera);
        const intersects = raycaster.intersectObjects(this.editor.scene.objects, true);
        
        if (intersects.length > 0) {
            let clickedObject = intersects[0].object;
            while (clickedObject.parent && !this.editor.scene.objects.includes(clickedObject)) {
                clickedObject = clickedObject.parent;
            }
            
            // Check if we have a placement tool active
            const isPlacementTool = this.editor.tools.selectedTool && 
                this.editor.tools.selectedTool !== 'select' && 
                this.editor.tools.selectedTool !== 'delete' && 
                this.editor.tools.selectedTool !== 'paint' && 
                this.editor.tools.selectedTool !== 'move' && 
                this.editor.tools.selectedTool !== 'extrude';
            
            // If placement tool active and Ctrl NOT held, prioritize placement over selection
            if (isPlacementTool && !(event.ctrlKey || event.metaKey)) {
                // Fall through to placement logic below
            } else {
                // Handle delete tool
                if (this.editor.tools.selectedTool === 'delete') {
                    if (this.editor.state.selectedObjects.size > 0) {
                        this.editor.state.deleteSelectedObjects();
                    } else if (clickedObject) {
                        this.editor.state.selectedObjects.add(clickedObject);
                        if (clickedObject.material && clickedObject.material.emissive) {
                            clickedObject.material.emissive = new THREE.Color(0x444444);
                        } else if (clickedObject.children) {
                            clickedObject.children.forEach(child => {
                                if (child.material && child.material.emissive) {
                                    child.material.emissive = new THREE.Color(0x444444);
                                }
                            });
                        }
                        this.editor.state.deleteSelectedObjects();
                    }
                    return;
                }
                
                // Handle paint tool
                if (this.editor.tools.selectedTool === 'paint') {
                    if (this.editor.state.selectedObjects.size > 0) {
                        // Paint all selected objects (copy set to avoid modification during iteration)
                        Array.from(this.editor.state.selectedObjects).forEach(obj => {
                            this.editor.tools.paintObject(obj);
                        });
                    } else {
                        this.editor.tools.paintObject(clickedObject);
                    }
                    this.editor.history.saveHistory('paint');
                    return;
                }
                
                // Handle multi-select: with select tool no Ctrl needed, otherwise Ctrl required
                const allowMultiSelect = this.editor.tools.selectedTool === 'select' || (event.ctrlKey || event.metaKey);
                
                if (allowMultiSelect) {
                    this.editor.state.toggleSelection(clickedObject);
                    return;
                }
                
                // Default: select object (clears multi-select)
                this.editor.state.selectObject(clickedObject);
                return;
            }
        } else {
            // Clicked empty space - clear selection unless holding Ctrl or using select tool
            if (this.editor.tools.selectedTool !== 'select' && !(event.ctrlKey || event.metaKey)) {
                this.editor.state.clearSelection();
            }
        }
        
        // Place new object
        if (this.editor.tools.selectedTool && this.editor.tools.selectedTool !== 'select' && 
            this.editor.tools.selectedTool !== 'delete' && this.editor.tools.selectedTool !== 'paint') {
            
            let placementPosition = null;
            
            // Try face snapping (Shift key disables this)
            if ((this.editor.tools.selectedTool === 'wall' || this.editor.tools.selectedTool === 'ramp' || 
                 this.editor.tools.selectedTool === 'powerup_spawn') && !event.shiftKey) {
                const faceIntersects = raycaster.intersectObjects(this.editor.scene.objects, true);
                
                for (const intersect of faceIntersects) {
                    let targetObject = intersect.object;
                    while (targetObject.parent && !this.editor.scene.objects.includes(targetObject)) {
                        targetObject = targetObject.parent;
                    }
                    
                    const type = targetObject.userData.type;
                    if (type === 'wall' || type === 'ramp') {
                        const face = intersect.face;
                        if (face) {
                            // Get face normal in world space
                            const normal = face.normal.clone();
                            const worldNormal = normal.transformDirection(intersect.object.matrixWorld);
                            
                            // Determine if top/bottom face or side face
                            const absY = Math.abs(worldNormal.y);
                            const isVerticalFace = absY > 0.5; // Normal pointing mostly up or down
                            
                            // Calculate offset based on face orientation
                            let offset;
                            if (isVerticalFace) {
                                // Top/bottom face - offset by half the HEIGHT of new object
                                if (this.editor.tools.selectedTool === 'wall') {
                                    offset = 1; // Half of wall height (2)
                                } else if (this.editor.tools.selectedTool === 'ramp') {
                                    offset = 0.25; // Half of ramp height (0.5)
                                } else if (this.editor.tools.selectedTool === 'powerup_spawn') {
                                    offset = 0.5;
                                }
                            } else {
                                // Side face - offset by half the DEPTH of new object
                                if (this.editor.tools.selectedTool === 'wall') {
                                    offset = 2; // Half of wall depth (4)
                                } else if (this.editor.tools.selectedTool === 'ramp') {
                                    offset = 3; // Half of ramp depth (6)
                                } else if (this.editor.tools.selectedTool === 'powerup_spawn') {
                                    offset = 0.5;
                                }
                            }
                            
                            // Place adjacent to face
                            placementPosition = intersect.point.clone();
                            placementPosition.add(worldNormal.multiplyScalar(offset));
                            
                            // Apply grid snapping
                            if (this.editor.scene.gridSnap) {
                                placementPosition.x = Math.round(placementPosition.x / this.editor.scene.gridSize) * this.editor.scene.gridSize;
                                placementPosition.z = Math.round(placementPosition.z / this.editor.scene.gridSize) * this.editor.scene.gridSize;
                                // For side faces (not top/bottom), also snap Y
                                if (!isVerticalFace) {
                                    placementPosition.y = Math.round(placementPosition.y / this.editor.scene.gridSize) * this.editor.scene.gridSize;
                                }
                            }
                            
                            break;
                        }
                    }
                }
            }
            
            // If no face snap, use ground plane or shift-click position
            if (!placementPosition) {
                const objectIntersects = raycaster.intersectObjects(this.editor.scene.objects, true);
                let intersectPoint;
                
                if (objectIntersects.length > 0 && event.shiftKey) {
                    // Shift held: place at intersection point (on/in objects)
                    intersectPoint = objectIntersects[0].point.clone();
                } else {
                    // Use ground plane
                    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                    intersectPoint = new THREE.Vector3();
                    raycaster.ray.intersectPlane(groundPlane, intersectPoint);
                }
                
                if (this.editor.scene.gridSnap) {
                    intersectPoint.x = Math.round(intersectPoint.x / this.editor.scene.gridSize) * this.editor.scene.gridSize;
                    intersectPoint.z = Math.round(intersectPoint.z / this.editor.scene.gridSize) * this.editor.scene.gridSize;
                }
                
                // Apply manual placement altitude
                if (this.editor.tools.placementAltitude !== 0) {
                    intersectPoint.y = this.editor.tools.placementAltitude;
                }
                
                placementPosition = intersectPoint;
            }
            
            this.editor.tools.placeObject(placementPosition);
        }
    }
    
    onCanvasMouseMove(event) {
        this.lastMousePosition = {
            clientX: event.clientX,
            clientY: event.clientY,
            shiftKey: event.shiftKey
        };
        this.lastMouseEvent = event;
        
        if (this.editor.tools.isExtruding && this.editor.tools.extrudeObject) {
            this.handleExtrudeDrag(event);
            return;
        }
        
        if (this.editor.tools.isMoving && this.editor.tools.moveObject) {
            this.handleMoveDrag(event);
            return;
        }
        
        if (this.editor.tools.selectedTool === 'delete' || this.editor.tools.selectedTool === 'paint') {
            const rect = this.editor.scene.renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, this.editor.scene.camera);
            const intersects = raycaster.intersectObjects(this.editor.scene.objects);
            
            if (intersects.length > 0) {
                const type = intersects[0].object.userData.type;
                if (this.editor.tools.selectedTool === 'delete') {
                    this.editor.scene.renderer.domElement.style.cursor = (type === 'start' || type === 'hole') ? 'not-allowed' : 'pointer';
                } else if (this.editor.tools.selectedTool === 'paint') {
                    this.editor.scene.renderer.domElement.style.cursor = (type === 'wall' || type === 'ramp' || type === 'powerup_spawn') ? 'pointer' : 'not-allowed';
                }
            } else {
                this.editor.scene.renderer.domElement.style.cursor = 'default';
            }
            return;
        } else {
            this.editor.scene.renderer.domElement.style.cursor = 'default';
        }
        
        if (this.editor.tools.isPastePreviewing) {
            const rect = this.editor.scene.renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, this.editor.scene.camera);
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersectPoint = new THREE.Vector3();
            raycaster.ray.intersectPlane(groundPlane, intersectPoint);
            
            if (this.editor.scene.gridSnap) {
                intersectPoint.x = Math.round(intersectPoint.x / this.editor.scene.gridSize) * this.editor.scene.gridSize;
                intersectPoint.z = Math.round(intersectPoint.z / this.editor.scene.gridSize) * this.editor.scene.gridSize;
            }
            
            this.editor.tools.updatePastePreview(intersectPoint);
            return;
        }
        
        if (!this.editor.tools.selectedTool || this.editor.tools.selectedTool === 'select' || 
            this.editor.tools.selectedTool === 'move' || this.editor.tools.selectedTool === 'extrude' || 
            this.editor.tools.selectedTool === 'delete' || this.editor.tools.selectedTool === 'paint') {
            this.editor.tools.hidePreview();
            return;
        }
        
        const rect = this.editor.scene.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.editor.scene.camera);
        
        let snappedPosition = null;
        let snappedRotation = null;
        
        // Face snapping for placement tools (Shift disables this)
        if ((this.editor.tools.selectedTool === 'wall' || this.editor.tools.selectedTool === 'ramp' || 
             this.editor.tools.selectedTool === 'powerup_spawn' || this.editor.tools.selectedTool === 'fan') && !event.shiftKey) {
            const intersects = raycaster.intersectObjects(this.editor.scene.objects, true);
            
            for (const intersect of intersects) {
                let targetObject = intersect.object;
                while (targetObject.parent && !this.editor.scene.objects.includes(targetObject)) {
                    targetObject = targetObject.parent;
                }
                
                const type = targetObject.userData.type;
                if (type === 'wall' || type === 'ramp') {
                    const face = intersect.face;
                    if (face) {
                        // Get face normal in world space
                        const normal = face.normal.clone();
                        const worldNormal = normal.transformDirection(intersect.object.matrixWorld);
                        
                        // Snap position to face at intersection point
                        snappedPosition = intersect.point.clone();
                        
                        // For fans, keep position on the face
                        // For other objects, offset to place adjacent
                        if (this.editor.tools.selectedTool !== 'fan') {
                            // Determine if top/bottom face or side face
                            const absY = Math.abs(worldNormal.y);
                            const isVerticalFace = absY > 0.5;
                            
                            let offset;
                            if (isVerticalFace) {
                                // Top/bottom face - offset by half the HEIGHT
                                if (this.editor.tools.selectedTool === 'wall') {
                                    offset = 1; // Half of wall height (2)
                                } else if (this.editor.tools.selectedTool === 'ramp') {
                                    offset = 0.25; // Half of ramp height (0.5)
                                } else if (this.editor.tools.selectedTool === 'powerup_spawn') {
                                    offset = 0.5;
                                }
                            } else {
                                // Side face - offset by half the DEPTH
                                if (this.editor.tools.selectedTool === 'wall') {
                                    offset = 2; // Half of wall depth (4)
                                } else if (this.editor.tools.selectedTool === 'ramp') {
                                    offset = 3; // Half of ramp depth (6)
                                } else if (this.editor.tools.selectedTool === 'powerup_spawn') {
                                    offset = 0.5;
                                }
                            }
                            snappedPosition.add(worldNormal.multiplyScalar(offset));
                        }
                        
                        // Calculate rotation for fans
                        if (this.editor.tools.selectedTool === 'fan') {
                            snappedRotation = Math.atan2(worldNormal.x, worldNormal.z);
                        }
                        
                        // Apply grid snapping
                        if (this.editor.scene.gridSnap) {
                            snappedPosition.x = Math.round(snappedPosition.x / this.editor.scene.gridSize) * this.editor.scene.gridSize;
                            snappedPosition.z = Math.round(snappedPosition.z / this.editor.scene.gridSize) * this.editor.scene.gridSize;
                            // For side faces (not top/bottom), also snap Y
                            const absY = Math.abs(worldNormal.y);
                            const isVerticalFace = absY > 0.5;
                            if (!isVerticalFace) {
                                snappedPosition.y = Math.round(snappedPosition.y / this.editor.scene.gridSize) * this.editor.scene.gridSize;
                            }
                        }
                        
                        // Highlight the face
                        this.editor.tools.highlightFace(intersect, targetObject);
                        
                        break;
                    }
                }
            }
        }
        
        // Use snapped position if found, otherwise use ground plane
        if (snappedPosition) {
            this.editor.tools.snappedRotation = (this.editor.tools.selectedTool === 'fan') ? snappedRotation : null;
            this.editor.tools.updatePreview(snappedPosition, snappedRotation !== null ? snappedRotation : (this.editor.tools.previewRotation * Math.PI) / 180);
        } else {
            this.editor.tools.snappedRotation = null;
            this.editor.tools.clearFaceHighlight();
            
            // First try to raycast to any object when Shift is held
            let intersectPoint;
            const objectIntersects = raycaster.intersectObjects(this.editor.scene.objects, true);
            
            if (objectIntersects.length > 0 && event.shiftKey) {
                // When Shift is held, place at the intersection point
                intersectPoint = objectIntersects[0].point.clone();
            } else {
                // Otherwise use ground plane
                const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                intersectPoint = new THREE.Vector3();
                raycaster.ray.intersectPlane(groundPlane, intersectPoint);
            }
            
            if (this.editor.scene.gridSnap) {
                intersectPoint.x = Math.round(intersectPoint.x / this.editor.scene.gridSize) * this.editor.scene.gridSize;
                intersectPoint.z = Math.round(intersectPoint.z / this.editor.scene.gridSize) * this.editor.scene.gridSize;
            }
            
            // Apply manual placement altitude
            if (this.editor.tools.placementAltitude !== 0) {
                intersectPoint.y = this.editor.tools.placementAltitude;
            }
            
            // Apply offset to make object sit on the target Y (not centered)
            let yOffset = 0;
            if (this.editor.tools.selectedTool === 'wall') yOffset = 1;
            else if (this.editor.tools.selectedTool === 'ramp') yOffset = 0.25;
            else if (this.editor.tools.selectedTool === 'powerup_spawn') yOffset = 0.5;
            else if (this.editor.tools.selectedTool === 'fan') yOffset = 2;
            else if (this.editor.tools.selectedTool === 'start') yOffset = 1;
            else if (this.editor.tools.selectedTool === 'hole') yOffset = 0.05;
            else if (this.editor.tools.selectedTool === 'bounce_pad') yOffset = 0.15;
            else if (this.editor.tools.selectedTool === 'bumper') yOffset = 0.25;
            else if (this.editor.tools.selectedTool === 'speedBoost') yOffset = 0.1;
            
            intersectPoint.y += yOffset;
            
            this.editor.tools.updatePreview(intersectPoint, (this.editor.tools.previewRotation * Math.PI) / 180);
        }
    }
    
    onCanvasMouseDown(event) {
        if (this.editor.tools.selectedTool !== 'extrude' && this.editor.tools.selectedTool !== 'move') return;
        
        const rect = this.editor.scene.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.editor.scene.camera);
        const intersects = raycaster.intersectObjects(this.editor.scene.objects);
        
        if (intersects.length > 0) {
            let obj = intersects[0].object;
            while (obj.parent && !this.editor.scene.objects.includes(obj)) {
                obj = obj.parent;
            }
            const type = obj.userData.type;
            
            if (this.editor.tools.selectedTool === 'move') {
                this.editor.tools.isMoving = true;
                this.editor.tools.moveObject = obj;
                this.editor.tools.moveStartPoint = intersects[0].point.clone();
                
                if (this.editor.state.selectedObjects.size > 0 && this.editor.state.selectedObjects.has(obj)) {
                    this.editor.tools.moveInitialPositions = new Map();
                    this.editor.state.selectedObjects.forEach(selectedObj => {
                        this.editor.tools.moveInitialPositions.set(selectedObj, {
                            x: selectedObj.position.x,
                            y: selectedObj.position.y,
                            z: selectedObj.position.z
                        });
                    });
                } else {
                    this.editor.tools.moveInitialPosition = {
                        x: obj.position.x,
                        y: obj.position.y,
                        z: obj.position.z
                    };
                }
                
                this.editor.tools.moveOffset = new THREE.Vector3(
                    this.editor.tools.moveStartPoint.x - obj.position.x,
                    0,
                    this.editor.tools.moveStartPoint.z - obj.position.z
                );
                
                if (!this.editor.state.selectedObjects.has(obj)) {
                    this.editor.state.selectObject(obj);
                }
                return;
            }
            
            if (this.editor.tools.selectedTool === 'extrude' && (type === 'wall' || type === 'ramp')) {
                this.editor.tools.isExtruding = true;
                this.editor.tools.extrudeObject = obj;
                this.editor.tools.extrudeStartPoint = intersects[0].point.clone();
                
                const face = intersects[0].face;
                if (face) {
                    const normal = face.normal.clone();
                    normal.transformDirection(obj.matrixWorld);
                    
                    const absX = Math.abs(normal.x);
                    const absY = Math.abs(normal.y);
                    const absZ = Math.abs(normal.z);
                    
                    if (absX > absY && absX > absZ) {
                        this.editor.tools.extrudeDirection = normal.x > 0 ? '+x' : '-x';
                    } else if (absZ > absY && absZ > absX) {
                        this.editor.tools.extrudeDirection = normal.z > 0 ? '+z' : '-z';
                    } else {
                        this.editor.tools.extrudeDirection = normal.y > 0 ? '+y' : '-y';
                    }
                }
                
                if (this.editor.state.selectedObjects.size > 0 && this.editor.state.selectedObjects.has(obj)) {
                    this.editor.tools.extrudeInitialData = new Map();
                    this.editor.state.selectedObjects.forEach(selectedObj => {
                        const objType = selectedObj.userData.type;
                        if (objType === 'wall' || objType === 'ramp') {
                            this.editor.tools.extrudeInitialData.set(selectedObj, {
                                size: { ...selectedObj.userData.data.size },
                                position: { ...selectedObj.position }
                            });
                        }
                    });
                } else {
                    this.editor.tools.extrudeInitialSize = { ...obj.userData.data.size };
                    this.editor.tools.extrudeInitialPosition = { ...obj.position };
                    this.editor.state.selectObject(obj);
                }
            }
        }
    }
    
    onCanvasMouseUp(event) {
        if (this.editor.tools.isExtruding) {
            this.editor.tools.isExtruding = false;
            this.editor.tools.extrudeStartPoint = null;
            this.editor.tools.extrudeObject = null;
            this.editor.tools.extrudeDirection = null;
            this.editor.tools.extrudeInitialSize = null;
            this.editor.tools.extrudeInitialPosition = null;
            this.editor.tools.extrudeInitialData = null;
            
            this.editor.history.saveHistory('extrude');
        }
        
        if (this.editor.tools.isMoving) {
            this.editor.tools.isMoving = false;
            this.editor.tools.moveObject = null;
            this.editor.tools.moveStartPoint = null;
            this.editor.tools.moveInitialPosition = null;
            this.editor.tools.moveInitialPositions = null;
            this.editor.tools.moveOffset = null;
            
            this.editor.history.saveHistory('move');
        }
    }
    
    handleExtrudeDrag(event) {
        if (!this.editor.tools.extrudeObject || !this.editor.tools.extrudeStartPoint || !this.editor.tools.extrudeDirection) return;
        
        const rect = this.editor.scene.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.editor.scene.camera);
        
        const cameraDirection = new THREE.Vector3();
        this.editor.scene.camera.getWorldDirection(cameraDirection);
        const plane = new THREE.Plane(cameraDirection.negate(), 0);
        plane.setFromNormalAndCoplanarPoint(plane.normal, this.editor.tools.extrudeStartPoint);
        
        const currentPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, currentPoint);
        
        if (!currentPoint) return;
        
        const delta = currentPoint.clone().sub(this.editor.tools.extrudeStartPoint);
        let dragAmount = 0;
        
        // Calculate drag amount based on direction
        switch (this.editor.tools.extrudeDirection) {
            case '+x':
                dragAmount = delta.x;
                break;
            case '-x':
                dragAmount = -delta.x;
                break;
            case '+z':
                dragAmount = delta.z;
                break;
            case '-z':
                dragAmount = -delta.z;
                break;
            case '+y':
                dragAmount = delta.y;
                break;
            case '-y':
                dragAmount = -delta.y;
                break;
        }
        
        // Handle multi-select extrude
        if (this.editor.tools.extrudeInitialData && this.editor.tools.extrudeInitialData.size > 0) {
            this.editor.tools.extrudeInitialData.forEach((initialData, obj) => {
                const axis = this.editor.tools.extrudeDirection.slice(1); // Get 'x', 'y', or 'z'
                const direction = this.editor.tools.extrudeDirection[0]; // Get '+' or '-'
                
                obj.userData.data.size[axis] = Math.max(0.5, initialData.size[axis] + dragAmount * 2);
                obj.position[axis] = initialData.position[axis] + (direction === '+' ? dragAmount : -dragAmount);
                
                if (obj.userData.data && obj.userData.data.position) {
                    obj.userData.data.position.x = obj.position.x;
                    obj.userData.data.position.y = obj.position.y;
                    obj.userData.data.position.z = obj.position.z;
                }
                
                obj.geometry.dispose();
                obj.geometry = new THREE.BoxGeometry(
                    obj.userData.data.size.x,
                    obj.userData.data.size.y,
                    obj.userData.data.size.z
                );
            });
        } else {
            // Handle single object extrude
            const obj = this.editor.tools.extrudeObject;
            const axis = this.editor.tools.extrudeDirection.slice(1);
            const direction = this.editor.tools.extrudeDirection[0];
            
            obj.userData.data.size[axis] = Math.max(0.5, this.editor.tools.extrudeInitialSize[axis] + dragAmount * 2);
            obj.position[axis] = this.editor.tools.extrudeInitialPosition[axis] + (direction === '+' ? dragAmount : -dragAmount);
            
            if (obj.userData.data && obj.userData.data.position) {
                obj.userData.data.position.x = obj.position.x;
                obj.userData.data.position.y = obj.position.y;
                obj.userData.data.position.z = obj.position.z;
            }
            
            obj.geometry.dispose();
            obj.geometry = new THREE.BoxGeometry(
                obj.userData.data.size.x,
                obj.userData.data.size.y,
                obj.userData.data.size.z
            );
        }
        
        this.editor.ui.updatePropertiesPanel();
    }
    
    handleMoveDrag(event) {
        if (!this.editor.tools.moveObject || !this.editor.tools.moveStartPoint) return;
        
        const rect = this.editor.scene.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.editor.scene.camera);
        
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const currentPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(groundPlane, currentPoint);
        
        if (!currentPoint) return;
        
        let newX = currentPoint.x - this.editor.tools.moveOffset.x;
        let newZ = currentPoint.z - this.editor.tools.moveOffset.z;
        
        if (this.editor.scene.gridSnap) {
            newX = Math.round(newX / this.editor.scene.gridSize) * this.editor.scene.gridSize;
            newZ = Math.round(newZ / this.editor.scene.gridSize) * this.editor.scene.gridSize;
        }
        
        if (this.editor.tools.moveInitialPositions && this.editor.tools.moveInitialPositions.size > 0) {
            // Multi-select move - calculate delta from first selected object
            const firstObj = Array.from(this.editor.tools.moveInitialPositions.keys())[0];
            const firstInitialPos = this.editor.tools.moveInitialPositions.get(firstObj);
            const deltaX = newX - firstInitialPos.x;
            const deltaZ = newZ - firstInitialPos.z;
            
            this.editor.tools.moveInitialPositions.forEach((initialPos, obj) => {
                obj.position.x = initialPos.x + deltaX;
                obj.position.z = initialPos.z + deltaZ;
                
                obj.userData.data.position.x = obj.position.x;
                obj.userData.data.position.z = obj.position.z;
                
                const type = obj.userData.type;
                if (type === 'start') {
                    this.editor.state.mapData.startPoint.x = obj.position.x;
                    this.editor.state.mapData.startPoint.z = obj.position.z;
                } else if (type === 'hole') {
                    this.editor.state.mapData.hole.x = obj.position.x;
                    this.editor.state.mapData.hole.z = obj.position.z;
                }
            });
        } else {
            this.editor.tools.moveObject.position.x = newX;
            this.editor.tools.moveObject.position.z = newZ;
            
            this.editor.tools.moveObject.userData.data.position.x = newX;
            this.editor.tools.moveObject.userData.data.position.z = newZ;
            
            const type = this.editor.tools.moveObject.userData.type;
            if (type === 'start') {
                this.editor.state.mapData.startPoint.x = newX;
                this.editor.state.mapData.startPoint.z = newZ;
            } else if (type === 'hole') {
                this.editor.state.mapData.hole.x = newX;
                this.editor.state.mapData.hole.z = newZ;
            }
        }
        
        this.editor.ui.updatePropertiesPanel();
    }
}
