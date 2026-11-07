import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Building, CampusPath } from "../api/types.ts";
import { FLOOR_HEIGHT, toScenePosition, WALK_SPEED } from "./coordinates.ts";
import { canWalk, routingStart, walkSegments, type WalkSegment } from "./navigation.ts";
import { parseReference, referenceMatrix, validateAlignment, validateModelNodes, type CampusReference } from "./modelReference.ts";

export type TravelState = "idle" | "ready" | "walking" | "paused" | "arrived" | "blocked";
export interface TravelUpdate {
  state: TravelState;
  position: [number, number, number];
  floor: number;
  remaining: number;
  progress: number;
  waypoint: number;
}
interface SceneEvents {
  travel: (update: TravelUpdate) => void;
  select: (place: Building) => void;
  floor: (floor: number) => void;
  model: (message: string, loaded: boolean) => void;
}
function disposeGroup(group: THREE.Group): void {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      object.geometry.dispose();
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose());
    }
  });
  group.clear();
}

export class CampusScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-40, 40, 30, -30, 0.1, 1000);
  private readonly controls: OrbitControls;
  private readonly clock = new THREE.Clock();
  private readonly campus = new THREE.Group();
  private readonly routeGroup = new THREE.Group();
  private readonly referenceGroup = new THREE.Group();
  private readonly modelGroup = new THREE.Group();
  private readonly avatar = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly destinationRing: THREE.Mesh;
  private readonly labels = new Map<number, HTMLButtonElement>();
  private readonly floorGroups = new Map<number, THREE.Group>();
  private readonly keys = new Set<string>();
  private readonly abort = new AbortController();
  private readonly resizeObserver: ResizeObserver;
  private places: Building[] = [];
  private segments: WalkSegment[] = [];
  private waypoints: THREE.Vector3[] = [];
  private index = 1;
  private state: TravelState = "idle";
  private totalLength = 0;
  private viewFloor = 0;
  private avatarFloor = 0;
  private frustum = 35;
  private topView = false;
  private labelsVisible = true;
  private reference: CampusReference | null = null;
  private collisionMeshes: THREE.Object3D[] = [];
  private lastEmission = 0;
  private walkTime = 0;

  constructor(private readonly container: HTMLElement, private readonly events: SceneEvents) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Model and lights are static. Reusing their shadow map avoids rendering the
    // entire building a second time on every animation frame.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.domElement.setAttribute("aria-label", "Interactive 3D campus. W A S D or arrows to walk; drag to orbit.");
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(0xe9eeeb);
    this.scene.add(this.campus, this.routeGroup, this.avatar, this.referenceGroup, this.modelGroup);
    this.referenceGroup.visible = false;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.46;
    this.controls.minZoom = 0.45;
    this.controls.maxZoom = 4;
    this.controls.screenSpacePanning = true;
    this.scene.add(new THREE.HemisphereLight(0xf7fcff, 0xb5b8a4, 1.5));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
    sun.position.set(-15, 65, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 180 });
    sun.shadow.normalBias = 0.06;
    sun.shadow.bias = -0.0001;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xddeeff, 0.7);
    fill.position.set(50, 20, -40);
    this.scene.add(fill);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: 0xe9eeeb, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.name = "presentation-ground";
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.makeAvatar();
    this.avatar.visible = false;
    this.destinationRing = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.065, 8, 48), new THREE.MeshStandardMaterial({ color: 0x0e8b75, emissive: 0x075c4d, emissiveIntensity: 0.4 }));
    this.destinationRing.rotation.x = -Math.PI / 2;
    this.destinationRing.visible = false;
    this.scene.add(this.destinationRing);
    const options = { signal: this.abort.signal };
    window.addEventListener("keydown", (event) => {
      if (event.target instanceof HTMLElement && (event.target.closest("input, select, textarea, button") || event.target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
        if (this.state !== "idle") this.cancel();
        this.keys.add(key);
      }
      if (key === "escape") this.cancel();
    }, options);
    window.addEventListener("keyup", (event) => {
      if (this.keys.delete(event.key.toLowerCase())) this.emit();
    }, options);
    window.addEventListener("blur", () => this.keys.clear(), options);
    document.addEventListener("visibilitychange", () => {
      this.keys.clear();
      if (document.hidden && this.state === "walking") this.pause();
    }, options);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private makeAvatar(): void {
    const fabric = new THREE.MeshStandardMaterial({ color: 0x177c70, roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x233e3b, roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe5b995, roughness: 0.8 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.44, 6, 12), fabric);
    torso.position.y = 0.94;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), skin);
    head.position.y = 1.53;
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.18), dark);
    bag.position.set(0, 1.03, 0.24);
    this.body.add(torso, head, bag);
    for (const x of [-0.13, 0.13]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.4, 4, 8), dark);
      leg.position.set(x, 0.34, 0);
      this.body.add(leg);
    }
    const contact = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), new THREE.MeshBasicMaterial({ color: 0x234138, transparent: true, opacity: 0.18, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.02;
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 36), new THREE.MeshBasicMaterial({ color: 0x128c76, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.035;
    this.avatar.add(this.body, contact, halo);
  }

  setCampus(places: Building[], paths: CampusPath[]): void {
    this.clearRoute();
    disposeGroup(this.campus);
    this.floorGroups.clear();
    this.labels.forEach((label) => label.remove());
    this.labels.clear();
    this.places = places;
    this.segments = walkSegments(places, paths);
    for (const floor of new Set(places.map((place) => place.floor))) {
      const group = new THREE.Group();
      this.floorGroups.set(floor, group);
      this.campus.add(group);
      const bounds = new THREE.Box3().setFromPoints(places.filter((place) => place.floor === floor).map(toScenePosition)).expandByScalar(5);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const slab = new THREE.Mesh(new THREE.BoxGeometry(size.x, 0.3, size.z), new THREE.MeshStandardMaterial({ color: 0xfaf9f3, roughness: 0.9 }));
      slab.position.set(center.x, floor * FLOOR_HEIGHT - 0.2, center.z);
      slab.castShadow = slab.receiveShadow = true;
      group.add(slab);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), new THREE.LineBasicMaterial({ color: 0xc8cfbf }));
      edge.position.copy(slab.position);
      group.add(edge);
    }
    for (const segment of this.segments) {
      if (segment.source.floor !== segment.target.floor) continue;
      const length = segment.a.distanceTo(segment.b);
      const corridor = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.05, Math.max(length, 0.01)), new THREE.MeshStandardMaterial({ color: segment.path.kind === "outdoor" ? 0xcdd9c0 : 0xdfe5da, roughness: 0.85 }));
      corridor.position.copy(segment.a).add(segment.b).multiplyScalar(0.5).y -= 0.015;
      corridor.rotation.y = Math.atan2(segment.b.x - segment.a.x, segment.b.z - segment.a.z);
      corridor.receiveShadow = true;
      this.floorGroups.get(segment.source.floor)?.add(corridor);
    }
    for (const place of places) {
      const isWaypoint = ["waypoint", "junction", "corridor", "reference"].includes(place.building_type ?? "");
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(isWaypoint ? 0.25 : 0.7, isWaypoint ? 0.25 : 0.7, 0.12, 32), new THREE.MeshStandardMaterial({ color: place.building_type === "entrance" ? 0x5fae91 : 0xb8c6b5 }));
      marker.position.copy(toScenePosition(place)).y += 0.04;
      marker.receiveShadow = true;
      this.floorGroups.get(place.floor)!.add(marker);
      if (isWaypoint) continue;
      const label = document.createElement("button");
      label.className = "place-label";
      label.textContent = place.name;
      label.type = "button";
      label.title = `Navigate to ${place.name}`;
      label.addEventListener("click", () => this.events.select(place));
      this.container.appendChild(label);
      this.labels.set(place.id, label);
    }
    const firstFloor = Math.min(...places.map((place) => place.floor));
    this.setFloor(Number.isFinite(firstFloor) ? firstFloor : 0);
    if (places.length) this.setOrigin(places.find((place) => place.building_type === "entrance") ?? places[0]);
  }

  setFloor(floor: number, fit = true): void {
    this.viewFloor = floor;
    this.renderer.shadowMap.needsUpdate = true;
    const ground = this.scene.getObjectByName("presentation-ground");
    if (ground) ground.position.y = floor * FLOOR_HEIGHT - 0.5;
    this.floorGroups.forEach((group, level) => { group.visible = level === floor && this.reference?.floor !== floor; });
    this.modelGroup.visible = this.reference?.floor === floor;
    this.avatar.visible = this.places.length > 0 && this.avatarFloor === floor;
    if (fit) this.resetView();
    this.events.floor(floor);
  }
  setOrigin(place: Building): void {
    this.clearRoute();
    this.avatar.position.copy(toScenePosition(place));
    this.avatarFloor = place.floor;
    this.avatar.visible = true;
    this.setFloor(place.floor);
    this.emit();
  }
  getRoutingStart(): ReturnType<typeof routingStart> { return routingStart(this.avatar.position, this.places, this.segments, this.avatarFloor); }
  setDestination(place: Building | undefined): void {
    this.labels.forEach((label, id) => label.classList.toggle("selected", id === place?.id));
    this.destinationRing.visible = !!place;
    if (place) this.destinationRing.position.copy(toScenePosition(place)).y += 0.12;
  }
  showRoute(points: THREE.Vector3[]): void {
    this.clearRoute();
    this.waypoints = points.filter((point, index) => index === 0 || point.distanceTo(points[index - 1]) > 0.001).map((point) => point.clone());
    if (!this.waypoints.length) return;
    if (this.avatar.position.distanceTo(this.waypoints[0]) > 0.1) throw new Error("Your position changed. Calculate the route again.");
    for (let i = 1; i < this.waypoints.length; i++) {
      const a = this.waypoints[i - 1].clone().add(new THREE.Vector3(0, 0.13, 0));
      const b = this.waypoints[i].clone().add(new THREE.Vector3(0, 0.13, 0));
      this.routeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, 0.09, 8, false), new THREE.MeshStandardMaterial({ color: 0x0b9279, emissive: 0x075943, emissiveIntensity: 0.25, roughness: 0.65 })));
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), new THREE.MeshStandardMaterial({ color: 0x0b9279 }));
      dot.position.copy(b);
      this.routeGroup.add(dot);
    }
    this.index = 1;
    this.totalLength = this.remaining();
    this.state = this.waypoints.length === 1 ? "arrived" : "ready";
    this.emit();
  }
  follow(): void { if (["ready", "paused"].includes(this.state)) { this.keys.clear(); this.state = "walking"; this.emit(); } }
  pause(): void { if (this.state === "walking") { this.state = "paused"; this.emit(); } }
  cancel(): void { this.clearRoute(); this.emit(); }
  clearRoute(): void { disposeGroup(this.routeGroup); this.waypoints = []; this.index = 1; this.totalLength = 0; this.state = "idle"; }
  toggleLabels(): boolean { this.labelsVisible = !this.labelsVisible; return this.labelsVisible; }
  toggleReferences(): boolean { this.referenceGroup.visible = !this.referenceGroup.visible; return this.referenceGroup.visible; }
  setTopView(top: boolean): void { this.topView = top; this.resetView(); }
  zoom(amount: number): void { this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * amount, 0.45, 4); this.camera.updateProjectionMatrix(); }

  resetView(): void {
    const points = this.places.filter((place) => place.floor === this.viewFloor).map(toScenePosition);
    const bounds = points.length ? new THREE.Box3().setFromPoints(points).expandByScalar(5) : new THREE.Box3(new THREE.Vector3(-20, 0, -15), new THREE.Vector3(20, 0, 15));
    if (this.reference?.floor === this.viewFloor) bounds.union(new THREE.Box3().setFromObject(this.modelGroup));
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const aspect = this.container.clientWidth / Math.max(this.container.clientHeight, 1);
    this.frustum = Math.max(18, size.z * 0.75, (size.x + size.z * (this.topView ? 0 : 0.35)) / aspect * 0.64);
    this.camera.zoom = 1;
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(this.topView ? new THREE.Vector3(0, 85, 0.001) : new THREE.Vector3(24, 55, 42));
    this.controls.update();
    this.resize();
  }
  async loadModel(): Promise<void> {
    const response = await fetch(`${import.meta.env.BASE_URL}models/campus-reference.json`, { cache: "no-cache" });
    if (response.status === 404) { this.events.model("Sample campus · real floor model pending", false); return; }
    if (!response.ok) throw new Error("Could not read the campus model references.");
    const reference = parseReference(await response.json());
    const aligned = validateAlignment(reference, this.places);
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${reference.model}`);
    const root = new THREE.Group();
    root.applyMatrix4(referenceMatrix(reference));
    root.add(gltf.scene);
    root.updateMatrixWorld(true);
    validateModelNodes(reference, root);
    const collisionMeshes: THREE.Object3D[] = [];
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = !/^(Site|Floor_Slab|Ramps_Stairs|Glass)/.test(object.name);
        object.receiveShadow = true;
        collisionMeshes.push(object);
      }
    });
    disposeGroup(this.modelGroup);
    this.modelGroup.add(root);
    this.collisionMeshes = collisionMeshes;
    this.reference = reference;
    disposeGroup(this.referenceGroup);
    for (const [index, point] of aligned.entries()) {
      const pin = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 12), new THREE.MeshBasicMaterial({ color: [0xea8c36, 0x437ec8, 0xb25ca9][index % 3] }));
      pin.position.copy(point.position).y += 0.8;
      this.referenceGroup.add(pin);
    }
    this.setFloor(reference.floor);
    this.events.model(`${reference.label} · ${aligned.length} references aligned`, true);
  }
  exportView(): void {
    this.renderer.render(this.scene, this.camera);
    const link = document.createElement("a");
    link.download = `uninav-route-floor-${this.viewFloor}.png`;
    link.href = this.renderer.domElement.toDataURL("image/png");
    link.click();
  }
  private collides(from: THREE.Vector3, to: THREE.Vector3): boolean {
    if (!this.collisionMeshes.length || this.reference?.floor !== this.avatarFloor) return false;
    const direction = to.clone().sub(from);
    const distance = direction.length();
    if (distance < 0.0001) return false;
    direction.normalize();
    for (const height of [0.45, 1.2]) for (const offset of [-0.22, 0, 0.22]) {
      const start = from.clone().add(new THREE.Vector3(-direction.z * offset, height, direction.x * offset));
      if (new THREE.Raycaster(start, direction, 0, distance + 0.25).intersectObjects(this.collisionMeshes, false).length) return true;
    }
    return false;
  }
  private remaining(): number {
    if (this.index >= this.waypoints.length) return 0;
    let distance = this.avatar.position.distanceTo(this.waypoints[this.index]);
    for (let i = this.index + 1; i < this.waypoints.length; i++) distance += this.waypoints[i - 1].distanceTo(this.waypoints[i]);
    return distance;
  }
  private emit(): void {
    const remaining = this.remaining();
    this.events.travel({ state: this.state, position: this.avatar.position.toArray(), floor: this.avatarFloor, remaining,
      progress: this.totalLength > 0 ? 1 - remaining / this.totalLength : this.state === "arrived" ? 1 : 0, waypoint: this.index });
  }
  private tick(): void {
    // Preserve walking speed on slower presentation GPUs. Each movement remains
    // bounded and its entire segment is checked against the model.
    const delta = Math.min(this.clock.getDelta(), 0.15);
    let moved = false;
    if (this.state === "walking" && this.index < this.waypoints.length) {
      const target = this.waypoints[this.index];
      const direction = target.clone().sub(this.avatar.position);
      const next = this.avatar.position.clone().add(direction.clone().setLength(Math.min(WALK_SPEED * delta, direction.length())));
      if (this.collides(this.avatar.position, next)) { this.state = "blocked"; this.emit(); }
      else {
        this.avatar.position.copy(next);
        if (direction.x * direction.x + direction.z * direction.z > 0.001) this.face(direction, delta);
        moved = true;
        if (next.distanceTo(target) < 0.005) { this.avatar.position.copy(target); this.index++; }
        const floor = Math.round(this.avatar.position.y / FLOOR_HEIGHT);
        if (floor !== this.avatarFloor) { this.avatarFloor = floor; this.setFloor(floor, false); }
        if (this.index >= this.waypoints.length) { this.state = "arrived"; this.emit(); }
      }
    } else if (this.keys.size && this.avatar.visible) {
      const dx = Number(this.keys.has("d") || this.keys.has("arrowright")) - Number(this.keys.has("a") || this.keys.has("arrowleft"));
      const dz = Number(this.keys.has("s") || this.keys.has("arrowdown")) - Number(this.keys.has("w") || this.keys.has("arrowup"));
      const direction = new THREE.Vector3(dx, 0, dz).normalize();
      const next = this.avatar.position.clone().addScaledVector(direction, WALK_SPEED * delta);
      if (canWalk(this.avatar.position, next, this.segments, this.avatarFloor) && !this.collides(this.avatar.position, next)) {
        this.avatar.position.copy(next); this.face(direction, delta); moved = true;
      }
    }
    if (moved) this.walkTime += delta;
    this.body.position.y = moved ? Math.sin(this.walkTime * 15) * 0.035 : 0;
    this.controls.update();
    const projection = new THREE.Vector3();
    const axis = document.getElementById("plan-axis");
    if (axis) {
      const zero = new THREE.Vector3().project(this.camera);
      const direction = new THREE.Vector3(0, 0, -1).project(this.camera).sub(zero);
      axis.style.transform = `rotate(${Math.atan2(direction.x, direction.y) * 180 / Math.PI}deg)`;
    }
    this.labels.forEach((label, id) => {
      const place = this.places.find((candidate) => candidate.id === id)!;
      projection.copy(toScenePosition(place)).y += 0.6;
      projection.project(this.camera);
      const visible = this.labelsVisible && place.floor === this.viewFloor && Math.abs(projection.x) < 0.92 && Math.abs(projection.y) < 0.9 && projection.z < 1;
      label.hidden = !visible;
      if (visible) { label.style.left = `${(projection.x * 0.5 + 0.5) * this.container.clientWidth}px`; label.style.top = `${(-projection.y * 0.5 + 0.5) * this.container.clientHeight}px`; }
    });
    this.destinationRing.scale.setScalar(1 + Math.sin(this.clock.elapsedTime * 2) * 0.06);
    this.lastEmission += delta;
    if (this.lastEmission > 0.12) { this.lastEmission = 0; this.emit(); }
    this.renderer.render(this.scene, this.camera);
  }
  private face(direction: THREE.Vector3, delta: number): void {
    const target = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-direction.x, -direction.z));
    this.body.quaternion.slerp(target, Math.min(delta * 10, 1));
  }
  private resize(): void {
    const width = Math.max(this.container.clientWidth, 1), height = Math.max(this.container.clientHeight, 1);
    const aspect = width / height;
    Object.assign(this.camera, { left: -this.frustum * aspect, right: this.frustum * aspect, top: this.frustum, bottom: -this.frustum });
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  dispose(): void {
    this.renderer.setAnimationLoop(null); this.abort.abort(); this.resizeObserver.disconnect(); this.controls.dispose();
    [this.campus, this.routeGroup, this.modelGroup, this.referenceGroup, this.avatar].forEach(disposeGroup);
    this.renderer.dispose(); this.labels.forEach((label) => label.remove());
  }
}
