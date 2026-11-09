import type { Building, BuildingUpdate, CampusPath, Floor, Health, NavigationState, NavigationTrail, PopularPlace, PopularRoute, QueuePosition, QueueStatus, RouteRequest, RouteResponse, RouteVisit, Token, Tour, TourSession, TourSummary, User, UserStats } from "./types.ts";

import {requestErrorMessage,retrySeconds} from './errors.ts';

// Same origin by default: FastAPI serves this app and the API from one host.
// VITE_API_BASE_URL can point elsewhere if the API is ever hosted separately.
const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const TOKEN_STORAGE_KEY = "uninav.token";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly retryAfterSeconds: number | null = null) {
    super(message);
  }
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

let token: string | null = readStoredToken();

function storeToken(value: string | null): void {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_STORAGE_KEY, value);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private mode); the token still lives in memory.
  }
}

function describeError(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => (item as { msg?: string }).msg ?? String(item)).join("; ");
    }
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const requestToken = token;
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(15000) });
  } catch {
    throw new ApiError(0, requestErrorMessage(0,path,''));
  }
  if (response.status === 401 && token === requestToken) {
    storeToken(null);
    if (requestToken) window.dispatchEvent(new CustomEvent('uninav:session-expired',{detail:{path}}));
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message = describeError(body, `Request failed with status ${response.status}.`);
    const retry = retrySeconds(response.headers.get("Retry-After"));
    throw new ApiError(response.status, requestErrorMessage(response.status,path,message,retry),retry);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  hasToken: (): boolean => token !== null,
  logout: (): void => storeToken(null),

  async login(username: string, password: string): Promise<User> {
    const result = await request<Token>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    storeToken(result.access_token);
    try { return await api.me(); }
    catch (error) { storeToken(null); throw error; }
  },

  async register(username: string, password: string): Promise<User> {
    await request<User>("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) });
    return api.login(username, password);
  },

  me: (): Promise<User> => request<User>("/auth/me"),
  health: (): Promise<Health> => request<Health>("/health"),
  buildings: (): Promise<Building[]> => request<Building[]>("/buildings"),
  paths: (): Promise<CampusPath[]> => request<CampusPath[]>("/paths"),
  floors: (): Promise<Floor[]> => request<Floor[]>("/floors"),
  calculateRoute: (body: RouteRequest): Promise<RouteResponse> =>
    request<RouteResponse>("/routes/calculate", { method: "POST", body: JSON.stringify(body) }),

  // History and statistics
  history: (limit = 10): Promise<RouteVisit[]> => request<RouteVisit[]>(`/routes/history?limit=${limit}`),
  clearHistory: (): Promise<void> => request<void>("/routes/history", { method: "DELETE" }),
  stats: (): Promise<UserStats> => request<UserStats>("/users/me/stats"),
  // Back and forward over visited places, persisted by the updated API worker.
  trail: (): Promise<NavigationTrail> => request<NavigationTrail>("/navigation"),
  visit: (buildingId: number): Promise<NavigationState> => request<NavigationState>("/navigation/visit", { method: "POST", body: JSON.stringify({ building_id: buildingId }) }),
  back: (): Promise<NavigationState> => request<NavigationState>("/navigation/back", { method: "POST" }),
  forward: (): Promise<NavigationState> => request<NavigationState>("/navigation/forward", { method: "POST" }),
  // Guided tours
  tours: (): Promise<TourSummary[]> => request<TourSummary[]>("/tours"),
  tour: (id: number): Promise<Tour> => request<Tour>(`/tours/${id}`),
  createTour: (name: string, description: string | null, buildingIds: number[]): Promise<Tour> =>
    request<Tour>("/tours", { method: "POST", body: JSON.stringify({ name, description, building_ids: buildingIds }) }),
  deleteTour: (id: number): Promise<void> => request<void>(`/tours/${id}`, { method: "DELETE" }),
  startTour: (id: number): Promise<TourSession> => request<TourSession>(`/tours/${id}/start`, { method: "POST" }),
  tourSession: (): Promise<TourSession> => request<TourSession>("/tours/session"),
  nextStop: (): Promise<TourSession> => request<TourSession>("/tours/session/next", { method: "POST" }),
  previousStop: (): Promise<TourSession> => request<TourSession>("/tours/session/previous", { method: "POST" }),
  endTour: (): Promise<void> => request<void>("/tours/session", { method: "DELETE" }),
  // Queues and rankings
  queue: (buildingId: number): Promise<QueueStatus> => request<QueueStatus>(`/queues/${buildingId}`),
  queuePosition: (buildingId: number): Promise<QueuePosition> => request<QueuePosition>(`/queues/${buildingId}/position`),
  joinQueue: (buildingId: number): Promise<QueuePosition> => request<QueuePosition>(`/queues/${buildingId}/join`, { method: "POST" }),
  leaveQueue: (buildingId: number): Promise<void> => request<void>(`/queues/${buildingId}/leave`, { method: "DELETE" }),
  serveQueue: (buildingId: number): Promise<unknown> => request<unknown>(`/queues/${buildingId}/serve`, { method: "POST" }),
  rankings: (limit = 10): Promise<PopularPlace[]> => request<PopularPlace[]>(`/rankings/places?limit=${limit}`),
  popularRoutes: (): Promise<PopularRoute[]> => request<PopularRoute[]>("/routes/popular"),
  // Administration (admin role)
  updateBuilding: (id: number, body: BuildingUpdate): Promise<Building> => request<Building>(`/buildings/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  reloadGraph: (): Promise<unknown> => request<unknown>("/graph/reload", { method: "POST" }),
};
