// Main entry point - coordinates all modules
import { AudioManager } from './audio-manager.js';
import { SceneManager } from './scene-manager.js';
import { NetworkManager } from './network.js';

console.log('Initializing Mini Golf Masters...');

// Initialize managers
const audioManager = new AudioManager();
const sceneManager = new SceneManager();
const networkManager = new NetworkManager(audioManager, sceneManager);

// Expose audioManager globally for easy access
window.audioManager = audioManager;

// Global console command helper for powerups
window.givePowerup = function(powerupId) {
    if (!window.powerupManager) {
        console.error('❌ PowerupManager not initialized yet. Start a game first!');
        return;
    }
    window.powerupManager.grantPowerup(powerupId);
};

// Initialize audio
audioManager.init();

console.log('Game initialized, waiting for player input...');
console.log('💡 Console commands available:');
console.log('  givePowerup("super_boost") - Get Super Boost powerup');
console.log('  givePowerup("feather_ball") - Get Feather Ball powerup');
console.log('  givePowerup("super_bounce") - Get Super Bounce powerup');
console.log('  givePowerup("sticky_ball") - Get Sticky Ball powerup');
