import * as THREE from "three";
import { SHOT_BACKGROUND, SHOT_PX, type SheetAngle } from "@/lib/manufacturer/views";

export type ShotTaker = (angle: SheetAngle) => string | null;

const FOV = 26;
const FRAMING = 1.04;
const QUALITY = 0.9;
const UP = new THREE.Vector3(0, 1, 0);

export function takeShot(gl: THREE.WebGLRenderer, scene: THREE.Scene, radius: number, center: THREE.Vector3, angle: SheetAngle) {
  const distance = (radius / Math.tan(THREE.MathUtils.degToRad(FOV / 2))) * FRAMING;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 400);
  camera.position.setFromSpherical(new THREE.Spherical(distance, angle.phi, angle.theta)).add(center);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const lights: { light: THREE.DirectionalLight; position: THREE.Vector3 }[] = [];
  scene.traverse((object) => {
    if (object instanceof THREE.DirectionalLight) lights.push({ light: object, position: object.position.clone() });
  });
  const environment = scene.environmentRotation.y;
  for (const { light } of lights) light.position.applyAxisAngle(UP, angle.spin);
  scene.environmentRotation.y = environment + angle.spin;
  gl.shadowMap.needsUpdate = true;
  gl.render(scene, camera);
  const output = document.createElement("canvas");
  output.width = output.height = SHOT_PX;
  const context = output.getContext("2d");
  if (context) {
    context.fillStyle = SHOT_BACKGROUND;
    context.fillRect(0, 0, SHOT_PX, SHOT_PX);
    context.drawImage(gl.domElement, 0, 0, SHOT_PX, SHOT_PX);
  }
  for (const { light, position } of lights) light.position.copy(position);
  scene.environmentRotation.y = environment;
  gl.shadowMap.needsUpdate = true;
  return context ? output.toDataURL("image/jpeg", QUALITY) : null;
}

export function trackLoads() {
  const manager = THREE.DefaultLoadingManager;
  let loaded = 0;
  let total = 0;
  const note = (_url: string, done: number, all: number) => {
    loaded = done;
    total = all;
  };
  manager.onStart = note;
  manager.onProgress = note;
  return {
    idle: () => loaded === total,
    stop: () => {
      if (manager.onProgress !== note) return;
      manager.onStart = undefined;
      manager.onProgress = () => undefined;
    },
  };
}
