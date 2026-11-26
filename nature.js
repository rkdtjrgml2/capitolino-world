/* Capitolino World · nature.js
 * Swaps the low poly trees, bushes, rocks, grass, flowers and reeds near the camera
 * for textured CC0 models (Quaternius Stylized Nature MegaKit, CC0 1.0).
 * The game keeps its own instanced meshes; this file hides the instances it replaces
 * and draws detailed ones in their place, so chopping and regrowing keep working.
 */
(function(){
"use strict";
const H=window.__gfxHooks,CAP=window.__cap;
if(!H||!window.THREE||!THREE.GLTFLoader)return;
const {scene,TREES,TREEGRID}=H;
const isTouch=matchMedia("(pointer:coarse)").matches;
const Q=isTouch?.42:1;
const loader=new THREE.GLTFLoader();if(window.MeshoptDecoder)loader.setMeshoptDecoder(window.MeshoptDecoder);
const U={time:{value:0}};
const ZERO=new THREE.Matrix4().makeScale(0,0,0);

/* quantized attributes to plain floats, node transform baked in */
function bake(mesh){
 mesh.updateMatrixWorld(true);const g=new THREE.BufferGeometry();const src=mesh.geometry;
 for(const name of ["position","normal","uv"]){const a=src.attributes[name];if(!a)continue;
  const n=a.count,sz=a.itemSize,out=new Float32Array(n*sz),arr=a.array;
  const k=a.normalized?(arr instanceof Int16Array?1/32767:arr instanceof Uint16Array?1/65535:arr instanceof Int8Array?1/127:arr instanceof Uint8Array?1/255:1):1;
  for(let i=0;i<n;i++)for(let j=0;j<sz;j++){let v=a.isInterleavedBufferAttribute?a.getComponent?a.getComponent(i,j):[a.getX(i),a.getY(i),a.getZ(i)][j]:arr[i*sz+j];
   v*=k;if(a.normalized&&(arr instanceof Int16Array||arr instanceof Int8Array))v=Math.max(v,-1);out[i*sz+j]=v}
  g.setAttribute(name,new THREE.BufferAttribute(out,sz))}
 if(src.index)g.setIndex(new THREE.BufferAttribute(Uint32Array.from(src.index.array),1));
 g.applyMatrix4(mesh.matrixWorld);if(g.attributes.normal)g.attributes.normal.needsUpdate=true;
 g.computeBoundingSphere();return g}

function windify(mat,amt){
 mat.onBeforeCompile=sh=>{sh.uniforms.uTime=U.time;
  sh.vertexShader="uniform float uTime;\n"+sh.vertexShader.replace("#include <begin_vertex>",
   "#include <begin_vertex>\n#ifdef USE_INSTANCING\n float ph=instanceMatrix[3].x*.21+instanceMatrix[3].z*.17;\n#else\n float ph=0.;\n#endif\n float hw=max(position.y,0.)*"+amt.toFixed(3)+";\n transformed.x+=sin(uTime*1.6+ph)*hw;\n transformed.z+=cos(uTime*1.3+ph*1.3)*hw*.7;")};
 mat.customProgramCacheKey=()=>"wind"+amt}

function material(m,leaf,wind){
 const p=new THREE.MeshPhongMaterial({map:m.map||null,color:0xffffff,shininess:leaf?8:2,specular:new THREE.Color(.04,.05,.03),
  alphaTest:leaf?.45:0,transparent:false,side:leaf?THREE.DoubleSide:THREE.FrontSide});
 if(p.map){p.map.encoding=THREE.LinearEncoding;p.map.anisotropy=4;if(leaf){p.emissive=new THREE.Color(1,1,1);p.emissiveMap=p.map;p.emissiveIntensity=.22}}
 if(m.color&&!p.map){p.color.copy(m.color).convertLinearToSRGB()}
 if(wind)windify(p,wind);return p}

function depthFor(mat){
 if(!mat.alphaTest)return null;
 return new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:mat.map,alphaTest:mat.alphaTest,side:THREE.DoubleSide})}

/* one replaced instanced mesh: near instances get the detailed model */
function NearSet(orig,parts,opt){
 const n=orig.count,base=new Float32Array(orig.instanceMatrix.array.slice(0,n*16));
 const CELL=16,grid=new Map();const m=new THREE.Matrix4();
 for(let i=0;i<n;i++){const x=base[i*16+12],z=base[i*16+14];const k=Math.floor(x/CELL)+","+Math.floor(z/CELL);(grid.get(k)||grid.set(k,[]).get(k)).push(i)}
 const cap=Math.max(8,Math.round(opt.cap*Q)),R=opt.r;
 const mk=(n,sh)=>parts.map(p=>{const im=new THREE.InstancedMesh(p.geo,p.mat,Math.max(1,n));im.count=0;im.frustumCulled=false;
  im.castShadow=sh;im.receiveShadow=true;const d=sh&&depthFor(p.mat);if(d)im.customDepthMaterial=d;scene.add(im);return im});
 /* only the closest instances cast shadows: the shadow pass draws every instance it is given */
 const cs=opt.shadow?Math.min(cap,Math.round((opt.shadowN||cap)*Q)):0;
 const meshS=cs?mk(cs,true):[],meshN=mk(cap-cs,false);
 const fix=opt.fix||new THREE.Matrix4();let cur=[];
 const others=opt.siblings||[];
 function hide(i,on){if(on){orig.setMatrixAt(i,ZERO);for(const s of others)s.setMatrixAt(i,ZERO)}
  else if(!opt.isDown||!opt.isDown(i)){m.fromArray(base,i*16);orig.setMatrixAt(i,m);for(const s of others)s.setMatrixAt(i,m)}}
 function refresh(px,pz){
  const c0x=Math.floor((px-R)/CELL),c1x=Math.floor((px+R)/CELL),c0z=Math.floor((pz-R)/CELL),c1z=Math.floor((pz+R)/CELL);
  const cand=[];for(let a=c0x;a<=c1x;a++)for(let b=c0z;b<=c1z;b++){const L=grid.get(a+","+b);if(!L)continue;
   for(const i of L){if(opt.isDown&&opt.isDown(i))continue;const dx=base[i*16+12]-px,dz=base[i*16+14]-pz,d=dx*dx+dz*dz;if(d<R*R)cand.push([d,i])}}
  cand.sort((a,b)=>a[0]-b[0]);if(cand.length>cap)cand.length=cap;
  const next=new Set(cand.map(c=>c[1]));for(const i of cur)if(!next.has(i))hide(i,false);
  let k=0,ks=0,kn=0;for(const [,i] of cand){hide(i,true);m.fromArray(base,i*16).multiply(fix);if(k<cs){for(const im of meshS)im.setMatrixAt(ks,m);ks++}else{for(const im of meshN)im.setMatrixAt(kn,m);kn++}k++}
  for(const im of meshS){im.count=ks;im.instanceMatrix.needsUpdate=true}for(const im of meshN){im.count=kn;im.instanceMatrix.needsUpdate=true}
  orig.instanceMatrix.needsUpdate=true;for(const s of others)s.instanceMatrix.needsUpdate=true;cur=[...next]}
 function check(){if(!opt.isDown)return false;for(const i of cur)if(opt.isDown(i))return true;return false}
 return {refresh,check}}

function partsOf(root,name,wind){
 const node=root.getObjectByName(name);if(!node)return null;const out=[];
 node.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];
  const leaf=/Leaf|Leaves|Grass|Flower/i.test(mats[0].name);out.push({geo:bake(o),mat:material(mats[0],leaf,leaf?wind:0)})});
 return out}

let oakParts=null;
/* frontier plot trees are plain meshes the game rebuilds; give each the detailed oak */
function plotTrees(){if(!oakParts||!TREES.oak)return;const found=[];
 scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.geometry===TREES.oak.trunk&&o.parent&&!o.parent.userData.natOak)found.push(o.parent)});
 for(const tg of found){tg.userData.natOak=1;tg.children.forEach(ch=>{if(ch.geometry===TREES.oak.trunk||ch.geometry===TREES.oak.leaf)ch.visible=false});
  for(const p of oakParts){const m=new THREE.Mesh(p.geo,p.mat);m.castShadow=true;m.receiveShadow=true;const d=depthFor(p.mat);if(d)m.customDepthMaterial=d;tg.add(m)}}}
const sets=[];let ready=false,lastX=1e9,lastZ=1e9,lastT=0;
function findIM(type,count){let f=null;scene.traverse(o=>{if(!f&&o.isInstancedMesh&&o.geometry.type===type&&o.instanceMatrix.count===count)f=o});return f}
function findIMBy(pred){let f=null;scene.traverse(o=>{if(!f&&o.isInstancedMesh&&pred(o))f=o});return f}

function setup(gl){
 const root=gl.scene;root.updateMatrixWorld(true);
 /* trees: the game keeps trunk + leaf instanced meshes per species and the TREEGRID records */
 const byIM=new Map();for(const k in TREEGRID)for(const t of TREEGRID[k]){if(!byIM.has(t.tm))byIM.set(t.tm,{lm:t.lm,list:[]});byIM.get(t.tm).list[t.i]=t}
 const species={pine:"pine",cypress:"cypress",oak:"oak",olive:"olive"};
 for(const [tm,info] of byIM){
  const sp=Object.keys(species).find(k=>TREES[k]&&TREES[k].trunk===tm.geometry);if(!sp)continue;
  const parts=partsOf(root,species[sp],.012);if(!parts||!parts.length)continue;
  sets.push(NearSet(tm,parts,{cap:sp==="olive"||sp==="cypress"?80:110,r:110,shadow:true,shadowN:36,siblings:[info.lm],isDown:i=>{const t=info.list[i];return !t||t.down}}))}
 /* scatter layers made by the game: matched by geometry type and parameters */
 const S=(new THREE.Matrix4()),sc=(x,y,z)=>new THREE.Matrix4().makeScale(x,y==null?x:y,z==null?x:z);
 const layers=[
  {pick:o=>o.geometry.type==="ConeGeometry"&&o.geometry.parameters.radius===.22,name:"grass",cap:2600,r:42,fix:sc(.95,.8,.95),wind:.06},
  {pick:o=>o.geometry.type==="OctahedronGeometry"&&o.geometry.parameters.radius===.17,name:"flowers",cap:500,r:40,fix:sc(.2),wind:.05},
  {pick:o=>o.geometry.type==="IcosahedronGeometry"&&o.geometry.parameters.radius===1&&o.instanceMatrix.count>1000,name:"bush",cap:320,r:80,fix:sc(1.05,.95,1.05),wind:.02,shadow:true,shadowN:60},
  {pick:o=>o.geometry.type==="CylinderGeometry"&&o.geometry.parameters.radiusTop===.03,name:"tallgrass",cap:700,r:42,fix:sc(1.05),wind:.05},
  {pick:o=>o.geometry.type==="DodecahedronGeometry"&&o.geometry.parameters.radius===1&&o.instanceMatrix.count>500,name:["rock1","rock2","rock3"],cap:260,r:130,fix:sc(.72),shadow:true,shadowN:30}];
 for(const L of layers){const im=findIMBy(L.pick);if(!im)continue;
  const names=Array.isArray(L.name)?L.name:[L.name];
  if(names.length===1){const parts=partsOf(root,names[0],L.wind||0);if(parts)sets.push(NearSet(im,parts,L))}
  else{/* rocks: one shape per third of the instances, all from the same source layer */
   const parts=names.map(n=>partsOf(root,n,0)).filter(Boolean);const all=parts.flat();
   /* split by index modulo via three proxies sharing the base: simplest is one shape set per proxy */
   const shapes=all.length;const proxies=[];
   for(let s=0;s<shapes;s++){proxies.push(NearSet(maskIM(im,shapes,s),[all[s]],L))}
   sets.push(...proxies)}}
 /* resource rocks at the mines */
 const rk=partsOf(root,"rock1",0);
 if(rk&&CAP&&CAP.NODES){const g=rk[0].geo.clone();g.computeBoundingBox();const bb=g.boundingBox,sz=new THREE.Vector3();bb.getSize(sz);
  g.translate(-(bb.min.x+bb.max.x)/2,-bb.min.y-sz.y*.35,-(bb.min.z+bb.max.z)/2);g.scale(2/sz.x,1.6/sz.y,2/sz.z);
  for(const n of CAP.NODES){const r=n.meshes&&n.meshes[0];if(r&&r.geometry&&r.geometry.type==="DodecahedronGeometry"){r.geometry=g;r.material=rk[0].mat;r.receiveShadow=true}}}
 oakParts=partsOf(root,"oak",.012);
 ready=true;console.log("[nature] ready",sets.length,"layers")}

/* a view of an instanced mesh that only exposes every Nth instance, so one game layer can feed several shapes */
function maskIM(im,N,s){
 const n=im.count,idx=[];for(let i=s;i<n;i+=N)idx.push(i);
 return {count:idx.length,instanceMatrix:{array:(()=>{const a=new Float32Array(idx.length*16);idx.forEach((i,k)=>a.set(im.instanceMatrix.array.subarray(i*16,i*16+16),k*16));return a})(),set needsUpdate(v){im.instanceMatrix.needsUpdate=v}},
  setMatrixAt:(k,m)=>im.setMatrixAt(idx[k],m)}}

loader.load("assets/nature.glb",gl=>{try{setup(gl)}catch(e){console.warn("[nature]",e)}},undefined,e=>console.warn("[nature] load",e));

/* per frame: wind clock and near set refresh after the game moved the camera */
const R=H.renderer,prev=R.render.bind(R);
R.render=function(sc,cam){
 if(ready&&sc===scene){const now=performance.now();U.time.value=now/1000;
  const P=H.P,px=P&&P.c?P.x:cam.position.x,pz=P&&P.c?P.z:cam.position.z;
  const moved=Math.hypot(px-lastX,pz-lastZ)>4,dirty=sets.some(s=>s.check());
  if(moved||dirty||now-lastT>3000){for(const s of sets)s.refresh(px,pz);plotTrees();lastX=px;lastZ=pz;lastT=now}}
 prev(sc,cam)};
window.__nature={sets,U};
})();
