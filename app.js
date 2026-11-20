import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { CASES, COLOR_SCHEMES, CHARTS, STORY_BEATS, getAgeGroup } from "./data/cases.js";

// =========================================================
// CONFIGURAÇÃO ESPACIAL DO CORREDOR
// =========================================================
const DOOR_Z = 100;
const START_OUTSIDE_Z = 108.5;
const CORRIDOR_START_Z = 88; // ~3 anos
const CORRIDOR_END_Z = -12;  // ~75 anos
const EXIT_DOOR_Z = -19;     // porta de saída ao fundo do corredor
const ENTRY_Z = 95.5;        // onde o visitante para logo após atravessar a porta
const MIN_AGE = 3;
const MAX_AGE = 75;
const EYE_HEIGHT = 1.68;

const PHOTO_BY_THEME = {
  infancia: "./assets/photos/narrative-infancia.jpg",
  territorio: "./assets/photos/narrative-territorio.jpg",
  memoria: "./assets/photos/narrative-memoria.jpg"
};

const MODEL_PATHS = {
  M: [
    "./assets/models/base_mesh_246_tri_walking_m_average_v1.glb",
    "./assets/models/base_mesh_246_tri_walking_m_slim_v1.glb",
    "./assets/models/base_mesh_246_tri_walking_m_broad_v1.glb"
  ],
  F: [
    "./assets/models/base_mesh_246_tri_walking_f_athletic_v1.glb",
    "./assets/models/base_mesh_246_tri_walking_f_petite_v1.glb",
    "./assets/models/base_mesh_246_tri_walking_f_curvy_v1.glb"
  ]
};

function ageToZ(age) {
  const t = (age - MIN_AGE) / (MAX_AGE - MIN_AGE);
  return CORRIDOR_START_Z - t * (CORRIDOR_START_Z - CORRIDOR_END_Z);
}

function zToAge(z) {
  const t = (CORRIDOR_START_Z - z) / (CORRIDOR_START_Z - CORRIDOR_END_Z);
  return MIN_AGE + t * (MAX_AGE - MIN_AGE);
}

function getCategoryKey(caseData, schemeId) {
  if (schemeId === "ageGroup") return getAgeGroup(caseData.age);
  return caseData[schemeId];
}

function getCategoryColor(caseData, schemeId) {
  const scheme = COLOR_SCHEMES[schemeId];
  const key = getCategoryKey(caseData, schemeId);
  const found = scheme.categories.find((c) => c.key === key);
  return found ? found.color : "#e6a94b";
}

// =========================================================
// ESTADO GLOBAL DA APLICAÇÃO
// =========================================================
const state = {
  started: false,
  doorOpen: false,
  doorAngle: 0,
  targetDoorAngle: 0,
  exitDoorOpen: false,
  exitDoorAngle: 0,
  targetExitDoorAngle: 0,
  outroVisible: false,
  inTransition: false,
  topdown: false,
  topdownBlend: 0,
  freeExplore: false,
  colorScheme: "circumstance",
  activeFilter: null,
  selectedCaseIndex: -1,
  hoveredCaseId: null,
  currentBeatId: null,

  // Navegação em primeira pessoa
  camX: 0,
  camZ: START_OUTSIDE_Z,
  targetCamX: 0,
  targetCamZ: START_OUTSIDE_Z,
  yaw: 0,
  targetYaw: 0,
  pitch: 0.02,
  targetPitch: 0.02,

  // Input
  keys: {},
  mobMoveDir: 0,
  isDragging: false,
  pointerDownX: 0,
  pointerDownY: 0,
  lastPointerX: 0,
  lastPointerY: 0,
  pointerMoved: false,

  // Áudio
  audioEnabled: false
};

// =========================================================
// REFERÊNCIAS DO DOM
// =========================================================
const dom = {
  doorTransition: document.getElementById("door-transition"),
  doorTransitionText: document.getElementById("door-transition-text"),
  introScreen: document.getElementById("intro-screen"),
  btnEnterMemorial: document.getElementById("btn-enter-memorial"),
  btnIntroList: document.getElementById("btn-intro-list"),
  outroScreen: document.getElementById("outro-screen"),
  btnOutroBack: document.getElementById("btn-outro-back"),
  btnOutroRestart: document.getElementById("btn-outro-restart"),
  btnOutroCases: document.getElementById("btn-outro-cases"),
  sceneContainer: document.getElementById("scene-container"),
  hoverTooltip: document.getElementById("hover-tooltip"),
  tooltipName: document.getElementById("tooltip-name"),
  tooltipMeta: document.getElementById("tooltip-meta"),
  doorPrompt: document.getElementById("door-prompt"),
  btnOpenDoor: document.getElementById("btn-open-door"),
  exitDoorPrompt: document.getElementById("exit-door-prompt"),
  btnOpenExitDoor: document.getElementById("btn-open-exit-door"),
  hudTop: document.getElementById("hud-top"),
  hudFilterCard: document.getElementById("hud-filter-card"),
  btnMobFilters: document.getElementById("btn-mob-filters"),
  btnReturnStart: document.getElementById("btn-return-start"),
  colorSelect: document.getElementById("color-scheme-select"),
  distributionBar: document.getElementById("distribution-bar"),
  legendList: document.getElementById("legend-list"),
  agePill: document.getElementById("age-pill"),
  agePillLabel: document.getElementById("age-pill-label"),
  agePillValue: document.getElementById("age-pill-value"),
  btnCases: document.getElementById("btn-cases"),
  hudAudioPill: document.getElementById("hud-audio-pill"),
  btnAudio: document.getElementById("btn-audio"),
  btnAudioLabel: document.getElementById("btn-audio-label"),
  audioMuteLine: document.getElementById("audio-mute-line"),
  audioMuteLine2: document.getElementById("audio-mute-line-2"),
  audioVolume: document.getElementById("audio-volume"),
  audioVolLabel: document.getElementById("audio-vol-label"),
  btnAbout: document.getElementById("btn-about"),
  narrativePanel: document.getElementById("narrative-panel"),
  narrativeBadge: document.getElementById("narrative-badge"),
  narrativeBody: document.getElementById("narrative-body"),
  narrativeMediaWrap: document.getElementById("narrative-media-wrap"),
  narrativePhoto: document.getElementById("narrative-photo"),
  narrativePhotoCaption: document.getElementById("narrative-photo-caption"),
  narrativeChartWrap: document.getElementById("narrative-chart-wrap"),
  narrativeText: document.getElementById("narrative-text"),
  narrativeHint: document.getElementById("narrative-hint"),
  btnFreeExplore: document.getElementById("btn-free-explore"),
  minimapWrapper: document.getElementById("minimap-wrapper"),
  minimapCanvas: document.getElementById("minimap-canvas"),
  btnToggleTopdown: document.getElementById("btn-toggle-topdown"),
  mobileNavControls: document.getElementById("mobile-nav-controls"),
  btnMobForward: document.getElementById("btn-mob-forward"),
  btnMobBack: document.getElementById("btn-mob-back"),
  btnMobMap: document.getElementById("btn-mob-map"),
  topdownBanner: document.getElementById("topdown-banner"),
  btnExitTopdown: document.getElementById("btn-exit-topdown"),
  personDrawer: document.getElementById("person-drawer"),
  btnClosePerson: document.getElementById("btn-close-person"),
  personPhoto: document.getElementById("person-photo"),
  personAgeBadge: document.getElementById("person-age-badge"),
  personDateBadge: document.getElementById("person-date-badge"),
  personCircumstancePill: document.getElementById("person-circumstance-pill"),
  personName: document.getElementById("person-name"),
  personLocation: document.getElementById("person-location"),
  personRegion: document.getElementById("person-region"),
  personLocationType: document.getElementById("person-location-type"),
  personSummary: document.getElementById("person-summary"),
  personContext: document.getElementById("person-context"),
  personSourceText: document.getElementById("person-source-text"),
  btnPrevCase: document.getElementById("btn-prev-case"),
  btnNextCase: document.getElementById("btn-next-case"),
  personCounter: document.getElementById("person-counter"),
  casesDrawer: document.getElementById("cases-drawer"),
  btnCloseCases: document.getElementById("btn-close-cases"),
  casesSearch: document.getElementById("cases-search"),
  casesList: document.getElementById("cases-list"),
  aboutDrawer: document.getElementById("about-drawer"),
  btnCloseAbout: document.getElementById("btn-close-about")
};

// =========================================================
// SOM AMBIENTE: MILTON NASCIMENTO ("FRANCISCO") ATÉ 3:45 COM TRANSIÇÃO CONTÍNUA
// =========================================================
const MUSIC_SRC = "./assets/music/Milton%20Nascimento%20_Francisco_.mp3";
const MUSIC_MAX_TIME = 224.8; // Recorte em 3:45 (com margem segura antes do fim do arquivo)
const CROSSFADE_DURATION = 5.0; // Transição abaixando suavemente e retornando ao início

let musicTracks = null;
let activeTrackIdx = 0;
let isCrossfading = false;
let userVolumePct = 20; // Sempre baixo por padrão (20%)
let currentGainFactor = 0;

function getTargetAmbientVolume() {
  // Mapeia 0..100% do controle para um volume ambiente suave (máx 0.55 para nunca ficar estridente)
  return Math.pow(userVolumePct / 100, 1.35) * 0.55;
}

function initMusicTracks() {
  if (musicTracks) return;
  const a = new Audio(MUSIC_SRC);
  const b = new Audio(MUSIC_SRC);
  [a, b].forEach((el) => {
    el.preload = "auto";
    el.loop = false;
    el.volume = 0;
  });
  musicTracks = [a, b];
}

function syncAudioUI() {
  const playing = state.audioEnabled && userVolumePct > 0;
  if (dom.hudAudioPill) dom.hudAudioPill.classList.toggle("playing", playing);
  if (dom.btnAudio) dom.btnAudio.setAttribute("aria-pressed", String(playing));
  if (dom.btnAudioLabel) {
    dom.btnAudioLabel.textContent = playing ? "Ligado" : "Pausado";
  }
  if (dom.audioMuteLine) dom.audioMuteLine.style.display = playing ? "none" : "block";
  if (dom.audioMuteLine2) dom.audioMuteLine2.style.display = playing ? "none" : "block";
  if (dom.audioVolLabel) dom.audioVolLabel.textContent = `${userVolumePct}%`;
  if (dom.audioVolume && Number(dom.audioVolume.value) !== userVolumePct) {
    dom.audioVolume.value = String(userVolumePct);
  }
}

function startAmbientMusic() {
  initMusicTracks();
  if (state.audioEnabled) return;
  if (userVolumePct === 0) userVolumePct = 20;
  state.audioEnabled = true;
  const active = musicTracks[activeTrackIdx];
  if (active.currentTime >= MUSIC_MAX_TIME - 0.5) active.currentTime = 0;
  active.play().catch(() => {
    state.audioEnabled = false;
    syncAudioUI();
  });
  syncAudioUI();
}

function toggleAudio() {
  initMusicTracks();
  if (!state.audioEnabled) {
    startAmbientMusic();
  } else {
    state.audioEnabled = false;
    isCrossfading = false;
    musicTracks.forEach((t) => t.pause());
    currentGainFactor = 0;
    syncAudioUI();
  }
}

function setMusicVolumeFromSlider(pct) {
  userVolumePct = Math.max(0, Math.min(100, Number(pct) || 0));
  initMusicTracks();
  if (userVolumePct > 0 && !state.audioEnabled) {
    startAmbientMusic();
  } else if (userVolumePct === 0 && state.audioEnabled) {
    musicTracks.forEach((t) => {
      t.volume = 0;
    });
  }
  syncAudioUI();
}

function updateMusicLoop(dt) {
  if (!musicTracks || !state.audioEnabled) return;

  const targetVol = getTargetAmbientVolume();
  currentGainFactor += (1 - currentGainFactor) * Math.min(1, dt * 2.2);
  const baseVol = targetVol * currentGainFactor;

  const active = musicTracks[activeTrackIdx];
  const nextIdx = 1 - activeTrackIdx;
  const standby = musicTracks[nextIdx];
  const t = active.currentTime || 0;

  // Inicia a transição contínua antes dos exatos 4:00 (240s)
  if (!isCrossfading && t >= MUSIC_MAX_TIME - CROSSFADE_DURATION && t < MUSIC_MAX_TIME) {
    isCrossfading = true;
    standby.currentTime = 0;
    standby.volume = 0;
    standby.play().catch(() => {});
  }

  if (isCrossfading) {
    const remaining = Math.max(0, MUSIC_MAX_TIME - t);
    const alpha = 1 - Math.min(1, Math.max(0, remaining / CROSSFADE_DURATION));
    active.volume = Math.max(0, Math.min(1, baseVol * (1 - alpha)));
    standby.volume = Math.max(0, Math.min(1, baseVol * alpha));

    if (t >= MUSIC_MAX_TIME || active.paused || active.ended) {
      active.pause();
      active.currentTime = 0;
      active.volume = 0;
      standby.volume = Math.max(0, Math.min(1, baseVol));
      activeTrackIdx = nextIdx;
      isCrossfading = false;
    }
  } else {
    if (t >= MUSIC_MAX_TIME) {
      active.currentTime = 0;
      active.play().catch(() => {});
    }
    active.volume = Math.max(0, Math.min(1, baseVol));
  }
}

function playChime() {
  // Mantido silencioso para preservar apenas a música ambiente de Milton Nascimento
}

// =========================================================
// CENA THREE.JS
// =========================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color("#0b0d11");
scene.fog = new THREE.FogExp2("#0b0d11", 0.0175);

const initialAspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(initialAspect < 1 ? 68 : 58, initialAspect, 0.1, 240);
camera.position.set(0, EYE_HEIGHT, START_OUTSIDE_Z);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 900 ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
dom.sceneContainer.appendChild(renderer.domElement);

// Iluminação editorial solene
const hemiLight = new THREE.HemisphereLight("#8fa8c8", "#181412", 0.72);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight("#ffe4be", 1.1);
dirLight.position.set(12, 26, 65);
scene.add(dirLight);

const doorSpot = new THREE.PointLight("#e6a94b", 18, 22, 1.5);
doorSpot.position.set(0, 4.4, DOOR_Z + 3.2);
scene.add(doorSpot);

const endGlowLight = new THREE.PointLight("#e6a94b", 28, 45, 1.4);
endGlowLight.position.set(0, 5.5, CORRIDOR_END_Z - 6);
scene.add(endGlowLight);

// =========================================================
// ARQUITETURA: CHÃO, MARCADORES DE IDADE, COLUNATA E PORTA ÚNICA
// =========================================================
const floorGeo = new THREE.PlaneGeometry(42, 160);
const floorMat = new THREE.MeshStandardMaterial({
  color: "#10131a",
  roughness: 0.78,
  metalness: 0.15
});
const floorMesh = new THREE.Mesh(floorGeo, floorMat);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.position.set(0, 0, 52);
floorMesh.name = "corridor-floor";
scene.add(floorMesh);

// Trilha central sutil no chão
const pathGeo = new THREE.PlaneGeometry(3.2, 130);
const pathMat = new THREE.MeshStandardMaterial({
  color: "#151923",
  roughness: 0.65,
  metalness: 0.2
});
const pathMesh = new THREE.Mesh(pathGeo, pathMat);
pathMesh.rotation.x = -Math.PI / 2;
pathMesh.position.set(0, 0.006, 52);
scene.add(pathMesh);

// Helper para criar placas de texto em canvas
function makeTextTexture(text, { width = 512, height = 128, font = "600 42px Inter, sans-serif", color = "#f4f0e8", bg = null } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Linhas de idade no chão
const ageMarks = [5, 10, 20, 30, 40, 50, 60, 70];
const lineMat = new THREE.MeshBasicMaterial({ color: "#e6a94b", transparent: true, opacity: 0.18 });
ageMarks.forEach((age) => {
  const z = ageToZ(age);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(24, 0.045), lineMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 0.01, z);
  scene.add(strip);

  const tex = makeTextTexture(`${age} ANOS`, {
    width: 320,
    height: 80,
    font: "500 32px 'JetBrains Mono', monospace",
    color: "rgba(230, 169, 75, 0.65)"
  });
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.6),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.014, z + 0.55);
  scene.add(label);
});

// Colunata lateral solene com fendas de luz âmbar
const pillarGeo = new THREE.BoxGeometry(0.9, 9.5, 0.9);
const pillarMat = new THREE.MeshStandardMaterial({ color: "#151821", roughness: 0.85, metalness: 0.12 });
const sconceGeo = new THREE.BoxGeometry(0.08, 2.2, 0.08);
const sconceMat = new THREE.MeshBasicMaterial({ color: "#e6a94b" });

for (let z = 88; z >= -14; z -= 14) {
  [-13.5, 13.5].forEach((x) => {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(x, 4.75, z);
    scene.add(pillar);

    const sconce = new THREE.Mesh(sconceGeo, sconceMat);
    sconce.position.set(x > 0 ? x - 0.47 : x + 0.47, 3.2, z);
    scene.add(sconce);
  });
}

// =========================================================
// PORTA DE SAÍDA AO FUNDO DO MEMORIAL (Z = EXIT_DOOR_Z)
// =========================================================
const exitFacadeGroup = new THREE.Group();
exitFacadeGroup.position.set(0, 0, EXIT_DOOR_Z);
scene.add(exitFacadeGroup);

const exitWallMat = new THREE.MeshStandardMaterial({
  color: "#15161d",
  roughness: 0.86,
  metalness: 0.16
});

const exitLeftWall = new THREE.Mesh(new THREE.BoxGeometry(15, 10, 0.9), exitWallMat);
exitLeftWall.position.set(-8.9, 5, 0);
exitFacadeGroup.add(exitLeftWall);

const exitRightWall = new THREE.Mesh(new THREE.BoxGeometry(15, 10, 0.9), exitWallMat);
exitRightWall.position.set(8.9, 5, 0);
exitFacadeGroup.add(exitRightWall);

const exitTopWall = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.4, 0.9), exitWallMat);
exitTopWall.position.set(0, 7.3, 0);
exitFacadeGroup.add(exitTopWall);

// Luz dourada que brilha por trás da porta de saída
const exitBackdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(3.4, 5.0),
  new THREE.MeshBasicMaterial({ color: "#e6a94b", transparent: true, opacity: 0.28 })
);
exitBackdrop.position.set(0, 2.4, -0.6);
exitFacadeGroup.add(exitBackdrop);

const exitFrameMat = new THREE.MeshStandardMaterial({ color: "#4d3e2b", roughness: 0.4, metalness: 0.72 });
const exitFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.7, 1.04), exitFrameMat);
exitFrameL.position.set(-1.44, 2.35, 0);
exitFacadeGroup.add(exitFrameL);

const exitFrameR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.7, 1.04), exitFrameMat);
exitFrameR.position.set(1.44, 2.35, 0);
exitFacadeGroup.add(exitFrameR);

const exitFrameT = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.16, 1.04), exitFrameMat);
exitFrameT.position.set(0, 4.66, 0);
exitFacadeGroup.add(exitFrameT);

const exitThreshold = new THREE.Mesh(
  new THREE.PlaneGeometry(2.7, 0.14),
  new THREE.MeshBasicMaterial({ color: "#e6a94b", transparent: true, opacity: 0.85 })
);
exitThreshold.rotation.x = -Math.PI / 2;
exitThreshold.position.set(0, 0.015, 0.65);
exitFacadeGroup.add(exitThreshold);

const exitSignTex = makeTextTexture("SAÍDA · MEMÓRIA E FUTURO", {
  width: 1024,
  height: 140,
  font: "600 40px Fraunces, Georgia, serif",
  color: "#f4f0e8"
});
const exitSignMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(6.2, 0.88),
  new THREE.MeshBasicMaterial({ map: exitSignTex, transparent: true })
);
exitSignMesh.position.set(0, 5.45, 0.48);
exitFacadeGroup.add(exitSignMesh);

const exitDoorPivot = new THREE.Group();
exitDoorPivot.position.set(-1.36, 0, 0.25);
exitFacadeGroup.add(exitDoorPivot);

const exitDoorPanel = new THREE.Mesh(
  new THREE.BoxGeometry(2.72, 4.56, 0.14),
  new THREE.MeshStandardMaterial({ color: "#211d1a", roughness: 0.48, metalness: 0.5 })
);
exitDoorPanel.position.set(1.36, 2.28, 0);
exitDoorPanel.userData = { isExitDoor: true };
exitDoorPivot.add(exitDoorPanel);

const exitDoorHandle = new THREE.Mesh(
  new THREE.CylinderGeometry(0.032, 0.032, 0.65, 16),
  new THREE.MeshStandardMaterial({
    color: "#e6a94b",
    emissive: "#a06a1e",
    emissiveIntensity: 0.65,
    roughness: 0.3,
    metalness: 0.8
  })
);
exitDoorHandle.position.set(2.38, 1.35, 0.14);
exitDoorHandle.userData = { isExitDoor: true };
exitDoorPivot.add(exitDoorHandle);

// =========================================================
// CONCEITO INICIAL AUTORAL: FACHADA MONOLÍTICA COM PORTA ÚNICA
// =========================================================
const facadeGroup = new THREE.Group();
facadeGroup.position.set(0, 0, DOOR_Z);
scene.add(facadeGroup);

const wallMat = new THREE.MeshStandardMaterial({
  color: "#14171f",
  roughness: 0.88,
  metalness: 0.14
});

// Paredes esquerda, direita e lintel superior ao redor da porta única (abertura 2.8m x 4.6m)
const leftWall = new THREE.Mesh(new THREE.BoxGeometry(15, 10, 0.9), wallMat);
leftWall.position.set(-8.9, 5, 0);
facadeGroup.add(leftWall);

const rightWall = new THREE.Mesh(new THREE.BoxGeometry(15, 10, 0.9), wallMat);
rightWall.position.set(8.9, 5, 0);
facadeGroup.add(rightWall);

const topWall = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.4, 0.9), wallMat);
topWall.position.set(0, 7.3, 0);
facadeGroup.add(topWall);

// Moldura metálica bronze/âmbar em volta da porta única
const frameMat = new THREE.MeshStandardMaterial({ color: "#3d3328", roughness: 0.45, metalness: 0.7 });
const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.7, 1.04), frameMat);
frameLeft.position.set(-1.44, 2.35, 0);
facadeGroup.add(frameLeft);

const frameRight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.7, 1.04), frameMat);
frameRight.position.set(1.44, 2.35, 0);
facadeGroup.add(frameRight);

const frameTop = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.16, 1.04), frameMat);
frameTop.position.set(0, 4.66, 0);
facadeGroup.add(frameTop);

// Fendas verticais de luz quente flanqueando a entrada
const lightSlitMat = new THREE.MeshBasicMaterial({ color: "#e6a94b" });
[-3.2, 3.2].forEach((x) => {
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 6.4, 0.08), lightSlitMat);
  slit.position.set(x, 3.2, 0.46);
  facadeGroup.add(slit);
});

// Filete luminoso na soleira da porta
const thresholdLight = new THREE.Mesh(
  new THREE.PlaneGeometry(2.7, 0.12),
  new THREE.MeshBasicMaterial({ color: "#e6a94b", transparent: true, opacity: 0.75 })
);
thresholdLight.rotation.x = -Math.PI / 2;
thresholdLight.position.set(0, 0.015, 0.65);
facadeGroup.add(thresholdLight);

// Inscrição arquitetônica acima da porta única
const signTex = makeTextTexture("VIDAS INTERROMPIDAS · RIO", {
  width: 1024,
  height: 160,
  font: "600 44px Fraunces, Georgia, serif",
  color: "#f4f0e8"
});
const signMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(6.8, 1.06),
  new THREE.MeshBasicMaterial({ map: signTex, transparent: true })
);
signMesh.position.set(0, 5.75, 0.48);
facadeGroup.add(signMesh);

const subSignTex = makeTextTexture(`MEMORIAL INTERATIVO · ${CASES.length} HISTÓRIAS CATALOGADAS`, {
  width: 1024,
  height: 96,
  font: "500 24px 'JetBrains Mono', monospace",
  color: "#e6a94b"
});
const subSignMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(6.2, 0.58),
  new THREE.MeshBasicMaterial({ map: subSignTex, transparent: true })
);
subSignMesh.position.set(0, 5.15, 0.48);
facadeGroup.add(subSignMesh);

// A PORTA ÚNICA (pivô na dobradiça esquerda)
const doorPivot = new THREE.Group();
doorPivot.position.set(-1.36, 0, 0.25);
facadeGroup.add(doorPivot);

const doorMat = new THREE.MeshStandardMaterial({
  color: "#1d1a19",
  roughness: 0.52,
  metalness: 0.45
});
const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(2.72, 4.56, 0.14), doorMat);
doorPanel.position.set(1.36, 2.28, 0);
doorPanel.userData = { isDoor: true };
doorPivot.add(doorPanel);

// Detalhe vertical em bronze na folha da porta
const doorAccent = new THREE.Mesh(
  new THREE.BoxGeometry(0.05, 3.4, 0.17),
  new THREE.MeshStandardMaterial({ color: "#b6823a", roughness: 0.35, metalness: 0.75 })
);
doorAccent.position.set(2.24, 2.28, 0);
doorAccent.userData = { isDoor: true };
doorPivot.add(doorAccent);

// Maçaneta luminosa quente
const doorHandle = new THREE.Mesh(
  new THREE.CylinderGeometry(0.032, 0.032, 0.65, 16),
  new THREE.MeshStandardMaterial({
    color: "#e6a94b",
    emissive: "#8a5a18",
    emissiveIntensity: 0.55,
    roughness: 0.3,
    metalness: 0.8
  })
);
doorHandle.position.set(2.38, 1.35, 0.14);
doorHandle.userData = { isDoor: true };
doorPivot.add(doorHandle);

// =========================================================
// PARTÍCULAS FLUTUANTES (BRASAS / LUZ DE VELA)
// =========================================================
const particleCount = 260;
const pPositions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  pPositions[i * 3] = (Math.random() - 0.5) * 24;
  pPositions[i * 3 + 1] = 0.3 + Math.random() * 7.5;
  pPositions[i * 3 + 2] = CORRIDOR_END_Z - 4 + Math.random() * 124;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
const pMat = new THREE.PointsMaterial({
  color: "#e6a94b",
  size: 0.075,
  transparent: true,
  opacity: 0.42
});
const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

// =========================================================
// PESSOAS 3D (26 CASOS DOCUMENTADOS + SILHUETAS DE ESCALA)
// =========================================================
const personEntries = [];
const clickableMeshes = [doorPanel, doorAccent, doorHandle, exitDoorPanel, exitDoorHandle];
const bgSilhouettes = [];
const mixers = [];

// Construtor de figura humana procedural (fallback garantido)
function buildProceduralPerson(material, heightScale = 1) {
  const g = new THREE.Group();
  const legGeo = new THREE.CylinderGeometry(0.08, 0.065, 0.84, 10);
  const leftLeg = new THREE.Mesh(legGeo, material);
  leftLeg.position.set(-0.11, 0.42, 0);
  const rightLeg = new THREE.Mesh(legGeo, material);
  rightLeg.position.set(0.11, 0.42, 0);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.62, 12), material);
  torso.position.set(0, 1.12, 0);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 12), material);
  head.position.set(0, 1.58, 0);

  const armGeo = new THREE.CylinderGeometry(0.05, 0.045, 0.58, 8);
  const leftArm = new THREE.Mesh(armGeo, material);
  leftArm.position.set(-0.24, 1.1, 0);
  leftArm.rotation.z = 0.08;
  const rightArm = new THREE.Mesh(armGeo, material);
  rightArm.position.set(0.24, 1.1, 0);
  rightArm.rotation.z = -0.08;

  g.add(leftLeg, rightLeg, torso, head, leftArm, rightArm);
  g.scale.setScalar(heightScale);
  return g;
}

function makeNameSprite(name, age) {
  // Primeiro + último nome (evita "Heloísa dos")
  const parts = name.split(" ").filter(Boolean);
  const shortName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : name;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "rgba(11, 13, 17, 0.86)";
  ctx.strokeStyle = "rgba(230, 169, 75, 0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(18, 16, 476, 96, 18);
  ctx.fill();
  ctx.stroke();

  ctx.font = "600 30px Fraunces, Georgia, serif";
  ctx.fillStyle = "#f4f0e8";
  ctx.textAlign = "center";
  ctx.fillText(shortName, 256, 56);

  ctx.font = "500 22px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#e6a94b";
  ctx.fillText(`${age} anos`, 256, 92);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.5, 0.375, 1);
  sprite.renderOrder = 10;
  return sprite;
}

// Altura aproximada (em metros) por idade e gênero · curva de crescimento simplificada
const HEIGHT_TABLE = [
  // idade, masculino, feminino
  [2, 0.88, 0.86],
  [3, 0.96, 0.95],
  [5, 1.10, 1.09],
  [8, 1.28, 1.27],
  [10, 1.39, 1.39],
  [12, 1.50, 1.52],
  [14, 1.63, 1.59],
  [16, 1.71, 1.62],
  [18, 1.75, 1.63],
  [60, 1.74, 1.62],
  [80, 1.70, 1.58]
];

function getBodyHeight(age, gender) {
  const col = gender === "F" ? 2 : 1;
  if (age <= HEIGHT_TABLE[0][0]) return HEIGHT_TABLE[0][col];
  for (let i = 1; i < HEIGHT_TABLE.length; i++) {
    const [a1] = HEIGHT_TABLE[i];
    if (age <= a1) {
      const [a0] = HEIGHT_TABLE[i - 1];
      const t = (age - a0) / (a1 - a0);
      return HEIGHT_TABLE[i - 1][col] + t * (HEIGHT_TABLE[i][col] - HEIGHT_TABLE[i - 1][col]);
    }
  }
  return HEIGHT_TABLE[HEIGHT_TABLE.length - 1][col];
}

// Fator relativo a um adulto padrão (usado para hitbox, rótulos e silhuetas)
function getHeightScaleForAge(age, gender = "M") {
  return getBodyHeight(age, gender) / 1.72;
}

// Crianças têm a cabeça proporcionalmente maior e o corpo mais estreito
function getHeadScaleForAge(age) {
  if (age >= 16) return 1;
  return 1 + Math.min(0.42, (16 - age) * 0.032);
}

function getWidthFactorForAge(age) {
  if (age <= 12) return 0.9;
  if (age <= 16) return 0.95;
  if (age >= 65) return 1.04;
  return 1;
}

// Escolhe o tipo de corpo do modelo conforme idade e gênero
// M: [average, slim, broad] · F: [athletic, petite, curvy]
function pickModelIndex(caseData, index, poolLength) {
  if (poolLength <= 1) return 0;
  const { age, gender } = caseData;
  let preferred;
  if (age <= 16) preferred = 1; // slim / petite
  else if (age >= 50) preferred = gender === "F" ? 2 : 0; // curvy / average
  else preferred = index % 3;
  return Math.min(preferred, poolLength - 1);
}

// Velocidade de caminhada (m/s) por idade
function getWalkSpeed(age) {
  if (age <= 6) return 0.55;
  if (age <= 14) return 0.75;
  if (age >= 65) return 0.5;
  if (age >= 50) return 0.65;
  return 0.85;
}

// Seed determinística por índice (layout estável a cada recarga)
function seeded(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Posição Z pela idade (com afastamento entre pessoas da mesma idade) e trilha de caminhada em X
const sameAgeCounter = {};
function computeCasePosition(caseData, index) {
  const order = (sameAgeCounter[caseData.age] = (sameAgeCounter[caseData.age] || 0) + 1) - 1;
  const zJitter = order === 0 ? 0 : (order % 2 === 1 ? -1 : 1) * Math.ceil(order / 2) * 0.75;
  const z = ageToZ(caseData.age) + zJitter;

  const side = index % 2 === 0 ? -1 : 1;
  const span = 3 + seeded(index) * 3.5;               // comprimento da trilha (3 a 6.5 m)
  const inner = 1.8 + seeded(index + 50) * 3;         // começa fora do corredor central
  const minAbs = inner;
  const maxAbs = Math.min(11, inner + span);
  const minX = side > 0 ? minAbs : -maxAbs;
  const maxX = side > 0 ? maxAbs : -minAbs;
  const x = minX + seeded(index + 99) * (maxX - minX);
  return { x, z, minX, maxX };
}

async function loadAllModels() {
  const loader = new GLTFLoader();
  const loaded = { M: [], F: [] };

  const loadOne = (url) =>
    new Promise((resolve) => {
      loader.load(
        url,
        (gltf) => resolve(gltf),
        undefined,
        () => resolve(null)
      );
    });

  for (const gender of ["M", "F"]) {
    const results = await Promise.all(MODEL_PATHS[gender].map(loadOne));
    loaded[gender] = results.filter(Boolean);
    // Mede cada modelo uma única vez para normalizar a altura
    loaded[gender].forEach((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(gltf.scene, true);
      let height = box.max.y - box.min.y;
      let minY = box.min.y;
      if (!Number.isFinite(height) || height < 0.01 || height > 1000) {
        height = 7.4;
        minY = 0;
      }
      gltf.userData.__norm = { factor: 1.72 / height, minY };
    });
  }
  return loaded;
}

function populatePeople(loadedModels) {
  // 1. Casos reais documentados
  CASES.forEach((caseData, index) => {
    const { x, z, minX, maxX } = computeCasePosition(caseData, index);
    const colorHex = getCategoryColor(caseData, state.colorScheme);
    const bodyHeight = getBodyHeight(caseData.age, caseData.gender);
    const heightScale = bodyHeight / 1.72;
    const widthFactor = getWidthFactorForAge(caseData.age);

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const personMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      emissive: new THREE.Color(colorHex),
      emissiveIntensity: 0.24,
      roughness: 0.55,
      metalness: 0.15
    });

    const pool = loadedModels[caseData.gender] || [];
    let bodyObj;
    let walkAction = null;
    let idleAction = null;
    let headBone = null;

    if (pool.length > 0) {
      const gltf = pool[pickModelIndex(caseData, index, pool.length)];
      const model = SkeletonUtils.clone(gltf.scene);
      model.traverse((child) => {
        if (child.isMesh) {
          child.material = personMat;
          child.frustumCulled = false;
          child.userData = { caseIndex: index, caseId: caseData.id };
        }
        if (child.isBone && /006_06$/.test(child.name)) headBone = child;
      });

      // Normaliza a escala do GLB (~7.4 unidades) para a altura real por idade e gênero
      const norm = gltf.userData.__norm;
      const s = (bodyHeight / 1.72) * norm.factor;
      bodyObj = new THREE.Group();
      model.position.y = -norm.minY;
      bodyObj.add(model);
      bodyObj.scale.set(s * widthFactor, s, s * widthFactor);

      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        const walkClip = gltf.animations.find((a) => /walk/i.test(a.name)) || gltf.animations[0];
        const idleClip = gltf.animations.find((a) => /idle/i.test(a.name)) || walkClip;
        walkAction = mixer.clipAction(walkClip);
        idleAction = mixer.clipAction(idleClip);
        const speedRatio = getWalkSpeed(caseData.age) / 0.85;
        walkAction.timeScale = speedRatio / Math.max(0.55, heightScale);
        walkAction.time = seeded(index + 7) * walkClip.duration;
        idleAction.time = seeded(index + 13) * idleClip.duration;
        walkAction.play();
        idleAction.play();
        walkAction.setEffectiveWeight(1);
        idleAction.setEffectiveWeight(0);
        mixers.push(mixer);
      }
    } else {
      bodyObj = buildProceduralPerson(personMat, heightScale);
      bodyObj.scale.x *= widthFactor;
      bodyObj.scale.z *= widthFactor;
    }

    group.add(bodyObj);

    // Anel luminoso no chão (identifica que é um caso clicável)
    const ringGeo = new THREE.RingGeometry(0.42, 0.54, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.78
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);

    // Hitbox invisível para clique fácil
    const hitbox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.58, Math.max(1.2, bodyHeight + 0.2), 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.y = Math.max(1.2, bodyHeight + 0.2) / 2;
    hitbox.userData = { caseIndex: index, caseId: caseData.id };
    group.add(hitbox);
    clickableMeshes.push(hitbox);

    // Etiqueta flutuante com nome e idade
    const sprite = makeNameSprite(caseData.name, caseData.age);
    sprite.position.set(0, bodyHeight + 0.42, 0);
    group.add(sprite);

    scene.add(group);

    const dir = seeded(index + 3) > 0.5 ? 1 : -1;
    personEntries.push({
      index,
      caseData,
      group,
      material: personMat,
      ring,
      ringMat,
      sprite,
      x,
      z,
      minX,
      maxX,
      dir,
      speed: getWalkSpeed(caseData.age),
      heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      walkWeight: 1,
      walkAction,
      idleAction,
      headBone,
      headScale: getHeadScaleForAge(caseData.age),
      pauseTimer: 1 + seeded(index + 21) * 5
    });
  });

  // 2. Silhuetas de fundo (escala da violência armada) também em caminhada lenta
  const bgMat = new THREE.MeshStandardMaterial({
    color: "#232834",
    roughness: 0.9,
    metalness: 0.05,
    transparent: true,
    opacity: 0.55
  });

  for (let i = 0; i < 84; i++) {
    const age = MIN_AGE + seeded(i + 201) * (MAX_AGE - MIN_AGE);
    const z = ageToZ(age);
    const side = i % 2 === 0 ? -1 : 1;
    const minAbs = 3.2 + seeded(i + 301) * 3.0;
    const maxAbs = Math.min(12.2, minAbs + 2.5 + seeded(i + 401) * 3.5);
    const minX = side > 0 ? minAbs : -maxAbs;
    const maxX = side > 0 ? maxAbs : -minAbs;
    const x = minX + seeded(i + 501) * (maxX - minX);
    const gender = i % 2 === 0 ? "F" : "M";
    const scale = getHeightScaleForAge(age, gender) * (0.94 + seeded(i + 601) * 0.1);
    const dir = seeded(i + 701) > 0.5 ? 1 : -1;

    const mesh = buildProceduralPerson(bgMat, scale);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(mesh);
    bgSilhouettes.push({
      mesh,
      x,
      z,
      minX,
      maxX,
      dir,
      speed: getWalkSpeed(age) * 0.65
    });
  }
}

// =========================================================
// CONTROLES DE COR, LEGENDA E FILTROS
// =========================================================
function updateColorsAndLegend() {
  const scheme = COLOR_SCHEMES[state.colorScheme];
  const counts = {};
  scheme.categories.forEach((c) => (counts[c.key] = 0));

  CASES.forEach((c) => {
    const key = getCategoryKey(c, state.colorScheme);
    if (counts[key] !== undefined) counts[key]++;
  });

  // Barra proporcional
  dom.distributionBar.innerHTML = "";
  scheme.categories.forEach((cat) => {
    const pct = (counts[cat.key] / CASES.length) * 100;
    const seg = document.createElement("div");
    seg.className = "dist-seg";
    seg.style.width = `${pct}%`;
    seg.style.background = cat.color;
    seg.style.opacity = state.activeFilter && state.activeFilter !== cat.key ? "0.25" : "1";
    seg.title = `${cat.label}: ${counts[cat.key]} casos`;
    dom.distributionBar.appendChild(seg);
  });

  // Chips de legenda clicáveis
  dom.legendList.innerHTML = "";
  scheme.categories.forEach((cat) => {
    const chip = document.createElement("button");
    chip.className = "legend-chip";
    if (state.activeFilter === cat.key) chip.classList.add("active");
    if (state.activeFilter && state.activeFilter !== cat.key) chip.classList.add("dimmed");
    chip.innerHTML = `
      <span class="legend-dot" style="background:${cat.color}"></span>
      <span>${cat.label}</span>
      <span class="legend-count">${counts[cat.key]}</span>
    `;
    chip.addEventListener("click", () => {
      state.activeFilter = state.activeFilter === cat.key ? null : cat.key;
      updateColorsAndLegend();
    });
    dom.legendList.appendChild(chip);
  });

  // Atualizar cores dos 26 bonecos 3D
  personEntries.forEach((entry) => {
    const key = getCategoryKey(entry.caseData, state.colorScheme);
    const hex = getCategoryColor(entry.caseData, state.colorScheme);
    const isDimmed = state.activeFilter && state.activeFilter !== key;
    const isSelected = state.selectedCaseIndex === entry.index;

    entry.material.color.set(isDimmed ? "#2b303c" : hex);
    entry.material.emissive.set(isDimmed ? "#0d1016" : hex);
    entry.material.emissiveIntensity = isSelected ? 0.65 : isDimmed ? 0.05 : 0.24;

    entry.ringMat.color.set(isDimmed ? "#303644" : hex);
    entry.ringMat.opacity = isSelected ? 1.0 : isDimmed ? 0.16 : 0.78;
  });

  renderCasesList(dom.casesSearch.value);
}

// =========================================================
// GRÁFICOS SVG INLINE PARA OS MARCOS NARRATIVOS
// =========================================================
function renderInlineChart(chartKey) {
  const cfg = CHARTS[chartKey];
  if (!cfg) {
    dom.narrativeChartWrap.classList.add("hidden");
    return;
  }

  const w = 480;
  const h = 118;
  const padL = 28;
  const padR = 14;
  const padT = 14;
  const padB = 22;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const allVals = cfg.series.flatMap((s) => s.values);
  const maxVal = Math.max(...allVals, 10);
  const isBar = cfg.series.length === 1;

  let svgContent = "";

  // Linhas horizontais de grade
  for (let i = 0; i <= 2; i++) {
    const y = padT + (plotH * i) / 2;
    const val = Math.round(maxVal * (1 - i / 2));
    svgContent += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(244,240,232,0.1)" stroke-dasharray="3 3" />`;
    svgContent += `<text x="${padL - 6}" y="${y + 3}" text-anchor="end" fill="#74706a" font-size="9" font-family="JetBrains Mono, monospace">${val}</text>`;
  }

  if (isBar) {
    const s = cfg.series[0];
    const barW = Math.min(38, (plotW / cfg.labels.length) * 0.56);
    cfg.labels.forEach((lbl, idx) => {
      const cx = padL + ((idx + 0.5) / cfg.labels.length) * plotW;
      const barH = (s.values[idx] / maxVal) * plotH;
      const y = padT + plotH - barH;
      svgContent += `<rect x="${cx - barW / 2}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="${s.color}" opacity="0.88" />`;
      svgContent += `<text x="${cx}" y="${y - 4}" text-anchor="middle" fill="#f4f0e8" font-size="9.5" font-family="JetBrains Mono, monospace">${s.values[idx]}%</text>`;
      svgContent += `<text x="${cx}" y="${h - 6}" text-anchor="middle" fill="#a6a095" font-size="9.5" font-family="Inter, sans-serif">${lbl}</text>`;
    });
  } else {
    cfg.labels.forEach((lbl, idx) => {
      const x = padL + (idx / (cfg.labels.length - 1)) * plotW;
      svgContent += `<text x="${x}" y="${h - 6}" text-anchor="middle" fill="#a6a095" font-size="9.5" font-family="JetBrains Mono, monospace">${lbl}</text>`;
    });

    cfg.series.forEach((s) => {
      const pts = s.values.map((v, idx) => {
        const x = padL + (idx / (cfg.labels.length - 1)) * plotW;
        const y = padT + plotH - (v / maxVal) * plotH;
        return { x, y, v };
      });
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      svgContent += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />`;
      pts.forEach((p) => {
        svgContent += `<circle cx="${p.x}" cy="${p.y}" r="3.4" fill="${s.color}" stroke="#0b0d11" stroke-width="1.2" />`;
      });
    });
  }

  const legendHtml = cfg.series
    .map((s) => `<span><i style="background:${s.color}"></i>${s.name}</span>`)
    .join("");

  dom.narrativeChartWrap.innerHTML = `
    <div class="chart-title">${cfg.title}</div>
    <div class="chart-subtitle">${cfg.subtitle}</div>
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="auto" role="img" aria-label="${cfg.title}">
      ${svgContent}
    </svg>
    <div class="chart-legend">${legendHtml}</div>
  `;
  dom.narrativeChartWrap.classList.remove("hidden");
}

// =========================================================
// MOTOR NARRATIVO AO CAMINHAR
// =========================================================
function updateNarrativeForPosition() {
  if (!state.started) return;

  const isOutside = state.camZ > DOOR_Z - 1.5;
  const isNearExit = state.doorOpen && !state.outroVisible && state.camZ < CORRIDOR_END_Z + 4.5;

  dom.doorPrompt.classList.toggle("hidden", !isOutside || state.doorOpen || state.topdown);
  dom.exitDoorPrompt.classList.toggle("hidden", !isNearExit || state.topdown);
  dom.btnReturnStart.classList.toggle("hidden", !state.doorOpen);
  if (dom.agePill) dom.agePill.classList.toggle("hidden", isOutside);

  if (!isOutside) {
    if (isNearExit) {
      dom.agePillLabel.textContent = "LIMIAR FINAL";
      dom.agePillValue.textContent = "Porta de Saída";
    } else {
      const currentAge = Math.max(MIN_AGE, Math.min(MAX_AGE, Math.round(zToAge(state.camZ))));
      dom.agePillLabel.textContent = "FAIXA NO CORREDOR";
      dom.agePillValue.textContent = `${currentAge} anos`;
    }
  }

  const age = isOutside ? -2 : zToAge(state.camZ);
  const beat =
    STORY_BEATS.find((b) => age >= b.ageStart && age < b.ageEnd) ||
    STORY_BEATS[STORY_BEATS.length - 1];

  if (!beat || beat.id === state.currentBeatId) return;
  state.currentBeatId = beat.id;

  dom.narrativeBadge.textContent =
    isOutside ? "A PORTA ÚNICA"
    : beat.ageEnd <= MIN_AGE ? "ENTRADA DO MEMORIAL"
    : `PERCURSO · ${Math.max(MIN_AGE, beat.ageStart)} A ${Math.min(73, beat.ageEnd)} ANOS`;
  dom.narrativeText.innerHTML = beat.text;
  dom.narrativeHint.textContent = beat.hint || "";

  if (beat.photo) {
    dom.narrativePhoto.src = beat.photo;
    dom.narrativePhoto.alt = beat.photoCaption || "";
    dom.narrativePhotoCaption.textContent = beat.photoCaption || "";
    dom.narrativeMediaWrap.classList.remove("hidden");
  } else {
    dom.narrativeMediaWrap.classList.add("hidden");
  }

  if (beat.chart) {
    renderInlineChart(beat.chart);
  } else {
    dom.narrativeChartWrap.classList.add("hidden");
  }
}

// =========================================================
// TRANSIÇÃO VISUAL DA PORTA (ENTRADA, SAÍDA E RETORNO)
// =========================================================
function runDoorTransition(labelText, onMidpoint) {
  if (state.inTransition) return;
  state.inTransition = true;
  if (dom.doorTransitionText) dom.doorTransitionText.textContent = labelText;
  dom.doorTransition.classList.add("active");
  dom.doorTransition.setAttribute("aria-hidden", "false");

  setTimeout(() => {
    if (typeof onMidpoint === "function") onMidpoint();
  }, 420);

  setTimeout(() => {
    dom.doorTransition.classList.remove("active");
    dom.doorTransition.setAttribute("aria-hidden", "true");
    state.inTransition = false;
  }, 980);
}

// =========================================================
// PORTA DE ENTRADA, PORTA DE SAÍDA, DOSSIÊ E GAVETAS
// =========================================================
function openDoorAndEnter() {
  if (state.doorOpen || state.inTransition) return;
  state.doorOpen = true;
  state.targetDoorAngle = -Math.PI * 0.56;
  dom.doorPrompt.classList.add("hidden");
  playChime(261.63, 1.8);

  runDoorTransition("Atravessando a porta de entrada...", () => {
    state.targetCamZ = ENTRY_Z;
    state.targetCamX = 0;
    state.camZ = ENTRY_Z;
    state.camX = 0;
    state.targetYaw = 0;
    state.yaw = 0;
    dom.btnReturnStart.classList.remove("hidden");
    updateNarrativeForPosition();
  });
}

function openExitDoorAndLeave() {
  if (state.outroVisible || state.inTransition) return;
  state.exitDoorOpen = true;
  state.targetExitDoorAngle = -Math.PI * 0.56;
  dom.exitDoorPrompt.classList.add("hidden");
  closePersonDrawer();
  playChime(349.23, 2.0);

  runDoorTransition("Atravessando a porta de saída...", () => {
    state.outroVisible = true;
    dom.outroScreen.classList.remove("hidden");
  });
}

function returnFromOutroToCorridor() {
  if (state.inTransition) return;
  playChime(293.66, 1.4);
  runDoorTransition("Retornando ao corredor da memória...", () => {
    state.outroVisible = false;
    state.exitDoorOpen = false;
    state.targetExitDoorAngle = 0;
    dom.outroScreen.classList.add("hidden");
    state.targetCamZ = CORRIDOR_END_Z + 4.5;
    state.camZ = CORRIDOR_END_Z + 4.5;
    state.targetCamX = 0;
    state.camX = 0;
    state.targetYaw = 0;
    state.yaw = 0;
    updateNarrativeForPosition();
  });
}

function returnToStart(showIntroCover = false) {
  if (state.inTransition) return;
  closePersonDrawer();
  dom.casesDrawer.classList.remove("open");
  dom.aboutDrawer.classList.remove("open");
  if (state.topdown) setTopdownMode(false);
  playChime(220.0, 1.6);

  runDoorTransition("Retornando ao início...", () => {
    state.outroVisible = false;
    dom.outroScreen.classList.add("hidden");
    state.doorOpen = false;
    state.targetDoorAngle = 0;
    state.doorAngle = 0;
    state.exitDoorOpen = false;
    state.targetExitDoorAngle = 0;
    state.exitDoorAngle = 0;
    state.targetCamZ = START_OUTSIDE_Z;
    state.camZ = START_OUTSIDE_Z;
    state.targetCamX = 0;
    state.camX = 0;
    state.targetYaw = 0;
    state.yaw = 0;
    state.targetPitch = 0.02;
    state.pitch = 0.02;
    state.currentBeatId = null;
    dom.btnReturnStart.classList.add("hidden");
    dom.exitDoorPrompt.classList.add("hidden");

    if (showIntroCover) {
      state.started = false;
      dom.introScreen.classList.remove("fade-out");
      dom.hudTop.classList.add("hidden");
      dom.narrativePanel.classList.add("hidden");
      dom.minimapWrapper.classList.add("hidden");
      if (dom.mobileNavControls) dom.mobileNavControls.classList.add("hidden");
      dom.doorPrompt.classList.add("hidden");
    } else {
      updateNarrativeForPosition();
    }
  });
}

function openPersonDrawer(caseIndex, moveCamera = false) {
  const entry = personEntries[caseIndex];
  if (!entry) return;
  const c = entry.caseData;
  state.selectedCaseIndex = caseIndex;

  dom.personPhoto.src = PHOTO_BY_THEME[c.photoTheme] || PHOTO_BY_THEME.memoria;
  dom.personPhoto.alt = `Ambientação memorial referente a ${c.name}`;
  dom.personAgeBadge.textContent = `${c.age} anos`;
  dom.personDateBadge.textContent = c.date;
  dom.personCircumstancePill.textContent = c.circumstance;
  dom.personCircumstancePill.style.background = getCategoryColor(c, "circumstance");
  dom.personName.textContent = c.name;
  dom.personLocation.textContent = c.neighborhood;
  dom.personRegion.textContent = c.region;
  dom.personLocationType.textContent = c.locationType;
  dom.personSummary.textContent = c.summary;
  dom.personContext.textContent = c.context;
  dom.personCounter.textContent = `${caseIndex + 1} / ${CASES.length}`;

  // Exibe apenas os nomes dos canais de notícia e fontes de monitoramento
  const channels = String(c.source || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  dom.personSourceText.innerHTML = channels
    .map((ch) => `<span class="source-outlet-chip">${ch}</span>`)
    .join("");

  dom.personDrawer.classList.add("open");
  dom.personDrawer.setAttribute("aria-hidden", "false");
  updateColorsAndLegend();
  playChime(329.63, 1.1);

  if (moveCamera) {
    if (!state.doorOpen) {
      state.doorOpen = true;
      state.targetDoorAngle = -Math.PI * 0.56;
    }
    if (state.topdown) setTopdownMode(false);
    state.targetCamZ = Math.min(CORRIDOR_START_Z + 3, entry.z + 5.2);
    state.targetCamX = entry.x * 0.35;
    state.targetYaw = Math.atan2(state.targetCamX - entry.x, state.targetCamZ - entry.z);
    state.targetPitch = 0.0;
  }
}

function closePersonDrawer() {
  state.selectedCaseIndex = -1;
  dom.personDrawer.classList.remove("open");
  dom.personDrawer.setAttribute("aria-hidden", "true");
  updateColorsAndLegend();
}

function renderCasesList(filterText = "") {
  const q = filterText.trim().toLowerCase();
  dom.casesList.innerHTML = "";

  CASES.forEach((c, idx) => {
    const hay = `${c.name} ${c.neighborhood} ${c.region} ${c.circumstance} ${c.age}`.toLowerCase();
    if (q && !hay.includes(q)) return;

    const btn = document.createElement("button");
    btn.className = "case-list-item";
    const color = getCategoryColor(c, state.colorScheme);
    btn.innerHTML = `
      <div class="case-age-badge">
        <span class="case-age-num">${c.age}</span>
        <span class="case-age-unit">anos</span>
      </div>
      <div class="case-item-info">
        <div class="case-item-name">${c.name}</div>
        <div class="case-item-sub">${c.neighborhood} · ${c.date}</div>
      </div>
      <span class="case-item-dot" style="background:${color}" title="${c.circumstance}"></span>
    `;
    btn.addEventListener("click", () => {
      dom.casesDrawer.classList.remove("open");
      dom.casesDrawer.setAttribute("aria-hidden", "true");
      openPersonDrawer(idx, true);
    });
    dom.casesList.appendChild(btn);
  });
}

function setTopdownMode(enabled) {
  if (!state.started) return;
  if (enabled && !state.doorOpen) {
    state.doorOpen = true;
    state.targetDoorAngle = -Math.PI * 0.56;
  }
  state.topdown = enabled;
  dom.topdownBanner.classList.toggle("hidden", !enabled);
  dom.narrativePanel.classList.toggle("hidden", enabled);
  dom.minimapWrapper.classList.toggle("hidden", enabled);
  if (dom.mobileNavControls) dom.mobileNavControls.classList.toggle("hidden", enabled);
  dom.btnToggleTopdown.textContent = enabled ? "Caminhar" : "Vista aérea";
  if (enabled) dom.doorPrompt.classList.add("hidden");
}

// =========================================================
// MINIMAPA 2D EM CANVAS
// =========================================================
const minimapCtx = dom.minimapCanvas.getContext("2d");

function drawMinimap() {
  if (!state.started || state.topdown) return;
  const ctx = minimapCtx;
  const w = dom.minimapCanvas.width;
  const h = dom.minimapCanvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#080a0f";
  ctx.fillRect(0, 0, w, h);

  const padX = 16;
  const padY = 14;
  const mapW = w - padX * 2;
  const mapH = h - padY * 2;

  // Mapeia Z (START_OUTSIDE_Z..EXIT_DOOR_Z) para eixo horizontal (esquerda -> direita)
  const mapZToX = (z) => padX + ((START_OUTSIDE_Z - z) / (START_OUTSIDE_Z - EXIT_DOOR_Z)) * mapW;
  const mapXToY = (x) => padY + ((x + 13) / 26) * mapH;

  // Contorno do corredor
  ctx.strokeStyle = "rgba(244, 240, 232, 0.14)";
  ctx.lineWidth = 1;
  ctx.strokeRect(mapZToX(DOOR_Z), padY, mapZToX(EXIT_DOOR_Z) - mapZToX(DOOR_Z), mapH);

  // Linha da porta de entrada e porta de saída
  const doorX = mapZToX(DOOR_Z);
  const exitDoorX = mapZToX(EXIT_DOOR_Z);
  ctx.strokeStyle = "#e6a94b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(doorX, padY + mapH * 0.34);
  ctx.lineTo(doorX, padY + mapH * 0.66);
  ctx.moveTo(exitDoorX, padY + mapH * 0.34);
  ctx.lineTo(exitDoorX, padY + mapH * 0.66);
  ctx.stroke();

  // Silhuetas de fundo
  ctx.fillStyle = "rgba(120, 130, 150, 0.28)";
  bgSilhouettes.forEach((b) => {
    ctx.beginPath();
    ctx.arc(mapZToX(b.z), mapXToY(b.x), 1.4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Os 26 casos documentados
  personEntries.forEach((entry) => {
    const px = mapZToX(entry.z);
    const py = mapXToY(entry.x);
    const key = getCategoryKey(entry.caseData, state.colorScheme);
    const isDimmed = state.activeFilter && state.activeFilter !== key;
    const isSelected = state.selectedCaseIndex === entry.index;

    ctx.fillStyle = isDimmed ? "rgba(80,86,98,0.35)" : getCategoryColor(entry.caseData, state.colorScheme);
    ctx.beginPath();
    ctx.arc(px, py, isSelected ? 4.4 : 3.0, 0, Math.PI * 2);
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = "#f4f0e8";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });

  // Posição do visitante + cone de visão
  const ux = mapZToX(state.camZ);
  const uy = mapXToY(state.camX);
  const lookAngle = -state.yaw;

  ctx.fillStyle = "rgba(230, 169, 75, 0.18)";
  ctx.beginPath();
  ctx.moveTo(ux, uy);
  ctx.arc(ux, uy, 22, lookAngle - 0.42, lookAngle + 0.42);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f4f0e8";
  ctx.beginPath();
  ctx.arc(ux, uy, 3.6, 0, Math.PI * 2);
  ctx.fill();

  // Rótulos de entrada e saída
  ctx.fillStyle = "rgba(166, 160, 149, 0.7)";
  ctx.font = "9px 'JetBrains Mono', monospace";
  ctx.fillText("ENTRADA", Math.max(4, doorX - 16), h - 3);
  ctx.fillText("SAÍDA (73A)", w - 66, h - 3);
}

// =========================================================
// RAYCASTING (HOVER & CLIQUE NA PORTA E NAS PESSOAS)
// =========================================================
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

function performRaycast(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  return raycaster.intersectObjects(clickableMeshes, false);
}

function handlePointerMove(e) {
  if (!state.started) return;

  if (state.isDragging && !state.topdown) {
    const dx = e.clientX - state.lastPointerX;
    const dy = e.clientY - state.lastPointerY;
    if (Math.hypot(e.clientX - state.pointerDownX, e.clientY - state.pointerDownY) > 5) {
      state.pointerMoved = true;
    }
    const yawSens = e.pointerType === "touch" ? 0.0058 : 0.0042;
    const pitchSens = e.pointerType === "touch" ? 0.004 : 0.003;
    state.targetYaw += dx * yawSens;
    state.targetPitch = Math.max(-0.42, Math.min(0.45, state.targetPitch + dy * pitchSens));
    state.lastPointerX = e.clientX;
    state.lastPointerY = e.clientY;
    dom.hoverTooltip.classList.add("hidden");
    return;
  }

  const hits = performRaycast(e.clientX, e.clientY);
  if (hits.length > 0) {
    const ud = hits[0].object.userData;
    if ((ud.isDoor && !state.doorOpen) || (ud.isExitDoor && !state.outroVisible)) {
      dom.sceneContainer.classList.add("pointer");
      state.hoveredCaseId = null;
      dom.hoverTooltip.classList.add("hidden");
      return;
    }
    if (ud.caseIndex !== undefined) {
      const c = CASES[ud.caseIndex];
      state.hoveredCaseId = c.id;
      dom.sceneContainer.classList.add("pointer");
      dom.tooltipName.textContent = c.name;
      dom.tooltipMeta.textContent = `${c.age} anos · ${c.circumstance} · ${c.neighborhood}`;
      dom.hoverTooltip.style.left = `${Math.min(window.innerWidth - 280, e.clientX)}px`;
      dom.hoverTooltip.style.top = `${Math.max(60, e.clientY)}px`;
      dom.hoverTooltip.classList.remove("hidden");
      return;
    }
  }

  state.hoveredCaseId = null;
  dom.sceneContainer.classList.remove("pointer");
  dom.hoverTooltip.classList.add("hidden");
}

function handlePointerDown(e) {
  if (!state.started || e.button !== 0) return;
  state.isDragging = true;
  state.pointerMoved = false;
  state.pointerDownX = e.clientX;
  state.pointerDownY = e.clientY;
  state.lastPointerX = e.clientX;
  state.lastPointerY = e.clientY;
}

function handlePointerUp(e) {
  if (!state.started) return;
  const wasClick = !state.pointerMoved;
  state.isDragging = false;
  if (!wasClick) return;

  const hits = performRaycast(e.clientX, e.clientY);
  if (hits.length > 0) {
    const ud = hits[0].object.userData;
    if (ud.isDoor && !state.doorOpen) {
      openDoorAndEnter();
      return;
    }
    if (ud.isExitDoor && !state.outroVisible) {
      openExitDoorAndLeave();
      return;
    }
    if (ud.caseIndex !== undefined) {
      openPersonDrawer(ud.caseIndex, false);
      return;
    }
  }

  // Em vista aérea, clicar no chão teleporta o visitante para aquele ponto e volta a caminhar
  if (state.topdown) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const floorHits = raycaster.intersectObject(floorMesh);
    if (floorHits.length > 0) {
      const pt = floorHits[0].point;
      state.targetCamX = Math.max(-10, Math.min(10, pt.x));
      state.targetCamZ = Math.max(CORRIDOR_END_Z - 2, Math.min(CORRIDOR_START_Z + 2, pt.z));
      setTopdownMode(false);
    }
  }
}

// =========================================================
// EVENTOS DE INTERFACE E TECLADO
// =========================================================
function startExperience(openListImmediately = false) {
  state.started = true;
  dom.introScreen.classList.add("fade-out");
  dom.hudTop.classList.remove("hidden");
  dom.narrativePanel.classList.remove("hidden");
  dom.minimapWrapper.classList.remove("hidden");
  if (dom.mobileNavControls) dom.mobileNavControls.classList.remove("hidden");
  startAmbientMusic();
  updateNarrativeForPosition();

  if (openListImmediately) {
    openDoorAndEnter();
    dom.casesDrawer.classList.add("open");
    dom.casesDrawer.setAttribute("aria-hidden", "false");
  }
}

dom.btnEnterMemorial.addEventListener("click", () => startExperience(false));
dom.btnIntroList.addEventListener("click", () => startExperience(true));
dom.btnOpenDoor.addEventListener("click", openDoorAndEnter);
dom.btnOpenExitDoor.addEventListener("click", openExitDoorAndLeave);
dom.btnReturnStart.addEventListener("click", () => returnToStart(false));
dom.btnOutroBack.addEventListener("click", returnFromOutroToCorridor);
dom.btnOutroRestart.addEventListener("click", () => returnToStart(true));
dom.btnOutroCases.addEventListener("click", () => {
  returnFromOutroToCorridor();
  setTimeout(() => {
    dom.casesDrawer.classList.add("open");
    dom.casesDrawer.setAttribute("aria-hidden", "false");
  }, 500);
});

dom.colorSelect.addEventListener("change", (e) => {
  state.colorScheme = e.target.value;
  state.activeFilter = null;
  updateColorsAndLegend();
});

dom.btnFreeExplore.addEventListener("click", () => {
  state.freeExplore = !state.freeExplore;
  dom.narrativeBody.classList.toggle("hidden", state.freeExplore);
  dom.btnFreeExplore.textContent = state.freeExplore ? "Mostrar" : "Ocultar";
});

dom.btnToggleTopdown.addEventListener("click", () => setTopdownMode(!state.topdown));
dom.minimapCanvas.addEventListener("click", () => setTopdownMode(true));
dom.btnExitTopdown.addEventListener("click", () => setTopdownMode(false));

dom.btnClosePerson.addEventListener("click", closePersonDrawer);
dom.btnPrevCase.addEventListener("click", () => {
  const prev = (state.selectedCaseIndex - 1 + CASES.length) % CASES.length;
  openPersonDrawer(prev, true);
});
dom.btnNextCase.addEventListener("click", () => {
  const next = (state.selectedCaseIndex + 1) % CASES.length;
  openPersonDrawer(next, true);
});

dom.btnCases.addEventListener("click", () => {
  dom.aboutDrawer.classList.remove("open");
  dom.casesDrawer.classList.toggle("open");
  dom.casesDrawer.setAttribute("aria-hidden", String(!dom.casesDrawer.classList.contains("open")));
});
dom.btnCloseCases.addEventListener("click", () => {
  dom.casesDrawer.classList.remove("open");
  dom.casesDrawer.setAttribute("aria-hidden", "true");
});
dom.casesSearch.addEventListener("input", (e) => renderCasesList(e.target.value));

dom.btnAbout.addEventListener("click", () => {
  dom.casesDrawer.classList.remove("open");
  dom.aboutDrawer.classList.toggle("open");
  dom.aboutDrawer.setAttribute("aria-hidden", String(!dom.aboutDrawer.classList.contains("open")));
});
dom.btnCloseAbout.addEventListener("click", () => {
  dom.aboutDrawer.classList.remove("open");
  dom.aboutDrawer.setAttribute("aria-hidden", "true");
});

dom.btnAudio.addEventListener("click", toggleAudio);
if (dom.audioVolume) {
  dom.audioVolume.addEventListener("input", (e) => setMusicVolumeFromSlider(e.target.value));
}

// Controles exclusivos mobile (filtros recolhíveis, caminhada tátil e vista aérea)
if (dom.btnMobFilters && dom.hudFilterCard) {
  dom.btnMobFilters.addEventListener("click", () => {
    const isOpen = dom.hudFilterCard.classList.toggle("mobile-open");
    dom.btnMobFilters.classList.toggle("active", isOpen);
    dom.btnMobFilters.setAttribute("aria-expanded", String(isOpen));
  });
}

function bindHoldWalkButton(btn, dir) {
  if (!btn) return;
  const startHold = (e) => {
    e.preventDefault();
    state.mobMoveDir = dir;
    btn.classList.add("pressed");
  };
  const stopHold = () => {
    if (state.mobMoveDir === dir) state.mobMoveDir = 0;
    btn.classList.remove("pressed");
  };
  btn.addEventListener("pointerdown", startHold);
  btn.addEventListener("pointerup", stopHold);
  btn.addEventListener("pointercancel", stopHold);
  btn.addEventListener("pointerleave", stopHold);
}

bindHoldWalkButton(dom.btnMobForward, 1);
bindHoldWalkButton(dom.btnMobBack, -1);

if (dom.btnMobMap) {
  dom.btnMobMap.addEventListener("click", () => setTopdownMode(!state.topdown));
}

// Scroll do mouse para caminhar para frente e para trás
renderer.domElement.addEventListener(
  "wheel",
  (e) => {
    if (!state.started || state.topdown || state.outroVisible || state.inTransition) return;
    e.preventDefault();
    const step = e.deltaY * 0.018;
    if (!state.doorOpen && step > 0 && state.targetCamZ < DOOR_Z + 5.5) {
      openDoorAndEnter();
      return;
    }
    if (state.doorOpen && step > 0 && state.targetCamZ < EXIT_DOOR_Z + 4.8) {
      openExitDoorAndLeave();
      return;
    }
    if (state.doorOpen && step < 0 && state.targetCamZ > DOOR_Z - 1.2) {
      returnToStart(false);
      return;
    }
    const minZ = EXIT_DOOR_Z + 3.2;
    const maxZ = state.doorOpen ? DOOR_Z + 0.5 : START_OUTSIDE_Z;
    state.targetCamZ = Math.max(minZ, Math.min(maxZ, state.targetCamZ - step));
  },
  { passive: false }
);

renderer.domElement.addEventListener("pointerdown", handlePointerDown);
window.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerup", handlePointerUp);

window.addEventListener("keydown", (e) => {
  if (document.activeElement && document.activeElement.tagName === "INPUT") return;
  state.keys[e.code] = true;

  if (e.code === "Space" && state.started) {
    e.preventDefault();
    if (!state.doorOpen) {
      openDoorAndEnter();
    } else {
      setTopdownMode(!state.topdown);
    }
  } else if (e.code === "Enter" && state.started && !state.doorOpen) {
    openDoorAndEnter();
  } else if (e.code === "Escape") {
    if (state.topdown) setTopdownMode(false);
    closePersonDrawer();
    dom.casesDrawer.classList.remove("open");
    dom.aboutDrawer.classList.remove("open");
  }
});

window.addEventListener("keyup", (e) => {
  state.keys[e.code] = false;
});

window.addEventListener("resize", () => {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.fov = aspect < 1 ? 68 : 58;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth <= 900 ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// =========================================================
// LOOP DE ANIMAÇÃO
// =========================================================
const clock = new THREE.Clock();

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function updateWalkers(dt) {
  for (const e of personEntries) {
    const isHover = state.hoveredCaseId === e.caseData.id;
    const isSelected = state.selectedCaseIndex === e.index;
    const distToCam = Math.hypot(e.x - state.camX, e.z - state.camZ);
    const attention = isHover || isSelected || (!state.topdown && distToCam < 2.4);

    // Pausas ocasionais naturais ao longo da trilha
    e.pauseTimer -= dt;
    let resting = false;
    if (e.pauseTimer < 0) {
      resting = true;
      if (e.pauseTimer < -2.2) e.pauseTimer = 4 + seeded(e.index + clock.elapsedTime) * 7;
    }

    const shouldWalk = !attention && !resting;
    const targetWeight = shouldWalk ? 1 : 0;
    e.walkWeight += (targetWeight - e.walkWeight) * Math.min(1, dt * 4);

    if (e.walkAction && e.idleAction) {
      e.walkAction.setEffectiveWeight(e.walkWeight);
      e.idleAction.setEffectiveWeight(1 - e.walkWeight);
    }

    let desiredHeading;
    if (attention) {
      // Vira-se para o visitante (frente do modelo = +Z)
      desiredHeading = Math.atan2(state.camX - e.x, state.camZ - e.z);
    } else {
      e.x += e.dir * e.speed * e.walkWeight * dt;
      if (e.x > e.maxX) { e.x = e.maxX; e.dir = -1; }
      if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
      desiredHeading = e.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    e.heading = lerpAngle(e.heading, desiredHeading, Math.min(1, dt * 3.2));
    e.group.position.x = e.x;
    e.group.rotation.y = e.heading;

    // Cabeça proporcionalmente maior em crianças (aplicada após o mixer)
    if (e.headBone && e.headScale !== 1) e.headBone.scale.setScalar(e.headScale);
  }

  // Caminhada lateral suave das silhuetas de fundo
  for (const b of bgSilhouettes) {
    if (!b.mesh) continue;
    b.x += b.dir * b.speed * dt;
    if (b.x > b.maxX) { b.x = b.maxX; b.dir = -1; }
    if (b.x < b.minX) { b.x = b.minX; b.dir = 1; }
    b.mesh.position.x = b.x;
    b.mesh.rotation.y = b.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  // Animação dos modelos 3D caminhando/respirando
  for (let i = 0; i < mixers.length; i++) {
    mixers[i].update(dt);
  }

  // Pessoas caminhando de um lado para o outro (param e olham para o visitante quando em foco)
  updateWalkers(dt);

  // Controle de ciclo contínuo de 4:00 (240s) da música ambiente
  updateMusicLoop(dt);

  // Animação suave da porta de entrada e porta de saída
  state.doorAngle += (state.targetDoorAngle - state.doorAngle) * Math.min(1, dt * 4.5);
  doorPivot.rotation.y = state.doorAngle;

  state.exitDoorAngle += (state.targetExitDoorAngle - state.exitDoorAngle) * Math.min(1, dt * 4.5);
  exitDoorPivot.rotation.y = state.exitDoorAngle;

  // Movimento por teclado (setas / WASD)
  if (state.started && !state.topdown && !state.outroVisible && !state.inTransition) {
    const moveSpeed = 13.5 * dt;
    const turnSpeed = 1.65 * dt;
    let forward = 0;

    if (state.keys.ArrowUp || state.keys.KeyW || state.mobMoveDir > 0) forward += 1;
    if (state.keys.ArrowDown || state.keys.KeyS || state.mobMoveDir < 0) forward -= 1;
    if (state.keys.ArrowLeft || state.keys.KeyA) state.targetYaw += turnSpeed;
    if (state.keys.ArrowRight || state.keys.KeyD) state.targetYaw -= turnSpeed;

    if (forward !== 0) {
      if (!state.doorOpen && forward > 0 && state.targetCamZ < DOOR_Z + 5.5) {
        openDoorAndEnter();
      } else if (state.doorOpen && forward > 0 && state.targetCamZ < EXIT_DOOR_Z + 4.8) {
        openExitDoorAndLeave();
      } else if (state.doorOpen && forward < 0 && state.targetCamZ > DOOR_Z - 1.2) {
        returnToStart(false);
      } else {
        const dx = -Math.sin(state.targetYaw) * forward * moveSpeed;
        const dz = -Math.cos(state.targetYaw) * forward * moveSpeed;
        const minZ = EXIT_DOOR_Z + 3.2;
        const maxZ = state.doorOpen ? DOOR_Z + 0.5 : START_OUTSIDE_Z;
        state.targetCamX = Math.max(-11.2, Math.min(11.2, state.targetCamX + dx));
        state.targetCamZ = Math.max(minZ, Math.min(maxZ, state.targetCamZ + dz));
      }
    }
  }

  // Evita que a câmera atravesse as pessoas (empurra para fora de um raio de 1.1m)
  if (!state.topdown) {
    for (const entry of personEntries) {
      const dx = state.targetCamX - entry.x;
      const dz = state.targetCamZ - entry.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.1 && d > 0.0001) {
        state.targetCamX = entry.x + (dx / d) * 1.1;
        state.targetCamZ = entry.z + (dz / d) * 1.1;
      }
    }
  }

  // Suavização da câmera
  const damp = Math.min(1, dt * 6.5);
  state.camX += (state.targetCamX - state.camX) * damp;
  state.camZ += (state.targetCamZ - state.camZ) * damp;
  state.yaw += (state.targetYaw - state.yaw) * damp;
  state.pitch += (state.targetPitch - state.pitch) * damp;

  const targetBlend = state.topdown ? 1 : 0;
  state.topdownBlend += (targetBlend - state.topdownBlend) * Math.min(1, dt * 4.2);

  // Interpolação entre visão em primeira pessoa e vista aérea
  const fpPos = new THREE.Vector3(state.camX, EYE_HEIGHT, state.camZ);
  const tdPos = new THREE.Vector3(0, 74, (CORRIDOR_START_Z + CORRIDOR_END_Z) * 0.5);
  camera.position.lerpVectors(fpPos, tdPos, state.topdownBlend);

  const fpLook = new THREE.Vector3(
    state.camX - Math.sin(state.yaw) * 10,
    EYE_HEIGHT + Math.sin(state.pitch) * 6,
    state.camZ - Math.cos(state.yaw) * 10
  );
  const tdLook = new THREE.Vector3(0, 0, (CORRIDOR_START_Z + CORRIDOR_END_Z) * 0.5);
  const finalLook = new THREE.Vector3().lerpVectors(fpLook, tdLook, state.topdownBlend);
  camera.lookAt(finalLook);

  // Ajusta neblina na vista aérea para nitidez de todos os pontos
  scene.fog.density = THREE.MathUtils.lerp(0.0175, 0.004, state.topdownBlend);

  // Movimento suave das partículas de luz
  const posAttr = pGeo.attributes.position;
  for (let i = 0; i < particleCount; i++) {
    let y = posAttr.getY(i) + dt * 0.14;
    if (y > 8) y = 0.2;
    posAttr.setY(i, y);
  }
  posAttr.needsUpdate = true;

  // Atualiza rótulos flutuantes das pessoas próximas ou sob o mouse
  const time = clock.elapsedTime;
  personEntries.forEach((entry) => {
    const dist = Math.hypot(entry.x - state.camX, entry.z - state.camZ);
    const isHover = state.hoveredCaseId === entry.caseData.id;
    const isSelected = state.selectedCaseIndex === entry.index;
    const targetOpacity = state.topdown
      ? isHover || isSelected
        ? 1
        : 0
      : isHover || isSelected
        ? 1
        : dist < 2.2
          ? 0
          : dist < 14
            ? Math.min(1, Math.max(0, 1 - (dist - 6) / 8)) * 0.9
            : 0;
    entry.sprite.material.opacity += (targetOpacity - entry.sprite.material.opacity) * Math.min(1, dt * 8);

    // Pulso discreto no anel do chão
    const pulse = 1 + Math.sin(time * 2.2 + entry.index) * 0.05;
    entry.ring.scale.setScalar(isSelected || isHover ? 1.24 : pulse);
  });

  updateNarrativeForPosition();
  drawMinimap();
  renderer.render(scene, camera);
}

// =========================================================
// INICIALIZAÇÃO
// =========================================================
async function boot() {
  updateColorsAndLegend();
  // Garante que as fontes estejam prontas antes de desenhar os rótulos em canvas
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); } catch (_) {}
  const loadedModels = await loadAllModels();
  populatePeople(loadedModels);
  updateColorsAndLegend();
  animate();
}

boot();
