import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Building, CampusPath, RouteResponse } from "../api/types.ts";
import { FLOOR_HEIGHT, toScenePosition, WALK_SPEED } from "./coordinates.ts";
import { advanceWalk, manualStep, nearbyStairFloors, routingStart, stairNetworks, walkSegments, type StairNetwork, type WalkSegment, type WalkWaypoint } from "./navigation.ts";
import { parseReference, referenceMatrix, transformMatrix, validateAlignment, validateModelNodes, type CampusReference } from "./modelReference.ts";
import { modelColliders, modelCollision, type ModelCollider } from "./modelCollision.ts";
import { prepareModelPresentation, setModelTopView } from "./modelPresentation.ts";
import { disposeGroup } from "./dispose.ts";
import { dataFingerprint, parseManifest, requiredModels, sha256, type CampusManifest, type ModelEntry } from "./modelManifest.ts";
import { ModelStore } from "./modelStore.ts";
import type { CampusCatalog } from "./catalog.ts";
import { supportColliders, supportedStep } from "./walkSupport.ts";
import { selectModelProfile } from "./modelProfiles.ts";
import { routeUsesStairs } from "./routeConstraints.ts";
import { AVATAR, avatarAnimation, type AvatarAnimation } from "./avatarAsset.ts";

interface LoadedCampusModel {
  entry: ModelEntry; reference?: CampusReference; root: THREE.Group;
  pins: THREE.Group; colliders: ModelCollider[]; supports: ModelCollider[]; outdoorSupports:ModelCollider[]; references: number;
}

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
  model: (message: string, loaded: boolean, detail?: string) => void;
  view: (overview: boolean, top: boolean) => void;
  resources: (state: { overview: boolean; preview: boolean; loaded: string[]; visible: string[]; colliders: number; profile:string }) => void;
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
  private readonly labelSizes = new Map<number,{width:number;height:number}>();
  private readonly floorGroups = new Map<number, THREE.Group>();
  private readonly keys = new Set<string>();
  private readonly abort = new AbortController();
  private readonly resizeObserver: ResizeObserver;
  private places: Building[] = [];
  private paths: CampusPath[] = [];
  private manifest: CampusManifest | null = null;
  private profile="base";
  private catalogMatched=false;
  private models: ModelStore<LoadedCampusModel> | null = null;
  private routeGeneration = 0;
  private segments: WalkSegment[] = [];
  private stairs: StairNetwork[] = [];
  private movementModelKey = "";
  private waypoints: WalkWaypoint[] = [];
  private index = 1;
  private state: TravelState = "idle";
  private totalLength = 0;
  private viewFloor = 0;
  private avatarFloor = 0;
  private frustum = 35;
  private fittedSize: { width: number; height: number } | null = null;
  private topView = false;
  private overview = false;
  private overviewError: string | null = null;
  private destinationFloor: number | undefined;
  private labelsVisible = true;
  private colliders: ModelCollider[] = [];
  private supports: ModelCollider[] = [];
  private outdoorSupports:ModelCollider[]=[];
  private lastEmission = 0;
  private walkTime = 0;
  private mixer: THREE.AnimationMixer | null = null;
  private clips: Partial<Record<AvatarAnimation, THREE.AnimationAction>> = {};
  private clip: AvatarAnimation = "Idle";
  private lastMove: number | null = null;

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
    this.renderer.domElement.setAttribute("aria-label", "Campus 3D interactivo. Usa W A S D o las flechas para caminar; arrastra para girar la vista.");
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
    this.controls.addEventListener("start", () => { this.fittedSize = null; });
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
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.ShadowMaterial({ opacity: .12 }));
    ground.rotation.x = -Math.PI / 2;
    ground.name = "presentation-ground";
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.makeAvatar();
    void this.loadAvatar();
    void document.fonts.ready.then(()=>{if(!this.abort.signal.aborted)this.labelSizes.clear();});
    this.avatar.visible = false;
    this.destinationRing = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.065, 8, 48), new THREE.MeshStandardMaterial({ color: 0x0e8b75, emissive: 0x075c4d, emissiveIntensity: 0.4 }));
    this.destinationRing.rotation.x = -Math.PI / 2;
    this.destinationRing.visible = false;
    this.scene.add(this.destinationRing);
    const options = { signal: this.abort.signal };
    window.addEventListener("keydown", (event) => {
      if (document.querySelector("dialog[open]")) return;
      const key = event.key.toLowerCase();
      if (key === "escape") { this.cancel(); return; }
      if (event.target instanceof HTMLElement && (event.target.closest("input, select, textarea, button") || event.target.isContentEditable)) return;
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
        if (this.state !== "idle") this.cancel();
        this.keys.add(key);
      }
    }, options);
    window.addEventListener("keyup", (event) => {
      if (this.keys.delete(event.key.toLowerCase())) this.emit();
    }, options);
    window.addEventListener("blur", () => this.keys.clear(), options);
    window.addEventListener("focusin", () => this.keys.clear(), options);
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
    this.container.dataset.avatar = "procedural";
  }

  // Replace the procedural figure with the reviewed faceless avatar and its Idle/Walk clips. The collision volume does
  // not change (body rays at ±0.22 m); a missing or altered file keeps the procedural fallback.
  private async loadAvatar(): Promise<void> {
    try {
      const response = await fetch(AVATAR.url, { signal: this.abort.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (await sha256(bytes) !== AVATAR.sha256) throw new Error("Avatar export changed; keeping the procedural avatar.");
      const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, "");
      if (this.abort.signal.aborted) { disposeGroup(gltf.scene); return; }
      const idle = THREE.AnimationClip.findByName(gltf.animations, "Idle"), walk = THREE.AnimationClip.findByName(gltf.animations, "Walk");
      if (!idle || !walk) throw new Error("Avatar clips Idle/Walk are missing.");
      gltf.scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.frustumCulled = false; } });
      const facing = new THREE.Group();
      facing.rotation.y = Math.PI; // the export faces +Z; the body's forward is -Z (see face())
      facing.add(gltf.scene);
      disposeGroup(this.body);
      this.body.add(facing);
      this.mixer = new THREE.AnimationMixer(gltf.scene);
      this.clips = { Idle: this.mixer.clipAction(idle), Walk: this.mixer.clipAction(walk) };
      this.clips.Walk!.timeScale = WALK_SPEED / AVATAR.walkCycleMetres;
      this.clips.Idle!.play();
      this.clip = "Idle";
      this.container.dataset.avatar = "glb:Idle";
    } catch (error) {
      if (!this.abort.signal.aborted) { console.warn(`Avatar unavailable: ${String(error)}`); this.container.dataset.avatar = "procedural"; }
    }
  }

  private animateAvatar(moved: boolean, delta: number): void {
    const now = this.clock.elapsedTime;
    if (moved) this.lastMove = now;
    if (!this.mixer) {
      if (moved) this.walkTime += delta;
      this.body.position.y = moved ? Math.sin(this.walkTime * 15) * 0.035 : 0;
      return;
    }
    const next = avatarAnimation(now, this.lastMove);
    if (next !== this.clip) {
      const from = this.clips[this.clip]!, to = this.clips[next]!;
      to.reset().setEffectiveWeight(1).fadeIn(AVATAR.crossFadeSeconds).play();
      from.fadeOut(AVATAR.crossFadeSeconds);
      this.clip = next;
      this.container.dataset.avatar = `glb:${next}`;
    }
    this.mixer.update(delta);
  }

  setCampus(places: Building[], paths: CampusPath[]): void {
    this.clearRoute();
    disposeGroup(this.campus);
    this.floorGroups.clear();
    this.labels.forEach((label) => label.remove());
    this.labels.clear();
    this.labelSizes.clear();
    this.places = places;
    this.paths = paths;
    this.segments = walkSegments(places, paths);
    this.stairs = stairNetworks(this.segments);
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
      label.textContent = place.display_name ?? place.name;
      label.type = "button";
      label.title = `Ir a ${place.display_name ?? place.name}`;
      label.addEventListener("click", () => this.events.select(place));
      this.container.appendChild(label);
      this.labels.set(place.id, label);
    }
    const firstFloor = Math.min(...places.map((place) => place.floor));
    this.setFloor(Number.isFinite(firstFloor) ? firstFloor : 0);
    if (places.length) this.setOrigin(places.find((place) => place.building_type === "entrance") ?? places[0]);
  }

  setFloor(floor: number, fit = true, preserveKeys = false): void {
    this.overviewError = null;
    if (!preserveKeys) this.keys.clear();
    this.overview = false;
    this.viewFloor = floor;
    this.renderer.shadowMap.needsUpdate = true;
    const ground = this.scene.getObjectByName("presentation-ground");
    if (ground) ground.position.y = floor * FLOOR_HEIGHT - 0.5;
    this.applyModels(fit);
    this.events.floor(floor);
    this.events.view(false,this.topView);
    if (this.manifest) void this.syncModels().catch((error) => this.events.model("Modelo no disponible · mostrando las conexiones",false,String(error)));
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
  routeUsesStairs(route:RouteResponse,start:ReturnType<typeof routingStart>):boolean {
    return routeUsesStairs(route,this.getCatalog() ? this.manifest?.stairCrossings:[],start);
  }
  setDestination(place: Building | undefined): void {
    this.destinationFloor = place?.floor;
    this.labels.forEach((label, id) => label.classList.toggle("selected", id === place?.id));
    this.destinationRing.visible = !!place && !this.overview && place.floor === this.viewFloor;
    if (place) this.destinationRing.position.copy(toScenePosition(place)).y += 0.12;
  }
  async showRoute(points: WalkWaypoint[]): Promise<void> {
    this.overviewError = null;
    this.overview = false;
    this.events.view(false,this.topView);
    this.applyModels(false);
    this.clearRoute();
    const generation = this.routeGeneration;
    this.waypoints = points.map((point) => ({ ...point,position:point.position.clone() }));
    if (!this.waypoints.length) return;
    if (this.avatar.position.distanceTo(this.waypoints[0].position) > 0.1 || this.avatarFloor !== this.waypoints[0].floor) throw new Error("Tu posición cambió. Vuelve a calcular la ruta.");
    await this.syncModels(true);
    if (generation !== this.routeGeneration) return;
    if (this.getCatalog()) for (const floor of this.routeFloors()) {
      if (!this.models?.values().some((model) => model.entry.kind !== "floor-preview" && model.entry.floors.includes(floor))) throw new Error(`La navegación del piso ${floor} está pendiente. Todavía no se puede seguir esta ruta.`);
    }
    for (let i = 1; i < this.waypoints.length; i++) {
      if (this.waypoints[i-1].position.distanceToSquared(this.waypoints[i].position)<0.000001) continue;
      const a = this.waypoints[i - 1].position.clone().add(new THREE.Vector3(0, 0.13, 0));
      const b = this.waypoints[i].position.clone().add(new THREE.Vector3(0, 0.13, 0));
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
  follow(): void {
    if (["ready", "paused"].includes(this.state)) {
      this.keys.clear();
      if (this.viewFloor !== this.avatarFloor) this.setFloor(this.avatarFloor);
      this.state = "walking"; this.emit();
    }
  }
  pause(): void { if (this.state === "walking") { this.state = "paused"; this.emit(); } }
  cancel(): void { this.clearRoute(); this.emit(); }
  clearRoute(): void {
    this.routeGeneration++;
    disposeGroup(this.routeGroup); this.waypoints = []; this.index = 1; this.totalLength = 0; this.state = "idle";
    if (this.manifest) void this.syncModels().catch((error) => this.events.model("Modelo no disponible · mostrando las conexiones",false,String(error)));
  }
  toggleLabels(): boolean { this.labelsVisible = !this.labelsVisible; return this.labelsVisible; }
  toggleReferences(): boolean { this.referenceGroup.visible = !this.referenceGroup.visible; return this.referenceGroup.visible; }
  setTopView(top: boolean): void {
    this.overviewError = null;
    this.overview = false;
    this.topView = top;
    this.applyModels(false);
    setModelTopView(this.modelGroup, top);
    this.renderer.shadowMap.needsUpdate = true;
    this.resetView();
    this.events.view(false,top);
    if (this.manifest) void this.syncModels().catch((error) => this.events.model("Modelo no disponible · mostrando las conexiones",false,String(error)));
  }
  hasOverview(): boolean {
    return !!this.getCatalog() && !!this.manifest?.models.some((entry) => entry.kind === "exterior" && entry.state === "ready") &&
      !!this.models?.values().some((model) => model.entry.kind !== "exterior");
  }
  async setOverview(enabled: boolean): Promise<void> {
    if (enabled && (!this.hasOverview() || ["ready","walking","paused"].includes(this.state))) return;
    this.overviewError = null;
    this.overview = enabled; this.topView = false; this.keys.clear();
    this.applyModels(true); this.events.view(enabled,false);
    try {
      await this.syncModels(true);
      if (this.overview && !this.models?.values().some((model) => model.entry.kind === "exterior")) throw new Error("El exterior del campus no está disponible.");
    } catch (error) {
      this.overviewError = error instanceof Error ? error.message : String(error);
      this.overview = false; this.applyModels(true); this.events.view(false,false);
      await this.syncModels();
      this.events.model("Exterior no disponible · vista del piso",true,String(error));
    }
  }
  zoom(amount: number): void { this.fittedSize = null; this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * amount, 0.45, 4); this.camera.updateProjectionMatrix(); }

  resetView(): void {
    const points = this.places.filter((place) => this.overview || place.floor === this.viewFloor).map(toScenePosition);
    const visibleModels = this.models?.values().filter((model) => model.root.visible) ?? [];
    const bounds = points.length ? new THREE.Box3().setFromPoints(points).expandByScalar(5) : visibleModels.length ? new THREE.Box3() : new THREE.Box3(new THREE.Vector3(-20, 0, -15), new THREE.Vector3(20, 0, 15));
    for (const model of visibleModels) bounds.union(new THREE.Box3().setFromObject(model.root));
    const center = bounds.getCenter(new THREE.Vector3());
    this.camera.zoom = 1;
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(this.topView ? new THREE.Vector3(0, 85, 0.001) : this.overview ? new THREE.Vector3(45, 50, 70) : new THREE.Vector3(24, 55, 42));
    this.controls.update();
    this.camera.updateMatrixWorld(true);
    const projected = new THREE.Box3();
    for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z])
      projected.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(this.camera.matrixWorldInverse));
    const size = projected.getSize(new THREE.Vector3());
    this.fittedSize = { width: size.x, height: size.y };
    this.resize();
  }
  async loadModel(): Promise<void> {
    this.manifest = null;
    this.catalogMatched=false;
    this.profile="base";
    this.models?.dispose(); this.models = null;
    disposeGroup(this.modelGroup);
    disposeGroup(this.referenceGroup);
    this.colliders = [];
    this.supports = [];
    this.outdoorSupports=[];
    this.setFloor(this.viewFloor, false);
    this.events.model("Cargando el modelo del campus…", false);
    const response = await fetch(`${import.meta.env.BASE_URL}models/campus-manifest.json`, { cache:"no-cache" });
    if (response.status === 404) { this.events.model("Catálogo del modelo pendiente",false); return; }
    if (!response.ok) throw new Error("No se pudo leer el catálogo del modelo.");
    const selected=await selectModelProfile(parseManifest(await response.json()),this.places,this.paths);
    this.manifest=selected.manifest;this.profile=selected.profile;this.catalogMatched=selected.recognized;
    if(selected.error){this.applyModels(false);throw new Error(selected.error);}
    const entries = this.manifest.models;
    this.models = new ModelStore((id) => this.loadModelEntry(entries.find((entry) => entry.id === id)!), (model) => {
      model.root.removeFromParent(); model.pins.removeFromParent();
      disposeGroup(model.root); disposeGroup(model.pins);
    });
    await this.syncModels(true);
  }
  getCatalog(): CampusCatalog | null {
    // The unrelated sample API must not acquire the UCC inventory.
    return this.manifest && this.catalogMatched ? this.manifest.catalog:null;
  }
  floorPresentation(floor: number): "navigable" | "preview" | "pending" {
    if (!this.getCatalog()) return "pending";
    const entries = this.manifest!.models.filter((entry) => entry.state === "ready" && entry.floors.includes(floor));
    return entries.some((entry) => entry.kind !== "floor-preview") ? "navigable" : entries.length ? "preview" : "pending";
  }
  private async loadModelEntry(entry: ModelEntry): Promise<LoadedCampusModel> {
    if (entry.kind === "exterior") {
      const modelURL = new URL(entry.model!,new URL(import.meta.env.BASE_URL,location.href));
      const resource = await fetch(modelURL,{ cache:"no-cache" });
      if (!resource.ok) throw new Error("Could not load the campus exterior.");
      const bytes = await resource.arrayBuffer();
      if (await sha256(new Uint8Array(bytes)) !== entry.modelSha256) throw new Error("Campus exterior export changed. Review the manifest.");
      const gltf = await new GLTFLoader().parseAsync(bytes,new URL(".",modelURL).href);
      const root = new THREE.Group(); root.applyMatrix4(transformMatrix(entry.transform!)); root.add(gltf.scene); root.updateMatrixWorld(true);
      prepareModelPresentation(root);
      // Exterior geometry has no navigation references and never becomes a collider.
      return { entry,root,pins:new THREE.Group(),colliders:[],supports:[],outdoorSupports:[],references:0 };
    }
    const preview = entry.kind === "floor-preview";
    if (!preview && (!entry.binding || await dataFingerprint(entry.binding.placeNames,this.places,this.paths) !== entry.binding.sha256)) throw new Error(`Model data revision differs: ${entry.label}. Reload compatible campus data.`);
    const referenceURL = new URL(entry.reference!,new URL(import.meta.env.BASE_URL,location.href));
    const response = await fetch(referenceURL,{ cache:"no-cache" });
    if (!response.ok) throw new Error(`Could not read references for ${entry.label}.`);
    const referenceBytes = await response.arrayBuffer();
    if (await sha256(new Uint8Array(referenceBytes)) !== entry.referenceSha256) throw new Error(`Model references changed: ${entry.label}.`);
    const reference = parseReference(JSON.parse(new TextDecoder().decode(referenceBytes)));
    if (preview !== (reference.alignment === "structural")) throw new Error("Structural references are reserved for non-navigable floor previews.");
    if (entry.floors.length !== 1 || entry.floors[0] !== reference.floor) throw new Error("Model floor and reference floor differ.");
    const aligned = validateAlignment(reference, this.places);
    const modelURL = entry.model ? new URL(entry.model,new URL(import.meta.env.BASE_URL,location.href)):new URL(reference.model,referenceURL);
    const resource = await fetch(modelURL,{ cache:"no-cache" });
    if (!resource.ok) throw new Error(`Could not load ${entry.label}.`);
    const bytes = await resource.arrayBuffer();
    if (await sha256(new Uint8Array(bytes)) !== entry.modelSha256) throw new Error(`Model export changed: ${entry.label}. Review its manifest before integrating.`);
    const gltf = await new GLTFLoader().parseAsync(bytes,new URL(".",modelURL).href);
    const root = new THREE.Group();
    root.applyMatrix4(referenceMatrix(reference));
    root.add(gltf.scene);
    root.updateMatrixWorld(true);
    try { validateModelNodes(reference, root); }
    catch (error) { disposeGroup(root); throw error; }
    prepareModelPresentation(root);
    setModelTopView(root, this.topView);
    const pins = new THREE.Group();
    for (const [index, point] of aligned.entries()) {
      const pin = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 12), new THREE.MeshBasicMaterial({ color: [0xea8c36, 0x437ec8, 0xb25ca9][index % 3] }));
      pin.position.copy(point.position).y += 0.8;
      pins.add(pin);
    }
    let supports:ModelCollider[]=[],outdoorSupports:ModelCollider[]=[];
    try { supports=preview ? [] : supportColliders(root,entry.supportNodes ?? []);outdoorSupports=preview ? []:supportColliders(root,entry.outdoorSupportNodes ?? []); }
    catch (error) { disposeGroup(root); disposeGroup(pins); throw error; }
    return { entry,reference,root,pins,colliders:preview ? [] : modelColliders(root),supports,outdoorSupports,references:aligned.length };
  }
  private routeFloors(): number[] {
    return [...new Set(this.waypoints.map((point) => point.floor))];
  }
  private movementFloors(): number[] {
    return [...new Set([this.avatarFloor,...this.routeFloors(),...nearbyStairFloors(this.avatar.position,this.avatarFloor,this.stairs)])].sort();
  }
  private async syncModels(strict = false): Promise<void> {
    const store = this.models, manifest = this.manifest;
    if (!store || !manifest) return;
    const movementFloors=this.movementFloors();
    this.movementModelKey=movementFloors.join(",");
    const required = requiredModels(manifest,this.viewFloor,this.avatarFloor,movementFloors,this.overview)
      .filter((entry) => this.getCatalog() || (entry.kind !== "floor-preview" && entry.kind !== "exterior"));
    const missing = required.some((entry) => !store.values().some((model) => model.entry.id === entry.id));
    if (missing) this.events.model("Cargando el modelo del campus…",false);
    const result = await store.sync(required.map((entry) => entry.id));
    if (store !== this.models || !result.current) return;
    this.renderer.shadowMap.needsUpdate = true;
    this.applyModels(missing);
    if (result.errors.length) {
      if (strict) throw result.errors[0];
      this.events.model(this.floorPresentation(this.viewFloor) === "preview" ? "Vista previa no disponible · elige otro piso" : "Modelo no disponible · mostrando las conexiones",false,String(result.errors[0]));
    }
  }
  private applyModels(fit: boolean): void {
    const loaded = this.models?.values() ?? [];
    const floor = this.overview ? this.manifest?.catalog.integrated_dataset.legacy_floor : this.viewFloor;
    const floorModels = loaded.filter((model) => model.entry.kind !== "exterior" && model.entry.floors.includes(floor!));
    const exteriorModels = this.overview ? loaded.filter((model) => model.entry.kind === "exterior") : [];
    const active = [...floorModels,...exteriorModels];
    for (const model of loaded) {
      if (model.root.parent !== this.modelGroup) this.modelGroup.add(model.root);
      if (model.pins.parent !== this.referenceGroup) this.referenceGroup.add(model.pins);
      model.root.visible = active.includes(model);
      model.pins.visible = !this.overview && floorModels.includes(model);
      setModelTopView(model.root,this.topView);
    }
    const preview = floorModels.some((model) => model.entry.kind === "floor-preview");
    const ground = this.scene.getObjectByName("presentation-ground");
    if (ground) ground.position.y = Math.min((floorModels[0]?.reference?.transform.translation[1] ?? this.viewFloor * FLOOR_HEIGHT) - 0.5,
      ...floorModels.map(m=>new THREE.Box3().setFromObject(m.root).min.y-0.05));
    // Retain both sides of vertical transitions, including overhead geometry.
    // The swept bounds in modelCollision discard distant floors per movement.
    const collisionFloors=new Set(this.movementFloors());
    const walkingModels=loaded.filter((model) => model.entry.kind !== "exterior" && model.entry.kind !== "floor-preview" && model.entry.floors.some((floor) => collisionFloors.has(floor)));
    this.colliders = walkingModels.flatMap((model) => model.colliders);
    this.supports = walkingModels.flatMap((model) => model.supports);
    this.outdoorSupports=walkingModels.flatMap(m=>m.outdoorSupports);
    this.floorGroups.forEach((group,level) => { group.visible = !this.overview && level === this.viewFloor && !floorModels.length; });
    this.modelGroup.visible = !!active.length;
    this.routeGroup.visible = !this.overview && !preview;
    this.avatar.visible = this.places.length > 0 && this.avatarFloor === this.viewFloor && !this.overview && !preview;
    this.destinationRing.visible = this.destinationFloor === this.viewFloor && !this.overview;
    if (this.overview && exteriorModels.length) this.events.model(`Vista del campus · Piso 1: ${floorModels.reduce((sum,model) => sum+model.references,0)} referencias alineadas`,true,"El exterior sigue el marco documentado del primer piso. Los bloques y las fachadas conservan las aproximaciones documentadas.");
    else if (floorModels.length && this.overviewError) this.events.model("Exterior no disponible · vista del piso",true,this.overviewError);
    else if (preview) this.events.model(`Solo vista previa · ${floorModels.reduce((sum,model) => sum+model.references,0)} referencias estructurales alineadas`,true,"Solo para explorar. Las rutas y conexiones verticales están pendientes. El modelo simplifica los medios niveles documentados.");
    else if (floorModels.length) this.events.model(`${floorModels.map((model) => model.entry.label).join(" + ")} · ${floorModels.reduce((sum,model) => sum+model.references,0)} referencias alineadas`,true,
      this.manifest?.stairCrossings?.length ? "El modelo simplifica algunos cambios de nivel documentados. Evitar escaleras excluye sus conexiones registradas.":undefined);
    else if (this.manifest) this.events.model("Modelo de este piso pendiente",false);
    this.events.resources({ overview:this.overview,preview,loaded:loaded.map((model) => model.entry.id),visible:active.map((model) => model.entry.id),colliders:this.colliders.length,profile:this.profile });
    if (fit) this.resetView();
  }
  exportView(): void {
    this.renderer.render(this.scene, this.camera);
    const link = document.createElement("a");
    link.download = `uninav-route-floor-${this.viewFloor}.png`;
    link.href = this.renderer.domElement.toDataURL("image/png");
    link.click();
  }
  private collides(from: THREE.Vector3, to: THREE.Vector3): boolean {
    return !!modelCollision(from, to, this.colliders);
  }
  private remaining(): number {
    if (this.index >= this.waypoints.length) return 0;
    let distance = this.avatar.position.distanceTo(this.waypoints[this.index].position);
    for (let i = this.index + 1; i < this.waypoints.length; i++) distance += this.waypoints[i - 1].position.distanceTo(this.waypoints[i].position);
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
      const count=Math.max(1,Math.ceil(WALK_SPEED*delta/0.06));
      for (let i=0;i<count && this.state==="walking";i++) {
        const target=this.waypoints[this.index];
        const direction=target.position.clone().sub(this.avatar.position);
        const advanced=advanceWalk(this.avatar.position,this.avatarFloor,target,WALK_SPEED*delta/count);
        const stepSupport=target.kind==="stairs" || target.kind==="ramp" || (target.kind==="outdoor" && this.outdoorSupports.length>0);
        const next=stepSupport && this.getCatalog() ? supportedStep(this.avatar.position,advanced.position,target.kind==="outdoor" ? [...this.supports,...this.outdoorSupports]:this.supports) : advanced.position;
        if (!next || this.collides(this.avatar.position,next)) { this.state="blocked"; this.emit(); break; }
        this.avatar.position.copy(next); moved=true;
        if (direction.x*direction.x+direction.z*direction.z>0.001) this.face(direction,delta/count);
        if (advanced.reached) {
          this.index++;
          if (advanced.floor!==this.avatarFloor) { this.avatarFloor=advanced.floor; this.setFloor(advanced.floor,false); }
          if (this.index>=this.waypoints.length) { this.state="arrived"; this.emit(); }
          break;
        }
      }
    } else if (this.keys.size && this.avatar.visible) {
      const dx = Number(this.keys.has("d") || this.keys.has("arrowright")) - Number(this.keys.has("a") || this.keys.has("arrowleft"));
      const dz = Number(this.keys.has("s") || this.keys.has("arrowdown")) - Number(this.keys.has("w") || this.keys.has("arrowup"));
      const direction = new THREE.Vector3(dx, 0, dz).normalize();
      const modelsReady=!this.getCatalog() || this.movementFloors().every((floor) => this.models?.values().some((m) => m.entry.kind!=="floor-preview" && m.entry.kind!=="exterior" && m.entry.floors.includes(floor)));
      // Bound substeps below a tread depth, including on a slow frame. Never
      // skip a riser or a narrow unsupported gap with one long keyboard move.
      const count=Math.max(1,Math.ceil(WALK_SPEED*delta/0.06));
      for (let i=0;modelsReady && i<count;i++) {
        const next=this.avatar.position.clone().addScaledVector(direction,WALK_SPEED*delta/count);
        const step=manualStep(this.avatar.position,next,this.segments,this.avatarFloor,
          (from,expected,kind) => this.getCatalog() && (kind!=="outdoor" || this.outdoorSupports.length>0)
            ? supportedStep(from,expected,kind==="outdoor" ? [...this.supports,...this.outdoorSupports]:this.supports):expected,(from,to) => this.collides(from,to));
        if (!step) break;
        this.avatar.position.copy(step.position); this.face(direction,delta/count); moved=true;
        if (step.floor!==this.avatarFloor) { this.avatarFloor=step.floor; this.setFloor(step.floor,false,true); }
      }
    }
    if (this.manifest && this.movementFloors().join(",")!==this.movementModelKey) void this.syncModels().catch((error) => this.events.model("Modelo no disponible · mostrando las conexiones",false,String(error)));
    this.animateAvatar(moved, delta);
    this.controls.update();
    const projection = new THREE.Vector3();
    const axis = document.getElementById("plan-axis");
    if (axis) {
      const zero = new THREE.Vector3().project(this.camera);
      const direction = new THREE.Vector3(0, 0, -1).project(this.camera).sub(zero);
      axis.style.transform = `rotate(${Math.atan2(direction.x, direction.y) * 180 / Math.PI}deg)`;
    }
    // Measure as a batch only when labels/fonts/layout change, before position
    // writes. Prefer the destination, then hide overlapping labels as we zoom.
    const unmeasured=[...this.labels].filter(([id])=>!this.labelSizes.has(id));
    for(const [,label] of unmeasured)label.hidden=false;
    for(const [id,label] of unmeasured)this.labelSizes.set(id,{width:label.offsetWidth || 150,height:label.offsetHeight || 27});
    const candidates:{id:number;label:HTMLButtonElement;x:number;y:number;depth:number;selected:boolean}[]=[];
    this.labels.forEach((label, id) => {
      const place = this.places.find((candidate) => candidate.id === id)!;
      projection.copy(toScenePosition(place)).y += 0.6;
      projection.project(this.camera);
      const visible = !this.overview && this.labelsVisible && place.floor === this.viewFloor && Math.abs(projection.x) < 0.92 && Math.abs(projection.y) < 0.9 && projection.z < 1;
      label.hidden=true;
      if(visible)candidates.push({id,label,x:(projection.x*0.5+0.5)*this.container.clientWidth,y:(-projection.y*0.5+0.5)*this.container.clientHeight,depth:projection.z,selected:label.classList.contains("selected")});
    });
    const occupied:{left:number;top:number;right:number;bottom:number}[]=[];
    for(const p of candidates.sort((a,b)=>Number(b.selected)-Number(a.selected) || a.depth-b.depth)){
      const size=this.labelSizes.get(p.id)!,box={left:p.x-size.width/2,right:p.x+size.width/2,top:p.y-size.height*1.6,bottom:p.y-size.height*0.6};
      if(occupied.some(b=>box.left<b.right+6 && box.right>b.left-6 && box.top<b.bottom+6 && box.bottom>b.top-6))continue;
      occupied.push(box);p.label.hidden=false;p.label.style.left=`${p.x}px`;p.label.style.top=`${p.y}px`;
    }
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
    this.labelSizes.clear();
    const width = Math.max(this.container.clientWidth, 1), height = Math.max(this.container.clientHeight, 1);
    const aspect = width / height;
    if (this.fittedSize) this.frustum = Math.max(12, this.fittedSize.height / 2, this.fittedSize.width / (2 * aspect)) * 1.16;
    Object.assign(this.camera, { left: -this.frustum * aspect, right: this.frustum * aspect, top: this.frustum, bottom: -this.frustum });
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  dispose(): void {
    this.renderer.setAnimationLoop(null); this.abort.abort(); this.resizeObserver.disconnect(); this.controls.dispose();
    this.mixer?.stopAllAction(); this.mixer = null; this.clips = {};
    this.models?.dispose(); this.models = null;
    disposeGroup(this.scene);
    this.colliders = [];
    this.supports = [];
    this.outdoorSupports=[];
    this.renderer.dispose(); this.labels.forEach((label) => label.remove());
  }
}
