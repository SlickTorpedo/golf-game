// EditorHistory.js - Manages undo/redo history

export class EditorHistory {
    constructor() {
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        this.clipboard = [];
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
        if (this.historyIndex > 0) {
            this.historyIndex--;
            return this.history[this.historyIndex].data;
        }
        return null;
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            return this.history[this.historyIndex].data;
        }
        return null;
    }
    
    canUndo() {
        return this.historyIndex > 0;
    }
    
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }
    
    copyToClipboard(objects) {
        this.clipboard = JSON.parse(JSON.stringify(objects));
        console.log(`📋 Copied ${this.clipboard.length} object(s)`);
    }
    
    pasteFromClipboard() {
        return JSON.parse(JSON.stringify(this.clipboard));
    }
    
    hasClipboard() {
        return this.clipboard.length > 0;
    }
}
