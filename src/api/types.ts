export type PathKind = "corridor" | "stairs" | "elevator" | "ramp" | "outdoor";

export interface Token {
  access_token: string;
  token_type: string;
}

export interface User {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

export interface Building {
  id: number;
  name: string;
  x: number;
  y: number;
  floor: number;
  code?: string;
  display_name?: string | null;
  block_code?: string | null;
  floor_code?: string | null;
  elevation_m?: number | null;
  effective_elevation_m?: number;
  elevation_source?: string | null;
  data_scope?: string | null;
  faculty: string | null;
  building_type: string | null;
}

export interface CampusPath {
  id: number;
  code?: string;
  source_id: number;
  target_id: number;
  source_name: string;
  target_name: string;
  weight: number;
  bidirectional: boolean;
  kind: PathKind;
}

export interface RouteRequest {
  origin_id: number;
  destination_id: number;
  algorithm?: "a_star" | "dijkstra";
  avoid?: PathKind[];
}

export interface RouteStep {
  origin_name: string;
  destination_name: string;
  kind: PathKind;
  distance: number;
  origin_id?: number;
  destination_id?: number;
  path_id?: number;
  connection_code?: string;
  origin_display_name?: string;
  destination_display_name?: string;
}

export interface RouteWaypoint {
  id: number;
  code: string;
  name: string;
  display_name: string;
  x: number;
  y: number;
  floor: number;
  elevation_m: number;
  block_code: string | null;
  floor_code: string | null;
}

export interface RouteResponse {
  waypoints?: RouteWaypoint[];
  path: string[];
  steps: RouteStep[];
  distance: number;
  origin_name: string;
  destination_name: string;
}

export interface Health {
  status: string;
  buildings: number;
  edges: number;
}

export interface Floor {
  level: number;
  name: string;
  building_count: number;
}

// Plan 1 §11 application functions (existing FastAPI endpoints)
export interface RouteVisit { id: number; origin_name: string; destination_name: string; distance: number; visited_at: string }
export interface UserStats { total_routes: number; total_distance: number; average_distance: number; most_visited_destination: string | null }
export interface PopularPlace { rank: number; building_id: number; building_name: string; floor: number; visits: number }
export interface PopularRoute { origin_name: string; destination_name: string; frequency: number }
export interface TourSummary { id: number; name: string; description: string | null; stop_count: number }
export interface TourStop { position: number; building_id: number; building_name: string; floor: number }
export interface Tour { id: number; name: string; description: string | null; stops: TourStop[] }
export interface TourSession { tour_id: number; tour_name: string; current_stop: TourStop; total_stops: number }
export interface QueueStatus { building_id: number; building_name: string; length: number }
export interface QueuePosition extends QueueStatus { position: number }
export interface NavigationStop { building_id: number; building_name: string; floor: number }
export interface NavigationState { current: NavigationStop | null; can_go_back: boolean; can_go_forward: boolean }
export interface NavigationTrail extends NavigationState { trail: (NavigationStop & { is_current: boolean })[] }
export interface BuildingUpdate { display_name?: string | null; building_type?: string | null; faculty?: string | null }
