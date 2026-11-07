import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Building, CampusPath } from "../api/types.ts";

// Shared convention with the backend: plan coordinates (x, y) in metres map to the
// Three.js XZ plane as (x, -y); height is Y, one storey every FLOOR_HEIGHT metres.
export const FLOOR_HEIGHT = 3.5;

const COLORS = {
  background: 0xeef0f2,
  marker: 0x5b6573,
  path: 0xa3abb5,
  route: 0xe0562d,
  avatar: 0x1f6feb,
};
const AVATAR_SPEED = 6; // metres per second

export function toScenePosition(building: Pick<Building, "x" | "y" | "floor">): THREE.Vector3 {
  return new THREE.Vector3(building.x, building.floor * FLOOR_HEIGHT, -building.y);
}

export class CampusScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly clock = new THREE.Clock();
  private readonly campusGroup = new THREE.Group();
  private readonly avatar: THREE.Mesh;
  private routeLine: THREE.Line | null = null;
  private waypoints: THREE.Vector3[] = [];
  private waypointIndex = 0;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(COLORS.background);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    this.camera.position.set(20, 45, 55);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(20, 5, 0);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb0b4ba, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(30, 60, 20);
    this.scene.add(sun);

    const grid = new THREE.GridHelper(120, 24, 0xc9ced4, 0xdde1e5);
    grid.position.set(20, -0.01, 0);
    this.scene.add(grid, this.campusGroup);

    this.avatar = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.6, 1.2, 4, 12),
      new THREE.MeshStandardMaterial({ color: COLORS.avatar }),
    );
    this.avatar.visible = false;
    this.scene.add(this.avatar);

    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  setCampus(buildings: Building[], paths: CampusPath[]): void {
    this.campusGroup.clear();
    const byId = new Map(buildings.map((building) => [building.id, building]));
    const markerGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.4, 16);
    const markerMaterial = new THREE.MeshStandardMaterial({ color: COLORS.marker });

    for (const building of buildings) {
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.copy(toScenePosition(building));
      marker.name = building.name;
      this.campusGroup.add(marker);
    }

    const segments: THREE.Vector3[] = [];
    for (const path of paths) {
      const source = byId.get(path.source_id);
      const target = byId.get(path.target_id);
      if (source && target) segments.push(toScenePosition(source), toScenePosition(target));
    }
    this.campusGroup.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(segments),
        new THREE.LineBasicMaterial({ color: COLORS.path }),
      ),
    );
  }

  showRoute(points: THREE.Vector3[]): void {
    this.clearRoute();
    if (points.length === 0) return;
    const lift = new THREE.Vector3(0, 0.3, 0);
    this.routeLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points.map((point) => point.clone().add(lift))),
      new THREE.LineBasicMaterial({ color: COLORS.route }),
    );
    this.scene.add(this.routeLine);

    const avatarLift = new THREE.Vector3(0, 1.2, 0);
    this.waypoints = points.map((point) => point.clone().add(avatarLift));
    this.waypointIndex = 1;
    this.avatar.position.copy(this.waypoints[0]);
    this.avatar.visible = true;
  }

  clearRoute(): void {
    if (this.routeLine) {
      this.scene.remove(this.routeLine);
      this.routeLine.geometry.dispose();
      this.routeLine = null;
    }
    this.waypoints = [];
    this.avatar.visible = false;
  }

  private tick(): void {
    const delta = this.clock.getDelta();
    if (this.waypointIndex < this.waypoints.length) {
      const target = this.waypoints[this.waypointIndex];
      const toTarget = target.clone().sub(this.avatar.position);
      const step = AVATAR_SPEED * delta;
      if (toTarget.length() <= step) {
        this.avatar.position.copy(target);
        this.waypointIndex += 1;
      } else {
        this.avatar.position.add(toTarget.setLength(step));
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.container;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
