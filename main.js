// ============================================
// CHRONO-HACKERS - WebXR Mixed Reality Game
// ============================================

// Variabili globali
let canvas, engine, scene, camera, xrHelper;
let isXRSupported = false;
let gamepadManager;
let currentGamepad = null;

// Oggetti di gioco
let varcoVHS, anomalia;
let anomaliaGrabbed = false;

// Configurazione
const CONFIG = {
    movement: {
        speed: 0.1,
        rotationSpeed: 0.05,
        gamepadDeadzone: 0.15
    },
    varco: {
        glitchSpeed: 0.05,
        position: { x: 0, y: 1.5, z: -2 }
    },
    anomalia: {
        size: 0.2,
        position: { x: 0, y: 1.2, z: 0.5 }
    }
};

// ============================================
// INIZIALIZZAZIONE
// ============================================

window.addEventListener('DOMContentLoaded', async function() {
    await initGame();
});

async function initGame() {
    // Ottieni il canvas
    canvas = document.getElementById('renderCanvas');
    
    // Ottieni le impostazioni grafiche
    const settings = graphicsSettings ? graphicsSettings.settings : {};
    
    // Crea il motore Babylon.js con le impostazioni
    engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        antialias: settings.antialiasing > 0,
        adaptToDeviceRatio: true
    });
    
    // Imposta l'hardware scaling per la risoluzione
    if (settings.resolutionScale) {
        engine.setHardwareScalingLevel(1 / settings.resolutionScale);
    }
    
    // Crea la scena
    scene = await createScene();
    
    // Nascondi lo schermo di caricamento
    setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
    }, 1000);
    
    // Avvia il loop di rendering
    engine.runRenderLoop(() => {
        scene.render();
    });
    
    // Gestisci il ridimensionamento
    window.addEventListener('resize', () => {
        engine.resize();
    });
}

// ============================================
// CREAZIONE SCENA
// ============================================

async function createScene() {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
    
    // Ottieni le impostazioni grafiche
    const settings = graphicsSettings ? graphicsSettings.settings : {};
    
    // Configura le ombre se abilitate
    if (settings.shadowQuality && settings.shadowQuality !== 'none') {
        setupShadows(scene, settings.shadowQuality);
    }
    
    // Configura post-processing se abilitato
    if (settings.postProcessing || settings.bloom) {
        setupPostProcessing(scene, settings);
    }
    
    // Verifica se WebXR è davvero supportato e disponibile
    const xrSupported = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-vr');
    const xrArSupported = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');
    
    console.log('WebXR VR supportato:', xrSupported);
    console.log('WebXR AR supportato:', xrArSupported);
    
    // Configura sempre la modalità desktop come base
    await setupDesktopExperience(scene);
    
    // Se WebXR è supportato, aggiungi il pulsante per entrare in VR
    if (xrSupported || xrArSupported) {
        try {
            const sessionMode = xrArSupported ? 'immersive-ar' : 'immersive-vr';
            xrHelper = await scene.createDefaultXRExperienceAsync({
                uiOptions: {
                    sessionMode: sessionMode
                },
                optionalFeatures: true
            });
            
            // Aggiorna l'interfaccia solo quando l'utente entra effettivamente in VR
            xrHelper.baseExperience.onStateChangedObservable.add((state) => {
                if (state === BABYLON.WebXRState.IN_XR) {
                    isXRSupported = true;
                    updateInstructions('xr');
                    console.log('Entrato in modalità XR');
                } else if (state === BABYLON.WebXRState.NOT_IN_XR) {
                    isXRSupported = false;
                    updateInstructions(currentGamepad ? 'gamepad' : 'desktop');
                    console.log('Uscito da modalità XR');
                }
            });
            
            await setupXRExperience(scene, xrHelper);
            
        } catch (error) {
            console.log('Errore inizializzazione WebXR:', error);
        }
    }
    
    // Inizialmente mostra le istruzioni desktop
    updateInstructions('desktop');
    isXRSupported = false;
    
    // Crea gli elementi di gioco
    createGameElements(scene);
    
    // Setup del gamepad manager (funziona sia in XR che desktop)
    setupGamepadManager(scene);
    
    // Loop di aggiornamento
    scene.onBeforeRenderObservable.add(() => {
        updateGame();
    });
    
    // Registra la funzione per applicare le impostazioni
    window.applyGraphicsSettings = (newSettings) => {
        applyGraphicsToScene(scene, newSettings);
    };
    
    return scene;
}

// ============================================
// SETUP ESPERIENZA XR (QUEST)
// ============================================

async function setupXRExperience(scene, xr) {
    console.log('Configurazione esperienza XR...');
    
    // Abilita il passthrough se disponibile
    const featuresManager = xr.baseExperience.featuresManager;
    
    // Hand tracking
    const handTracking = featuresManager.enableFeature(
        BABYLON.WebXRFeatureName.HAND_TRACKING,
        'latest',
        { xrInput: xr.input }
    );
    
    if (handTracking) {
        console.log('Hand tracking abilitato');
    }
    
    // Gestione input XR per afferrare oggetti
    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            setupXRController(controller, motionController);
        });
    });
}

function setupXRController(controller, motionController) {
    const componentIds = motionController.getComponentIds();
    
    // Trigger o squeeze per afferrare
    let triggerComponent = motionController.getComponent(componentIds[0]);
    
    if (triggerComponent) {
        triggerComponent.onButtonStateChangedObservable.add(() => {
            if (triggerComponent.pressed && controller.grip) {
                handleGrabAction(controller.grip.position);
            } else if (!triggerComponent.pressed && anomaliaGrabbed) {
                releaseAnomalia();
            }
        });
    }
}

// ============================================
// SETUP ESPERIENZA DESKTOP
// ============================================

async function setupDesktopExperience(scene) {
    console.log('Configurazione esperienza desktop...');
    
    // Crea una camera universale
    camera = new BABYLON.UniversalCamera(
        'desktopCamera',
        new BABYLON.Vector3(0, 1.6, -3),
        scene
    );
    
    camera.setTarget(new BABYLON.Vector3(0, 1.5, 0));
    camera.attachControl(canvas, true);
    
    // Configura i controlli base
    camera.speed = CONFIG.movement.speed;
    camera.angularSensibility = 2000;
    
    // Aggiungi una luce ambientale per vedere meglio in modalità desktop
    const light = new BABYLON.HemisphericLight(
        'light',
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    light.intensity = 0.7;
    
    // Aggiungi una luce direzionale per le ombre
    const dirLight = new BABYLON.DirectionalLight(
        'dirLight',
        new BABYLON.Vector3(-1, -2, -1),
        scene
    );
    dirLight.position = new BABYLON.Vector3(5, 10, 5);
    dirLight.intensity = 0.5;
    
    // Crea l'ambiente con modello 3D e skybox
    await createDesktopEnvironment(scene);
    
    // Mouse click per interagire
    scene.onPointerDown = (evt, pickResult) => {
        if (pickResult.hit && pickResult.pickedMesh === anomalia) {
            if (!anomaliaGrabbed) {
                anomaliaGrabbed = true;
                anomalia.parent = camera;
            } else {
                releaseAnomalia();
            }
        }
    };
}

async function createDesktopEnvironment(scene) {
    // Crea la skybox corrotta
    const skybox = BABYLON.MeshBuilder.CreateBox('skybox', { size: 1000 }, scene);
    const skyboxMaterial = new BABYLON.StandardMaterial('skyboxMat', scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    
    // Carica la texture della skybox glitch
    const skyboxTexture = new BABYLON.Texture('skybox_glitch.jpg', scene);
    skyboxMaterial.emissiveTexture = skyboxTexture;
    skyboxMaterial.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    
    // Aggiungi un effetto di animazione alla skybox
    let skyboxTime = 0;
    scene.onBeforeRenderObservable.add(() => {
        skyboxTime += 0.001;
        if (skyboxTexture) {
            skyboxTexture.uOffset = Math.sin(skyboxTime) * 0.02;
            skyboxTexture.vOffset = Math.cos(skyboxTime * 0.7) * 0.02;
        }
    });
    
    // Carica il modello 3D dell'appartamento
    try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync(
            '',
            '',
            'apartment_floor_plan.glb',
            scene
        );
        
        console.log('Modello appartamento caricato:', result.meshes.length, 'mesh');
        
        // Scala e posiziona il modello
        if (result.meshes.length > 0) {
            const rootMesh = result.meshes[0];
            rootMesh.scaling = new BABYLON.Vector3(2, 2, 2);
            rootMesh.position = new BABYLON.Vector3(0, 0, 0);
            
            // Applica un materiale con effetto glitch ai mesh
            result.meshes.forEach((mesh, index) => {
                if (mesh.material && index > 0) {
                    const originalMat = mesh.material;
                    if (originalMat instanceof BABYLON.PBRMaterial || originalMat instanceof BABYLON.StandardMaterial) {
                        // Aggiungi un leggero effetto emissivo verde
                        if (originalMat.emissiveColor) {
                            originalMat.emissiveColor = new BABYLON.Color3(0, 0.1, 0);
                        }
                    }
                }
            });
        }
        
    } catch (error) {
        console.warn('Impossibile caricare il modello 3D:', error);
        // Fallback: crea un ambiente semplice
        createSimpleEnvironment(scene);
    }
}

function createSimpleEnvironment(scene) {
    // Ambiente di fallback se il modello non si carica
    const ground = BABYLON.MeshBuilder.CreateGround(
        'ground',
        { width: 20, height: 20 },
        scene
    );
    
    const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.15);
    groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
    ground.material = groundMat;
    
    const wall = BABYLON.MeshBuilder.CreateBox(
        'wall',
        { width: 10, height: 5, depth: 0.2 },
        scene
    );
    wall.position = new BABYLON.Vector3(0, 2.5, -2.1);
    
    const wallMat = new BABYLON.StandardMaterial('wallMat', scene);
    wallMat.diffuseColor = new BABYLON.Color3(0.15, 0.1, 0.2);
    wallMat.specularColor = new BABYLON.Color3(0, 0, 0);
    wall.material = wallMat;
}

// ============================================
// ELEMENTI DI GIOCO
// ============================================

function createGameElements(scene) {
    // Crea il Varco VHS
    varcoVHS = BABYLON.MeshBuilder.CreatePlane(
        'varcoVHS',
        { width: 1.2, height: 0.7 },
        scene
    );
    
    varcoVHS.position = new BABYLON.Vector3(
        CONFIG.varco.position.x,
        CONFIG.varco.position.y,
        CONFIG.varco.position.z
    );
    
    // Materiale con effetto glitch
    const varcoMaterial = new BABYLON.StandardMaterial('varcoMat', scene);
    varcoMaterial.emissiveColor = new BABYLON.Color3(1, 0, 1);
    varcoMaterial.disableLighting = true;
    varcoVHS.material = varcoMaterial;
    
    // Aggiungi un bordo al varco
    const border = BABYLON.MeshBuilder.CreateBox(
        'varcoBorder',
        { width: 1.3, height: 0.8, depth: 0.05 },
        scene
    );
    border.position = varcoVHS.position.clone();
    border.position.z += 0.01;
    
    const borderMat = new BABYLON.StandardMaterial('borderMat', scene);
    borderMat.emissiveColor = new BABYLON.Color3(0, 1, 0);
    borderMat.disableLighting = true;
    borderMat.wireframe = true;
    border.material = borderMat;
    
    // Crea l'Anomalia (oggetto da afferrare)
    anomalia = BABYLON.MeshBuilder.CreateBox(
        'anomalia',
        { size: CONFIG.anomalia.size },
        scene
    );
    
    anomalia.position = new BABYLON.Vector3(
        CONFIG.anomalia.position.x,
        CONFIG.anomalia.position.y,
        CONFIG.anomalia.position.z
    );
    
    const anomaliaMat = new BABYLON.StandardMaterial('anomaliaMat', scene);
    anomaliaMat.emissiveColor = new BABYLON.Color3(0, 1, 1);
    anomaliaMat.disableLighting = true;
    anomalia.material = anomaliaMat;
    
    // Aggiungi fisica all'anomalia (solo in modalità desktop)
    if (!isXRSupported) {
        anomalia.physicsImpostor = new BABYLON.PhysicsImpostor(
            anomalia,
            BABYLON.PhysicsImpostor.BoxImpostor,
            { mass: 0, restitution: 0.9 },
            scene
        );
    }
}

// ============================================
// GAMEPAD MANAGER
// ============================================

function setupGamepadManager(scene) {
    gamepadManager = new BABYLON.GamepadManager();
    
    gamepadManager.onGamepadConnectedObservable.add((gamepad) => {
        console.log('Gamepad connesso:', gamepad.id);
        currentGamepad = gamepad;
        updateInstructions('gamepad');
    });
    
    gamepadManager.onGamepadDisconnectedObservable.add((gamepad) => {
        console.log('Gamepad disconnesso');
        currentGamepad = null;
        updateInstructions('desktop');
    });
}

function handleGamepadInput() {
    if (!currentGamepad || !camera || isXRSupported) return;
    
    // Movimento con stick sinistro
    const leftStick = currentGamepad.leftStick;
    if (leftStick && (Math.abs(leftStick.x) > CONFIG.movement.gamepadDeadzone || 
                      Math.abs(leftStick.y) > CONFIG.movement.gamepadDeadzone)) {
        
        const forward = camera.getDirection(BABYLON.Axis.Z);
        const right = camera.getDirection(BABYLON.Axis.X);
        
        camera.position.addInPlace(forward.scale(leftStick.y * CONFIG.movement.speed));
        camera.position.addInPlace(right.scale(leftStick.x * CONFIG.movement.speed));
    }
    
    // Rotazione con stick destro
    const rightStick = currentGamepad.rightStick;
    if (rightStick && (Math.abs(rightStick.x) > CONFIG.movement.gamepadDeadzone || 
                       Math.abs(rightStick.y) > CONFIG.movement.gamepadDeadzone)) {
        
        camera.rotation.y += rightStick.x * CONFIG.movement.rotationSpeed;
        camera.rotation.x -= rightStick.y * CONFIG.movement.rotationSpeed;
        
        // Limita la rotazione verticale
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    }
    
    // Pulsante A o trigger destro per afferrare
    if (currentGamepad.type === BABYLON.Gamepad.XBOX) {
        const xboxPad = currentGamepad;
        if (xboxPad.buttonA === 1 || xboxPad.rightTrigger > 0.5) {
            if (!anomaliaGrabbed && camera) {
                const distance = BABYLON.Vector3.Distance(camera.position, anomalia.position);
                if (distance < 2) {
                    anomaliaGrabbed = true;
                    anomalia.parent = camera;
                }
            }
        } else if (xboxPad.buttonB === 1) {
            if (anomaliaGrabbed) {
                releaseAnomalia();
            }
        }
    }
}

// ============================================
// LOGICA DI GIOCO
// ============================================

let glitchTime = 0;

function updateGame() {
    // Aggiorna l'effetto glitch del varco
    glitchTime += CONFIG.varco.glitchSpeed;
    
    if (varcoVHS && varcoVHS.material) {
        const r = Math.sin(glitchTime) * 0.5 + 0.5;
        const g = Math.sin(glitchTime * 0.7) * 0.3;
        const b = Math.cos(glitchTime * 0.5) * 0.5 + 0.5;
        
        varcoVHS.material.emissiveColor = new BABYLON.Color3(r, g, b);
        
        // Leggero movimento del varco
        varcoVHS.rotation.z = Math.sin(glitchTime * 0.3) * 0.05;
    }
    
    // Rotazione dell'anomalia
    if (anomalia && !anomaliaGrabbed) {
        anomalia.rotation.y += 0.02;
        anomalia.rotation.x += 0.01;
        
        // Leggero movimento su e giù
        anomalia.position.y = CONFIG.anomalia.position.y + Math.sin(glitchTime * 2) * 0.05;
    }
    
    // Gestisci input del gamepad
    handleGamepadInput();
    
    // Controlla se l'anomalia è stata riportata al varco
    checkAnomaliaReturn();
}

function handleGrabAction(handPosition) {
    if (!anomalia || anomaliaGrabbed) return;
    
    const distance = BABYLON.Vector3.Distance(handPosition, anomalia.position);
    
    if (distance < 0.3) {
        anomaliaGrabbed = true;
        anomalia.parent = handPosition.parent;
    }
}

function releaseAnomalia() {
    if (!anomalia) return;
    
    anomalia.parent = null;
    anomaliaGrabbed = false;
}

function checkAnomaliaReturn() {
    if (!anomalia || !varcoVHS) return;
    
    const distance = BABYLON.Vector3.Distance(anomalia.position, varcoVHS.position);
    
    if (distance < 0.5) {
        // Successo! L'anomalia è stata riportata al varco
        successEffect();
    }
}

function successEffect() {
    // Effetto visivo di successo
    if (varcoVHS && varcoVHS.material) {
        varcoVHS.material.emissiveColor = new BABYLON.Color3(0, 2, 0);
        
        setTimeout(() => {
            // Resetta l'anomalia in una nuova posizione
            resetAnomalia();
        }, 500);
    }
}

function resetAnomalia() {
    if (!anomalia) return;
    
    anomalia.parent = null;
    anomaliaGrabbed = false;
    
    // Nuova posizione casuale
    const randomX = (Math.random() - 0.5) * 2;
    const randomZ = Math.random() * 1.5 + 0.3;
    
    anomalia.position = new BABYLON.Vector3(randomX, CONFIG.anomalia.position.y, randomZ);
}

// ============================================
// UI E ISTRUZIONI
// ============================================

function updateInstructions(mode) {
    const controlsList = document.getElementById('controlsList');
    const instructionsBox = document.getElementById('instructions');
    
    let instructions = '';
    let platformInfo = '';
    
    switch(mode) {
        case 'xr':
            instructions = `
                <li>Usa le MANI per afferrare</li>
                <li>Pizzica per prendere l'anomalia</li>
                <li>Riportala al VARCO VHS</li>
            `;
            platformInfo = '<strong style="color: #00ffff;">REALTÀ MISTA ATTIVA</strong>';
            break;
            
        case 'gamepad':
            instructions = `
                <li>Stick SX: Movimento</li>
                <li>Stick DX: Rotazione camera</li>
                <li>Pulsante A / RT: Afferra</li>
                <li>Pulsante B: Rilascia</li>
            `;
            platformInfo = '<strong style="color: #00ff00;">CONTROLLER RILEVATO</strong>';
            break;
            
        case 'desktop':
            instructions = `
                <li>WASD: Movimento</li>
                <li>Mouse: Rotazione camera</li>
                <li>Click SX: Afferra/Rilascia</li>
            `;
            platformInfo = '<strong style="color: #00ff00;">MODALITÀ DESKTOP</strong>';
            break;
    }
    
    controlsList.innerHTML = instructions + '<li style="margin-top: 10px; border-top: 1px solid #00ff00; padding-top: 10px;">' + platformInfo + '</li>';
}

// ============================================
// GESTIONE IMPOSTAZIONI GRAFICHE
// ============================================

function setupShadows(scene, quality) {
    // Trova tutte le luci nella scena
    const lights = scene.lights;
    
    lights.forEach(light => {
        if (light instanceof BABYLON.DirectionalLight || light instanceof BABYLON.SpotLight) {
            const shadowGenerator = new BABYLON.ShadowGenerator(getShadowMapSize(quality), light);
            shadowGenerator.useBlurExponentialShadowMap = quality === 'ultra' || quality === 'high';
            shadowGenerator.blurKernel = quality === 'ultra' ? 64 : 32;
            
            // Aggiungi tutti i mesh che devono proiettare ombre
            scene.meshes.forEach(mesh => {
                if (mesh.name !== 'ground' && mesh.name !== 'wall') {
                    shadowGenerator.addShadowCaster(mesh);
                }
            });
        }
    });
}

function getShadowMapSize(quality) {
    const sizes = {
        low: 512,
        medium: 1024,
        high: 2048,
        ultra: 4096
    };
    return sizes[quality] || 1024;
}

function setupPostProcessing(scene, settings) {
    const camera = scene.activeCamera;
    if (!camera) return;
    
    // Bloom effect
    if (settings.bloom) {
        const bloomEffect = new BABYLON.BloomEffect(scene, 1.0, 2, 1.0);
    }
    
    // VHS Glitch effect (se abilitato)
    if (settings.postProcessing) {
        const glitchIntensity = (settings.glitchIntensity || 70) / 100;
        
        // Shader personalizzato per l'effetto VHS
        BABYLON.Effect.ShadersStore["vhsFragmentShader"] = `
            #ifdef GL_ES
                precision highp float;
            #endif
            
            varying vec2 vUV;
            uniform sampler2D textureSampler;
            uniform float time;
            uniform float intensity;
            
            void main(void) {
                vec2 uv = vUV;
                
                // Distorsione orizzontale (tracking VHS)
                float lineNoise = sin(uv.y * 800.0 + time * 10.0) * 0.002 * intensity;
                uv.x += lineNoise;
                
                // Aberrazione cromatica
                vec2 offset = vec2(0.002 * intensity, 0.0);
                float r = texture2D(textureSampler, uv + offset).r;
                float g = texture2D(textureSampler, uv).g;
                float b = texture2D(textureSampler, uv - offset).b;
                
                // Scanlines
                float scanline = sin(uv.y * 600.0) * 0.04 * intensity;
                
                vec3 color = vec3(r, g, b);
                color -= scanline;
                
                // Glitch occasionale
                if (mod(time, 3.0) < 0.1) {
                    float glitch = step(0.98, sin(uv.y * 100.0 + time * 50.0));
                    uv.x += glitch * 0.05 * intensity;
                    color = texture2D(textureSampler, uv).rgb;
                }
                
                gl_FragColor = vec4(color, 1.0);
            }
        `;
        
        const vhsEffect = new BABYLON.PostProcess(
            "vhsEffect",
            "vhs",
            ["time", "intensity"],
            null,
            1.0,
            camera
        );
        
        let time = 0;
        vhsEffect.onApply = (effect) => {
            time += 0.016;
            effect.setFloat("time", time);
            effect.setFloat("intensity", glitchIntensity);
        };
    }
}

function applyGraphicsToScene(scene, newSettings) {
    console.log('Applicazione nuove impostazioni grafiche:', newSettings);
    
    // Aggiorna hardware scaling
    if (newSettings.resolutionScale) {
        engine.setHardwareScalingLevel(1 / newSettings.resolutionScale);
    }
    
    // Rimuovi e ricrea post-processing se necessario
    if (scene.activeCamera) {
        // Rimuovi tutti i post-process esistenti
        scene.activeCamera.detachPostProcess(scene.activeCamera._postProcesses);
        
        // Ricrea se abilitati
        if (newSettings.postProcessing || newSettings.bloom) {
            setupPostProcessing(scene, newSettings);
        }
    }
    
    // Aggiorna l'intensità del glitch in tempo reale
    CONFIG.varco.glitchSpeed = 0.05 * (newSettings.glitchIntensity / 70);
    
    console.log('Impostazioni applicate con successo');
}
