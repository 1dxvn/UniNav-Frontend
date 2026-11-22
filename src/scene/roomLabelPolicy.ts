import type { RoomAnnotation } from "./roomLabels.ts";

export type OrientationIcon = "entrance" | "stairs" | "elevator";
export interface RoomLabelDisplay { name: string; shortName: string; icon?: OrientationIcon }

// The complete DWG inventory stays in the source files. The public map only
// labels useful destinations; it has no review mode or provisional room codes.
export function presentRoomLabel(room: RoomAnnotation): RoomLabelDisplay | null {
  if (["P0-R042", "P1-R033"].includes(room.code)) return { name: "Escaleras", shortName: "Escaleras", icon: "stairs" };
  if (["P0-R078", "P1-R093"].includes(room.code)) return { name: "Ascensores", shortName: "Ascensores", icon: "elevator" };
  if (room.code === "P1-R080") return { name: "Acceso principal", shortName: "Acceso principal", icon: "entrance" };
  if (room.status !== "confirmed") return null;
  const name = room.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/^escaleras?\b/.test(name))return {name:"Escaleras",shortName:"Escaleras",icon:"stairs"};
  if (/^(hall de )?ascensores\b/.test(name))return {name:"Ascensores",shortName:"Ascensores",icon:"elevator"};
  if (/^(acceso|hall|pasillo|circulacion|cubierta|rejilla|zona verde|jardin|patio|plazoleta|balcon|terraza|rampa|vacio)\b/.test(name) ||
      /^(bodega|cuarto|compresor(?:es)?|succionador(?:es)?|subestacion|planta electrica|residuos|aseo|area limpia|area contaminada|area esteril|control|espacio disponible|archivo)\b/.test(name) ||
      name === "almacen") return null;
  return { name: room.text, shortName: room.shortText };
}

export function orientationSymbol(icon: OrientationIcon): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
  svg.classList.add("icon");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", {
    stairs: "M3 20h6v-5h5v-5h6V4M4 11l6-6M4 5h6v6",
    elevator: "M5 3h14v18H5zM9 10l3-3 3 3M12 7v10m-3-3 3 3 3-3",
    entrance: "M13 21h7V3H9v5M3 13h11m-4-4 4 4-4 4M9 18v3h4",
  }[icon]);
  svg.append(path); return svg;
}
