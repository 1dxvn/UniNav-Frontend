import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { Building,PathKind,RouteResponse } from "../src/api/types.ts";
import { routeInstructions,activeInstruction } from "../src/routeInstructions.ts";
import { toScenePosition } from "../src/scene/coordinates.ts";

const floor=(n:number)=>`Floor ${n}`;
const p=(id:number,x:number,y:number,height=3.5,level=1,type="waypoint"):Building=>({id,name:`Internal point ${id}`,x,y,floor:level,elevation_m:height,building_type:type,faculty:null});
function route(points:Building[],kinds:PathKind[]=points.slice(1).map(()=>"corridor")):RouteResponse{return {path:points.map(p=>p.name),origin_name:points[0].name,destination_name:points.at(-1)!.name,distance:100,
  steps:points.slice(1).map((b,i)=>({origin_name:points[i].name,destination_name:b.name,kind:kinds[i],distance:100}))};}

test("actual three-floor paths keep every API edge, two landings, floor targets and physical distance",async()=>{
  const contract=JSON.parse(await readFile(new URL("../docs/verification/c17/compatibility/ucc-three-floors-c16-contract.json",import.meta.url),"utf8"));
  const walks=JSON.parse(await readFile(new URL("../docs/verification/c17/three-floors/computer-lab-1-entrance-walks.json",import.meta.url),"utf8"));
  for(const run of walks.runs){
    const r=run.route as RouteResponse,points=r.waypoints!.map(w=>(contract.buildings as Building[]).find(p=>p.code===w.code)!),before=JSON.stringify({r,points}),instructions=routeInstructions(r,points,floor);
    assert.ok(instructions.length<r.steps.length/2);
    assert.deepEqual(instructions.flatMap(i=>Array.from({length:i.lastStep-i.firstStep+1},(_,n)=>i.firstStep+n)),r.steps.map((_,i)=>i));
    const distance=points.slice(1).reduce((n,p,i)=>n+toScenePosition(p).distanceTo(toScenePosition(points[i])),0);
    assert.ok(Math.abs(instructions.reduce((n,i)=>n+i.distance,0)-distance)<1e-8);
    assert.equal(instructions.filter(i=>i.phase==="landing").length,2);
    assert.ok(instructions.some(i=>i.text.includes("toward Floor 2")));
    assert.ok(instructions.some(i=>i.text.includes(run.direction==="outbound" ? "on Floor 3":"toward Floor 1")));
    assert.ok(instructions.every(i=>!i.text.includes("stair point") && !i.text.includes("doorway centre")));
    for(let edge=0;edge<r.steps.length;edge++){
      const active=instructions[activeInstruction(instructions,edge+1)];assert.ok(active.firstStep<=edge && active.lastStep>=edge);
    }
    assert.equal(JSON.stringify({r,points}),before);
  }
});

test("corridor turns and named halls remain separate instructions",()=>{
  const points=[p(1,0,0),p(2,1,0),p(3,2,0),p(4,2,1),p(5,2,2,3.5,1,"hall"),p(6,2,3)];
  points[4].display_name="Reception";
  const instructions=routeInstructions(route(points),points,floor);
  assert.deepEqual(instructions.map(i=>[i.firstStep,i.lastStep]),[[0,1],[2,3],[4,4]]);
  assert.equal(instructions[1].text,"Continue to Reception");
});

test("flat legacy stair tags never imply a landing, altitude or another floor",()=>{
  const points=[p(1,0,0),p(2,1,0),p(3,2,0)];
  const instructions=routeInstructions(route(points,["stairs","stairs"]),points,floor);
  assert.equal(instructions.length,1);assert.equal(instructions[0].text,"Use the mapped steps");assert.equal(instructions[0].phase,"steps");
});

test("ramps retain slope direction, elevators retain explicit floor and weights do not become metres",()=>{
  const points=[p(1,0,0,1),p(2,0,1,.8),p(3,0,2,.6),p(4,0,3,.7),p(5,0,3,4,2)];
  const instructions=routeInstructions(route(points,["ramp","ramp","ramp","elevator"]),points,floor);
  assert.deepEqual(instructions.map(i=>i.text),["Follow the ramp down","Follow the ramp up","Take the elevator to Floor 2"]);
  assert.ok(instructions.reduce((n,i)=>n+i.distance,0)<10);
});

test("a retained-position connector has its own instruction and correct movement index",()=>{
  const points=[p(1,0,0),p(2,1,0)],r=route(points);
  const exact=routeInstructions(r,points,floor),moving=routeInstructions(r,points,floor,{distance:.3,kind:"stairs",floor:1});
  assert.equal(activeInstruction(exact,1),0);assert.equal(activeInstruction(moving,1),0);assert.equal(activeInstruction(moving,2),1);
  assert.equal(moving[0].text,"Rejoin the stairs");assert.equal(moving[0].firstStep,-1);
  const metadata=routeInstructions(r,points,floor,{distance:0,kind:"stairs",floor:2});
  assert.equal(metadata[0].phase,"connector");assert.equal(activeInstruction(metadata,2),1);
});

test("empty API routes and malformed point counts do not invent directions",()=>{
  const points=[p(1,0,0)],r=route(points);
  assert.deepEqual(routeInstructions(r,points,floor),[]);
  assert.equal(activeInstruction([],1),-1);
  assert.throws(()=>routeInstructions(r,[],floor),/do not match/);
});

test("an up-and-down stair block does not assign its final floor to its ascent",()=>{
  const points=[p(1,0,0,0,1),p(2,0,1,1,2),p(3,0,2,0,1)];
  const instructions=routeInstructions(route(points,["stairs","stairs"]),points,floor);
  assert.deepEqual(instructions.map(i=>i.text),["Go up the stairs","Go down the stairs"]);
});
