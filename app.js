import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const MODEL_URL = "./assets/LED_Flasher_Breadboard.glb";

const componentData = {
  D1: {
    name: "Red LED",
    subtitle: "left output",
    role: "OUTPUT",
    description: "Emits the left half of the alternating pulse.",
  },
  D2: {
    name: "Red LED",
    subtitle: "right output",
    role: "OUTPUT",
    description: "Emits the right half of the alternating pulse.",
  },
  Q1: {
    name: "NPN transistor",
    subtitle: "left switch",
    role: "SWITCH",
    description: "Pulls the left branch low while the opposite side charges.",
  },
  Q2: {
    name: "NPN transistor",
    subtitle: "right switch",
    role: "SWITCH",
    description: "Pulls the right branch low while the opposite side charges.",
  },
  C1: {
    name: "100 μF capacitor",
    subtitle: "left timing",
    role: "TIMING",
    description: "Stores charge to set the handoff interval on the left side.",
  },
  C2: {
    name: "100 μF capacitor",
    subtitle: "right timing",
    role: "TIMING",
    description: "Stores charge to set the handoff interval on the right side.",
  },
};

const viewer = document.querySelector("#viewer");
const viewerWrap = document.querySelector("#viewerWrap");
const loadingState = document.querySelector("#loadingState");
const loadingLabel = document.querySelector("#loadingLabel");
const modelStatus = document.querySelector("#modelStatus");
const runSignal = document.querySelector("#runSignal");
const speedControl = document.querySelector("#speedControl");
const speedValue = document.querySelector("#speedValue");
const frequencyReadout = document.querySelector("#frequencyReadout");
const selectedPartId = document.querySelector("#selectedPartId");
const selectedPartName = document.querySelector("#selectedPartName");
const selectedPartDescription = document.querySelector("#selectedPartDescription");
const componentRows = [...document.querySelectorAll("[data-component]")];
const pathRows = [...document.querySelectorAll(".path-row")];
const toast = document.querySelector("#toast");
const helpPopover = document.querySelector("#helpPopover");

let scene;
let camera;
let renderer;
let controls;
let model;
let selectionHelper;
let modelBounds = new THREE.Box3();
let defaultCameraPosition = new THREE.Vector3();
let defaultTarget = new THREE.Vector3();
let selectedKey = "D1";
let elapsed = 0;
let blinkRate = 1;
let signalRunning = true;
let toastTimer;
let focusTween = null;
const ledMaterials = [];
const ledLights = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

init();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111713);

  camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
  camera.position.set(7, 5.6, 7.4);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  viewer.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 2.2;
  controls.maxDistance = 18;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minPolarAngle = Math.PI * 0.13;
  controls.autoRotateSpeed = 0.8;
  controls.addEventListener("start", () => {
    renderer.domElement.classList.add("is-orbiting");
  });
  controls.addEventListener("end", () => {
    renderer.domElement.classList.remove("is-orbiting");
  });

  addLights();
  addFloor();
  attachUI();
  loadModel();
  window.addEventListener("resize", resize);
  resize();
  renderer.setAnimationLoop(animate);
}

function addLights() {
  const hemi = new THREE.HemisphereLight(0xcfe9d3, 0x0d120f, 2.2);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xf1ffe9, 4.1);
  key.position.set(4.8, 9.5, 5.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9ce9d5, 1.45);
  fill.position.set(-7, 4, -4);
  scene.add(fill);
}

function addFloor() {
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(16, 64),
    new THREE.MeshStandardMaterial({ color: 0x0c110e, roughness: 0.92, metalness: 0.03 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.2;
  floor.receiveShadow = true;
  scene.add(floor);
}

function loadModel() {
  const loader = new GLTFLoader();
  loader.load(
    MODEL_URL,
    (gltf) => {
      model = gltf.scene;
      model.traverse((object) => {
        if (object.name === "Backdrop") {
          object.visible = false;
          return;
        }
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        if (Array.isArray(object.material)) {
          object.material = object.material.map((material) => material.clone());
        } else if (object.material) {
          object.material = object.material.clone();
        }
      });

      centerModel();
      prepareLEDs();
      scene.add(model);
      markReady();
      selectComponent("D1", { focus: false });
    },
    (event) => {
      if (!event.total) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      loadingLabel.textContent = `Loading 3D model ${percent}%`;
    },
    (error) => {
      console.error("Unable to load the GLB model", error);
      loadingLabel.textContent = "Model failed to load";
      modelStatus.textContent = "Unable to load geometry";
      modelStatus.classList.add("is-error");
      showToast("The model could not be loaded. Check the asset path.");
    },
  );
}

function centerModel() {
  // The source scene contains a large backdrop plane for offline renders.
  // Exclude it from camera fitting so the breadboard remains the subject.
  const fitBounds = new THREE.Box3();
  model.traverse((object) => {
    if (object.isMesh && object.name !== "Backdrop") fitBounds.expandByObject(object);
  });
  const center = fitBounds.getCenter(new THREE.Vector3());
  const size = fitBounds.getSize(new THREE.Vector3());
  model.position.sub(center);
  modelBounds.min.copy(fitBounds.min).add(model.position);
  modelBounds.max.copy(fitBounds.max).add(model.position);

  const maxDim = Math.max(size.x, size.y, size.z);
  // Leave breathing room around the full assembly: the source scene includes
  // tall jumpers and a wide board, so a close mathematical fit feels cropped
  // once the perspective camera is viewed inside the shallow stage.
  const fitDistance = maxDim * 1.55;
  defaultTarget.set(0, 0, 0);
  defaultCameraPosition.set(fitDistance * 0.94, fitDistance * 0.72, fitDistance * 0.94);
  camera.position.copy(defaultCameraPosition);
  camera.near = Math.max(0.05, maxDim / 100);
  camera.far = Math.max(100, maxDim * 12);
  camera.updateProjectionMatrix();
  controls.minDistance = Math.max(2.2, maxDim * 0.03);
  controls.maxDistance = Math.max(18, maxDim * 8);
  controls.target.copy(defaultTarget);
  controls.update();

  const floorY = modelBounds.min.y - Math.max(maxDim * 0.08, 0.12);
  const floor = scene.children.find((child) => child.geometry?.type === "CircleGeometry");
  if (floor) floor.position.y = floorY;
}

function prepareLEDs() {
  for (const key of ["D1", "D2"]) {
    const bounds = getComponentBounds(key);
    if (bounds.isEmpty()) continue;
    const center = bounds.getCenter(new THREE.Vector3());
    const light = new THREE.PointLight(0xff3d35, 0.05, 2.2, 2);
    light.position.copy(center);
    scene.add(light);
    ledLights.push({ key, light });
  }

  model.traverse((object) => {
    if (!object.isMesh) return;
    const key = componentFromObject(object);
    if (key !== "D1" && key !== "D2") return;
    const isLens = /lens|dome|flange/i.test(object.name || "");
    if (!isLens) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!material?.emissive) return;
      material.emissive = new THREE.Color(0xff2e2e);
      material.emissiveIntensity = 0.12;
      ledMaterials.push({ key, material, base: 0.12 });
    });
  });
}

function attachUI() {
  document.querySelector("#resetView").addEventListener("click", resetView);
  document.querySelector("#autoRotate").addEventListener("click", (event) => {
    controls.autoRotate = !controls.autoRotate;
    event.currentTarget.setAttribute("aria-pressed", String(controls.autoRotate));
    showToast(controls.autoRotate ? "Auto orbit on" : "Auto orbit off");
  });

  runSignal.addEventListener("change", () => {
    signalRunning = runSignal.checked;
    document.body.classList.toggle("signal-paused", !signalRunning);
    showToast(signalRunning ? "Signal running" : "Signal paused");
  });

  speedControl.addEventListener("input", () => {
    blinkRate = Number(speedControl.value);
    speedValue.textContent = `${blinkRate.toFixed(2).replace(/\.00$/, "")}×`;
    frequencyReadout.textContent = `${(1.6 * blinkRate).toFixed(1)} Hz`;
  });

  componentRows.forEach((row) => {
    row.addEventListener("click", () => selectComponent(row.dataset.component));
  });

  document.querySelector("#helpButton").addEventListener("click", () => {
    helpPopover.hidden = !helpPopover.hidden;
  });

  document.querySelector("#closeHelp").addEventListener("click", () => {
    helpPopover.hidden = true;
  });

  renderer.domElement.addEventListener("pointerup", onViewerClick);
  renderer.domElement.addEventListener("dblclick", () => resetView());
}

function onViewerClick(event) {
  if (!model || Math.abs(event.movementX) > 3 || Math.abs(event.movementY) > 3) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(model, true);
  const key = hits.map((hit) => componentFromObject(hit.object)).find(Boolean);
  if (key) selectComponent(key);
}

function selectComponent(key, options = {}) {
  if (!componentData[key]) return;
  selectedKey = key;
  const data = componentData[key];
  selectedPartId.textContent = key;
  selectedPartName.textContent = data.name;
  selectedPartDescription.textContent = data.description;

  componentRows.forEach((row) => row.classList.toggle("is-selected", row.dataset.component === key));
  pathRows.forEach((row) => row.classList.toggle("is-active", row.dataset.component === key));

  updateSelectionHelper(key);
  if (options.focus !== false) focusComponent(key);
}

function updateSelectionHelper(key) {
  if (!model) return;
  const bounds = getComponentBounds(key);
  if (bounds.isEmpty()) return;
  if (!selectionHelper) {
    selectionHelper = new THREE.Box3Helper(bounds, 0xd8ff63);
    selectionHelper.material.transparent = true;
    selectionHelper.material.opacity = 0.72;
    scene.add(selectionHelper);
  } else {
    selectionHelper.box.copy(bounds);
  }
}

function focusComponent(key) {
  const bounds = getComponentBounds(key);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const distance = Math.max(size.length() * 4.7, 2.2);
  const direction = camera.position.clone().sub(controls.target).normalize();
  focusTween = {
    fromPosition: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPosition: center.clone().add(direction.multiplyScalar(distance)),
    toTarget: center,
    startedAt: performance.now(),
    duration: 520,
  };
}

function resetView() {
  if (!model) return;
  focusTween = {
    fromPosition: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPosition: defaultCameraPosition.clone(),
    toTarget: defaultTarget.clone(),
    startedAt: performance.now(),
    duration: 620,
  };
  selectComponent("D1", { focus: false });
}

function animate(time) {
  elapsed = time * 0.001;
  controls.update();
  updateFocusTween(time);
  updatePulse();
  renderer.render(scene, camera);
}

function updateFocusTween(time) {
  if (!focusTween) return;
  const progress = Math.min((time - focusTween.startedAt) / focusTween.duration, 1);
  const eased = 1 - Math.pow(1 - progress, 4);
  camera.position.lerpVectors(focusTween.fromPosition, focusTween.toPosition, eased);
  controls.target.lerpVectors(focusTween.fromTarget, focusTween.toTarget, eased);
  if (progress >= 1) focusTween = null;
}

function updatePulse() {
  const cycle = elapsed * blinkRate * 1.6;
  const left = signalRunning ? Math.pow((Math.sin(cycle * Math.PI * 2) + 1) / 2, 2.4) : 0;
  const right = signalRunning ? Math.pow((Math.sin(cycle * Math.PI * 2 + Math.PI) + 1) / 2, 2.4) : 0;

  ledMaterials.forEach(({ key, material, base }) => {
    const pulse = key === "D1" ? left : right;
    material.emissiveIntensity = base + pulse * 2.25;
  });

  ledLights.forEach(({ key, light }) => {
    const pulse = key === "D1" ? left : right;
    light.intensity = 0.03 + pulse * 1.75;
  });

  pathRows.forEach((row) => {
    const key = row.dataset.component;
    const isActive = signalRunning && (key === "D1" || key === "Q1" ? left > 0.5 : right > 0.5);
    row.classList.toggle("is-active", key === selectedKey || isActive);
  });
}

function getComponentBounds(key) {
  const bounds = new THREE.Box3();
  if (!model) return bounds;
  model.traverse((object) => {
    if (object.isMesh && componentFromObject(object) === key) bounds.expandByObject(object);
  });
  return bounds;
}

function componentFromObject(object) {
  let cursor = object;
  while (cursor && cursor !== model) {
    const name = cursor.name || "";
    const key = Object.keys(componentData).find((candidate) => new RegExp(`^${candidate}(?:\\s|\\.|$)`, "i").test(name));
    if (key) return key;
    cursor = cursor.parent;
  }
  return null;
}

function markReady() {
  loadingState.classList.add("is-hidden");
  modelStatus.textContent = "Loaded · LED Flasher";
  modelStatus.classList.add("is-ready");
}

function resize() {
  const width = viewerWrap.clientWidth;
  const height = viewerWrap.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}
