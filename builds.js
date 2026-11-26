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
 p.name=m.name;return p}
window.__buildModel=function(kind){const src=LIB[kind];if(!src)return null;
 const g=src.clone(true);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});return g};
window.__buildInfo={domus:{h:6.2},aedes:{h:9.4},templum:{h:11.6}};
loader.load("assets/buildings.glb",gl=>{
 gl.scene.traverse(o=>{if(o.isMesh){const arr=Array.isArray(o.material)?o.material:[o.material];
  const conv=arr.map(m=>cache[m.uuid]||(cache[m.uuid]=phong(m)));o.material=Array.isArray(o.material)?conv:conv[0]}});
 for(const k of ["domus","aedes","templum"]){const n=gl.scene.getObjectByName(k);if(!n)continue;
  const g=new THREE.Group();const c=n.clone(true);c.position.set(0,0,0);g.add(c);LIB[k]=g}
 console.log("[builds] ready",Object.keys(LIB).join(","));
 if(window.__rebuildHouses)window.__rebuildHouses()},undefined,e=>console.warn("[builds] load",e));
})();
