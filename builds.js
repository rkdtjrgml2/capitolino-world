/* Capitolino World · builds.js
 * Detailed models for the buildings members can raise on their land:
 * domus (house), aedes (small Ionic temple), templum (grand Doric temple).
 * The game calls window.__buildModel(kind) from buildHouse; until the models load it
 * falls back to its own simple house, then __rebuildHouses swaps them in.
 */
(function(){
"use strict";
if(!window.THREE||!THREE.GLTFLoader)return;
const loader=new THREE.GLTFLoader();if(window.MeshoptDecoder)loader.setMeshoptDecoder(window.MeshoptDecoder);
const LIB={};const cache={};
function phong(m){
 const metal=m.metalness||0;const p=new THREE.MeshPhongMaterial({map:m.map||null,color:0xffffff,
  shininess:metal>.5?70:10,specular:metal>.5?new THREE.Color(.5,.4,.25):new THREE.Color(.05,.05,.05)});
 if(p.map){p.map.encoding=THREE.LinearEncoding;p.map.anisotropy=4}else if(m.color){p.color.copy(m.color).convertLinearToSRGB()}
 if(m.normalMap){p.normalMap=m.normalMap;p.normalMap.encoding=THREE.LinearEncoding;p.normalScale.copy(m.normalScale||new THREE.Vector2(1,-1))}
 p.name=m.name;return p}
window.__buildModel=function(kind){const src=LIB[kind];if(!src)return null;
 const g=src.clone(true);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});return g};
window.__buildInfo={domus:{h:6.2},aedes:{h:9.4},templum:{h:11.6}};
loader.load("assets/buildings.glb",gl=>{
 gl.scene.traverse(o=>{if(o.isMesh){const arr=Array.isArray(o.material)?o.material:[o.material];
  const conv=arr.map(m=>cache[m.uuid]||(cache[m.uuid]=phong(m)));o.material=Array.isArray(o.material)?conv:conv[0]}});
 for(const k of ["domus","aedes","templum"]){const n=gl.scene.getObjectByName(k);if(!n)continue;
  const g=new THREE.Group();const c=n.clone(true);c.position.set(0,0,0);g.add(c);LIB[k]=g}
 civic(gl.scene);
 console.log("[builds] ready",Object.keys(LIB).join(","));
 if(window.__rebuildHouses)window.__rebuildHouses()},undefined,e=>console.warn("[builds] load",e));
/* civic core: the Forum temples, basilicas, curia and horrea. The detailed model takes the place of
 * the simple stone group the game builds; beyond LOD_FAR a lighter decimated copy stands in. */
const LOD_FAR=210;
function civic(scene){const C=window.__civic;if(!C)return;let n=0;
 for(const b of C){const hi=scene.getObjectByName("civic_"+b.k),lo=scene.getObjectByName("civic_"+b.k+"_lod");if(!hi||!b.group)continue;
  const prep=o=>{const c=o.clone(true);c.position.set(0,0,0);c.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});return c};
  const L=new THREE.LOD();L.addLevel(prep(hi),0);if(lo){const f=prep(lo);f.traverse(m=>{if(m.isMesh)m.castShadow=false});L.addLevel(f,LOD_FAR)}
  L.position.copy(b.group.position);L.rotation.copy(b.group.rotation);L.name="civic3d_"+b.k;
  b.group.parent.add(L);b.group.visible=false;b.lod=L;n++}
 const H=window.__gfxHooks,R=H&&H.renderer;
 if(R&&n){const cam=H.camera,base=R.render.bind(R);R.render=function(s,c){for(const b of C)if(b.lod)b.lod.update(c||cam);return base(s,c)}}
 /* Forum rostra and honorary columns */
 const D=window.__forumDeco,ro=scene.getObjectByName("civic_rostra"),hc=scene.getObjectByName("civic_honcol");
 const put=(src,x,y,z,parent)=>{const c=src.clone(true);c.position.set(x,y,z);c.rotation.set(0,0,0);c.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});parent.add(c);return c};
 if(D&&ro&&D.rostra.parent){const r=D.rostra;put(ro,r.position.x,r.position.y-1.1,r.position.z,r.parent);r.visible=false;n++}
 if(D&&hc)for(const k of D.cols){if(!k.c.parent)continue;put(hc,k.x,k.c.position.y-4,k.z,k.c.parent);k.c.visible=false;k.s.visible=false;n++}
 window.__civicDbg={count:n};console.log("[builds] civic",n)}
/* weapons: Quaternius Medieval Weapons (CC0), grip at the origin, blade along +Y */
const WEAP={};
window.__weaponModel=function(kind){const src=WEAP[kind];if(!src)return null;const g=src.clone(true);g.traverse(o=>{if(o.isMesh)o.castShadow=true});return g};
loader.load("assets/weapons.glb",gl=>{
 gl.scene.traverse(o=>{if(o.isMesh){const arr=Array.isArray(o.material)?o.material:[o.material];
  const conv=arr.map(m=>cache[m.uuid]||(cache[m.uuid]=phong(m)));o.material=Array.isArray(o.material)?conv:conv[0]}});
 for(const k of ["dagger","sword","longsword","axe","spear"]){const n=gl.scene.getObjectByName(k);if(!n)continue;const g=new THREE.Group();const c=n.clone(true);c.position.set(0,0,0);g.add(c);WEAP[k]=g}
 const H=window.__gfxHooks;if(!H)return;
 /* swap what already exists: the held weapon and the weapons lying on the ground */
 const P=H.P;if(P&&P.handMesh&&P.hand&&WEAP[P.hand]){const o=P.handMesh,n=window.__weaponModel(P.hand);n.position.copy(o.position);n.rotation.copy(o.rotation);n.scale.copy(o.scale);
  if(o.parent){o.parent.add(n);o.parent.remove(o)}P.handMesh=n}
 for(const it of H.items||[]){if(!WEAP[it.kind]||!it.m||it.taken)continue;const o=it.m,n=window.__weaponModel(it.kind);n.position.copy(o.position);n.rotation.copy(o.rotation);n.userData.item=it;
  n.traverse(c=>{c.userData.item=it});n.visible=o.visible;if(o.parent){o.parent.add(n);o.parent.remove(o)}it.m=n}
 console.log("[builds] weapons",Object.keys(WEAP).join(","))},undefined,e=>console.warn("[builds] weapons",e));
})();
