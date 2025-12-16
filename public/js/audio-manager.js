import { UI } from './ui-manager.js';

export class AudioManager {
    constructor() {
        this.volumes = {
            master: 1.0,
            music: 0.3,
            sfx: 0.7
        };
    }
    
    init() {
        console.log('🔊 Initializing Audio Manager');
        
        // Create multiple variations of ball hit sound at different pitches
        this.createBallHitVariations();
        
        // Load saved volumes from localStorage
        const savedMaster = localStorage.getItem('volume_master');
        const savedMusic = localStorage.getItem('volume_music');
        const savedSfx = localStorage.getItem('volume_sfx');
        
        if (savedMaster !== null) this.volumes.master = parseFloat(savedMaster);
        if (savedMusic !== null) this.volumes.music = parseFloat(savedMusic);
        if (savedSfx !== null) this.volumes.sfx = parseFloat(savedSfx);
        
        // Update sliders
        UI.volumeControls.masterSlider.value = this.volumes.master * 100;
        UI.volumeControls.musicSlider.value = this.volumes.music * 100;
        UI.volumeControls.sfxSlider.value = this.volumes.sfx * 100;
        
        this.updateVolumeDisplays();
        this.applyVolumes();
        this.setupVolumeControls();
    }
    
    setupVolumeControls() {
        // Volume panel toggle
        UI.volumeControls.toggleBtn.addEventListener('click', () => {
            UI.volumeControls.panel.classList.toggle('show');
        });

        // Close volume panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!UI.volumeControls.toggleBtn.contains(e.target) && 
                !UI.volumeControls.panel.contains(e.target)) {
                UI.volumeControls.panel.classList.remove('show');
            }
        });

        UI.volumeControls.masterSlider.addEventListener('input', (e) => {
            this.setMasterVolume(e.target.value);
            this.updateVolumeDisplays();
        });

        UI.volumeControls.musicSlider.addEventListener('input', (e) => {
            this.setMusicVolume(e.target.value);
            this.updateVolumeDisplays();
        });

        UI.volumeControls.sfxSlider.addEventListener('input', (e) => {
            this.setSfxVolume(e.target.value);
            this.updateVolumeDisplays();
        });
    }
    
    setMasterVolume(value) {
        this.volumes.master = value / 100;
        localStorage.setItem('volume_master', this.volumes.master);
        this.applyVolumes();
    }
    
    setMusicVolume(value) {
        this.volumes.music = value / 100;
        localStorage.setItem('volume_music', this.volumes.music);
        this.applyVolumes();
    }
    
    setSfxVolume(value) {
        this.volumes.sfx = value / 100;
        localStorage.setItem('volume_sfx', this.volumes.sfx);
        this.applyVolumes();
    }
    
    applyVolumes() {
        // Apply to music
        if (UI.audio.lobbyMusic) {
            UI.audio.lobbyMusic.volume = this.volumes.master * this.volumes.music;
        }
        if (UI.audio.gameMusic) {
            UI.audio.gameMusic.volume = this.volumes.master * this.volumes.music;
        }
        
        // Apply to SFX
        if (UI.audio.playerJoinedSfx) {
            UI.audio.playerJoinedSfx.volume = this.volumes.master * this.volumes.sfx;
        }
        if (UI.audio.playerLeftSfx) {
            UI.audio.playerLeftSfx.volume = this.volumes.master * this.volumes.sfx;
        }
        if (UI.audio.ballHitSfx) {
            UI.audio.ballHitSfx.volume = this.volumes.master * this.volumes.sfx;
        }
        // Apply to all ball hit variations
        if (UI.audio.ballHitVariations) {
            UI.audio.ballHitVariations.forEach(audio => {
                audio.volume = this.volumes.master * this.volumes.sfx;
            });
        }
        if (UI.audio.ballWhooshSfx) {
            UI.audio.ballWhooshSfx.volume = this.volumes.master * this.volumes.sfx;
        }
    }
    
    updateVolumeDisplays() {
        UI.volumeControls.masterValue.textContent = Math.round(this.volumes.master * 100) + '%';
        UI.volumeControls.musicValue.textContent = Math.round(this.volumes.music * 100) + '%';
        UI.volumeControls.sfxValue.textContent = Math.round(this.volumes.sfx * 100) + '%';
    }
    
    playSfx(audioElement, pitch = 1.0) {
        if (audioElement && this.volumes.master > 0 && this.volumes.sfx > 0) {
            // Set playback rate FIRST before resetting position
            audioElement.playbackRate = pitch;
            audioElement.volume = this.volumes.master * this.volumes.sfx;
            audioElement.currentTime = 0;
            
            // Force a pause/play cycle to ensure rate is applied
            audioElement.pause();
            audioElement.play().catch(err => {
                console.log('SFX playback error:', err);
            });
        }
    }
    
    playLobbyMusic() {
        if (UI.audio.lobbyMusic) {
            this.applyVolumes();
            UI.audio.lobbyMusic.play().catch(err => {
                console.log('Audio autoplay blocked:', err);
            });
        }
    }

    stopLobbyMusic() {
        if (UI.audio.lobbyMusic) {
            UI.audio.lobbyMusic.pause();
            UI.audio.lobbyMusic.currentTime = 0;
        }
    }

    playGameMusic() {
        if (UI.audio.gameMusic) {
            this.applyVolumes();
            UI.audio.gameMusic.play().catch(err => {
                console.log('Game music autoplay blocked:', err);
            });
        }
    }

    stopGameMusic() {
        if (UI.audio.gameMusic) {
            UI.audio.gameMusic.pause();
            UI.audio.gameMusic.currentTime = 0;
        }
    }

    setMusicVolume(volumeLevel) {
        // Temporarily set music volume (for ducking effects)
        if (UI.audio.lobbyMusic) {
            UI.audio.lobbyMusic.volume = volumeLevel * this.volumes.master;
        }
        if (UI.audio.gameMusic) {
            UI.audio.gameMusic.volume = volumeLevel * this.volumes.master;
        }
    }
    
    createBallHitVariations() {
        console.log('🎵 Loading pre-pitched ball hit variations from disk');
        
        // Load 7 pre-pitched variations (0.7x to 1.3x in 0.1 increments)
        for (let i = 0; i < 7; i++) {
            const audio = new Audio(`sounds/ball_hit_variations/hit_${i}.mp3`);
            audio.volume = this.volumes.master * this.volumes.sfx;
            const pitch = 0.7 + (i * 0.1);
            UI.audio.ballHitVariations.push(audio);
            console.log(`  ✅ Loaded hit_${i}.mp3 at pitch ${pitch.toFixed(2)}`);
        }
        
        console.log(`✅ Loaded ${UI.audio.ballHitVariations.length} pre-pitched ball hit variations`);
    }
    
    playBallHitSound() {
        const variations = UI.audio.ballHitVariations;
        if (variations.length === 0) return;
        
        const randomIndex = Math.floor(Math.random() * variations.length);
        const audio = variations[randomIndex];
        const pitch = 0.7 + (randomIndex * 0.1);
        
        console.log('🔊 Playing ball hit variation', randomIndex, 'at pitch:', pitch.toFixed(2));
        
        audio.volume = this.volumes.master * this.volumes.sfx;
        audio.currentTime = 0;
        audio.play().catch(err => {
            console.log('⚠️ Ball hit playback error:', err);
        });
    }
    
    playBallWhooshSound() {
        console.log('🔊 Playing ball whoosh sound');
        this.playSfx(UI.audio.ballWhooshSfx);
    }
    
    playScoreSound() {
        console.log('🎊 Playing score sound');
        this.playSfx(UI.audio.scoreSfx);
    }
    
    playGameFinishedSound() {
        console.log('🏁 Playing game finished sound');
        // Stop game music first
        this.stopGameMusic();
        this.playSfx(UI.audio.gameFinishedSfx);
    }

    playPickupSound() {
        console.log('💎 Playing pickup sound');
        this.playSfx(UI.audio.pickupSfx);
    }

    playProximitySound(volume) {
        if (!UI.audio.proximityAudio) {
            UI.audio.proximityAudio = new Audio('/sounds/powerup_nearby.mp3');
            UI.audio.proximityAudio.loop = true;
        }
        
        const audio = UI.audio.proximityAudio;
        audio.volume = Math.min(volume * this.volumes.master * this.volumes.sfx, volume);
        
        if (audio.paused) {
            audio.play().catch(err => {
                console.log('⚠️ Proximity audio playback error:', err);
            });
        }
        
        return 'proximity_audio'; // Return ID for tracking
    }

    updateProximityVolume(audioId, volume) {
        if (UI.audio.proximityAudio && !UI.audio.proximityAudio.paused) {
            UI.audio.proximityAudio.volume = Math.min(volume * this.volumes.master * this.volumes.sfx, volume);
        }
    }

    stopProximitySound(audioId) {
        if (UI.audio.proximityAudio) {
            UI.audio.proximityAudio.pause();
            UI.audio.proximityAudio.currentTime = 0;
        }
    }
}
