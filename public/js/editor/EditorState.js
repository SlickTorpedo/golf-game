// EditorState.js - Manages the state of the map editor

export class EditorState {
    constructor() {
        // Current hole being edited
        this.currentHoleIndex = 0;
        
        // Map data structure
        this.mapData = {
            name: 'Untitled Map',
            holes: [
                {
                    number: 1,
                    par: 3,
                    startPoint: { x: 0, y: 0, z: 30 },
                    hole: { x: 0, y: 0, z: -30, radius: 1.2 },
                    walls: [],
                    ramps: [],
                    powerupSpawns: [],
                    fans: [],
                    bouncePads: [],
                    bumpers: [],
                    speedBoosts: []
                }
            ],
            settings: {
                skyColor: 0x87CEEB,
                groundColor: 0x228B22,
                gravity: -30
            }
        };
        
        // Tool state
        this.selectedTool = null;
        this.selectedObject = null;
        this.selectedObjects = new Set();
        
        // Placement state
        this.previewRotation = 0;
        this.previewAngle = 0;
        this.previewColor = null;
        this.snappedRotation = null;
        this.placementAltitude = 0;
        
        // Extrude state
        this.isExtruding = false;
        this.extrudeStartPoint = null;
        this.extrudeObject = null;
        this.extrudeDirection = null;
        this.extrudeInitialSize = null;
        this.extrudeInitialPosition = null;
        
        // Move state
        this.isMoving = false;
        this.moveObject = null;
        this.moveStartPoint = null;
        this.moveInitialPosition = null;
        this.moveOffset = null;
        
        // Paint bucket
        this.paintColor = 0x8B4513;
        
        // Paste preview
        this.isPastePreviewing = false;
        this.pastePreviewRotation = 0;
        
        // Grid
        this.gridSnap = true;
        this.gridSize = 1;
        
        // Ctrl key tracking
        this.ctrlPressed = false;
        this.lastMouseEvent = null;
    }
    
    getCurrentHole() {
        return this.mapData.holes[this.currentHoleIndex];
    }
    
    addHole() {
        const newHoleNumber = this.mapData.holes.length + 1;
        const newHole = {
            number: newHoleNumber,
            par: 3,
            startPoint: { x: 0, y: 0, z: 30 },
            hole: { x: 0, y: 0, z: -30, radius: 1.2 },
            walls: [],
            ramps: [],
            powerupSpawns: [],
            fans: [],
            bouncePads: [],
            bumpers: [],
            speedBoosts: []
        };
        this.mapData.holes.push(newHole);
        return newHoleNumber - 1; // Return index
    }
    
    deleteHole(index) {
        if (this.mapData.holes.length <= 1) {
            console.warn('Cannot delete last hole');
            return false;
        }
        
        this.mapData.holes.splice(index, 1);
        
        // Renumber remaining holes
        this.mapData.holes.forEach((hole, i) => {
            hole.number = i + 1;
        });
        
        // Adjust current hole index if needed
        if (this.currentHoleIndex >= this.mapData.holes.length) {
            this.currentHoleIndex = this.mapData.holes.length - 1;
        }
        
        return true;
    }
    
    switchHole(index) {
        if (index >= 0 && index < this.mapData.holes.length) {
            this.currentHoleIndex = index;
            return true;
        }
        return false;
    }
    
    getHoleCount() {
        return this.mapData.holes.length;
    }
}
