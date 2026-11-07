export interface CatalogFloor {
  id: string; level: number; name: string; source_label: string;
  datum_elevation_m: number; evidence: "confirmed" | "derived" | "pending";
}
export interface CatalogBlock {
  id: string; name: string; identity_evidence: "confirmed" | "derived" | "pending";
  source: string; floors: CatalogFloor[];
}
export interface CampusCatalog {
  version: 1; id: string; revision: string; source: string;
  integrated_dataset: { id: string; revision: string; label: string; legacy_floor: number;
    model_elevation_m: number; elevation_evidence: "confirmed" | "derived" | "provisional" };
  blocks: CatalogBlock[]; unassigned_sheets: string[]; notes: string[];
}
const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
export function parseCatalog(value: unknown): CampusCatalog {
  if (!value || typeof value !== "object") throw new Error("Invalid campus catalogue.");
  const catalog = value as CampusCatalog, dataset = catalog.integrated_dataset;
  if (catalog.version !== 1 || !nonempty(catalog.id) || !nonempty(catalog.revision) || !nonempty(catalog.source) ||
    !dataset || !nonempty(dataset.id) || !nonempty(dataset.revision) || !nonempty(dataset.label) ||
    !Number.isInteger(dataset.legacy_floor) || !Number.isFinite(dataset.model_elevation_m) ||
    !["confirmed","derived","provisional"].includes(dataset.elevation_evidence) ||
    !Array.isArray(catalog.blocks) || !Array.isArray(catalog.notes) || catalog.notes.some((n) => !nonempty(n)) ||
    !Array.isArray(catalog.unassigned_sheets) || catalog.unassigned_sheets.some((n) => !nonempty(n))) throw new Error("Incomplete campus catalogue.");
  const ids = new Set<string>();
  for (const block of catalog.blocks) {
    if (!block || !nonempty(block.id) || !nonempty(block.name) || !nonempty(block.source) ||
      !["confirmed","derived","pending"].includes(block.identity_evidence) || !Array.isArray(block.floors) || ids.has(block.id)) throw new Error("Invalid or duplicate catalogue block.");
    ids.add(block.id);
    for (const floor of block.floors) {
      if (!floor || !nonempty(floor.id) || ids.has(floor.id) || !nonempty(floor.name) || !nonempty(floor.source_label) ||
        !Number.isInteger(floor.level) || floor.level < 0 || floor.level > 7 || !Number.isFinite(floor.datum_elevation_m) ||
        !["confirmed","derived","pending"].includes(floor.evidence)) throw new Error("Invalid or duplicate catalogue floor.");
      ids.add(floor.id);
    }
  }
  return catalog;
}
