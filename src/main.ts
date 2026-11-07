import "./style.css";
import { api, ApiError } from "./api/client.ts";
import type { Building, PathKind } from "./api/types.ts";
import { CampusScene, toScenePosition } from "./scene/campusScene.ts";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

const ui = {
  status: element<HTMLParagraphElement>("api-status"),
  loginForm: element<HTMLFormElement>("login-form"),
  loginError: element<HTMLParagraphElement>("login-error"),
  session: element<HTMLDivElement>("session"),
  sessionUser: element<HTMLElement>("session-user"),
  logout: element<HTMLButtonElement>("logout"),
  origin: element<HTMLSelectElement>("origin"),
  destination: element<HTMLSelectElement>("destination"),
  avoidStairs: element<HTMLInputElement>("avoid-stairs"),
  calculate: element<HTMLButtonElement>("calculate"),
  routeError: element<HTMLParagraphElement>("route-error"),
  routeSteps: element<HTMLOListElement>("route-steps"),
  routeSummary: element<HTMLParagraphElement>("route-summary"),
};

const scene = new CampusScene(element<HTMLDivElement>("scene"));
let buildings: Building[] = [];

function showError(target: HTMLParagraphElement, error: unknown): void {
  target.textContent = error instanceof Error ? error.message : String(error);
  target.hidden = false;
}

function fillSelect(select: HTMLSelectElement, places: Building[]): void {
  select.replaceChildren(
    ...places.map((place) => new Option(`${place.name} (floor ${place.floor})`, String(place.id))),
  );
}

function clearRouteDetails(): void {
  scene.clearRoute();
  ui.routeSteps.replaceChildren();
  ui.routeSummary.textContent = "";
}

async function loadCampus(): Promise<void> {
  const [health, places, paths] = await Promise.all([api.health(), api.buildings(), api.paths()]);
  buildings = places;
  ui.status.textContent = `API ${health.status} · ${health.buildings} places · ${health.edges} connections`;
  scene.setCampus(places, paths);
  fillSelect(ui.origin, places);
  fillSelect(ui.destination, places);
  if (places.length > 1) ui.destination.selectedIndex = places.length - 1;
}

function showSession(username: string | null): void {
  ui.loginForm.hidden = username !== null;
  ui.session.hidden = username === null;
  ui.sessionUser.textContent = username ?? "";
  if (username === null) clearRouteDetails();
}

ui.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  ui.loginError.hidden = true;
  const data = new FormData(ui.loginForm);
  try {
    const user = await api.login(String(data.get("username")), String(data.get("password")));
    ui.loginForm.reset();
    showSession(user.username);
  } catch (error) {
    showError(ui.loginError, error);
  }
});

ui.logout.addEventListener("click", () => {
  api.logout();
  showSession(null);
});

ui.calculate.addEventListener("click", async () => {
  ui.routeError.hidden = true;
  ui.calculate.disabled = true;
  try {
    const avoid: PathKind[] = ui.avoidStairs.checked ? ["stairs"] : [];
    const route = await api.calculateRoute({
      origin_id: Number(ui.origin.value),
      destination_id: Number(ui.destination.value),
      avoid,
    });
    const byName = new Map(buildings.map((place) => [place.name, place]));
    const points = route.path
      .map((name) => byName.get(name))
      .filter((place): place is Building => place !== undefined)
      .map(toScenePosition);
    scene.showRoute(points);
    ui.routeSteps.replaceChildren(
      ...route.steps.map((step) => {
        const item = document.createElement("li");
        item.textContent = `${step.origin_name} → ${step.destination_name} · ${step.kind} · ${step.distance.toFixed(1)} m`;
        return item;
      }),
    );
    ui.routeSummary.textContent = `${route.origin_name} to ${route.destination_name}: ${route.distance.toFixed(1)} m`;
  } catch (error) {
    clearRouteDetails();
    if (error instanceof ApiError && error.status === 401) showSession(null);
    showError(ui.routeError, error);
  } finally {
    ui.calculate.disabled = false;
  }
});

async function start(): Promise<void> {
  try {
    await loadCampus();
  } catch (error) {
    ui.status.textContent = `API unavailable: ${error instanceof Error ? error.message : String(error)}`;
    ui.status.classList.add("error");
  }
  if (api.hasToken()) {
    try {
      showSession((await api.me()).username);
      return;
    } catch {
      api.logout();
    }
  }
  showSession(null);
}

void start();
