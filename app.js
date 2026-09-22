import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const MODEL_URL = "./assets/LED_Flasher_Breadboard.glb";

const viewer = document.querySelector("#viewer");
const viewerShell = document.querySelector("#viewerShell");
const loadingState = document.querySelector("#loadingState");
const loadingLabel = document.querySelector("#loadingLabel");
const resetViewButton = document.querySelector("#resetView");

let scene;
let camera;
let renderer;
let controls;
let model;
let defaultCameraPosition;
let defaultTarget;

init();

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(31, 1, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  viewer.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minPolarAngle = Math.PI * 0.13;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.addEventListener("change", render);

  addLights();
  addFloor();
  resetViewButton.addEventListener("click", resetView);
  window.addEventListener("resize", resize);
  loadModel();
  resize();
  renderer.setAnimationLoop(animate);
}

function addLights() {
  scene.add(new THREE.HemisphereLight(0xcfe9d3, 0x0d120f, 2.2));

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
    new THREE.CircleGeometry(200, 64),
    new THREE.MeshStandardMaterial({ color: 0x0c110e, roughness: 0.94, metalness: 0.02 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = "viewer-floor";
  scene.add(floor);
}

function loadModel() {
  new GLTFLoader().load(
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
      });

      fitModel();
      scene.add(model);
      loadingState.classList.add("is-hidden");
      render();
    },
    (event) => {
      if (!event.total) return;
      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
      loadingLabel.textContent = `Loading model ${percent}%`;
    },
    (error) => {
      console.error("Unable to load the GLB model", error);
      loadingState.classList.add("is-error");
      loadingLabel.textContent = "Model could not load";
    },
  );
}

function fitModel() {
  const fitBounds = new THREE.Box3();
  model.traverse((object) => {
    if (object.isMesh && object.name !== "Backdrop") fitBounds.expandByObject(object);
  });

  const center = fitBounds.getCenter(new THREE.Vector3());
  const size = fitBounds.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  model.position.sub(center);

  const fitDistance = maxDim * 1.55;
  defaultTarget = new THREE.Vector3(0, 0, 0);
  defaultCameraPosition = new THREE.Vector3(fitDistance * 0.94, fitDistance * 0.72, fitDistance * 0.94);
  camera.position.copy(defaultCameraPosition);
  camera.near = Math.max(0.05, maxDim / 100);
  camera.far = Math.max(100, maxDim * 15);
  camera.updateProjectionMatrix();

  controls.minDistance = Math.max(2.2, maxDim * 0.03);
  controls.maxDistance = Math.max(18, maxDim * 8);
  controls.target.copy(defaultTarget);
  controls.update();

  const floor = scene.getObjectByName("viewer-floor");
  if (floor) floor.position.y = fitBounds.min.y + model.position.y - Math.max(maxDim * 0.08, 0.12);
}

function resetView() {
  if (!defaultCameraPosition || !defaultTarget) return;
  camera.position.copy(defaultCameraPosition);
  controls.target.copy(defaultTarget);
  controls.update();
  render();
}

function animate() {
  controls.update();
  render();
}

function render() {
  renderer.render(scene, camera);
}

function resize() {
  const width = viewerShell.clientWidth;
  const height = viewerShell.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
