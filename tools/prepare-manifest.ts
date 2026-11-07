import { readFile, writeFile } from "node:fs/promises";
import { parseCatalog } from "../src/scene/catalog.ts";
import { dataFingerprint, parseManifest, sha256, type CampusManifest, type ModelEntry } from "../src/scene/modelManifest.ts";
import { parseReference } from "../src/scene/modelReference.ts";
import type { Building, CampusPath } from "../src/api/types.ts";
import { committedAsset } from "./reviewed-assets.ts";

// Run after reviewing a new export; never regenerate bindings automatically in
// the application. Preserve entries belonging to independently integrated floors.
const api = process.env.UNINAV_TEST_URL ?? "http://127.0.0.1:8001";
const catalog = parseCatalog(JSON.parse(await readFile(new URL("../../data/campus-catalog.json",import.meta.url),"utf8")));
const sourceCommit = process.env.UNINAV_MODEL_COMMIT ?? "efd05d1";
const referenceBytes = await committedAsset(sourceCommit,"models/campus-reference.json");
const reference = parseReference(JSON.parse(referenceBytes.toString("utf8")));
const places = await (await fetch(`${api}/buildings`)).json() as Building[];
const paths = await (await fetch(`${api}/paths`)).json() as CampusPath[];
const placeNames = places.filter((place) => place.floor === reference.floor).map((place) => place.name).sort();
let previous: CampusManifest | undefined;
try { previous = parseManifest(JSON.parse(await readFile("public/models/campus-manifest.json","utf8"))); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
const baseline: ModelEntry = { id:"ucc-first-floor",label:"UCC · First floor",floors:[reference.floor],state:"ready",revision:process.env.UNINAV_MODEL_REVISION ?? "C2-efd05d1",
    sourceCommit,reference:"models/campus-reference.json",referenceSha256:await sha256(referenceBytes),
    modelSha256:await sha256(await committedAsset(sourceCommit,`models/${reference.model}`)),
    binding:{ placeNames,sha256:await dataFingerprint(placeNames,places,paths) } };
const models = previous?.models.map((entry) => entry.id === baseline.id ? baseline : entry) ?? [];
if (!models.some((entry) => entry.id === baseline.id)) models.push(baseline);
const manifest: CampusManifest = { ...previous,version:1,catalog,models };
parseManifest(manifest);
await writeFile("public/models/campus-manifest.json",JSON.stringify(manifest,null,2)+"\n");
console.log(`Prepared ${manifest.models.length} model entries; catalogue ${catalog.revision}. Review and rehearse before publishing.`);
