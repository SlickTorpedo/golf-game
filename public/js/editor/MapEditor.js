// MapEditor.js - Main map editor class that coordinates all modules

import { EditorScene } from './EditorScene.js';
import { EditorState } from './EditorState.js';
import { EditorObjects } from './EditorObjects.js';
import { EditorHistory } from './EditorHistory.js';
import { EditorTools } from './EditorTools.js';
import { EditorInteraction } from './EditorInteraction.js';
import { EditorUI } from './EditorUI.js';
import { EditorFileIO } from './EditorFileIO.js';
import { MultiLevelManager } from '../editor-multi-hole.js';

export class MapEditor {
    constructor() {
        // Initialize all editor modules
        this.scene = new EditorScene('editor-canvas');
        this.state = new EditorState(this);
        this.objects = new EditorObjects(this);
        this.history = new EditorHistory(this);
        this.tools = new EditorTools(this);
        this.interaction = new EditorInteraction(this);
        this.ui = new EditorUI(this);
        this.fileIO = new EditorFileIO(this);
        
        // Initialize multi-level manager
        this.multiLevelManager = new MultiLevelManager(this);
        
        // Create initial objects
        this.objects.createStartPoint();
        this.objects.createHole();
        
        // Apply initial settings
        this.ui.applyMapSettings();
        
        // Setup event listeners
        this.interaction.setupEventListeners();
        this.setupToolButtons();
        this.setupMenuButtons();
        this.setupMapSettingsListeners();
        this.setupModalListeners();
        
        // Save initial state
        this.history.saveHistory('init');
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Start animation loop
        this.animate();
    }
    
    setupToolButtons() {
        document.querySelectorAll('.palette-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.type;
                
                // Update active button
                document.querySelectorAll('.palette-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Set tool
                this.tools.setTool(tool);
            });
        });
    }
    
    setupMenuButtons() {
        // View controls
        document.getElementById('view-top')?.addEventListener('click', () => this.ui.setTopView());
        document.getElementById('view-angle')?.addEventListener('click', () => this.ui.setAngleView());
        
        // File operations
        document.getElementById('new-map')?.addEventListener('click', () => this.fileIO.newMap());
        document.getElementById('save-map')?.addEventListener('click', () => this.fileIO.showSaveModal());
        document.getElementById('load-map')?.addEventListener('click', () => this.fileIO.showLoadModal());
        document.getElementById('play-test')?.addEventListener('click', () => this.fileIO.playTest());
        
        // Edit operations
        document.getElementById('menu-undo')?.addEventListener('click', () => this.history.undo());
        document.getElementById('menu-redo')?.addEventListener('click', () => this.history.redo());
        document.getElementById('menu-copy')?.addEventListener('click', () => this.state.copySelected());
        document.getElementById('menu-paste')?.addEventListener('click', () => {
            if (this.state.clipboard.length > 0) {
                this.tools.createPastePreview();
            }
        });
        
        // Grid toggle
        document.getElementById('toggle-grid')?.addEventListener('click', () => {
            this.scene.gridSnap = !this.scene.gridSnap;
            const btn = document.getElementById('toggle-grid');
            if (btn) {
                btn.classList.toggle('active', this.scene.gridSnap);
                btn.textContent = this.scene.gridSnap ? '📐 Grid: ON' : '📐 Grid: OFF';
            }
            console.log(`Grid snap: ${this.scene.gridSnap ? 'ON' : 'OFF'}`);
        });
    }
    
    setupMapSettingsListeners() {
        const skyColor = document.getElementById('map-sky-color');
        if (skyColor) {
            skyColor.addEventListener('input', (e) => this.ui.updateSkyColor(e.target.value));
        }
        
        const groundColor = document.getElementById('map-ground-color');
        if (groundColor) {
            groundColor.addEventListener('input', (e) => this.ui.updateGroundColor(e.target.value));
        }
        
        const gravity = document.getElementById('map-gravity');
        if (gravity) {
            gravity.addEventListener('input', (e) => this.ui.updateGravity(parseFloat(e.target.value)));
        }
        
        const gridSnap = document.getElementById('grid-snap');
        if (gridSnap) {
            gridSnap.addEventListener('change', (e) => {
                this.scene.gridSnap = e.target.checked;
            });
        }
        
        const gridSize = document.getElementById('grid-size');
        if (gridSize) {
            gridSize.addEventListener('input', (e) => {
                this.scene.gridSize = parseFloat(e.target.value);
            });
        }
    }
    
    setupModalListeners() {
        // Save modal
        document.getElementById('confirm-save')?.addEventListener('click', () => this.fileIO.saveMap());
        document.getElementById('cancel-save')?.addEventListener('click', () => {
            document.getElementById('save-modal').classList.add('hidden');
        });
        
        // Load modal
        document.getElementById('close-modal')?.addEventListener('click', () => {
            document.getElementById('map-list-modal').classList.add('hidden');
        });
        
        // Enter key to save
        document.getElementById('map-name')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.fileIO.saveMap();
            }
        });
    }
    
    onWindowResize() {
        const viewport = document.getElementById('viewport');
        this.scene.camera.aspect = viewport.clientWidth / viewport.clientHeight;
        this.scene.camera.updateProjectionMatrix();
        this.scene.renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Animate fan blades
        this.scene.fanBlades.forEach(blades => {
            if (blades) {
                blades.rotation.z += 0.1;
            }
        });
        
        // Animate fan particles
        this.scene.objects.forEach(obj => {
            if (obj.userData.type === 'fan' && obj.userData.particles) {
                const particles = obj.userData.particles;
                const positions = particles.geometry.attributes.position.array;
                const velocities = particles.userData.velocities;
                
                for (let i = 0; i < positions.length / 3; i++) {
                    positions[i * 3 + 2] += velocities[i] * 0.05;
                    
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
        
        this.scene.controls.update();
        this.scene.renderer.render(this.scene.scene, this.scene.camera);
    }
}

// Initialize editor when page loads
window.addEventListener('DOMContentLoaded', () => {
    new MapEditor();
});
