import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const manifest=JSON.parse(await readFile(resolve(root,'public/models/campus-manifest.json'),'utf8'));
const assets=new Map();
function add(path,hash){
  if(!/^models\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:glb|json)$/.test(path ?? '') || !/^[a-f0-9]{64}$/.test(hash ?? ''))throw new Error(`Invalid asset declaration: ${path}`);
  if(assets.has(path) && assets.get(path)!==hash)throw new Error(`Conflicting hashes: ${path}`);
  assets.set(path,hash);
}
for(const entry of [...manifest.models,...(manifest.profiles ?? []).flatMap(p=>p.models)]){
  if(entry.state!=='ready')continue;
  if(entry.reference)add(entry.reference,entry.referenceSha256);
  add(entry.model,entry.modelSha256);
}
const avatar=await readFile(resolve(root,'src/scene/avatarAsset.ts'),'utf8');
add(avatar.match(/url:\s*"([^"]+)"/)?.[1],avatar.match(/sha256:\s*"([a-f0-9]{64})"/)?.[1]);
for(const [path,expected] of assets){
  const bytes=await readFile(resolve(root,'public',path));
  if(createHash('sha256').update(bytes).digest('hex')!==expected)throw new Error(`Asset hash mismatch: ${path}`);
}
console.log(`Verified ${assets.size} application assets.`);
