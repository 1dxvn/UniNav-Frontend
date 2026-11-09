import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./style.css";
import { api, ApiError } from "./api/client.ts";
import type { Building, CampusPath, Floor, RouteResponse, User } from "./api/types.ts";
import { CampusScene, type TravelState, type TravelUpdate } from "./scene/campus.ts";
import { resolveRoute, walkWaypoints } from "./scene/navigation.ts";
import { toScenePosition, WALK_SPEED } from "./scene/coordinates.ts";
import { activeInstruction,routeInstructions,type RouteInstruction } from "./routeInstructions.ts";
import { Minimap } from "./minimap.ts";
import { CampusTools } from "./campusTools.ts";
import { ExplorerShell } from "./explorerShell.ts";
import { askCampus, normalize } from "./assistant.ts";
import {placeTypeLabel} from './placeLabels.ts';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}
const ui = {
  status: element("api-status"), origin: element<HTMLSelectElement>("origin"), search: element<HTMLInputElement>("search"),
  floor: element<HTMLSelectElement>("floor"), destinationFloor: element<HTMLSelectElement>("destination-floor"),
  places: element("place-list"), count: element("place-count"), preview: element("destination-preview"),
  destinationName: element("destination-name"), destinationMeta: element("destination-meta"),
  avoidStairs: element<HTMLInputElement>("avoid-stairs"), calculate: element<HTMLButtonElement>("calculate"),
  routeError: element("route-error"), card: element("route-card"), distance: element("route-distance"),
  title: element("route-title"), summary: element("route-summary"), progress: element<HTMLProgressElement>("route-progress"),
  follow: element<HTMLButtonElement>("follow"), cancel: element<HTMLButtonElement>("cancel"), steps: element("route-steps"),
  loading: element("map-loading"), retry: element<HTMLButtonElement>("retry"),
  dialog: element<HTMLDialogElement>("auth-dialog"), loginForm: element<HTMLFormElement>("login-form"),
  loginError: element("login-error"), loginSubmit: element<HTMLButtonElement>("login-submit"),
  authToggle: element<HTMLButtonElement>("auth-toggle"), openLogin: element<HTMLButtonElement>("open-login"),
  session: element("session"), username: element("session-user"), initial: element("user-initial"),
  travelStatus: element("travel-status"), travelDetail: element("travel-detail"), modelStatus: element("model-status"),
};
let buildings: Building[] = [], paths: CampusPath[] = [], floors: Floor[] = [];
let destination: Building | undefined;
let currentRoute: RouteResponse | null = null;
let directions:RouteInstruction[]=[];
let travelState: TravelState = "idle";
let revision = 0, loading = false, signedIn = false, registerMode = false, pendingNavigation = false;
let scene: CampusScene | null = null;
let role: string | null = null;
let loginReturnFocus: HTMLElement | null = null;
const minimap = new Minimap(document.getElementById("minimap") as unknown as SVGSVGElement, (place) => selectDestination(place));
const shell = new ExplorerShell(() => minimap.draw());
const sessionEvents = new AbortController();
window.addEventListener('uninav:session-expired', (event) => {
  showSession(null);
  pendingNavigation = (event as CustomEvent<{path:string}>).detail.path === '/routes/calculate';
  openLogin();
}, {signal:sessionEvents.signal});
const tools = new CampusTools(element("campus-tools"), element<HTMLButtonElement>("nav-back"), element<HTMLButtonElement>("nav-forward"), {
  places: () => buildings, destination: () => destination, floorName: (level) => floorName(level),
  select: (place) => selectDestination(place),
  routeTo: async (place) => { selectDestination(place); await calculateRoute(); },
  signedIn: () => signedIn, admin: () => role === "admin", openLogin: () => openLogin(),
  sessionExpired: () => showSession(null),
});

function showError(target: HTMLElement, error: unknown): void {
  target.textContent = error instanceof Error ? error.message : String(error);
  target.hidden = false;
  if (target === ui.routeError) shell.open("directions");
}
function placeName(place: Building): string { return place.display_name ?? place.name; }
function floorName(level: number): string { return `Piso ${level}`; }
function clearRoute(): void {
  revision++;
  currentRoute = null;
  directions=[];
  scene?.cancel();
  minimap.setRoute(null);
  ui.card.hidden = true;
  ui.routeError.hidden = true;
  shell.routeActive(false);
}
function renderPlaces(): void {
  const query = normalize(ui.search.value);
  const selectedFloor = ui.destinationFloor.value;
  const matches = query ? askCampus(ui.search.value, buildings, buildings.length).matches.map(match => match.place.id) : [];
  const places = buildings.filter((place) => !["waypoint", "junction", "corridor", "reference"].includes(place.building_type ?? "") &&
    (selectedFloor === "all" || place.floor === Number(selectedFloor)) &&
    (!query || matches.includes(place.id) || normalize(`${placeName(place)} ${place.name} ${place.block_code ?? ""} ${place.faculty ?? ""} ${place.building_type ?? ""} ${floorName(place.floor)}`).includes(query)));
  if (query) places.sort((a,b) => { const rank=(id:number) => matches.includes(id) ? matches.indexOf(id) : matches.length; return rank(a.id)-rank(b.id); });
  ui.count.textContent = `${places.length} ${places.length === 1 ? "lugar" : "lugares"}`;
  ui.places.replaceChildren();
  for (const place of places) {
    const button = document.createElement("button");
    button.className = `place-option${destination?.id === place.id ? " selected" : ""}`;
    button.type = "button";
    button.setAttribute("aria-pressed", String(destination?.id === place.id));
    const icon = document.createElement("span");
    icon.className = "place-icon";
    icon.textContent = place.building_type === "stairs" ? "↟" : place.building_type === "elevator" ? "↕" : "⌑";
    const text = document.createElement("span"), title = document.createElement("strong"), meta = document.createElement("small");
    title.textContent = placeName(place);
    meta.textContent = `${place.block_code ? `Bloque ${place.block_code} · ` : ""}${floorName(place.floor)} · ${placeTypeLabel(place.building_type)}`;
    text.append(title, meta);
    const arrow = document.createElement("span"); arrow.className = "place-arrow"; arrow.textContent = "↗";
    button.append(icon, text, arrow);
    button.addEventListener("click", () => selectDestination(place));
    ui.places.appendChild(button);
  }
  if (!places.length) {
    const empty = document.createElement("p"); empty.className = "empty-state";
    empty.textContent = buildings.length ? "No encontramos ese lugar. Prueba otro nombre o piso." : "Todavía no hay lugares disponibles.";
    ui.places.appendChild(empty);
  }
}
function selectDestination(place: Building, reveal = true): void {
  clearRoute();
  destination = place;
  scene?.setDestination(place);
  scene?.setFloor(place.floor);
  minimap.setDestination(place);
  ui.preview.hidden = false;
  ui.destinationName.textContent = placeName(place);
  ui.destinationMeta.textContent = `${place.block_code ? `Bloque ${place.block_code} · ` : ""}${floorName(place.floor)} · ${place.faculty ?? "Campus"}`;
  ui.calculate.disabled = false;
  renderPlaces();
  tools.destinationChanged();
  if (reveal) shell.selected();
}
function showSession(user: User | null): void {
  const username = user?.username ?? null;
  const changed = signedIn !== (username !== null) || role !== (user?.role ?? null) || ui.username.textContent !== (username ?? '');
  signedIn = username !== null;
  role = user?.role ?? null;
  ui.openLogin.hidden = signedIn;
  ui.session.hidden = !signedIn;
  ui.username.textContent = username ?? "";
  ui.initial.textContent = username?.slice(0, 1).toUpperCase() ?? "";
  if (!signedIn && changed) clearRoute();
  if (changed) void tools.refresh();
}
function openLogin(trigger?: HTMLElement): void {
  ui.loginError.hidden = true;
  if (!ui.dialog.open) {
    loginReturnFocus = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : ui.openLogin);
    ui.dialog.showModal();
  }
}
function updateTravel(update: TravelUpdate): void {
  const changed = travelState !== update.state;
  travelState = update.state;
  minimap.setAvatar(update.position, update.floor);
  if (changed && update.state === "arrived" && destination) void tools.arrived(destination);
  const activeStep=activeInstruction(directions,update.waypoint),cue=directions[activeStep]?.text;
  const inspectingPreview = ui.modelStatus.dataset.preview === "true";
  const title: Record<TravelState, string> = {
    idle: inspectingPreview ? "Explorando este piso" : "Listo para explorar", ready: "Tu ruta está lista", walking: "En camino", paused: "Recorrido en pausa",
    arrived: `Llegaste${destination ? ` a ${placeName(destination)}` : ""}`, blocked: "El paso está bloqueado",
  };
  if (changed || ui.travelStatus.textContent !== title[update.state]) ui.travelStatus.textContent = title[update.state];
  ui.travelStatus.dataset.state = update.state;
  document.querySelectorAll<HTMLElement>(".walk-status .keycap").forEach((key) => { key.hidden = inspectingPreview; });
  ui.travelDetail.textContent = update.state === "idle" ? (inspectingPreview ? "Vista previa; las rutas de este piso aún no están habilitadas." : "Elige un destino para comenzar.") :
    update.state === "blocked" ? "La geometría impide continuar. Puedes elegir otra ruta." :
    update.state === "arrived" ? `${floorName(update.floor)} · Elige otro lugar para seguir explorando.` :
    `${cue ? `${cue} · `:""}${update.remaining.toFixed(1)} m restantes · ${floorName(update.floor)}`;
  ui.progress.value = update.progress;
  ui.follow.textContent = update.state === "walking" ? "Pausar Ⅱ" : update.state === "paused" ? "Continuar →" : update.state === "arrived" ? "Llegaste ✓" : "Comenzar →";
  if (changed && update.state === "walking") shell.walking();
  ui.follow.disabled = ["idle", "arrived", "blocked"].includes(update.state);
  element<HTMLButtonElement>("campus-overview").disabled = ["ready","walking","paused"].includes(update.state);
  if (update.state === "idle" && currentRoute) {
    currentRoute = null; directions = []; minimap.setRoute(null);
    ui.card.hidden = true; shell.routeActive(false); revision++;
  }
  if (update.state === "blocked" && changed) showError(ui.routeError, "No se puede seguir esta ruta con la geometría disponible. Finaliza el recorrido y elige otra ruta.");
  Array.from(ui.steps.children).forEach((item,index)=>{
    const current=index===activeStep && ["walking","paused"].includes(update.state);
    item.classList.toggle("current",current);
    if(current)item.setAttribute("aria-current","step");else item.removeAttribute("aria-current");
  });
  // Observable coordinates support the route rehearsal without exposing a control API.
  ui.travelStatus.dataset.position = update.position.map((value) => value.toFixed(3)).join(",");
}

try {
  scene = new CampusScene(element("scene"), {
    travel: updateTravel, select: selectDestination,
    floor: (floor) => { ui.floor.value = String(floor); element("floor-title").textContent = floorName(floor); minimap.setFloor(floor); },
    model: (message, loaded, detail) => { ui.modelStatus.textContent = message; ui.modelStatus.title = detail ?? ""; ui.modelStatus.classList.toggle("verified", loaded); element("references").hidden = !loaded; },
    view: syncViewControls,
    resources: (state) => {
      ui.modelStatus.dataset.view = state.overview ? "campus" : "floor";
      ui.modelStatus.dataset.preview = String(state.preview);
      ui.modelStatus.dataset.loadedModels = JSON.stringify(state.loaded);
      ui.modelStatus.dataset.visibleModels = JSON.stringify(state.visible);
      ui.modelStatus.dataset.colliders = String(state.colliders);
      ui.modelStatus.dataset.profile = state.profile;
    },
  });
} catch (error) {
  ui.loading.querySelector("h3")!.textContent = "El visor 3D no está disponible";
  ui.loading.querySelector("p")!.textContent = "Activa WebGL en tu navegador y vuelve a cargar esta página.";
  ui.loading.querySelector(".loading-ring")!.remove();
  console.error(error);
}

async function loadCampus(): Promise<void> {
  if (loading || !scene) return;
  loading = true;
  ui.loading.hidden = false;
  ui.retry.hidden = true;
  try {
    const [health, places, connections, levels] = await Promise.all([api.health(), api.buildings(), api.paths(), api.floors()]);
    buildings = places; paths = connections; floors = levels;
    ui.status.replaceChildren();
    const dot = document.createElement("i"); dot.className = "status-dot online";
    ui.status.append(dot, ` Campus conectado · ${health.buildings} lugares`);
    ui.floor.replaceChildren(...floors.filter((floor) => floor.building_count > 0).map((floor) => new Option(String(floor.level).padStart(2, "0"), String(floor.level))));
    ui.destinationFloor.replaceChildren(new Option("Todos los pisos", "all"), ...floors.filter((floor) => floor.building_count > 0).map((floor) => new Option(floorName(floor.level), String(floor.level))));
    ui.origin.replaceChildren(...places.filter((place) => place.building_type !== "reference").map((place) => new Option(`${placeName(place)} · ${place.block_code ? `Bloque ${place.block_code} · ` : ""}F${place.floor}`, String(place.id))));
    ui.origin.disabled = !places.length;
    clearRoute();
    scene.setCampus(places, connections);
    minimap.setCampus(places, connections);
    const entry = places.find((place) => place.building_type === "entrance") ?? places[0];
    if (entry) ui.origin.value = String(entry.id);
    const candidates = places.filter((place) => place.floor === entry?.floor && place.id !== entry?.id && !["waypoint", "junction", "corridor", "reference", "stairs", "elevator"].includes(place.building_type ?? ""));
    destination = undefined;
    if (candidates[0]) selectDestination(candidates[0], false);
    else { ui.preview.hidden = true; ui.calculate.disabled = true; renderPlaces(); }
    ui.loading.hidden = true;
    ui.modelStatus.textContent = "Preparando el modelo del campus";
    try { await scene.loadModel(); }
    catch (error) {
      ui.modelStatus.textContent = "Modelo no disponible; puedes consultar los lugares y las conexiones";
      ui.modelStatus.title = error instanceof Error ? error.message : String(error);
      ui.modelStatus.classList.remove("verified");
      element("references").hidden = true;
    }
    const catalog = scene.getCatalog();
    if (catalog) {
      const observed = ui.floor.value;
      const levels = [...new Set(catalog.blocks.flatMap((block) => block.floors.map((floor) => floor.level)))].sort((a,b) => a-b);
      ui.floor.replaceChildren(...levels.map((level) => new Option(`${String(level).padStart(2,"0")}${scene!.floorPresentation(level) === "preview" ? " · vista previa" : scene!.floorPresentation(level) === "pending" ? " · modelo pendiente" : ""}`,String(level))));
      ui.floor.value = observed;
    }
    const overview = element("campus-overview");
    overview.hidden = !scene.hasOverview();
    if (!overview.hidden) await scene.setOverview(true);
  } catch (error) {
    ui.status.textContent = "No hay conexión con el campus";
    ui.loading.querySelector("h3")!.textContent = "Volvamos a conectar";
    ui.loading.querySelector("p")!.textContent = error instanceof Error ? error.message : String(error);
    ui.loading.querySelector(".loading-ring")?.classList.add("stopped");
    ui.retry.hidden = false;
  } finally { loading = false; }
}

async function calculateRoute(): Promise<void> {
  if (!destination || !scene) return;
  if (!signedIn) { pendingNavigation = true; openLogin(); return; }
  scene.pause();
  clearRoute();
  const requestRevision = revision;
  const target = destination;
  ui.calculate.disabled = true;
  ui.calculate.textContent = "Buscando tu ruta…";
  try {
    const start = scene.getRoutingStart();
    const route = await api.calculateRoute({ origin_id: start.place.id, destination_id: target.id, avoid: ui.avoidStairs.checked ? ["stairs"] : [] });
    if (revision !== requestRevision || !signedIn) return;
    const resolved = resolveRoute(route, buildings, paths, start.place.id, target.id);
    if(ui.avoidStairs.checked && scene.routeUsesStairs(route,start))throw new Error("Esta ruta tiene escalones. No hay un recorrido sin escaleras verificado.");
    await scene.showRoute(walkWaypoints(start,resolved,paths));
    if (revision !== requestRevision || !signedIn) return;
    currentRoute = route;
    minimap.setRoute(resolved);
    ui.origin.value = String(start.place.id);
    scene.setFloor(start.place.floor);
    ui.card.hidden = false;
    const connectorLength = start.connector[0].distanceTo(start.connector[1]);
    const physicalDistance = resolved.slice(1).reduce((sum, place, index) => sum + toScenePosition(place).distanceTo(toScenePosition(resolved[index])), connectorLength);
    ui.distance.textContent = `${physicalDistance.toFixed(0)} m`;
    ui.title.textContent = placeName(target);
    directions=routeInstructions(route,resolved,floorName,{distance:connectorLength,kind:start.kind ?? "corridor",floor:start.floor});
    ui.summary.textContent = `Aprox. ${Math.max(1, Math.ceil(physicalDistance / WALK_SPEED))} s · ${directions.length} indicaciones${ui.avoidStairs.checked ? " · Sin escaleras verificadas" : ""}`;
    ui.steps.replaceChildren(...directions.map((step) => {
      const item = document.createElement("li");
      item.textContent = `${step.text} · ${step.distance.toFixed(1)} m`;
      item.dataset.firstStep=String(step.firstStep);item.dataset.lastStep=String(step.lastStep);item.dataset.kind=step.kind;item.dataset.phase=step.phase;
      return item;
    }));
    shell.routeReady();
  } catch (error) {
    if (revision !== requestRevision) return;
    clearRoute();
    if (error instanceof ApiError && error.status === 401) { showSession(null); pendingNavigation = true; openLogin(); }
    showError(ui.routeError, error);
  } finally {
    ui.calculate.disabled = !destination;
    ui.calculate.textContent = "Encontrar mi ruta ↗";
  }
}

ui.search.addEventListener("input", renderPlaces);
ui.search.addEventListener('keydown', event => {
  if (event.isComposing) return;
  const first = ui.places.querySelector<HTMLButtonElement>('button');
  if (event.key === 'ArrowDown' && first) { event.preventDefault(); first.focus(); }
  else if (event.key === 'Enter' && first && ui.search.value.trim()) { event.preventDefault(); first.click(); }
});
ui.places.addEventListener('keydown', event => {
  const buttons = [...ui.places.querySelectorAll<HTMLButtonElement>('button')];
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0) return;
  if (event.key === 'ArrowDown') { event.preventDefault(); buttons[Math.min(index + 1, buttons.length - 1)]?.focus(); }
  else if (event.key === 'ArrowUp') { event.preventDefault(); if (index === 0) ui.search.focus(); else buttons[index - 1].focus(); }
});
ui.destinationFloor.addEventListener("change", () => { renderPlaces(); if (ui.destinationFloor.value !== "all") scene?.setFloor(Number(ui.destinationFloor.value)); });
ui.floor.addEventListener("change", () => scene?.setFloor(Number(ui.floor.value)));
ui.origin.addEventListener("change", () => {
  const place = buildings.find((candidate) => candidate.id === Number(ui.origin.value));
  if (place) { clearRoute(); scene?.setOrigin(place); }
});
ui.avoidStairs.addEventListener("change", clearRoute);
ui.calculate.addEventListener("click", () => void calculateRoute());
ui.follow.addEventListener("click", () => { if (travelState === "walking") scene?.pause(); else scene?.follow(); });
ui.cancel.addEventListener("click", clearRoute);
ui.retry.addEventListener("click", () => void loadCampus());
ui.openLogin.addEventListener("click", () => openLogin(ui.openLogin));
element("close-login").addEventListener("click", () => ui.dialog.close());
ui.dialog.addEventListener("close", () => {
  pendingNavigation = false;
  if (!signedIn) {
    const target = loginReturnFocus?.isConnected && loginReturnFocus.getClientRects().length ? loginReturnFocus : ui.openLogin;
    target.focus({preventScroll:true});
  }
});
ui.dialog.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...ui.dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')]
    .filter(node => !node.hidden && node.getClientRects().length);
  const first = controls[0], last = controls.at(-1);
  if ((!event.shiftKey && document.activeElement === last) || (event.shiftKey && document.activeElement === first)) {
    event.preventDefault(); (event.shiftKey ? last : first)?.focus();
  }
});
element("logout").addEventListener("click", () => { api.logout(); showSession(null); });
ui.authToggle.addEventListener("click", () => {
  registerMode = !registerMode;
  ui.loginError.hidden = true;
  element("auth-title").textContent = registerMode ? "Tu campus empieza aquí." : "Tu campus te espera.";
  ui.loginSubmit.textContent = registerMode ? "Crear cuenta →" : "Ingresar →";
  ui.authToggle.textContent = registerMode ? "¿Ya tienes cuenta? Ingresa" : "¿Primera vez? Crea una cuenta";
  const password = ui.loginForm.elements.namedItem("password") as HTMLInputElement;
  password.minLength = registerMode ? 6 : 1;
  password.autocomplete = registerMode ? "new-password" : "current-password";
});
ui.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  ui.loginError.hidden = true;
  ui.loginSubmit.disabled = ui.authToggle.disabled = true;
  const data = new FormData(ui.loginForm);
  try {
    const username = String(data.get("username")).trim(), password = String(data.get("password"));
    const user = await (registerMode ? api.register(username, password) : api.login(username, password));
    showSession(user);
    ui.loginForm.reset();
    const navigate = pendingNavigation;
    ui.dialog.close();
    if (navigate) await calculateRoute();
  } catch (error) { showError(ui.loginError, error); }
  finally { ui.loginSubmit.disabled = ui.authToggle.disabled = false; }
});
function viewMode(top: boolean): void {
  scene?.setTopView(top);
}
function syncViewControls(overview: boolean, top: boolean): void {
  for (const [id,active] of [["campus-overview",overview],["top-view",!overview&&top],["isometric",!overview&&!top]] as const) {
    element(id).classList.toggle("active",active); element(id).setAttribute("aria-pressed",String(active));
  }
  element("floor-title").textContent = overview ? "Tu campus, en 3D" : floorName(Number(ui.floor.value));
  ui.floor.closest<HTMLElement>(".floor-control")!.hidden = overview;
}
element("campus-overview").addEventListener("click",() => { void scene?.setOverview(true); });
element("top-view").addEventListener("click", () => viewMode(true));
element("isometric").addEventListener("click", () => viewMode(false));
element("zoom-in").addEventListener("click", () => scene?.zoom(1.2));
element("zoom-out").addEventListener("click", () => scene?.zoom(1 / 1.2));
element("reset-view").addEventListener("click", () => scene?.resetView());
element("labels").addEventListener("click", () => element("labels").setAttribute("aria-pressed", String(scene?.toggleLabels())));
element("references").addEventListener("click", () => element("references").setAttribute("aria-pressed", String(scene?.toggleReferences())));
element("export").addEventListener("click", () => scene?.exportView());

async function start(): Promise<void> {
  await loadCampus();
  if (api.hasToken()) {
    try { showSession(await api.me()); }
    catch (error) { if (error instanceof ApiError && error.status === 401) api.logout(); showSession(null); }
  } else showSession(null);
}
if (import.meta.hot) import.meta.hot.dispose(() => { sessionEvents.abort(); shell.dispose(); scene?.dispose(); });
void start();
