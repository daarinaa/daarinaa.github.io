import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from 'gsap';

// --- СЦЕНА ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 3000);
camera.position.set(0, 0.8, 4.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.setPixelRatio(window.devicePixelRatio);

const canvasContainer = document.getElementById('canvas-container');
canvasContainer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, -0.5, 0);
controls.update();

// --- ОСВЕЩЕНИЕ ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xfff5e6, 1.1);
mainLight.position.set(2, 5, 3);
mainLight.castShadow = true;
scene.add(mainLight);

const fillLight = new THREE.PointLight(0xffddbb, 0.55);
fillLight.position.set(1, 2, 2);
scene.add(fillLight);

const backLight = new THREE.PointLight(0xffccaa, 0.45);
backLight.position.set(0, 1, -3);
scene.add(backLight);

const rimLight = new THREE.PointLight(0xffeedd, 0.35);
rimLight.position.set(1, 1.5, -2);
scene.add(rimLight);

const bottomFill = new THREE.PointLight(0xccaa88, 0.25);
bottomFill.position.set(0, -1, 0);
scene.add(bottomFill);

const lights = { ambientLight, mainLight, fillLight, backLight, rimLight, bottomFill };

function setStudioLighting() {
    ambientLight.intensity = 0.6;
    mainLight.intensity = 1.0;
    mainLight.position.set(2, 3, 2);
    fillLight.intensity = 0.5;
    fillLight.position.set(1, 1, 1);
    backLight.intensity = 0.4;
    backLight.position.set(-1, 2, -2);
    rimLight.intensity = 0.3;
    rimLight.position.set(1, 1.5, -2);
}
function setDayLighting() {
    ambientLight.intensity = 0.7;
    mainLight.intensity = 1.2;
    mainLight.position.set(5, 8, 4);
    fillLight.intensity = 0.4;
    fillLight.position.set(0, 2, 2);
    backLight.intensity = 0.5;
    backLight.position.set(0, 1, -3);
    rimLight.intensity = 0.2;
    rimLight.position.set(0, 2, -3);
}
function setBackLighting() {
    ambientLight.intensity = 0.3;
    mainLight.intensity = 0.6;
    mainLight.position.set(-2, 3, -3);
    fillLight.intensity = 0.3;
    fillLight.position.set(0, 1, -1);
    backLight.intensity = 1.0;
    backLight.position.set(1, 2, 3);
    rimLight.intensity = 0.7;
    rimLight.position.set(0, 1, 2);
}

const gridHelper = new THREE.GridHelper(8, 20, 0x88aaff, 0x335588);
gridHelper.position.y = -0.9;
gridHelper.material.transparent = true;
gridHelper.material.opacity = 0.35;
scene.add(gridHelper);

// --- ПАНОРАМНЫЙ ФОН ---
const textureLoader = new THREE.TextureLoader();
const panoramaTexture = textureLoader.load('panorama.jpg');
const skyGeometry = new THREE.SphereGeometry(1000, 64, 64);
const skyMaterial = new THREE.MeshBasicMaterial({
    map: panoramaTexture,
    side: THREE.BackSide
});
const skySphere = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(skySphere);

// --- ПЕРЕМЕННЫЕ ---
let currentModel = null;
let mixer = null;
let actions = {};
let activeAction = null;
let meshesWithMorphs = [];
let morphNames = [];
let wireframeMode = false;
let currentGLBUrl = null;
let currentGLBBlob = null;
let currentSkeletonHelper = null;
let uvCheckerActive = false;
let originalMaterials = new Map();

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function countPolygonsAndVertices(model) {
    let triangles = 0, vertices = 0;
    model.traverse(child => {
        if (child.isMesh) {
            const geom = child.geometry;
            if (!geom) return;
            const posAttr = geom.attributes.position;
            if (posAttr) vertices += posAttr.count;
            if (geom.index) triangles += geom.index.count / 3;
            else if (posAttr) triangles += posAttr.count / 3;
        }
    });
    return { triangles, vertices };
}
function countBones(model) {
    let skeleton = null;
    model.traverse(child => {
        if (child.isSkinnedMesh && child.skeleton && !skeleton) skeleton = child.skeleton;
    });
    return skeleton ? skeleton.bones.length : 0;
}
function updateTechStats() {
    if (!currentModel) return;
    const stats = countPolygonsAndVertices(currentModel);
    const bones = countBones(currentModel);
    const blendshapeCount = meshesWithMorphs.reduce((sum, mesh) => {
        return sum + (mesh.morphTargetDictionary ? Object.keys(mesh.morphTargetDictionary).length : 0);
    }, 0);
    const animationsCount = Object.keys(actions).length;
    document.getElementById('tech-stats').innerHTML = `
        📐 Треугольников: ${stats.triangles.toLocaleString()}<br>
        🔷 Вершин: ${stats.vertices.toLocaleString()}<br>
        🦴 Костей: ${bones}<br>
        😀 Блендшейпов: ${blendshapeCount}<br>
        🎬 Анимаций: ${animationsCount}
    `;
}

// --- УПРАВЛЕНИЕ БЛЕНДШЕЙПАМИ ---
function setMorphWeightByName(morphName, weight, duration = 0.2) {
    if (!meshesWithMorphs.length) return;
    meshesWithMorphs.forEach(mesh => {
        const dict = mesh.morphTargetDictionary;
        if (dict && dict[morphName] !== undefined) {
            const idx = dict[morphName];
            gsap.killTweensOf(mesh.morphTargetInfluences, [idx]);
            if (duration <= 0) mesh.morphTargetInfluences[idx] = weight;
            else gsap.to(mesh.morphTargetInfluences, { [idx]: weight, duration, ease: "power2.out", overwrite: true });
        }
    });
}
function resetAllMorphs() {
    if (!meshesWithMorphs.length) return;
    meshesWithMorphs.forEach(mesh => {
        const dict = mesh.morphTargetDictionary;
        if (dict) {
            Object.keys(dict).forEach(name => {
                const idx = dict[name];
                gsap.killTweensOf(mesh.morphTargetInfluences, [idx]);
                mesh.morphTargetInfluences[idx] = 0;
            });
        }
    });
    const extraSliders = document.querySelectorAll('#extra-morphs-container input[type="range"]');
    extraSliders.forEach(slider => { slider.value = 0; });
    const extraSpans = document.querySelectorAll('#extra-morphs-container .weight-value');
    extraSpans.forEach(span => { span.innerText = '0'; });
    const speedSlider = document.getElementById('anim-speed');
    if (speedSlider) {
        speedSlider.value = '1';
        setAnimationSpeed(1);
    }
}
function emotionNeutral() {
    if (!meshesWithMorphs.length) return;
    resetAllMorphs();
    setMorphWeightByName('neutral', 1.0, 0.25);
}
function setEmotionByName(emotionName, value = 1.0) {
    resetAllMorphs();
    setMorphWeightByName(emotionName, value, 0.25);
}
function emotionHappy()   { setEmotionByName('happy', 1.0); }
function emotionAngry()   { setEmotionByName('angry', 1.0); }
function emotionSad()     { setEmotionByName('sad', 1.0); }
function emotionSurprise(){ setEmotionByName('surprise', 1.0); }

// --- АВТОТЕСТ ---
let testTimer = null;
function autoTestBlendshapes() {
    if (testTimer) {
        clearTimeout(testTimer);
        testTimer = null;
        resetAllMorphs();
        return;
    }
    const emotions = ['happy', 'angry', 'sad', 'surprise'];
    let step = 0;
    function next() {
        if (step >= emotions.length) {
            resetAllMorphs();
            testTimer = null;
            return;
        }
        setEmotionByName(emotions[step], 1.0);
        setTimeout(() => {
            setEmotionByName(emotions[step], 0.0);
            step++;
            setTimeout(next, 400);
        }, 800);
    }
    next();
    testTimer = setTimeout(() => {}, 99999);
}

// --- АНИМАЦИИ ---
function playAnimationByKeyword(keyword) {
    if (!mixer || !Object.keys(actions).length) return;
    const matchedName = Object.keys(actions).find(name =>
        name.toLowerCase().includes(keyword.toLowerCase())
    );
    if (!matchedName) { console.warn(`Анимация с "${keyword}" не найдена`); return; }
    const newAction = actions[matchedName];
    if (activeAction === newAction) return;
    newAction.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    if (activeAction) activeAction.crossFadeTo(newAction, 0.3, true);
    activeAction = newAction;
}
function setAnimationSpeed(speed) {
    if (mixer) mixer.timeScale = speed;
    document.getElementById('speed-val').innerText = speed.toFixed(2);
}

// --- ИНСТРУМЕНТЫ ---
function toggleWireframe() {
    wireframeMode = !wireframeMode;
    currentModel?.traverse(child => { if (child.isMesh) child.material.wireframe = wireframeMode; });
}
function toggleSkeleton() {
    if (currentSkeletonHelper) {
        scene.remove(currentSkeletonHelper);
        currentSkeletonHelper = null;
    } else if (currentModel) {
        currentSkeletonHelper = new THREE.SkeletonHelper(currentModel);
        scene.add(currentSkeletonHelper);
    }
}
function toggleUVChecker() {
    if (!currentModel) return;
    const btn = document.getElementById('uv-checker-btn');
    if (!uvCheckerActive) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 512, 512);
        ctx.fillStyle = '#888888';
        const step = 64;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if ((i + j) % 2 === 0) ctx.fillRect(i * step, j * step, step, step);
            }
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        currentModel.traverse(child => {
            if (child.isMesh && child.material) {
                if (!originalMaterials.has(child)) originalMaterials.set(child, child.material);
                const newMat = new THREE.MeshStandardMaterial({
                    map: texture,
                    skinning: child.material.skinning || false
                });
                child.material = newMat;
            }
        });
        uvCheckerActive = true;
        btn.textContent = '🔳 Отключить UV';
    } else {
        originalMaterials.forEach((mat, child) => { child.material = mat; });
        originalMaterials.clear();
        uvCheckerActive = false;
        btn.textContent = '🔲 UV Checker';
    }
}

// --- КАМЕРА И СКРИНШОТ ---
function resetCamera() {
    camera.position.set(0, 0.8, 4.5);
    controls.target.set(0, -0.5, 0);
    controls.update();
}
function takeScreenshot() {
    const canvas = renderer.domElement;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `screenshot_${Date.now()}.png`;
    link.click();
}

// --- СКАЧИВАНИЕ МОДЕЛИ ---
function downloadCurrentModel() {
    if (currentGLBBlob) {
        const url = URL.createObjectURL(currentGLBBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'downloaded_model.glb';
        link.click();
        URL.revokeObjectURL(url);
    } else if (currentGLBUrl) {
        fetch(currentGLBUrl)
            .then(res => res.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'model.glb';
                link.click();
                URL.revokeObjectURL(url);
                currentGLBBlob = blob;
            })
            .catch(err => { console.error(err); alert('Не удалось скачать модель'); });
    } else {
        alert('Модель не загружена');
    }
}
function clearCurrentCharacter() {
    if (currentModel) scene.remove(currentModel);
    if (mixer) mixer.stopAllAction();
    if (currentSkeletonHelper) scene.remove(currentSkeletonHelper);
    currentModel = null;
    mixer = null;
    actions = {};
    activeAction = null;
    meshesWithMorphs = [];
    morphNames = [];
    originalMaterials.clear();
    uvCheckerActive = false;
    document.getElementById('uv-checker-btn').textContent = '🔲 UV Checker';
    const container = document.getElementById('extra-morphs-container');
    if (container) container.innerHTML = '';
    updateTechStats();
}

// --- ЗАГРУЗКА МОДЕЛИ ---
const loader = new GLTFLoader();
const progressDiv = document.getElementById('loading-progress');
function loadCharacterFromURL(url, blobForDownload = null) {
    clearCurrentCharacter();
    currentGLBUrl = url;
    currentGLBBlob = blobForDownload;
    if (!blobForDownload && url && !url.startsWith('blob:')) {
        fetch(url).then(res => res.blob()).then(blob => { currentGLBBlob = blob; }).catch(e => console.warn('Blob fetch error', e));
    }
    progressDiv.style.display = 'block';
    loader.load(url, (gltf) => {
        currentModel = gltf.scene;
        scene.add(currentModel);
        currentModel.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                if (node.morphTargetDictionary && Object.keys(node.morphTargetDictionary).length) meshesWithMorphs.push(node);
            }
        });
        currentModel.scale.set(1, 1, 1);
        currentModel.position.y = -1;
        if (gltf.animations.length) {
            mixer = new THREE.AnimationMixer(currentModel);
            gltf.animations.forEach(clip => { actions[clip.name] = mixer.clipAction(clip); console.log(`Анимация: ${clip.name}`); });
            if (Object.keys(actions).some(name => name.toLowerCase().includes('hello'))) {
                playAnimationByKeyword('hello');
            } else {
                playAnimationByKeyword('idle');
            }
        }
        const uniqueNames = new Set();
        meshesWithMorphs.forEach(mesh => {
            if (mesh.morphTargetDictionary) Object.keys(mesh.morphTargetDictionary).forEach(n => uniqueNames.add(n));
        });
        morphNames = Array.from(uniqueNames).sort();
        console.log('Блендшейпы (имена):', morphNames);
        resetAllMorphs();
        emotionNeutral();
        rebuildExtraMorphs();
        updateTechStats();
        document.getElementById('info-message').innerHTML = `✅ Загружено. Морфов: ${morphNames.length}, анимаций: ${Object.keys(actions).length}`;
        progressDiv.style.display = 'none';
        updateSwitchButtonText();
    }, (xhr) => {
        const percent = Math.round(xhr.loaded / xhr.total * 100);
        progressDiv.innerText = `Загрузка: ${percent}%`;
        if (percent === 100) setTimeout(() => progressDiv.style.display = 'none', 300);
    }, (error) => {
        console.error(error);
        progressDiv.style.display = 'none';
        document.getElementById('info-message').innerHTML = `❌ Ошибка загрузки ${url}`;
    });
}

// --- ДОПОЛНИТЕЛЬНЫЕ БЛЕНДШЕЙПЫ ---
function rebuildExtraMorphs() {
    const container = document.getElementById('extra-morphs-container');
    if (!container) return;
    container.innerHTML = '';
    if (!meshesWithMorphs.length) return;
    const allMorphs = new Set();
    meshesWithMorphs.forEach(mesh => {
        if (mesh.morphTargetDictionary) {
            Object.keys(mesh.morphTargetDictionary).forEach(name => allMorphs.add(name));
        }
    });
    const exclude = new Set(['neutral', 'blendShape1', 'happy', 'sad', 'angry', 'surprise']);
    const extra = Array.from(allMorphs).filter(name => !exclude.has(name)).sort();
    if (extra.length === 0) {
        container.innerHTML = '<div class="note">Нет дополнительных блендшейпов</div>';
        return;
    }
    extra.forEach(name => {
        const wrapper = document.createElement('div');
        wrapper.className = 'slider-container';
        const label = document.createElement('label');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        const valueSpan = document.createElement('span');
        valueSpan.className = 'weight-value';
        valueSpan.textContent = '0';
        label.appendChild(nameSpan);
        label.appendChild(valueSpan);
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 1;
        slider.step = 0.01;
        slider.value = 0;
        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            valueSpan.textContent = val;
            setMorphWeightByName(name, val, 0.05);
        });
        wrapper.appendChild(label);
        wrapper.appendChild(slider);
        container.appendChild(wrapper);
    });
}
function setupFileUpload() {
    const input = document.getElementById('upload-model');
    input.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        currentGLBBlob = file;
        loadCharacterFromURL(url, file);
    });
}
const characterUrls = ['./models/deer.glb', './models/rabbit.glb'];
const characterNames = ['Оленёнок', 'Зайка'];
let currentCharacterIndex = 0;
function updateSwitchButtonText() {
    const switchBtn = document.getElementById('switch-character');
    if (!switchBtn) return;
    const nextIndex = (currentCharacterIndex + 1) % characterUrls.length;
    switchBtn.textContent = `🔄 ${characterNames[nextIndex]}`;
}
function switchCharacter() {
    currentCharacterIndex = (currentCharacterIndex + 1) % characterUrls.length;
    loadCharacterFromURL(characterUrls[currentCharacterIndex], null);
}
function showTutorialOnce() {
    const tutorial = document.getElementById('tutorial');
    const closeBtn = document.getElementById('close-tutorial');
    if (!tutorial) return;
    const alreadyShown = localStorage.getItem('tutorialShown');
    if (!alreadyShown) {
        tutorial.style.display = 'flex';
        closeBtn.onclick = () => {
            tutorial.style.display = 'none';
            localStorage.setItem('tutorialShown', 'true');
        };
        setTimeout(() => {
            if (tutorial.style.display === 'flex') {
                tutorial.style.display = 'none';
                localStorage.setItem('tutorialShown', 'true');
            }
        }, 10000);
    }
}

// --- ПРИВЯЗКА UI ---
function bindUI() {
    document.getElementById('switch-character').addEventListener('click', switchCharacter);
    setupFileUpload();
    document.getElementById('auto-test').addEventListener('click', autoTestBlendshapes);
    document.getElementById('reset-all').addEventListener('click', resetAllMorphs);
    document.getElementById('anim-idle').addEventListener('click', () => playAnimationByKeyword('idle'));
    document.getElementById('anim-walk').addEventListener('click', () => playAnimationByKeyword('walk'));
    document.getElementById('anim-hello').addEventListener('click', () => playAnimationByKeyword('hello'));
    document.getElementById('anim-speed').addEventListener('input', e => setAnimationSpeed(parseFloat(e.target.value)));
    document.getElementById('wireframe-btn').addEventListener('click', toggleWireframe);
    document.getElementById('skeleton-btn').addEventListener('click', toggleSkeleton);
    document.getElementById('uv-checker-btn').addEventListener('click', toggleUVChecker);
    document.getElementById('download-model-btn').addEventListener('click', downloadCurrentModel);
    document.getElementById('light-studio').addEventListener('click', setStudioLighting);
    document.getElementById('light-day').addEventListener('click', setDayLighting);
    document.getElementById('light-back').addEventListener('click', setBackLighting);
    document.getElementById('emotion-neutral').addEventListener('click', emotionNeutral);
    document.getElementById('emotion-happy').addEventListener('click', emotionHappy);
    document.getElementById('emotion-sad').addEventListener('click', emotionSad);
    document.getElementById('emotion-angry').addEventListener('click', emotionAngry);
    document.getElementById('emotion-surprise').addEventListener('click', emotionSurprise);
    document.getElementById('reset-camera-btn').addEventListener('click', resetCamera);
    document.getElementById('screenshot-btn').addEventListener('click', takeScreenshot);
    updateSwitchButtonText();
    showTutorialOnce();
}
let clock = new THREE.Clock();
function animate() {
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate();
bindUI();
loadCharacterFromURL(characterUrls[0], null);

// --- СВОРАЧИВАНИЕ ЛЕВОЙ ПАНЕЛИ ---
const uiPanel = document.getElementById('ui');
const collapseBtn = document.getElementById('collapse-ui-btn');
if (collapseBtn && uiPanel) {
    collapseBtn.addEventListener('click', () => {
        uiPanel.classList.toggle('collapsed');
        collapseBtn.textContent = uiPanel.classList.contains('collapsed') ? '▶' : '◀';
    });
    uiPanel.addEventListener('click', (e) => {
        if (uiPanel.classList.contains('collapsed') && e.target === uiPanel) {
            uiPanel.classList.remove('collapsed');
            collapseBtn.textContent = '◀';
        }
    });
}
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- СЛАЙДЕРЫ ДЛЯ ПАЙПЛАЙНА ---
function initPipelineSliders() {
    const sliders = document.querySelectorAll('.step .slider');
    sliders.forEach(slider => {
        const container = slider.querySelector('.slider-container');
        const imgs = container ? Array.from(container.querySelectorAll('.slider-img')) : [];
        if (imgs.length === 0) return;
        let current = 0;
        let dotsContainer = slider.querySelector('.slider-dots');
        if (dotsContainer) {
            dotsContainer.innerHTML = '';
            imgs.forEach((_, idx) => {
                const dot = document.createElement('span');
                dot.classList.add('dot');
                if (idx === 0) dot.classList.add('active');
                dot.addEventListener('click', () => showSlide(idx));
                dotsContainer.appendChild(dot);
            });
        }
        function showSlide(index) {
            if (index < 0) index = imgs.length - 1;
            if (index >= imgs.length) index = 0;
            imgs.forEach((img, i) => { img.style.display = i === index ? 'block' : 'none'; });
            if (dotsContainer) {
                const dots = dotsContainer.querySelectorAll('.dot');
                dots.forEach((dot, i) => {
                    if (i === index) dot.classList.add('active');
                    else dot.classList.remove('active');
                });
            }
            current = index;
        }
        const prevBtn = slider.querySelector('.slider-prev');
        const nextBtn = slider.querySelector('.slider-next');
        if (prevBtn) prevBtn.onclick = () => showSlide(current - 1);
        if (nextBtn) nextBtn.onclick = () => showSlide(current + 1);
        showSlide(0);
    });
}
window.addEventListener('DOMContentLoaded', initPipelineSliders);
setTimeout(initPipelineSliders, 100);

// ========== ДОПОЛНЕНИЯ ДЛЯ МОБИЛЬНОГО МЕНЮ (ТОЛЬКО UI, НЕ МЕНЯЕТ ЛОГИКУ) ==========
function initMobileMenu() {
    const isMobile = window.innerWidth < 768;
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const uiPanelMobile = document.getElementById('ui');
    
    if (!mobileBtn || !uiPanelMobile) return;
    
    // Удаляем старый обработчик, вешаем новый
    const newBtn = mobileBtn.cloneNode(true);
    mobileBtn.parentNode.replaceChild(newBtn, mobileBtn);
    
    newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uiPanelMobile.classList.toggle('open');
    });
    
    // Добавляем крестик закрытия ТОЛЬКО на мобилках
    if (isMobile) {
        if (!uiPanelMobile.querySelector('.mobile-close-btn')) {
            const closeDiv = document.createElement('div');
            closeDiv.className = 'mobile-close-btn';
            closeDiv.textContent = '✖ Закрыть';
            closeDiv.addEventListener('click', () => {
                uiPanelMobile.classList.remove('open');
            });
            uiPanelMobile.insertBefore(closeDiv, uiPanelMobile.firstChild);
        }
    } else {
        const existingClose = uiPanelMobile.querySelector('.mobile-close-btn');
        if (existingClose) existingClose.remove();
        // На десктопе также убедимся, что панель не в "open" состоянии
        uiPanelMobile.classList.remove('open');
    }
}

// Запускаем при загрузке и при изменении размера окна
window.addEventListener('DOMContentLoaded', initMobileMenu);
window.addEventListener('resize', () => {
    initMobileMenu();
});