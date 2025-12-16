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
        this.selectedObjects = new Set(); // For multi-select
        this.objects = [];
        this.clipboard = []; // For copy/paste
        this.gridHelper = null;
        this.gridSnap = true;
        this.gridSize = 1;
        this.previewMesh = null;
        
        // Placement customization
        this.previewRotation = 0;
        this.previewAngle = 0;
        this.previewColor = null;
        this.snappedRotation = null; // For face snapping
        this.placementAltitude = 0; // Manual altitude adjustment with Ctrl+scroll
        
        // Extrude mode
        this.isExtruding = false;
        this.extrudeStartPoint = null;
        this.extrudeObject = null;
        this.extrudeDirection = null;
        this.extrudeInitialSize = null;
        this.extrudeInitialPosition = null;
        
        // Move mode
        this.isMoving = false;
        this.moveObject = null;
        this.moveStartPoint = null;
        this.moveInitialPosition = null;
        this.moveOffset = null;
        
        // Paint bucket tool
        this.paintColor = 0x8B4513;
        
        // Paste preview
        this.isPastePreviewing = false;
        this.pastePreviewMeshes = [];
        this.pastePreviewRotation = 0;
        
        // Undo/Redo history
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // Map data
        this.mapData = {
            name: 'Untitled Map',
            startPoint: { x: 0, y: 0, z: 30 },
            hole: { x: 0, y: 0, z: -30, radius: 1.2 },
            walls: [],
            ramps: [],
            powerupSpawns: [],
            fans: []
        };
        
        // Animation tracking for fans
        this.fanBlades = [];
        
        // Face highlighting for placement
        this.faceHighlight = null;
        
        // Store last mouse event for altitude updates
        this.lastMouseEvent = null;
        
        // Track Ctrl key state for altitude control
        this.ctrlPressed = false;
        
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
        this.controls.enableZoom = true; // Will be disabled when Ctrl is held
        
        // Configure mouse buttons - only right click for rotation
        this.controls.mouseButtons = {
            LEFT: null,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE
        };
        
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
        
        // Save initial state
        this.saveHistory('init');
        
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
    
    createWall(position, size, rotationY = 0, color = 0x8B4513) {
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const actualColor = (color !== undefined && color !== null) ? color : 0x8B4513;
        const material = new THREE.MeshLambertMaterial({ color: actualColor });
        const wall = new THREE.Mesh(geometry, material);
        wall.position.set(position.x, position.y, position.z);
        wall.rotation.y = (rotationY * Math.PI) / 180;
        
        const wallData = { position, size, rotationY, color: actualColor };
        wall.userData = { type: 'wall', data: wallData };
        
        this.scene.add(wall);
        this.objects.push(wall);
        this.mapData.walls.push(wallData);
        
        return wall;
    }
    
    createRamp(position, size, rotationY, angle, color = 0x6b8e23) {
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const actualColor = (color !== undefined && color !== null) ? color : 0x6b8e23;
        const material = new THREE.MeshLambertMaterial({ color: actualColor });
        const ramp = new THREE.Mesh(geometry, material);
        ramp.position.set(position.x, position.y, position.z);
        
        const angleRad = (angle * Math.PI) / 180;
        ramp.rotation.z = angleRad;
        ramp.rotation.y = (rotationY * Math.PI) / 180;
        
        const rampData = { position, size, rotationY, angle, color: actualColor };
        ramp.userData = { type: 'ramp', data: rampData };
        
        this.scene.add(ramp);
        this.objects.push(ramp);
        this.mapData.ramps.push(rampData);
        
        return ramp;
    }
    
    createPowerupSpawn(position, color = 0xff00ff) {
        const geometry = new THREE.SphereGeometry(0.5, 16, 16);
        const actualColor = (color !== undefined && color !== null) ? color : 0xff00ff;
        const material = new THREE.MeshLambertMaterial({ 
            color: actualColor,
            transparent: true,
            opacity: 0.6
        });
        const spawn = new THREE.Mesh(geometry, material);
        spawn.position.set(position.x, position.y, position.z);
        
        const spawnData = { position, color: actualColor };
        spawn.userData = { type: 'powerup_spawn', data: spawnData };
        
        this.scene.add(spawn);
        this.objects.push(spawn);
        this.mapData.powerupSpawns.push(spawnData);
        
        return spawn;
    }
    
    createFan(position, rotationY = 0, angle = 0, strength = 10) {
        // Create fan housing
        const fanGroup = new THREE.Group();
        
        // Housing cylinder
        const housingGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 32);
        const housingMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x404040
        });
        const housing = new THREE.Mesh(housingGeometry, housingMaterial);
        housing.rotation.x = Math.PI / 2;
        fanGroup.add(housing);
        
        // Grille (front)
        const grilleGeometry = new THREE.TorusGeometry(1.3, 0.05, 8, 32);
        const grilleMaterial = new THREE.MeshLambertMaterial({ color: 0x606060 });
        const grille = new THREE.Mesh(grilleGeometry, grilleMaterial);
        grille.position.z = 0.3;
        fanGroup.add(grille);
        
        // Inner grille cross
        const crossBar1 = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 2.4, 0.1),
            grilleMaterial
        );
        crossBar1.position.z = 0.3;
        fanGroup.add(crossBar1);
        
        const crossBar2 = new THREE.Mesh(
            new THREE.BoxGeometry(2.4, 0.1, 0.1),
            grilleMaterial
        );
        crossBar2.position.z = 0.3;
        fanGroup.add(crossBar2);
        
        // Spinning blades
        const bladesGroup = new THREE.Group();
        const bladeGeometry = new THREE.BoxGeometry(0.15, 1.8, 0.05);
        const bladeMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xcccccc,
            side: THREE.DoubleSide
        });
        
        for (let i = 0; i < 3; i++) {
            const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
            blade.rotation.z = (i * Math.PI * 2) / 3;
            bladesGroup.add(blade);
        }
        
        bladesGroup.position.z = 0.15;
        fanGroup.add(bladesGroup);
        
        // Store blade reference for animation
        fanGroup.userData.blades = bladesGroup;
        
        // Create particle system for wind effect
        const particleCount = 30;
        const particleGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        const particleVelocities = [];
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 1.2;
            particlePositions[i * 3] = Math.cos(angle) * radius;
            particlePositions[i * 3 + 1] = Math.sin(angle) * radius;
            particlePositions[i * 3 + 2] = Math.random() * 5;
            particleVelocities.push(Math.random() * 0.5 + 0.5);
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: 0x88ccff,
            size: 0.15,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending
        });
        
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        particles.userData.velocities = particleVelocities;
        fanGroup.add(particles);
        fanGroup.userData.particles = particles;
        
        // Position and rotate the fan group
        fanGroup.position.set(position.x, position.y, position.z);
        fanGroup.rotation.y = (rotationY * Math.PI) / 180;
        fanGroup.rotation.x = (angle * Math.PI) / 180;
        
        const fanData = { position, rotationY, angle, strength };
        fanGroup.userData = { 
            type: 'fan', 
            data: fanData,
            blades: bladesGroup,
            particles: particles
        };
        
        this.scene.add(fanGroup);
        this.objects.push(fanGroup);
        this.mapData.fans.push(fanData);
        this.fanBlades.push(bladesGroup);
        
        return fanGroup;
    }
    
    setupEventListeners() {
        // Palette buttons
        document.querySelectorAll('.palette-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.palette-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedTool = btn.dataset.type;
                this.previewRotation = 0;
                this.previewAngle = (btn.dataset.type === 'ramp') ? 15 : 0;
                this.previewColor = null;
                this.hidePreview();
                this.clearFaceHighlight();
                // Cancel paste preview when switching tools
                if (this.isPastePreviewing) {
                    this.clearPastePreview();
                    this.isPastePreviewing = false;
                }
                this.updatePlacementControls();
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
        
        // Canvas click and mouse move
        this.renderer.domElement.addEventListener('click', (e) => this.onCanvasClick(e));
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));
        this.renderer.domElement.addEventListener('mousedown', (e) => this.onCanvasMouseDown(e));
        this.renderer.domElement.addEventListener('mouseup', (e) => this.onCanvasMouseUp(e));
        this.renderer.domElement.addEventListener('wheel', (e) => this.onCanvasWheel(e), { passive: false, capture: true });
        
        // Save modal
        document.getElementById('confirm-save').addEventListener('click', () => this.saveMap());
        document.getElementById('cancel-save').addEventListener('click', () => {
            document.getElementById('save-modal').classList.add('hidden');
        });
        
        // Load modal
        document.getElementById('close-modal').addEventListener('click', () => {
            document.getElementById('map-list-modal').classList.add('hidden');
        });
        
        // Track Ctrl key to disable zoom for altitude control
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && !this.ctrlPressed) {
                this.ctrlPressed = true;
                this.controls.enableZoom = false;
            }
        }, true); // Use capture phase
        
        window.addEventListener('keyup', (e) => {
            if (e.key === 'Control' || e.key === 'Meta') {
                this.ctrlPressed = false;
                this.controls.enableZoom = true;
            }
        }, true); // Use capture phase
        
        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.selectedObject) {
                this.deleteSelectedObject();
            } else if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                this.rotateObject();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.undo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                this.redo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                this.copySelected();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                this.pasteObjects();
            } else if (e.key === 'Escape') {
                if (this.isPastePreviewing) {
                    e.preventDefault();
                    this.clearPastePreview();
                    this.isPastePreviewing = false;
                    console.log('🚫 Paste cancelled');
                }
            }
        });
    }
    
    onCanvasWheel(event) {
        // Ctrl+scroll to adjust placement altitude
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            
            const delta = -Math.sign(event.deltaY);
            this.placementAltitude += delta;
            
            // Clamp altitude to reasonable values
            this.placementAltitude = Math.max(-50, Math.min(100, this.placementAltitude));
            
            // Update altitude display
            this.updateAltitudeDisplay();
            
            // Update preview position by re-running mouse move logic
            if (this.lastMousePosition || this.lastMouseEvent) {
                const clientX = this.lastMousePosition ? this.lastMousePosition.clientX : this.lastMouseEvent.clientX;
                const clientY = this.lastMousePosition ? this.lastMousePosition.clientY : this.lastMouseEvent.clientY;
                const shiftKey = this.lastMousePosition ? this.lastMousePosition.shiftKey : this.lastMouseEvent.shiftKey;
                
                const syntheticEvent = {
                    clientX: clientX,
                    clientY: clientY,
                    shiftKey: shiftKey,
                    ctrlKey: true,
                    altKey: false,
                    metaKey: false,
                    preventDefault: () => {},
                    stopPropagation: () => {}
                };
                this.onCanvasMouseMove(syntheticEvent);
            }
            
            return false; // Prevent any further handling
        }
    }
    
    updateAltitudeDisplay() {
        // Show altitude in the properties panel or create a floating indicator
        const altitudeText = this.placementAltitude === 0 ? 'Ground' : `Y: ${this.placementAltitude}`;
        
        // Try to find or create altitude display element
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
        
        // Hide after 2 seconds
        clearTimeout(this.altitudeTimeout);
        this.altitudeTimeout = setTimeout(() => {
            if (this.placementAltitude === 0) {
                altDisplay.style.display = 'none';
            }
        }, 2000);
    }
    
    onCanvasClick(event) {
        // Handle paste preview placement
        if (this.isPastePreviewing) {
            const rect = this.renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, this.camera);
            
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersectPoint = new THREE.Vector3();
            raycaster.ray.intersectPlane(groundPlane, intersectPoint);
            
            if (this.gridSnap) {
                intersectPoint.x = Math.round(intersectPoint.x / this.gridSize) * this.gridSize;
                intersectPoint.z = Math.round(intersectPoint.z / this.gridSize) * this.gridSize;
            }
            
            this.commitPaste(intersectPoint);
            return;
        }
        
        // Don't handle clicks if we're in extrude or move mode (handled by mousedown/mouseup)
        if (this.selectedTool === 'extrude' || this.isExtruding || this.selectedTool === 'move' || this.isMoving) {
            return;
        }
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        // Check if clicking on an object (recursively check children for groups)
        const intersects = raycaster.intersectObjects(this.objects, true);
        
        if (intersects.length > 0) {
            // Find the top-level object from this.objects array
            let clickedObject = intersects[0].object;
            while (clickedObject.parent && !this.objects.includes(clickedObject)) {
                clickedObject = clickedObject.parent;
            }
            
            // If we have a placement tool active and Ctrl is NOT held, prioritize placement over selection
            const isPlacementTool = this.selectedTool && 
                this.selectedTool !== 'select' && 
                this.selectedTool !== 'delete' && 
                this.selectedTool !== 'paint' && 
                this.selectedTool !== 'move' && 
                this.selectedTool !== 'extrude';
            
            if (isPlacementTool && !(event.ctrlKey || event.metaKey)) {
                // Allow placement to happen instead of selection
                // Fall through to placement logic below
            } else {
                // Handle delete tool
                if (this.selectedTool === 'delete') {
                // If we have selected objects, delete them all
                if (this.selectedObjects.size > 0) {
                    this.deleteSelectedObjects();
                } else if (clickedObject) {
                    // If clicking an object without selection, add it to selection and delete
                    this.selectedObjects.add(clickedObject);
                    
                    // Set emissive - handle groups vs single meshes
                    if (clickedObject.material && clickedObject.material.emissive) {
                        clickedObject.material.emissive = new THREE.Color(0x444444);
                    } else if (clickedObject.children) {
                        clickedObject.children.forEach(child => {
                            if (child.material && child.material.emissive) {
                                child.material.emissive = new THREE.Color(0x444444);
                            }
                        });
                    }
                    
                    this.deleteSelectedObjects();
                }
                return;
            }
            
            // Handle paint bucket tool
            if (this.selectedTool === 'paint') {
                // If we have multi-selected objects, paint them all
                if (this.selectedObjects.size > 0) {
                    this.selectedObjects.forEach(obj => {
                        this.paintObject(obj);
                    });
                } else {
                    this.paintObject(clickedObject);
                }
                return;
            }
            
                // Handle multi-select:
                // - With select tool: no Ctrl needed
                // - With other tools: Ctrl required
                const allowMultiSelect = this.selectedTool === 'select' || (event.ctrlKey || event.metaKey);
                
                if (allowMultiSelect) {
                    this.toggleSelection(clickedObject);
                    return;
                }
                
                // Default: select object (clears multi-select)
                this.selectObject(clickedObject);
                return;
            }
        } else {
            // Clicked on empty space - clear selection unless holding Ctrl or using select tool
            if (this.selectedTool !== 'select' && !(event.ctrlKey || event.metaKey)) {
                this.clearSelection();
            }
        }
        
        // Place new object (only if not using tool-only modes)
        if (this.selectedTool && this.selectedTool !== 'select' && this.selectedTool !== 'delete' && this.selectedTool !== 'paint') {
            let placementPosition = null;
            
            // For walls, ramps, and powerup spawns, try to snap to adjacent faces
            // Hold Shift to disable face snapping
            if ((this.selectedTool === 'wall' || this.selectedTool === 'ramp' || this.selectedTool === 'powerup_spawn') && !event.shiftKey) {
                const faceIntersects = raycaster.intersectObjects(this.objects, true);
                
                for (const intersect of faceIntersects) {
                    let targetObject = intersect.object;
                    
                    // Traverse up to find the top-level object
                    while (targetObject.parent && !this.objects.includes(targetObject)) {
                        targetObject = targetObject.parent;
                    }
                    
                    const type = targetObject.userData.type;
                    if (type === 'wall' || type === 'ramp') {
                        const face = intersect.face;
                        if (face) {
                            // Get the face normal in world space
                            const normal = face.normal.clone();
                            const worldNormal = normal.transformDirection(targetObject.matrixWorld);
                            
                            // Determine if this is a top/bottom face or side face
                            const absY = Math.abs(worldNormal.y);
                            const isVerticalFace = absY > 0.5; // Normal pointing mostly up or down
                            
                            // Calculate offset based on face orientation and object type
                            let offset;
                            if (isVerticalFace) {
                                // Top/bottom face - offset by half the HEIGHT of new object
                                if (this.selectedTool === 'wall') {
                                    offset = 1; // Half of wall height (2) = 1
                                } else if (this.selectedTool === 'ramp') {
                                    offset = 0.25; // Half of ramp height (0.5) = 0.25
                                } else if (this.selectedTool === 'powerup_spawn') {
                                    offset = 0.5; // Half of powerup spawn diameter
                                }
                            } else {
                                // Side face - offset by half the DEPTH of new object
                                if (this.selectedTool === 'wall') {
                                    offset = 2; // Half of wall depth (4) = 2
                                } else if (this.selectedTool === 'ramp') {
                                    offset = 3; // Half of ramp depth (6) = 3
                                } else if (this.selectedTool === 'powerup_spawn') {
                                    offset = 0.5; // Half of powerup spawn size
                                }
                            }
                            
                            // Place adjacent to the face, touching it
                            placementPosition = intersect.point.clone();
                            placementPosition.add(worldNormal.multiplyScalar(offset));
                            
                            // Apply grid snapping if enabled
                            if (this.gridSnap) {
                                placementPosition.x = Math.round(placementPosition.x / this.gridSize) * this.gridSize;
                                placementPosition.z = Math.round(placementPosition.z / this.gridSize) * this.gridSize;
                                // For side faces (not top/bottom), also snap Y
                                if (!isVerticalFace) {
                                    placementPosition.y = Math.round(placementPosition.y / this.gridSize) * this.gridSize;
                                }
                            }
                            
                            break;
                        }
                    }
                }
            }
            
            // If no face snap (or Shift held), use ground plane or raycast to objects
            if (!placementPosition) {
                // First try to raycast to any object for placement position
                const intersects = raycaster.intersectObjects(this.objects, true);
                let intersectPoint;
                
                if (intersects.length > 0 && event.shiftKey) {
                    // When Shift is held, place at the intersection point (can be on/in objects)
                    intersectPoint = intersects[0].point.clone();
                } else {
                    // Otherwise use ground plane
                    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                    intersectPoint = new THREE.Vector3();
                    raycaster.ray.intersectPlane(groundPlane, intersectPoint);
                }
                
                if (this.gridSnap) {
                    intersectPoint.x = Math.round(intersectPoint.x / this.gridSize) * this.gridSize;
                    intersectPoint.z = Math.round(intersectPoint.z / this.gridSize) * this.gridSize;
                }
                
                // Apply manual placement altitude (not from face snapping)
                if (this.placementAltitude !== 0) {
                    intersectPoint.y = this.placementAltitude;
                }
                
                placementPosition = intersectPoint;
            }
            
            this.placeObject(placementPosition);
        }
    }
    
    placeObject(position) {
        let obj;
        
        switch (this.selectedTool) {
            case 'wall':
                obj = this.createWall(
                    { x: position.x, y: position.y !== undefined ? position.y : 1, z: position.z },
                    { x: 4, y: 2, z: 4 },
                    this.previewRotation,
                    this.previewColor || 0x8B4513
                );
                break;
                
            case 'ramp':
                obj = this.createRamp(
                    { x: position.x, y: position.y !== undefined ? position.y : 0.3, z: position.z },
                    { x: 8, y: 0.5, z: 6 },
                    this.previewRotation,
                    this.previewAngle,
                    this.previewColor || 0x6b8e23
                );
                break;
                
            case 'powerup_spawn':
                obj = this.createPowerupSpawn(
                    { x: position.x, y: position.y !== undefined ? position.y : 1, z: position.z },
                    this.previewColor || 0xff00ff
                );
                break;
                
            case 'fan':
                // Use snapped rotation if available, otherwise use preview rotation
                // Note: snappedRotation is in radians, convert to degrees for createFan
                const fanRotation = this.snappedRotation !== null ? (this.snappedRotation * 180 / Math.PI) : this.previewRotation;
                obj = this.createFan(
                    { x: position.x, y: position.y !== undefined ? position.y : 2, z: position.z },
                    fanRotation,
                    this.previewAngle,
                    10 // default strength
                );
                // Clear snapped rotation after placement
                this.snappedRotation = null;
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
        
        this.saveHistory('place');
    }
    
    selectObject(obj) {
        // Clear multi-selection
        this.clearSelection();
        
        this.selectedObject = obj;
        
        // Set emissive highlight - handle groups (fans) vs single meshes
        if (this.selectedObject.material && this.selectedObject.material.emissive) {
            this.selectedObject.material.emissive = new THREE.Color(0x444444);
        } else if (this.selectedObject.children) {
            // For groups like fans, highlight the main housing
            this.selectedObject.children.forEach(child => {
                if (child.material && child.material.emissive) {
                    child.material.emissive = new THREE.Color(0x444444);
                }
            });
        }
        
        this.updatePropertiesPanel();
    }
    
    toggleSelection(obj) {
        if (this.selectedObjects.has(obj)) {
            // Deselect
            this.selectedObjects.delete(obj);
            // Clear emissive - handle groups vs single meshes
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
            // Select
            this.selectedObjects.add(obj);
            // Set emissive - handle groups vs single meshes
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
        
        // Update single selection reference
        if (this.selectedObjects.size === 0) {
            this.selectedObject = null;
        } else {
            this.selectedObject = Array.from(this.selectedObjects)[0];
        }
        
        this.updatePropertiesPanel();
    }
    
    clearSelection() {
        // Remove highlight from previous selection
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
        
        // Clear multi-selection highlights
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
    
    updatePropertiesPanel() {
        const panel = document.getElementById('properties-content');
        
        if (this.selectedObjects.size > 1) {
            panel.innerHTML = `<p class="hint">${this.selectedObjects.size} objects selected<br><br>Use Ctrl+C to copy<br>Use Delete to remove</p>`;
            return;
        }
        
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
        
        if (type === 'hole') {
            html += `<div class="property-group">
                <label>Radius</label>
                <input type="number" id="prop-radius" value="${data.radius}" step="0.1" min="0.5" max="3">
            </div>`;
        }
        
        // Color picker for colorable objects
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
        
        // Add event listeners for property changes
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
            const type = this.selectedObject?.userData.type;
            if (type === 'ramp') {
                this.updateRampRotation(parseFloat(rotation.value));
            } else if (type === 'fan') {
                this.updateFanRotation(parseFloat(rotation.value));
            }
        });
        
        const wallRotation = document.getElementById('prop-wall-rotation');
        if (wallRotation) wallRotation.addEventListener('change', () => this.updateWallRotation(parseFloat(wallRotation.value)));
        
        const angle = document.getElementById('prop-angle');
        if (angle) angle.addEventListener('change', () => {
            const type = this.selectedObject?.userData.type;
            if (type === 'ramp') {
                this.updateRampAngle(parseFloat(angle.value));
            } else if (type === 'fan') {
                this.updateFanAngle(parseFloat(angle.value));
            }
        });
        
        const strength = document.getElementById('prop-strength');
        if (strength) strength.addEventListener('change', () => this.updateFanStrength(parseFloat(strength.value)));
        
        const radius = document.getElementById('prop-radius');
        if (radius) radius.addEventListener('change', () => this.updateHoleRadius(parseFloat(radius.value)));
        
        const color = document.getElementById('prop-color');
        if (color) color.addEventListener('change', () => this.updateObjectColor(color.value));
        
        const deleteBtn = document.getElementById('delete-object');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.deleteSelectedObject());
    }
    
    updateObjectProperty(prop, axis, value) {
        if (this.selectedObject) {
            this.selectedObject[prop][axis] = value;
            if (this.selectedObject.userData.data[prop]) {
                this.selectedObject.userData.data[prop][axis] = value;
            }
            this.saveHistory('modify');
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
            this.saveHistory('modify');
        }
    }
    
    updateRampRotation(value) {
        if (this.selectedObject && this.selectedObject.userData.type === 'ramp') {
            this.selectedObject.userData.data.rotationY = value;
            const angleRad = (this.selectedObject.userData.data.angle * Math.PI) / 180;
            this.selectedObject.rotation.y = (value * Math.PI) / 180;
            this.selectedObject.rotation.z = angleRad;
            this.saveHistory('modify');
        }
    }
    
    updateWallRotation(value) {
        if (this.selectedObject && this.selectedObject.userData.type === 'wall') {
            this.selectedObject.userData.data.rotationY = value;
            this.selectedObject.rotation.y = (value * Math.PI) / 180;
            this.saveHistory('modify');
        }
    }
    
    updateObjectColor(hexColor) {
        if (this.selectedObject) {
            const color = parseInt(hexColor.replace('#', ''), 16);
            this.selectedObject.material.color.setHex(color);
            this.selectedObject.userData.data.color = color;
            this.saveHistory('modify');
        }
    }
    
    updateRampAngle(value) {
        if (this.selectedObject && this.selectedObject.userData.type === 'ramp') {
            this.selectedObject.userData.data.angle = value;
            const angleRad = (value * Math.PI) / 180;
            this.selectedObject.rotation.z = angleRad;
            this.saveHistory('modify');
        }
    }
    
    updateFanRotation(value) {
        if (this.selectedObject && this.selectedObject.userData.type === 'fan') {
            this.selectedObject.userData.data.rotationY = value;
            this.selectedObject.rotation.y = (value * Math.PI) / 180;
            this.saveHistory('modify');
        }
    }
    
    updateFanAngle(value) {
        if (this.selectedObject && this.selectedObject.userData.type === 'fan') {
            this.selectedObject.userData.data.angle = value;
            this.selectedObject.rotation.x = (value * Math.PI) / 180;
            this.saveHistory('modify');
        }
    }
    
    updateFanStrength(value) {
        if (this.selectedObject && this.selectedObject.userData.type === 'fan') {
            this.selectedObject.userData.data.strength = value;
            this.saveHistory('modify');
        }
    }
    
    updateHoleRadius(value) {
        if (this.selectedObject && this.selectedObject.userData.type === 'hole') {
            this.selectedObject.userData.data.radius = value;
            this.mapData.hole.radius = value;
            this.selectedObject.geometry.dispose();
            this.selectedObject.geometry = new THREE.CylinderGeometry(value, value, 0.5, 32);
            this.saveHistory('modify');
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
        } else if (type === 'fan') {
            const fanIndex = this.mapData.fans.indexOf(data);
            if (fanIndex > -1) {
                this.mapData.fans.splice(fanIndex, 1);
                // Remove from fanBlades array
                const bladeIndex = this.fanBlades.indexOf(this.selectedObject.userData.blades);
                if (bladeIndex > -1) this.fanBlades.splice(bladeIndex, 1);
            }
        }
        
        this.selectedObject = null;
        this.updatePropertiesPanel();
        
        this.saveHistory('delete');
    }
    
    deleteSelectedObjects() {
        if (this.selectedObjects.size === 0) return;
        
        let cannotDelete = [];
        const toDelete = Array.from(this.selectedObjects);
        
        toDelete.forEach(obj => {
            const type = obj.userData.type;
            
            // Can't delete start point or hole
            if (type === 'start' || type === 'hole') {
                cannotDelete.push(type);
                return;
            }
            
            // Remove from scene
            this.scene.remove(obj);
            
            // Remove from objects array
            const index = this.objects.indexOf(obj);
            if (index > -1) {
                this.objects.splice(index, 1);
            }
            
            // Remove from map data
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
                    // Remove from fanBlades array
                    const bladeIndex = this.fanBlades.indexOf(obj.userData.blades);
                    if (bladeIndex > -1) this.fanBlades.splice(bladeIndex, 1);
                }
            }
        });
        
        if (cannotDelete.length > 0) {
            alert(`Cannot delete: ${cannotDelete.join(', ')}`);
        }
        
        this.clearSelection();
        this.updatePropertiesPanel();
        
        this.saveHistory('delete');
    }
    
    copySelected() {
        if (this.selectedObjects.size > 0) {
            // Copy multiple objects
            this.clipboard = [];
            this.selectedObjects.forEach(obj => {
                const type = obj.userData.type;
                const data = obj.userData.data;
                
                // Don't copy start or hole
                if (type !== 'start' && type !== 'hole') {
                    this.clipboard.push({
                        type: type,
                        data: JSON.parse(JSON.stringify(data))
                    });
                }
            });
            console.log(`📋 Copied ${this.clipboard.length} object(s)`);
        } else if (this.selectedObject) {
            // Copy single object
            const type = this.selectedObject.userData.type;
            const data = this.selectedObject.userData.data;
            
            // Don't copy start or hole
            if (type !== 'start' && type !== 'hole') {
                this.clipboard = [{
                    type: type,
                    data: JSON.parse(JSON.stringify(data))
                }];
                console.log('📋 Copied 1 object');
            }
        }
    }
    
    pasteObjects() {
        if (this.clipboard.length === 0) {
            console.log('📋 Nothing to paste');
            return;
        }
        
        // Enter paste preview mode
        this.isPastePreviewing = true;
        this.clearSelection();
        this.createPastePreview();
        
        console.log(`📋 Paste mode activated - click to place ${this.clipboard.length} object(s)`);
    }
    
    createPastePreview() {
        // Clear any existing preview
        this.clearPastePreview();
        
        // Reset paste preview rotation
        this.pastePreviewRotation = 0;
        
        // Calculate center of clipboard objects
        let centerX = 0, centerZ = 0;
        this.clipboard.forEach(item => {
            centerX += item.data.position.x;
            centerZ += item.data.position.z;
        });
        centerX /= this.clipboard.length;
        centerZ /= this.clipboard.length;
        
        // Create preview meshes
        this.clipboard.forEach(item => {
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
                this.scene.add(mesh);
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
    
    clearPastePreview() {
        this.pastePreviewMeshes.forEach(mesh => {
            this.scene.remove(mesh);
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
    
    commitPaste(position) {
        this.clearSelection();
        
        this.pastePreviewMeshes.forEach(mesh => {
            const item = mesh.userData.itemData;
            const newPos = {
                x: mesh.position.x,
                y: item.data.position.y,
                z: mesh.position.z
            };
            
            let newObj;
            
            // Calculate new rotation including paste preview rotation
            const originalRotY = item.data.rotationY || 0;
            const newRotY = (originalRotY + this.pastePreviewRotation) % 360;
            
            if (item.type === 'wall') {
                newObj = this.createWall(
                    newPos,
                    { ...item.data.size },
                    newRotY,
                    item.data.color
                );
            } else if (item.type === 'ramp') {
                newObj = this.createRamp(
                    newPos,
                    { ...item.data.size },
                    newRotY,
                    item.data.angle,
                    item.data.color
                );
            } else if (item.type === 'powerup_spawn') {
                newObj = this.createPowerupSpawn(newPos, item.data.color);
            } else if (item.type === 'fan') {
                newObj = this.createFan(
                    newPos,
                    newRotY,
                    item.data.angle || 0,
                    item.data.strength || 10
                );
            }
            
            if (newObj) {
                this.selectedObjects.add(newObj);
                // Set emissive highlight - handle groups (fans) vs single meshes
                if (newObj.material && newObj.material.emissive) {
                    newObj.material.emissive = new THREE.Color(0x444444);
                } else if (newObj.children) {
                    // For groups like fans, highlight the main housing
                    newObj.children.forEach(child => {
                        if (child.material && child.material.emissive) {
                            child.material.emissive = new THREE.Color(0x444444);
                        }
                    });
                }
            }
        });
        
        if (this.selectedObjects.size > 0) {
            this.selectedObject = Array.from(this.selectedObjects)[0];
        }
        
        this.clearPastePreview();
        this.isPastePreviewing = false;
        
        this.updatePropertiesPanel();
        this.saveHistory('paste');
        
        console.log(`📋 Pasted ${this.clipboard.length} object(s)`);
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
        
        // Reset history
        this.history = [];
        this.historyIndex = -1;
        this.saveHistory('new_map');
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
                this.createWall(wall.position, wall.size, wall.rotationY || 0, wall.color);
            });
            
            mapData.ramps.forEach(ramp => {
                this.createRamp(ramp.position, ramp.size, ramp.rotationY, ramp.angle, ramp.color);
            });
            
            mapData.powerupSpawns.forEach(spawn => {
                this.createPowerupSpawn(spawn.position, spawn.color);
            });
            
            if (mapData.fans) {
                mapData.fans.forEach(fan => {
                    this.createFan(fan.position, fan.rotationY || 0, fan.angle || 0, fan.strength || 10);
                });
            }
            
            document.getElementById('map-list-modal').classList.add('hidden');
            
            // Reset history
            this.history = [];
            this.historyIndex = -1;
            this.saveHistory('load_map');
            
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
            window.open(`/index.html?playtest=true&map=${mapName}`, '_blank');
        });
    }
    
    onWindowResize() {
        const viewport = document.getElementById('viewport');
        this.camera.aspect = viewport.clientWidth / viewport.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    }
    
    updateAltitudeDisplay() {
        // Show altitude in the properties panel or create a floating indicator
        const altitudeText = this.placementAltitude === 0 ? 'Ground' : `Y: ${this.placementAltitude}`;
        
        // Try to find or create altitude display element
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
        
        // Hide after 2 seconds
        clearTimeout(this.altitudeTimeout);
        this.altitudeTimeout = setTimeout(() => {
            if (this.placementAltitude === 0) {
                altDisplay.style.display = 'none';
            }
        }, 2000);
    }
    
    onCanvasMouseMove(event) {
        // Store last mouse event properties for altitude updates
        this.lastMousePosition = {
            clientX: event.clientX,
            clientY: event.clientY,
            shiftKey: event.shiftKey
        };
        this.lastMouseEvent = event; // Keep this for compatibility
        
        // Handle extrude dragging
        if (this.isExtruding && this.extrudeObject) {
            this.handleExtrudeDrag(event);
            return;
        }
        
        // Handle move dragging
        if (this.isMoving && this.moveObject) {
            this.handleMoveDrag(event);
            return;
        }
        
        // Update cursor for delete and paint tools when hovering over objects
        if (this.selectedTool === 'delete' || this.selectedTool === 'paint') {
            const rect = this.renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, this.camera);
            const intersects = raycaster.intersectObjects(this.objects);
            
            if (intersects.length > 0) {
                const type = intersects[0].object.userData.type;
                if (this.selectedTool === 'delete') {
                    this.renderer.domElement.style.cursor = (type === 'start' || type === 'hole') ? 'not-allowed' : 'pointer';
                } else if (this.selectedTool === 'paint') {
                    this.renderer.domElement.style.cursor = (type === 'wall' || type === 'ramp' || type === 'powerup_spawn') ? 'pointer' : 'default';
                }
            } else {
                this.renderer.domElement.style.cursor = 'default';
            }
            return;
        } else {
            this.renderer.domElement.style.cursor = 'default';
        }
        
        // Handle paste preview
        if (this.isPastePreviewing) {
            const rect = this.renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, this.camera);
            
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersectPoint = new THREE.Vector3();
            raycaster.ray.intersectPlane(groundPlane, intersectPoint);
            
            if (this.gridSnap) {
                intersectPoint.x = Math.round(intersectPoint.x / this.gridSize) * this.gridSize;
                intersectPoint.z = Math.round(intersectPoint.z / this.gridSize) * this.gridSize;
            }
            
            this.updatePastePreview(intersectPoint);
            return;
        }
        
        // Don't show preview for tool-only modes
        if (!this.selectedTool || this.selectedTool === 'select' || this.selectedTool === 'move' || this.selectedTool === 'extrude' || this.selectedTool === 'delete' || this.selectedTool === 'paint') {
            this.hidePreview();
            this.clearFaceHighlight();
            return;
        }
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        // For walls, ramps, powerup spawns, and fans, try to snap to wall/ramp faces
        // Hold Shift to disable face snapping
        if ((this.selectedTool === 'wall' || this.selectedTool === 'ramp' || this.selectedTool === 'powerup_spawn' || this.selectedTool === 'fan') && !event.shiftKey) {
            const intersects = raycaster.intersectObjects(this.objects, true);
            let snappedPosition = null;
            let snappedRotation = 0;
            
            for (const intersect of intersects) {
                let targetObject = intersect.object;
                
                // Traverse up to find the top-level object
                while (targetObject.parent && !this.objects.includes(targetObject)) {
                    targetObject = targetObject.parent;
                }
                
                const type = targetObject.userData.type;
                if (type === 'wall' || type === 'ramp') {
                    const face = intersect.face;
                    if (face) {
                        // Get the face normal in world space
                        const normal = face.normal.clone();
                        const worldNormal = normal.transformDirection(targetObject.matrixWorld);
                        
                        // Snap position to face at intersection point
                        snappedPosition = intersect.point.clone();
                        
                        // For fans, keep position on the face
                        // For other objects, offset to place adjacent (touching)
                        if (this.selectedTool !== 'fan') {
                            // Determine if this is a top/bottom face or side face
                            const absY = Math.abs(worldNormal.y);
                            const isVerticalFace = absY > 0.5;
                            
                            let offset;
                            if (isVerticalFace) {
                                // Top/bottom face - offset by half the HEIGHT
                                if (this.selectedTool === 'wall') {
                                    offset = 1; // Half of wall height (2) = 1
                                } else if (this.selectedTool === 'ramp') {
                                    offset = 0.25; // Half of ramp height (0.5) = 0.25
                                } else if (this.selectedTool === 'powerup_spawn') {
                                    offset = 0.5; // Half of powerup spawn diameter
                                }
                            } else {
                                // Side face - offset by half the DEPTH
                                if (this.selectedTool === 'wall') {
                                    offset = 2; // Half of wall depth (4) = 2
                                } else if (this.selectedTool === 'ramp') {
                                    offset = 3; // Half of ramp depth (6) = 3
                                } else if (this.selectedTool === 'powerup_spawn') {
                                    offset = 0.5; // Half of powerup spawn size
                                }
                            }
                            snappedPosition.add(worldNormal.multiplyScalar(offset));
                        }
                        
                        // Calculate rotation to face outward from the surface (only for fans)
                        if (this.selectedTool === 'fan') {
                            snappedRotation = Math.atan2(worldNormal.x, worldNormal.z);
                        }
                        
                        // Apply grid snapping if enabled
                        if (this.gridSnap) {
                            snappedPosition.x = Math.round(snappedPosition.x / this.gridSize) * this.gridSize;
                            snappedPosition.z = Math.round(snappedPosition.z / this.gridSize) * this.gridSize;
                            // For side faces (not top/bottom), also snap Y
                            const absY = Math.abs(worldNormal.y);
                            const isVerticalFace = absY > 0.5;
                            if (!isVerticalFace) {
                                snappedPosition.y = Math.round(snappedPosition.y / this.gridSize) * this.gridSize;
                            }
                        }
                        
                        // Highlight the face being snapped to
                        this.highlightFace(intersect, targetObject);
                        
                        break;
                    }
                }
            }
            
            // Use snapped position if found, otherwise use ground plane
            if (snappedPosition) {
                this.snappedRotation = (this.selectedTool === 'fan') ? snappedRotation : null;
                this.updatePreview(snappedPosition, snappedRotation);
            } else {
                this.snappedRotation = null;
                this.clearFaceHighlight();
                
                // First try to raycast to any object when Shift is held
                let intersectPoint;
                const objectIntersects = raycaster.intersectObjects(this.objects, true);
                
                if (objectIntersects.length > 0 && event.shiftKey) {
                    // When Shift is held, place at the intersection point (can be on/in objects)
                    intersectPoint = objectIntersects[0].point.clone();
                } else {
                    // Otherwise use ground plane
                    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                    intersectPoint = new THREE.Vector3();
                    raycaster.ray.intersectPlane(groundPlane, intersectPoint);
                }
                
                if (this.gridSnap) {
                    intersectPoint.x = Math.round(intersectPoint.x / this.gridSize) * this.gridSize;
                    intersectPoint.z = Math.round(intersectPoint.z / this.gridSize) * this.gridSize;
                }
                
                // Apply manual placement altitude
                if (this.placementAltitude !== 0) {
                    intersectPoint.y = this.placementAltitude;
                }
                
                // Apply offset to make object sit on the target Y (not centered)
                // This ensures objects are placed ON the ground/altitude, not half-in
                let yOffset = 0;
                if (this.selectedTool === 'wall') yOffset = 1;
                else if (this.selectedTool === 'ramp') yOffset = 0.25;
                else if (this.selectedTool === 'powerup_spawn') yOffset = 0.5;
                else if (this.selectedTool === 'fan') yOffset = 2;
                else if (this.selectedTool === 'start') yOffset = 1;
                else if (this.selectedTool === 'hole') yOffset = 0.05;
                
                intersectPoint.y += yOffset;
                
                this.updatePreview(intersectPoint);
            }
            return;
        }
        
        // Default behavior for other tools
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(groundPlane, intersectPoint);
        
        if (this.gridSnap) {
            intersectPoint.x = Math.round(intersectPoint.x / this.gridSize) * this.gridSize;
            intersectPoint.z = Math.round(intersectPoint.z / this.gridSize) * this.gridSize;
        }
        
        // Apply manual placement altitude
        if (this.placementAltitude !== 0) {
            intersectPoint.y = this.placementAltitude;
        }
        
        // Apply offset to make object sit on the target Y (not centered)
        let yOffset = 0;
        if (this.selectedTool === 'wall') yOffset = 1;
        else if (this.selectedTool === 'ramp') yOffset = 0.25;
        else if (this.selectedTool === 'powerup_spawn') yOffset = 0.5;
        else if (this.selectedTool === 'fan') yOffset = 2;
        else if (this.selectedTool === 'start') yOffset = 1;
        else if (this.selectedTool === 'hole') yOffset = 0.05;
        
        intersectPoint.y += yOffset;
        
        this.updatePreview(intersectPoint);
    }
    
    createPreviewMesh(type) {
        let geometry, material, mesh;
        const defaultColors = {
            wall: 0x8B4513,
            ramp: 0x6b8e23,
            powerup_spawn: 0xff00ff,
            start: 0x00ff00,
            hole: 0x000000
        };
        
        switch (type) {
            case 'wall':
                geometry = new THREE.BoxGeometry(4, 2, 4);
                material = new THREE.MeshLambertMaterial({ 
                    color: this.previewColor || defaultColors.wall,
                    transparent: true,
                    opacity: 0.3
                });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 1;
                mesh.rotation.y = (this.previewRotation * Math.PI) / 180;
                break;
                
            case 'ramp':
                geometry = new THREE.BoxGeometry(8, 0.5, 6);
                material = new THREE.MeshLambertMaterial({ 
                    color: this.previewColor || defaultColors.ramp,
                    transparent: true,
                    opacity: 0.3
                });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 0.3;
                mesh.rotation.z = (this.previewAngle * Math.PI) / 180;
                mesh.rotation.y = (this.previewRotation * Math.PI) / 180;
                break;
                
            case 'powerup_spawn':
                geometry = new THREE.SphereGeometry(0.5, 16, 16);
                material = new THREE.MeshLambertMaterial({ 
                    color: this.previewColor || defaultColors.powerup_spawn,
                    transparent: true,
                    opacity: 0.3
                });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 1;
                break;
                
            case 'start':
                geometry = new THREE.ConeGeometry(0.8, 2, 16);
                material = new THREE.MeshLambertMaterial({ 
                    color: defaultColors.start,
                    transparent: true,
                    opacity: 0.3
                });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 1;
                break;
                
            case 'hole':
                geometry = new THREE.CylinderGeometry(1.2, 1.2, 0.5, 32);
                material = new THREE.MeshLambertMaterial({ 
                    color: defaultColors.hole,
                    transparent: true,
                    opacity: 0.3
                });
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.y = 0.25;
                break;
                
            case 'fan':
                // Simple preview - cylinder with cross
                const fanGroup = new THREE.Group();
                
                geometry = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 32);
                material = new THREE.MeshLambertMaterial({ 
                    color: 0x404040,
                    transparent: true,
                    opacity: 0.3
                });
                const housing = new THREE.Mesh(geometry, material);
                housing.rotation.x = Math.PI / 2;
                fanGroup.add(housing);
                
                // Cross indicator
                const crossMat = new THREE.MeshLambertMaterial({ 
                    color: 0x88ccff,
                    transparent: true,
                    opacity: 0.5
                });
                const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), crossMat);
                cross1.position.z = 0.3;
                fanGroup.add(cross1);
                const cross2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.1), crossMat);
                cross2.position.z = 0.3;
                fanGroup.add(cross2);
                
                fanGroup.position.y = 2;
                fanGroup.rotation.y = (this.previewRotation * Math.PI) / 180;
                fanGroup.rotation.x = (this.previewAngle * Math.PI) / 180;
                mesh = fanGroup;
                break;
        }
        
        return mesh;
    }
    
    updatePreview(position, rotationY = null) {
        if (!this.selectedTool) {
            this.hidePreview();
            return;
        }
        
        // Create preview if it doesn't exist or if tool changed
        if (!this.previewMesh || this.previewMesh.userData.type !== this.selectedTool) {
            this.hidePreview();
            this.previewMesh = this.createPreviewMesh(this.selectedTool);
            if (this.previewMesh) {
                this.previewMesh.userData.type = this.selectedTool;
                this.previewMesh.userData.isPreview = true;
                this.scene.add(this.previewMesh);
            }
        }
        
        // Update preview position
        if (this.previewMesh) {
            this.previewMesh.position.x = position.x;
            if (position.y !== undefined) {
                this.previewMesh.position.y = position.y;
            }
            this.previewMesh.position.z = position.z;
            
            // Update rotation if provided (for face snapping)
            if (rotationY !== null) {
                this.previewMesh.rotation.y = rotationY;
            }
        }
    }
    
    hidePreview() {
        if (this.previewMesh) {
            this.scene.remove(this.previewMesh);
            
            // Handle both Mesh and Group (for fans)
            if (this.previewMesh.geometry) {
                this.previewMesh.geometry.dispose();
            }
            if (this.previewMesh.material) {
                this.previewMesh.material.dispose();
            }
            
            // For Groups, dispose children
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
    
    highlightFace(intersect, targetObject) {
        // Clear existing highlight
        this.clearFaceHighlight();
        
        if (!intersect.face) return;
        
        // Get face normal in world space
        const face = intersect.face;
        const normal = face.normal.clone();
        const worldNormal = normal.transformDirection(intersect.object.matrixWorld);
        
        // Determine which face of the box we're looking at based on normal
        const absX = Math.abs(worldNormal.x);
        const absY = Math.abs(worldNormal.y);
        const absZ = Math.abs(worldNormal.z);
        
        // Get the object's size and position from userData
        const data = targetObject.userData.data;
        if (!data || !data.size) return;
        
        const size = data.size;
        const position = targetObject.position;
        const rotation = targetObject.rotation;
        
        // Create a plane geometry for the entire face
        let planeWidth, planeHeight;
        let planePosition = position.clone();
        let planeRotation = new THREE.Euler();
        
        // Determine face orientation and size
        if (absY > absX && absY > absZ) {
            // Top or bottom face
            planeWidth = size.x;
            planeHeight = size.z;
            planeRotation.set(Math.PI / 2, 0, 0);
            planePosition.y += (worldNormal.y > 0) ? size.y / 2 : -size.y / 2;
        } else if (absX > absZ) {
            // Left or right face
            planeWidth = size.z;
            planeHeight = size.y;
            planeRotation.set(0, Math.PI / 2, 0);
            // Account for object's rotation
            const offset = new THREE.Vector3((worldNormal.x > 0 ? 1 : -1) * size.x / 2, 0, 0);
            offset.applyEuler(rotation);
            planePosition.add(offset);
        } else {
            // Front or back face
            planeWidth = size.x;
            planeHeight = size.y;
            planeRotation.set(0, 0, 0);
            // Account for object's rotation
            const offset = new THREE.Vector3(0, 0, (worldNormal.z > 0 ? 1 : -1) * size.z / 2);
            offset.applyEuler(rotation);
            planePosition.add(offset);
        }
        
        // Create highlight geometry
        const highlightGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
        
        // Create highlight material
        const highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthTest: false
        });
        
        // Create and add highlight mesh
        this.faceHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
        this.faceHighlight.position.copy(planePosition);
        this.faceHighlight.rotation.copy(rotation);
        this.faceHighlight.rotateX(planeRotation.x);
        this.faceHighlight.rotateY(planeRotation.y);
        this.faceHighlight.rotateZ(planeRotation.z);
        this.faceHighlight.renderOrder = 999; // Render on top
        this.scene.add(this.faceHighlight);
    }
    
    clearFaceHighlight() {
        if (this.faceHighlight) {
            this.scene.remove(this.faceHighlight);
            this.faceHighlight.geometry.dispose();
            this.faceHighlight.material.dispose();
            this.faceHighlight = null;
        }
    }
    
    onCanvasMouseDown(event) {
        if (this.selectedTool !== 'extrude' && this.selectedTool !== 'move') return;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        // Check if clicking on an object
        const intersects = raycaster.intersectObjects(this.objects);
        
        if (intersects.length > 0) {
            // Find the top-level object from this.objects array
            let obj = intersects[0].object;
            while (obj.parent && !this.objects.includes(obj)) {
                obj = obj.parent;
            }
            const type = obj.userData.type;
            
            // Handle move tool
            if (this.selectedTool === 'move') {
                this.isMoving = true;
                this.moveObject = obj;
                this.moveStartPoint = intersects[0].point.clone();
                
                // Store initial positions for all selected objects
                if (this.selectedObjects.size > 0 && this.selectedObjects.has(obj)) {
                    // Moving multiple objects
                    this.moveInitialPositions = new Map();
                    this.selectedObjects.forEach(selectedObj => {
                        this.moveInitialPositions.set(selectedObj, {
                            x: selectedObj.position.x,
                            y: selectedObj.position.y,
                            z: selectedObj.position.z
                        });
                    });
                } else {
                    // Moving single object
                    this.moveInitialPosition = {
                        x: obj.position.x,
                        y: obj.position.y,
                        z: obj.position.z
                    };
                }
                
                // Calculate offset from object center to click point
                this.moveOffset = new THREE.Vector3(
                    this.moveStartPoint.x - obj.position.x,
                    0, // Keep Y at 0 for ground-level movement
                    this.moveStartPoint.z - obj.position.z
                );
                
                if (!this.selectedObjects.has(obj)) {
                    this.selectObject(obj);
                }
                return;
            }
            
            // Only allow extrude on walls and ramps
            if (this.selectedTool === 'extrude' && (type === 'wall' || type === 'ramp')) {
                this.isExtruding = true;
                this.extrudeObject = obj;
                this.extrudeStartPoint = intersects[0].point.clone();
                
                // Determine which face was clicked based on the normal
                const face = intersects[0].face;
                if (face) {
                    const normal = face.normal.clone();
                    normal.transformDirection(obj.matrixWorld);
                    
                    // Determine primary axis based on largest normal component
                    const absX = Math.abs(normal.x);
                    const absY = Math.abs(normal.y);
                    const absZ = Math.abs(normal.z);
                    
                    if (absX > absY && absX > absZ) {
                        this.extrudeDirection = normal.x > 0 ? '+x' : '-x';
                    } else if (absZ > absY && absZ > absX) {
                        this.extrudeDirection = normal.z > 0 ? '+z' : '-z';
                    } else {
                        this.extrudeDirection = normal.y > 0 ? '+y' : '-y';
                    }
                }
                
                // Store initial data for all selected objects
                if (this.selectedObjects.size > 0 && this.selectedObjects.has(obj)) {
                    // Extruding multiple objects
                    this.extrudeInitialData = new Map();
                    this.selectedObjects.forEach(selectedObj => {
                        const objType = selectedObj.userData.type;
                        if (objType === 'wall' || objType === 'ramp') {
                            this.extrudeInitialData.set(selectedObj, {
                                size: {
                                    x: selectedObj.userData.data.size.x,
                                    y: selectedObj.userData.data.size.y,
                                    z: selectedObj.userData.data.size.z
                                },
                                position: {
                                    x: selectedObj.position.x,
                                    y: selectedObj.position.y,
                                    z: selectedObj.position.z
                                }
                            });
                        }
                    });
                } else {
                    // Store initial size and position for single object
                    this.extrudeInitialSize = {
                        x: obj.userData.data.size.x,
                        y: obj.userData.data.size.y,
                        z: obj.userData.data.size.z
                    };
                    this.extrudeInitialPosition = {
                        x: obj.position.x,
                        y: obj.position.y,
                        z: obj.position.z
                    };
                    this.selectObject(obj);
                }
            }
        }
    }
    
    onCanvasMouseUp(event) {
        if (this.isExtruding) {
            this.isExtruding = false;
            this.extrudeStartPoint = null;
            this.extrudeObject = null;
            this.extrudeDirection = null;
            this.extrudeInitialSize = null;
            this.extrudeInitialPosition = null;
            this.extrudeInitialData = null;
            
            // Save history after extrude completes
            this.saveHistory('extrude');
        }
        
        if (this.isMoving) {
            this.isMoving = false;
            this.moveObject = null;
            this.moveStartPoint = null;
            this.moveInitialPosition = null;
            this.moveInitialPositions = null;
            this.moveOffset = null;
            
            // Save history after move completes
            this.saveHistory('move');
        }
    }
    
    handleExtrudeDrag(event) {
        if (!this.extrudeObject || !this.extrudeStartPoint || !this.extrudeDirection) return;
        
        // Safety check for multi-select extrude
        if (this.extrudeInitialData && this.extrudeInitialData.size > 0) {
            // Multi-object extrude is not yet implemented for drag
            // Just return early to prevent errors
            return;
        }
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        // Create a plane perpendicular to the camera at the object's position
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        const plane = new THREE.Plane(cameraDirection.negate(), 0);
        plane.setFromNormalAndCoplanarPoint(plane.normal, this.extrudeStartPoint);
        
        const currentPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, currentPoint);
        
        if (!currentPoint) return;
        
        // Calculate drag distance
        const delta = currentPoint.clone().sub(this.extrudeStartPoint);
        
        // Apply extrusion based on direction
        const obj = this.extrudeObject;
        let dragAmount = 0;
        
        switch (this.extrudeDirection) {
            case '+x':
                dragAmount = delta.x;
                obj.userData.data.size.x = Math.max(0.5, this.extrudeInitialSize.x + dragAmount * 2);
                obj.position.x = this.extrudeInitialPosition.x + dragAmount;
                break;
            case '-x':
                dragAmount = -delta.x;
                obj.userData.data.size.x = Math.max(0.5, this.extrudeInitialSize.x + dragAmount * 2);
                obj.position.x = this.extrudeInitialPosition.x - dragAmount;
                break;
            case '+z':
                dragAmount = delta.z;
                obj.userData.data.size.z = Math.max(0.5, this.extrudeInitialSize.z + dragAmount * 2);
                obj.position.z = this.extrudeInitialPosition.z + dragAmount;
                break;
            case '-z':
                dragAmount = -delta.z;
                obj.userData.data.size.z = Math.max(0.5, this.extrudeInitialSize.z + dragAmount * 2);
                obj.position.z = this.extrudeInitialPosition.z - dragAmount;
                break;
            case '+y':
                dragAmount = delta.y;
                obj.userData.data.size.y = Math.max(0.5, this.extrudeInitialSize.y + dragAmount * 2);
                obj.position.y = this.extrudeInitialPosition.y + dragAmount;
                break;
            case '-y':
                dragAmount = -delta.y;
                obj.userData.data.size.y = Math.max(0.5, this.extrudeInitialSize.y + dragAmount * 2);
                obj.position.y = this.extrudeInitialPosition.y - dragAmount;
                break;
        }
        
        // Update position in data
        if (obj.userData.data && obj.userData.data.position) {
            obj.userData.data.position.x = obj.position.x;
            obj.userData.data.position.y = obj.position.y;
            obj.userData.data.position.z = obj.position.z;
        }
        
        // Recreate geometry with new size
        obj.geometry.dispose();
        obj.geometry = new THREE.BoxGeometry(
            obj.userData.data.size.x,
            obj.userData.data.size.y,
            obj.userData.data.size.z
        );
        
        // Update properties panel in real-time
        this.updatePropertiesPanel();
    }
    
    rotateObject() {
        // Rotate paste preview
        if (this.isPastePreviewing) {
            this.pastePreviewRotation = (this.pastePreviewRotation + 45) % 360;
            this.rotatePastePreview();
        }
        // Rotate preview object if hovering
        else if (this.previewMesh) {
            this.previewRotation = (this.previewRotation + 45) % 360;
            this.previewMesh.rotation.y = (this.previewRotation * Math.PI) / 180;
            this.updatePlacementControls();
        } 
        // Rotate selected object
        else if (this.selectedObject) {
            const type = this.selectedObject.userData.type;
            if (type === 'wall') {
                const currentRotation = this.selectedObject.userData.data.rotationY || 0;
                const newRotation = (currentRotation + 45) % 360;
                this.updateWallRotation(newRotation);
                this.updatePropertiesPanel();
            } else if (type === 'ramp') {
                const currentRotation = this.selectedObject.userData.data.rotationY || 0;
                const newRotation = (currentRotation + 45) % 360;
                this.updateRampRotation(newRotation);
                this.updatePropertiesPanel();
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
        
        // Can't paint start or hole
        if (type === 'start' || type === 'hole') {
            return;
        }
        
        // Only paint walls, ramps, and powerup spawns
        if (type !== 'wall' && type !== 'ramp' && type !== 'powerup_spawn') {
            return;
        }
        
        // Apply paint color
        object.material.color.setHex(this.paintColor);
        object.userData.data.color = this.paintColor;
        
        // Save to history
        this.saveHistory('paint');
        
        // Select the painted object
        this.selectObject(object);
    }
    
    updatePaintColor(hexColor) {
        this.paintColor = parseInt(hexColor.replace('#', ''), 16);
    }
    
    handleMoveDrag(event) {
        if (!this.moveObject || !this.moveStartPoint) return;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        // Raycast to ground plane
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const currentPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(groundPlane, currentPoint);
        
        if (!currentPoint) return;
        
        // Calculate new position accounting for offset
        let newX = currentPoint.x - this.moveOffset.x;
        let newZ = currentPoint.z - this.moveOffset.z;
        
        // Apply grid snapping if enabled
        if (this.gridSnap) {
            newX = Math.round(newX / this.gridSize) * this.gridSize;
            newZ = Math.round(newZ / this.gridSize) * this.gridSize;
        }
        
        // Calculate delta from initial position
        const deltaX = newX - this.moveInitialPosition.x;
        const deltaZ = newZ - this.moveInitialPosition.z;
        
        // Move all selected objects if multiple selected
        if (this.moveInitialPositions && this.moveInitialPositions.size > 0) {
            this.moveInitialPositions.forEach((initialPos, obj) => {
                obj.position.x = initialPos.x + deltaX;
                obj.position.z = initialPos.z + deltaZ;
                
                obj.userData.data.position.x = obj.position.x;
                obj.userData.data.position.z = obj.position.z;
                
                // Update special object positions
                const type = obj.userData.type;
                if (type === 'start') {
                    this.mapData.startPoint.x = obj.position.x;
                    this.mapData.startPoint.z = obj.position.z;
                } else if (type === 'hole') {
                    this.mapData.hole.x = obj.position.x;
                    this.mapData.hole.z = obj.position.z;
                }
            });
        } else {
            // Move single object
            this.moveObject.position.x = newX;
            this.moveObject.position.z = newZ;
            
            // Update position in data
            this.moveObject.userData.data.position.x = newX;
            this.moveObject.userData.data.position.z = newZ;
            
            // Update special object positions
            const type = this.moveObject.userData.type;
            if (type === 'start') {
                this.mapData.startPoint.x = newX;
                this.mapData.startPoint.z = newZ;
            } else if (type === 'hole') {
                this.mapData.hole.x = newX;
                this.mapData.hole.z = newZ;
            }
        }
        
        // Update properties panel in real-time
        this.updatePropertiesPanel();
    }
    
    updatePlacementControls() {
        const panel = document.getElementById('placement-content');
        
        if (!this.selectedTool) {
            panel.innerHTML = '<p class="hint">Select a tool to customize placement</p>';
            return;
        }
        
        // Tool-specific hints
        if (this.selectedTool === 'select') {
            panel.innerHTML = '<p class="hint">Click objects to select them</p>';
            return;
        }
        
        if (this.selectedTool === 'move') {
            panel.innerHTML = '<p class="hint">Click and drag to move objects<br><br>Works on all objects</p>';
            return;
        }
        
        if (this.selectedTool === 'extrude') {
            panel.innerHTML = '<p class="hint">Click and drag object faces to extrude<br><br>Works on walls and ramps</p>';
            return;
        }
        
        if (this.selectedTool === 'delete') {
            panel.innerHTML = '<p class="hint">Click objects to delete them<br><br>Cannot delete start point or hole</p>';
            return;
        }
        
        if (this.selectedTool === 'paint') {
            const currentColor = '#' + this.paintColor.toString(16).padStart(6, '0');
            let html = '<h3>PAINT BUCKET</h3>';
            html += `<div class="property-group">
                <label>Paint Color</label>
                <input type="color" id="paint-color" value="${currentColor}">
            </div>`;
            html += '<p class="hint">Click objects to paint them<br><br>Works on walls, ramps, and powerup spawns</p>';
            panel.innerHTML = html;
            
            // Add event listener
            const colorInput = document.getElementById('paint-color');
            if (colorInput) {
                colorInput.addEventListener('input', (e) => this.updatePaintColor(e.target.value));
            }
            return;
        }
        
        let html = `<h3>${this.selectedTool.toUpperCase()}</h3>`;
        
        // Rotation control for walls and ramps
        if (this.selectedTool === 'wall' || this.selectedTool === 'ramp') {
            html += `<div class="property-group">
                <label>Rotation (degrees)</label>
                <input type="number" id="placement-rotation" value="${this.previewRotation}" step="15" min="0" max="360">
            </div>`;
        }
        
        // Angle control for ramps
        if (this.selectedTool === 'ramp') {
            html += `<div class="property-group">
                <label>Angle (degrees)</label>
                <input type="number" id="placement-angle" value="${this.previewAngle}" step="5" min="5" max="45">
            </div>`;
        }
        
        // Color picker for colorable objects
        if (this.selectedTool === 'wall' || this.selectedTool === 'ramp' || this.selectedTool === 'powerup_spawn') {
            const defaultColors = {
                wall: '#8B4513',
                ramp: '#6b8e23',
                powerup_spawn: '#ff00ff'
            };
            const currentColor = this.previewColor !== null ? 
                '#' + this.previewColor.toString(16).padStart(6, '0') : 
                defaultColors[this.selectedTool];
            html += `<div class="property-group">
                <label>Color</label>
                <input type="color" id="placement-color" value="${currentColor}">
            </div>`;
        }
        
        html += '<p class="hint">Press SPACE to rotate</p>';
        
        panel.innerHTML = html;
        
        // Add event listeners
        const rotationInput = document.getElementById('placement-rotation');
        if (rotationInput) {
            rotationInput.addEventListener('change', (e) => this.updatePreviewRotation(parseFloat(e.target.value)));
        }
        
        const angleInput = document.getElementById('placement-angle');
        if (angleInput) {
            angleInput.addEventListener('change', (e) => this.updatePreviewAngle(parseFloat(e.target.value)));
        }
        
        const colorInput = document.getElementById('placement-color');
        if (colorInput) {
            colorInput.addEventListener('input', (e) => this.updatePreviewColor(e.target.value));
        }
    }
    
    saveHistory(actionType) {
        // Create a snapshot of the current state
        const snapshot = {
            actionType: actionType,
            mapData: JSON.parse(JSON.stringify(this.mapData)),
            timestamp: Date.now()
        };
        
        // If we're not at the end of history, remove all states after current position
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Add new snapshot
        this.history.push(snapshot);
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
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
        // Clear current objects (except start and hole which we'll update)
        this.objects.forEach(obj => {
            this.scene.remove(obj);
        });
        this.objects = [];
        
        // Restore map data
        this.mapData = JSON.parse(JSON.stringify(snapshot.mapData));
        
        // Recreate objects
        this.createStartPoint();
        this.createHole();
        
        this.mapData.walls.forEach(wall => {
            this.createWall(wall.position, wall.size, wall.rotationY || 0, wall.color);
        });
        
        this.mapData.ramps.forEach(ramp => {
            this.createRamp(ramp.position, ramp.size, ramp.rotationY, ramp.angle, ramp.color);
        });
        
        this.mapData.powerupSpawns.forEach(spawn => {
            this.createPowerupSpawn(spawn.position, spawn.color);
        });
            
            if (this.mapData.fans) {
                this.mapData.fans.forEach(fan => {
                    this.createFan(fan.position, fan.rotationY || 0, fan.angle || 0, fan.strength || 10);
                });
            }
        this.updatePropertiesPanel();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Animate fan blades
        this.fanBlades.forEach(blades => {
            if (blades) {
                blades.rotation.z += 0.1; // Spinning speed
            }
        });
        
        // Animate fan particles
        this.objects.forEach(obj => {
            if (obj.userData.type === 'fan' && obj.userData.particles) {
                const particles = obj.userData.particles;
                const positions = particles.geometry.attributes.position.array;
                const velocities = particles.userData.velocities;
                
                for (let i = 0; i < positions.length / 3; i++) {
                    positions[i * 3 + 2] += velocities[i] * 0.05;
                    
                    // Reset particle when it goes too far
                    if (positions[i * 3 + 2] > 5) {
                        positions[i * 3 + 2] = 0;
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.random() * 1.2;
                        positions[i * 3] = Math.cos(angle) * radius;
                        positions[i * 3 + 1] = Math.sin(angle) * radius;
                    }
                }
                
                particles.geometry.attributes.position.needsUpdate = true;
            }
        });
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize editor when page loads
window.addEventListener('DOMContentLoaded', () => {
    new MapEditor();
});
