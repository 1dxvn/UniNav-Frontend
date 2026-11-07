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
  faculty: string | null;
  building_type: string | null;
}

export interface CampusPath {
  id: number;
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
}

export interface RouteResponse {
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
