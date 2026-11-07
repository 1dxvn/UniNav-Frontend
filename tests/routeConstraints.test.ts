import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { routeUsesStairs } from "../src/scene/routeConstraints.ts";
import { parseManifest } from "../src/scene/modelManifest.ts";
import { readFile } from "node:fs/promises";
import type { RouteResponse } from "../src/api/types.ts";
import type { WalkStart } from "../src/scene/navigation.ts";

const crossing={connectionCode:"hall-steps",originName:"Corridor",destinationName:"Hall",source:"registered sheet"};
function route(a:string,b:string,kind:"corridor"|"stairs"="corridor"):RouteResponse{return {path:[a,b],origin_name:a,destination_name:b,distance:2,steps:[{origin_name:a,destination_name:b,kind,distance:2}]};}

test("mapped steps reject both directions of a legacy corridor, without closing the entire hall area",()=>{
  assert.equal(routeUsesStairs(route("Corridor","Hall"),[crossing]),true);
  assert.equal(routeUsesStairs(route("Hall","Corridor"),[crossing]),true);
  assert.equal(routeUsesStairs(route("Hall","Preclinic"),[crossing]),false);
  assert.equal(routeUsesStairs(route("ICETEX","Corridor"),[crossing]),false);
  assert.equal(routeUsesStairs(route("Corridor","Hall")),false);
  assert.equal(routeUsesStairs(route("Tower bottom","Tower top","stairs")),true);
});

test("replanning cannot hide a stair-containing connector behind a stair-free API route",()=>{
  const start={floor:1,connector:[new Vector3(1,3.5,0),new Vector3(2,3.5,0)],
    path:{source_name:"Corridor",target_name:"Hall",kind:"corridor"}} as WalkStart;
  assert.equal(routeUsesStairs(route("Hall","Preclinic"),[crossing],start),true);
  start.connector[0].copy(start.connector[1]);
  assert.equal(routeUsesStairs(route("Hall","Preclinic"),[crossing],start),false);
});

test("manifest rejects duplicate or untraceable stair constraints",async()=>{
  const source=JSON.parse(await readFile(new URL("../public/models/campus-manifest.json",import.meta.url),"utf8"));
  assert.throws(()=>parseManifest({...source,stairCrossings:[crossing,crossing]}),/Mapped stair crossings/);
  assert.throws(()=>parseManifest({...source,stairCrossings:[{...crossing,source:""}]}),/Mapped stair crossings/);
  assert.throws(()=>parseManifest({...source,stairCrossings:[{...crossing,planBounds:[1,2,0,3]}]}),/Mapped stair bounds/);
  assert.throws(()=>parseManifest({...source,stairCrossings:[crossing]}),/Mapped stair endpoints/);
});

test("connector restrictions use the drawn stair footprint, preserving the clear part of a mixed connection",()=>{
  const c={...crossing,planBounds:[27.3,47.86,29.8,49.23] as [number,number,number,number]};
  const start={floor:1,connector:[new Vector3(28,3.5,-37),new Vector3(28,3.5,-36.5)],path:{source_name:"Corridor",target_name:"Hall",kind:"stairs"}} as WalkStart;
  assert.equal(routeUsesStairs(route("Hall","Preclinic"),[c],start),false);
  start.connector=[new Vector3(28,3.5,-48),new Vector3(28,3.5,-47.6)];
  assert.equal(routeUsesStairs(route("Hall","Preclinic"),[c],start),true);
  start.connector.reverse();assert.equal(routeUsesStairs(route("Hall","Preclinic"),[c],start),true);
  start.connector=[new Vector3(28,3.5,-49.32),new Vector3(28,3.5,-50)];
  assert.equal(routeUsesStairs(route("Hall","Preclinic"),[c],start),true); // Footprint still meets the fourth nosing.
  start.connector=[new Vector3(20,3.5,-48),new Vector3(21,3.5,-48)];
  assert.equal(routeUsesStairs(route("Hall","Preclinic"),[c],start),false);
});
