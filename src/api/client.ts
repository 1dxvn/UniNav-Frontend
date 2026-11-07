import type { Building, CampusPath, Floor, Health, RouteRequest, RouteResponse, Token, User } from "./types.ts";

// Same origin by default: FastAPI serves this app and the API from one host.
// VITE_API_BASE_URL can point elsewhere if the API is ever hosted separately.
const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const TOKEN_STORAGE_KEY = "uninav.token";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
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
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(15000) });
  } catch {
    throw new ApiError(0, "Cannot reach UniNav. Check your connection and try again.");
  }
  if (response.status === 401) storeToken(null);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message = describeError(body, `Request failed with status ${response.status}.`);
    const retry = response.headers.get("Retry-After");
    throw new ApiError(response.status, response.status === 429 && retry ? `${message} Try again in ${retry} seconds.` : message);
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
};
