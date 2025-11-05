// ============================================
// SETTINGS MANAGER - Chrono-Hackers
// ============================================

class GraphicsSettings {
    constructor() {
        this.currentPreset = 'ultra';
        this.settings = this.getDefaultSettings();
        this.loadSettings();
        this.initUI();
    }
    
    getDefaultSettings() {
        return {
            resolutionScale: 1.0,
            antialiasing: 4,
            shadowQuality: 'high',
            particleEffects: true,
            postProcessing: true,
            bloom: true,
            fpsTarget: 72,
            glitchIntensity: 70
        };
    }
    
    getPresetSettings(preset) {
        const presets = {
            low: {
                resolutionScale: 0.5,
                antialiasing: 0,
                shadowQuality: 'none',
                particleEffects: false,
                postProcessing: false,
                bloom: false,
                fpsTarget: 60,
                glitchIntensity: 30
            },
            medium: {
                resolutionScale: 0.75,
                antialiasing: 2,
                shadowQuality: 'low',
                particleEffects: true,
                postProcessing: true,
                bloom: false,
                fpsTarget: 72,
                glitchIntensity: 50
            },
            ultra: {
                resolutionScale: 1.25,
                antialiasing: 8,
                shadowQuality: 'ultra',
                particleEffects: true,
                postProcessing: true,
                bloom: true,
                fpsTarget: 72,
                glitchIntensity: 70
            },
            custom: this.settings
        };
        
        return presets[preset] || presets.ultra;
    }
    
    loadSettings() {
        try {
            const saved = localStorage.getItem('chronoHackersSettings');
            if (saved) {
                const data = JSON.parse(saved);
                this.settings = { ...this.getDefaultSettings(), ...data.settings };
                this.currentPreset = data.preset || 'ultra';
            }
        } catch (e) {
            console.warn('Impossibile caricare le impostazioni salvate:', e);
        }
    }
    
    saveSettings() {
        try {
            localStorage.setItem('chronoHackersSettings', JSON.stringify({
                preset: this.currentPreset,
                settings: this.settings
            }));
        } catch (e) {
            console.warn('Impossibile salvare le impostazioni:', e);
        }
    }
    
    applyPreset(preset) {
        this.currentPreset = preset;
        if (preset !== 'custom') {
            this.settings = this.getPresetSettings(preset);
        }
        this.updateUI();
        this.saveSettings();
    }
    
    updateSetting(key, value) {
        this.settings[key] = value;
        this.currentPreset = 'custom';
        this.saveSettings();
    }
    
    initUI() {
        // Bottone per aprire il menu
        const settingsButton = document.getElementById('settingsButton');
        const settingsMenu = document.getElementById('settingsMenu');
        
        if (settingsButton) {
            settingsButton.addEventListener('click', () => {
                settingsMenu.classList.toggle('hidden');
            });
        }
        
        // Preset buttons
        const presetButtons = document.querySelectorAll('.preset-btn');
        presetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                this.applyPreset(preset);
                
                // Aggiorna UI dei bottoni
                presetButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Risoluzione
        const resolutionScale = document.getElementById('resolutionScale');
        if (resolutionScale) {
            resolutionScale.addEventListener('change', (e) => {
                this.updateSetting('resolutionScale', parseFloat(e.target.value));
            });
        }
        
        // Antialiasing
        const antialiasing = document.getElementById('antialiasing');
        if (antialiasing) {
            antialiasing.addEventListener('change', (e) => {
                this.updateSetting('antialiasing', parseInt(e.target.value));
            });
        }
        
        // Shadow Quality
        const shadowQuality = document.getElementById('shadowQuality');
        if (shadowQuality) {
            shadowQuality.addEventListener('change', (e) => {
                this.updateSetting('shadowQuality', e.target.value);
            });
        }
        
        // Particle Effects
        const particleEffects = document.getElementById('particleEffects');
        if (particleEffects) {
            particleEffects.addEventListener('change', (e) => {
                this.updateSetting('particleEffects', e.target.checked);
            });
        }
        
        // Post Processing
        const postProcessing = document.getElementById('postProcessing');
        if (postProcessing) {
            postProcessing.addEventListener('change', (e) => {
                this.updateSetting('postProcessing', e.target.checked);
            });
        }
        
        // Bloom
        const bloom = document.getElementById('bloom');
        if (bloom) {
            bloom.addEventListener('change', (e) => {
                this.updateSetting('bloom', e.target.checked);
            });
        }
        
        // FPS Target
        const fpsTarget = document.getElementById('fpsTarget');
        if (fpsTarget) {
            fpsTarget.addEventListener('change', (e) => {
                this.updateSetting('fpsTarget', parseInt(e.target.value));
            });
        }
        
        // Glitch Intensity
        const glitchIntensity = document.getElementById('glitchIntensity');
        const glitchValue = document.getElementById('glitchValue');
        if (glitchIntensity && glitchValue) {
            glitchIntensity.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                glitchValue.textContent = value + '%';
                this.updateSetting('glitchIntensity', value);
            });
        }
        
        // Apply button
        const applyButton = document.getElementById('applySettings');
        if (applyButton) {
            applyButton.addEventListener('click', () => {
                this.applySettings();
                settingsMenu.classList.add('hidden');
            });
        }
        
        // Cancel button
        const cancelButton = document.getElementById('cancelSettings');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                this.loadSettings();
                this.updateUI();
                settingsMenu.classList.add('hidden');
            });
        }
        
        // Inizializza l'UI con i valori correnti
        this.updateUI();
    }
    
    updateUI() {
        // Aggiorna i valori dei controlli
        const resolutionScale = document.getElementById('resolutionScale');
        if (resolutionScale) resolutionScale.value = this.settings.resolutionScale;
        
        const antialiasing = document.getElementById('antialiasing');
        if (antialiasing) antialiasing.value = this.settings.antialiasing;
        
        const shadowQuality = document.getElementById('shadowQuality');
        if (shadowQuality) shadowQuality.value = this.settings.shadowQuality;
        
        const particleEffects = document.getElementById('particleEffects');
        if (particleEffects) particleEffects.checked = this.settings.particleEffects;
        
        const postProcessing = document.getElementById('postProcessing');
        if (postProcessing) postProcessing.checked = this.settings.postProcessing;
        
        const bloom = document.getElementById('bloom');
        if (bloom) bloom.checked = this.settings.bloom;
        
        const fpsTarget = document.getElementById('fpsTarget');
        if (fpsTarget) fpsTarget.value = this.settings.fpsTarget;
        
        const glitchIntensity = document.getElementById('glitchIntensity');
        const glitchValue = document.getElementById('glitchValue');
        if (glitchIntensity && glitchValue) {
            glitchIntensity.value = this.settings.glitchIntensity;
            glitchValue.textContent = this.settings.glitchIntensity + '%';
        }
        
        // Aggiorna il bottone del preset attivo
        const presetButtons = document.querySelectorAll('.preset-btn');
        presetButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.preset === this.currentPreset) {
                btn.classList.add('active');
            }
        });
    }
    
    applySettings() {
        console.log('Applicazione impostazioni:', this.settings);
        
        // Applica le impostazioni al motore di gioco
        if (window.applyGraphicsSettings) {
            window.applyGraphicsSettings(this.settings);
        }
        
        // Mostra notifica
        this.showNotification('Impostazioni applicate con successo!');
    }
    
    showNotification(message) {
        // Crea una notifica temporanea
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: rgba(0, 255, 0, 0.9);
            color: #000;
            padding: 15px 25px;
            border: 2px solid #00ff00;
            font-family: 'Courier New', monospace;
            font-weight: bold;
            z-index: 1000;
            box-shadow: 0 0 20px #00ff00;
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
}

// Inizializza il sistema di impostazioni quando il DOM è pronto
let graphicsSettings;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        graphicsSettings = new GraphicsSettings();
    });
} else {
    graphicsSettings = new GraphicsSettings();
}
