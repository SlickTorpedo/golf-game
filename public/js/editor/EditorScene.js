// EditorScene.js - Manages Three.js scene, camera, renderer

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class EditorScene {
    constructor(canvasId) {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.ground = null;
        this.gridHelper = null;
        this.objects = [];
        this.fanBlades = [];
        
        // Grid settings
        this.gridSnap = true;
        this.gridSize = 1;
        
        this.init(canvasId);
    }
    
    init(canvasId) {
        const canvas = document.getElementById(canvasId);
        
        // Scene
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
        this.controls.enableZoom = true;
        
        // Configure mouse buttons - only right click for rotation
        this.controls.mouseButtons = {
            LEFT: null,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE
        };
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 5.0);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);
        
        // Ground
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x2d5016,
            map: this.createCheckeredTexture(0x2d5016)
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
        
        // Grid
        this.gridHelper = new THREE.GridHelper(100, 100, 0x444444, 0x222222);
        this.scene.add(this.gridHelper);
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    createCheckeredTexture(baseColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        const color = new THREE.Color(baseColor);
        const r = Math.floor(color.r * 255);
        const g = Math.floor(color.g * 255);
        const b = Math.floor(color.b * 255);
        
        const r2 = Math.floor(r * 0.85);
        const g2 = Math.floor(g * 0.85);
        const b2 = Math.floor(b * 0.85);
        
        const lightColor = `rgb(${r}, ${g}, ${b})`;
        const darkColor = `rgb(${r2}, ${g2}, ${b2})`;
        
        const squareSize = 32;
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? lightColor : darkColor;
                ctx.fillRect(x * squareSize, y * squareSize, squareSize, squareSize);
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(10, 10);
        
        return texture;
    }
    
    onWindowResize() {
        const canvas = this.renderer.domElement;
        const width = canvas.parentElement.clientWidth;
        const height = canvas.parentElement.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    addObject(mesh) {
        this.scene.add(mesh);
        this.objects.push(mesh);
    }
    
    removeObject(mesh) {
        this.scene.remove(mesh);
        const index = this.objects.indexOf(mesh);
        if (index > -1) {
            this.objects.splice(index, 1);
        }
    }
    
    clearObjects() {
        // Remove all objects except ground and grid
        this.objects.forEach(obj => this.scene.remove(obj));
        this.objects = [];
    }
    
    updateGroundColor(color) {
        this.ground.material.color = new THREE.Color(color);
        this.ground.material.map = this.createCheckeredTexture(color);
        this.ground.material.needsUpdate = true;
    }
    
    updateSkyColor(color) {
        this.scene.background = new THREE.Color(color);
    }
    
    createCheckeredTexture(baseColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        const color = new THREE.Color(baseColor);
        const r = Math.floor(color.r * 255);
        const g = Math.floor(color.g * 255);
        const b = Math.floor(color.b * 255);
        
        const r2 = Math.floor(r * 0.85);
        const g2 = Math.floor(g * 0.85);
        const b2 = Math.floor(b * 0.85);
        
        const lightColor = `rgb(${r}, ${g}, ${b})`;
        const darkColor = `rgb(${r2}, ${g2}, ${b2})`;
        
        const squareSize = 32;
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? lightColor : darkColor;
                ctx.fillRect(x * squareSize, y * squareSize, squareSize, squareSize);
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(10, 10);
        
        return texture;
    }
    
    render() {
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
