import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./style.css";
import { api, ApiError } from "./api/client.ts";
import type { Building, CampusPath, Floor, RouteResponse } from "./api/types.ts";
import { CampusScene, type TravelState, type TravelUpdate } from "./scene/campus.ts";
import { resolveRoute } from "./scene/navigation.ts";
import { toScenePosition, WALK_SPEED } from "./scene/coordinates.ts";

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
let travelState: TravelState = "idle";
let revision = 0, loading = false, signedIn = false, registerMode = false, pendingNavigation = false;
let scene: CampusScene | null = null;
let overviewVisible = false;

function showError(target: HTMLElement, error: unknown): void {
  target.textContent = error instanceof Error ? error.message : String(error);
  target.hidden = false;
}
function placeName(place: Building): string { return place.display_name ?? place.name; }
function floorName(level: number): string { return floors.find((floor) => floor.level === level)?.name ?? `Floor ${level}`; }
function clearRoute(): void {
  revision++;
  currentRoute = null;
  scene?.cancel();
  ui.card.hidden = true;
  ui.routeError.hidden = true;
}
function renderPlaces(): void {
  const query = ui.search.value.trim().toLowerCase();
  const selectedFloor = ui.destinationFloor.value;
  const places = buildings.filter((place) => !["waypoint", "junction", "corridor", "reference"].includes(place.building_type ?? "") &&
    (selectedFloor === "all" || place.floor === Number(selectedFloor)) &&
    `${placeName(place)} ${place.name} ${place.block_code ?? ""} ${place.faculty ?? ""} ${place.building_type ?? ""} ${floorName(place.floor)}`.toLowerCase().includes(query));
  ui.count.textContent = `${places.length} places`;
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
    meta.textContent = `${place.block_code ? `Block ${place.block_code} · ` : ""}${floorName(place.floor)} · ${(place.building_type ?? "place").replaceAll("_", " ")}`;
    text.append(title, meta);
    const arrow = document.createElement("span"); arrow.className = "place-arrow"; arrow.textContent = "↗";
    button.append(icon, text, arrow);
    button.addEventListener("click", () => selectDestination(place));
    ui.places.appendChild(button);
  }
  if (!places.length) {
    const empty = document.createElement("p"); empty.className = "empty-state";
    empty.textContent = buildings.length ? "No matching places. Try another name or floor." : "No campus places are available yet.";
    ui.places.appendChild(empty);
  }
}
function selectDestination(place: Building): void {
  clearRoute();
  destination = place;
  scene?.setDestination(place);
  scene?.setFloor(place.floor);
  ui.preview.hidden = false;
  ui.destinationName.textContent = placeName(place);
  ui.destinationMeta.textContent = `${place.block_code ? `Block ${place.block_code} · ` : ""}${floorName(place.floor)} · ${place.faculty ?? "Campus"}`;
  ui.calculate.disabled = false;
  renderPlaces();
}
function showSession(username: string | null): void {
  signedIn = username !== null;
  ui.openLogin.hidden = signedIn;
  ui.session.hidden = !signedIn;
  ui.username.textContent = username ?? "";
  ui.initial.textContent = username?.slice(0, 1).toUpperCase() ?? "";
  if (!signedIn) clearRoute();
}
function openLogin(): void {
  ui.loginError.hidden = true;
  if (!ui.dialog.open) ui.dialog.showModal();
}
function updateTravel(update: TravelUpdate): void {
  const changed = travelState !== update.state;
  travelState = update.state;
  const inspectingPreview = ui.modelStatus.dataset.preview === "true";
  const title: Record<TravelState, string> = {
    idle: inspectingPreview ? "Inspecting this floor" : "Ready to explore", ready: "Your route is ready", walking: "On your way", paused: "Taking a pause",
    arrived: `You've arrived${destination ? ` at ${placeName(destination)}` : ""}`, blocked: "The walkway is blocked",
  };
  if (changed || ui.travelStatus.textContent !== title[update.state]) ui.travelStatus.textContent = title[update.state];
  ui.travelStatus.dataset.state = update.state;
  document.querySelectorAll<HTMLElement>(".walk-status .keycap").forEach((key) => { key.hidden = inspectingPreview; });
  ui.travelDetail.textContent = update.state === "idle" ? (inspectingPreview ? "View only · routes on this floor are pending." : overviewVisible ? "Choose a destination or open a floor to start walking." : "W A S D to walk · Drag to orbit · Scroll to zoom") :
    update.state === "blocked" ? "Model geometry obstructs this route. Check the corridor alignment." :
    update.state === "arrived" ? `${floorName(update.floor)} · Choose another place to keep exploring.` :
    `${update.remaining.toFixed(1)} m remaining · ${floorName(update.floor)} · Esc to cancel`;
  ui.progress.value = update.progress;
  ui.follow.textContent = update.state === "walking" ? "Pause walking Ⅱ" : update.state === "paused" ? "Resume walking →" : update.state === "arrived" ? "Destination reached ✓" : "Start walking →";
  ui.follow.disabled = ["idle", "arrived", "blocked"].includes(update.state);
  element<HTMLButtonElement>("campus-overview").disabled = ["ready","walking","paused"].includes(update.state);
  if (update.state === "idle" && currentRoute) { currentRoute = null; ui.card.hidden = true; revision++; }
  if (update.state === "blocked" && changed) showError(ui.routeError, "The model blocks the calculated corridor. Cancel and check the reference points or graph.");
  const activeStep = Math.max(0, update.waypoint - 2);
  Array.from(ui.steps.children).forEach((item, index) => item.classList.toggle("current", index === activeStep && update.state === "walking"));
  // Observable coordinates support the route rehearsal without exposing a control API.
  ui.travelStatus.dataset.position = update.position.map((value) => value.toFixed(3)).join(",");
}

try {
  scene = new CampusScene(element("scene"), {
    travel: updateTravel, select: selectDestination,
    floor: (floor) => { ui.floor.value = String(floor); element("floor-title").textContent = floorName(floor); },
    model: (message, loaded, detail) => { ui.modelStatus.textContent = message; ui.modelStatus.title = detail ?? ""; ui.modelStatus.classList.toggle("verified", loaded); element("references").hidden = !loaded; },
    view: syncViewControls,
    resources: (state) => {
      ui.modelStatus.dataset.view = state.overview ? "campus" : "floor";
      ui.modelStatus.dataset.preview = String(state.preview);
      ui.modelStatus.dataset.loadedModels = JSON.stringify(state.loaded);
      ui.modelStatus.dataset.visibleModels = JSON.stringify(state.visible);
      ui.modelStatus.dataset.colliders = String(state.colliders);
    },
  });
} catch (error) {
  ui.loading.querySelector("h3")!.textContent = "3D rendering is unavailable";
  ui.loading.querySelector("p")!.textContent = "Enable WebGL in your browser and reload this page.";
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
    ui.status.append(dot, ` Campus online · ${health.buildings} places`);
    ui.floor.replaceChildren(...floors.filter((floor) => floor.building_count > 0).map((floor) => new Option(String(floor.level).padStart(2, "0"), String(floor.level))));
    ui.destinationFloor.replaceChildren(new Option("All floors", "all"), ...floors.filter((floor) => floor.building_count > 0).map((floor) => new Option(floor.name, String(floor.level))));
    ui.origin.replaceChildren(...places.filter((place) => place.building_type !== "reference").map((place) => new Option(`${placeName(place)} · ${place.block_code ? `Block ${place.block_code} · ` : ""}F${place.floor}`, String(place.id))));
    ui.origin.disabled = !places.length;
    clearRoute();
    scene.setCampus(places, connections);
    const entry = places.find((place) => place.building_type === "entrance") ?? places[0];
    if (entry) ui.origin.value = String(entry.id);
    const candidates = places.filter((place) => place.floor === entry?.floor && place.id !== entry?.id && !["waypoint", "junction", "corridor", "reference", "stairs", "elevator"].includes(place.building_type ?? ""));
    destination = undefined;
    if (candidates[0]) selectDestination(candidates[0]);
    else { ui.preview.hidden = true; ui.calculate.disabled = true; renderPlaces(); }
    ui.loading.hidden = true;
    ui.modelStatus.textContent = "Sample campus · real floor model pending";
    try { await scene.loadModel(); }
    catch (error) {
      ui.modelStatus.textContent = "Model unavailable · using graph preview";
      ui.modelStatus.title = error instanceof Error ? error.message : String(error);
      ui.modelStatus.classList.remove("verified");
      element("references").hidden = true;
    }
    const catalog = scene.getCatalog();
    if (catalog) {
      const observed = ui.floor.value;
      const levels = [...new Set(catalog.blocks.flatMap((block) => block.floors.map((floor) => floor.level)))].sort((a,b) => a-b);
      ui.floor.replaceChildren(...levels.map((level) => new Option(`${String(level).padStart(2,"0")}${scene!.floorPresentation(level) === "preview" ? " · preview" : scene!.floorPresentation(level) === "pending" ? " · model pending" : ""}`,String(level))));
      ui.floor.value = observed;
    }
    const overview = element("campus-overview");
    overview.hidden = !scene.hasOverview();
    if (!overview.hidden) await scene.setOverview(true);
  } catch (error) {
    ui.status.textContent = "Campus connection unavailable";
    ui.loading.querySelector("h3")!.textContent = "Let's reconnect";
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
  ui.calculate.textContent = "Finding your route…";
  try {
    const start = scene.getRoutingStart();
    const route = await api.calculateRoute({ origin_id: start.place.id, destination_id: target.id, avoid: ui.avoidStairs.checked ? ["stairs"] : [] });
    if (revision !== requestRevision || !signedIn) return;
    const resolved = resolveRoute(route, buildings, paths, start.place.id, target.id);
    await scene.showRoute([...start.connector, ...resolved.slice(1).map(toScenePosition)]);
    if (revision !== requestRevision || !signedIn) return;
    currentRoute = route;
    ui.origin.value = String(start.place.id);
    scene.setFloor(start.place.floor);
    ui.card.hidden = false;
    const connectorLength = start.connector[0].distanceTo(start.connector[1]);
    const physicalDistance = resolved.slice(1).reduce((sum, place, index) => sum + toScenePosition(place).distanceTo(toScenePosition(resolved[index])), connectorLength);
    ui.distance.textContent = `${physicalDistance.toFixed(0)} m`;
    ui.title.textContent = placeName(target);
    ui.summary.textContent = `About ${Math.max(1, Math.ceil(physicalDistance / WALK_SPEED))} sec · ${resolved.length - 1} connections${ui.avoidStairs.checked ? " · Mapped stairs excluded" : ""}`;
    ui.steps.replaceChildren(...route.steps.map((step) => {
      const item = document.createElement("li");
      item.textContent = `${step.origin_display_name ?? step.origin_name} → ${step.destination_display_name ?? step.destination_name} · ${step.kind} · ${step.distance.toFixed(1)} m`;
      return item;
    }));
    ui.card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    if (revision !== requestRevision) return;
    clearRoute();
    if (error instanceof ApiError && error.status === 401) { showSession(null); pendingNavigation = true; openLogin(); }
    showError(ui.routeError, error);
  } finally {
    ui.calculate.disabled = !destination;
    ui.calculate.textContent = "Find my route ↗";
  }
}

ui.search.addEventListener("input", renderPlaces);
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
ui.openLogin.addEventListener("click", openLogin);
element("close-login").addEventListener("click", () => ui.dialog.close());
ui.dialog.addEventListener("close", () => { pendingNavigation = false; });
element("logout").addEventListener("click", () => { api.logout(); showSession(null); });
ui.authToggle.addEventListener("click", () => {
  registerMode = !registerMode;
  ui.loginError.hidden = true;
  element("auth-title").textContent = registerMode ? "Make yourself at home." : "Your campus awaits.";
  ui.loginSubmit.textContent = registerMode ? "Create account →" : "Sign in →";
  ui.authToggle.textContent = registerMode ? "Already here? Sign in" : "New here? Create an account";
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
    showSession(user.username);
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
  overviewVisible = overview;
  for (const [id,active] of [["campus-overview",overview],["top-view",!overview&&top],["isometric",!overview&&!top]] as const) {
    element(id).classList.toggle("active",active); element(id).setAttribute("aria-pressed",String(active));
  }
  element("floor-title").textContent = overview ? "Campus overview" : floorName(Number(ui.floor.value));
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
    try { showSession((await api.me()).username); }
    catch (error) { if (error instanceof ApiError && error.status === 401) api.logout(); showSession(null); }
  } else showSession(null);
}
if (import.meta.hot) import.meta.hot.dispose(() => scene?.dispose());
void start();
