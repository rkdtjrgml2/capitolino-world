/* Capitolino World · gfx.js
 * Upgrades the procedural creatures to rigged, animated CC0 models (Quaternius, CC0 1.0)
 * without touching the game logic. It reads window.__gfxHooks / window.__cap and
 * swaps what each creature object (c.g, c.anim, c.hand) shows.
 */
(function(){
"use strict";
const H=window.__gfxHooks,CAP=window.__cap;
if(!H||!window.THREE||!THREE.GLTFLoader||!THREE.SkeletonUtils){console.warn("[gfx] hooks or loader missing");return}
const {P,fauna,NPCS,scene,camera}=H;
const V=new THREE.Vector3(),V2=new THREE.Vector3();
const isTouch=matchMedia("(pointer:coarse)").matches;
const BASE="assets/";
/* per kind: file, size rule, clip map, tuning */
const SPEC={
 human:{file:"human.glb",fit:"h",target:2.12},
 wolf:{file:"wolf.glb",fit:"len",target:1.75},
 deer:{file:"deer.glb",fit:"len",target:2.1},
 bear:{file:"bear.glb",fit:"len",target:2.6},
 boar:{file:"boar.glb",fit:"len",target:1.55},
 hare:{file:"hare.glb",fit:"len",target:.62},
 fish:{file:"fish.glb",fit:"len",target:1.1}
};
const LIB={};let ready=false;
const loader=new THREE.GLTFLoader();if(window.MeshoptDecoder)loader.setMeshoptDecoder(window.MeshoptDecoder);

/* the game renders with linear output and Phong materials; convert glTF PBR to matching Phong */
function toPhong(m){
 const c=m.color?m.color.clone():new THREE.Color(1,1,1);c.convertLinearToSRGB();
 const metal=m.metalness||0,rough=m.roughness==null?1:m.roughness;
 const p=new THREE.MeshPhongMaterial({color:c,skinning:true,flatShading:false,shininess:metal>.5?60:Math.round((1-rough)*30)+4,
  specular:metal>.5?c.clone().multiplyScalar(.6):new THREE.Color(.06,.06,.06)});
 p.name=m.name;return p}

function measure(root){
 /* bind-pose box: geometry bounds through the (dequantizing) node transforms */
 root.updateMatrixWorld(true);const box=new THREE.Box3();
 root.traverse(o=>{if(!o.isMesh||!o.visible)return;const pa=o.geometry.attributes.position;
  /* r128 does not denormalize quantized (KHR_mesh_quantization) positions when computing bounds */
  const arr=pa.array,k=pa.normalized?(arr instanceof Int16Array?1/32767:arr instanceof Uint16Array?1/65535:arr instanceof Int8Array?1/127:arr instanceof Uint8Array?1/255:1):1;
  const bb=new THREE.Box3();for(let i=0;i<pa.count;i++){V.set(pa.getX(i)*k,pa.getY(i)*k,pa.getZ(i)*k);bb.expandByPoint(V)}
  o.geometry.boundingBox=bb.clone();o.geometry.boundingSphere=bb.getBoundingSphere(new THREE.Sphere());
  if(o.isSkinnedMesh&&o.skeleton){/* quantized skins keep the dequant scale in the inverse bind matrices: skin the rest pose by hand */
   const sk=o.skeleton,bm=sk.bones.map((b,j)=>new THREE.Matrix4().multiplyMatrices(b.matrixWorld,sk.boneInverses[j]));
   const si=o.geometry.attributes.skinIndex,sw=o.geometry.attributes.skinWeight,bmi=o.bindMatrixInverse,acc=new THREE.Vector3(),t=new THREE.Vector3();
   const wk=sw.normalized?(sw.array instanceof Uint8Array?1/255:sw.array instanceof Uint16Array?1/65535:1):1;
   for(let i=0;i<pa.count;i++){V.set(pa.getX(i)*k,pa.getY(i)*k,pa.getZ(i)*k).applyMatrix4(o.bindMatrix);acc.set(0,0,0);
    for(let j=0;j<4;j++){const w=[sw.getX(i),sw.getY(i),sw.getZ(i),sw.getW(i)][j];if(!w)continue;
     const bi=[si.getX(i),si.getY(i),si.getZ(i),si.getW(i)][j];t.copy(V).applyMatrix4(bm[bi]).multiplyScalar(w*wk);acc.add(t)}
    acc.applyMatrix4(bmi).applyMatrix4(o.matrixWorld);box.expandByPoint(acc)}
   return}
  box.union(bb.applyMatrix4(o.matrixWorld))});
 return box}

function prep(kind,gl){
 const s=SPEC[kind];const src=gl.scene;const mats={};
 if(kind==="human"){const want=lookParts({});src.traverse(o=>{if(o.isMesh&&/^V_/.test(o.name)){const k=o.name.slice(2);o.visible=want.some(w=>k.startsWith(w))}})}
 src.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;o.frustumCulled=false;
  const arr=Array.isArray(o.material)?o.material:[o.material];const conv=arr.map(m=>mats[m.uuid]||(mats[m.uuid]=toPhong(m)));o.material=Array.isArray(o.material)?conv:conv[0]}});
 const clips={};for(const a of gl.animations)clips[a.name]=a;
 /* size in idle pose */
 const tmp=THREE.SkeletonUtils.clone(src);const mx=new THREE.AnimationMixer(tmp);const idle=clips.Idle||gl.animations[0];
 if(idle){mx.clipAction(idle).play();mx.update(0)}
 const box=measure(tmp);const size=box.getSize(new THREE.Vector3());
 const scale=s.fit==="h"?s.target/size.y:s.target/Math.max(size.z,size.x);
 LIB[kind]={src,clips,scale,minY:box.min.y*scale,spec:s};
}

let pending=0;
for(const k in SPEC){pending++;loader.load(BASE+SPEC[k].file,gl=>{try{prep(k,gl)}catch(e){console.warn("[gfx]",k,e)}if(--pending===0)start()},undefined,e=>{console.warn("[gfx] load",k,e);if(--pending===0)start()})}

/* ---------- instancing ---------- */
const live=new Set();
function hideOld(c){c.g.children.forEach(ch=>{if(!ch.isSprite&&!ch.userData.gfx)ch.visible=false})}
function makeInstance(kind,c,opts){
 const L=LIB[kind];if(!L)return null;
 const model=THREE.SkeletonUtils.clone(L.src);model.userData.gfx=1;
 model.scale.setScalar(L.scale);model.position.y=-L.minY;
 const mats=[];const own=opts&&opts.ownMats;
 model.traverse(o=>{if(o.isMesh){if(own){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone()}
  (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(!mats.includes(m))mats.push(m)});
  if(opts&&opts.tag)o.userData[opts.tag[0]]=opts.tag[1]}});
 const mixer=new THREE.AnimationMixer(model);const acts={};
 for(const n in L.clips){acts[n]=mixer.clipAction(L.clips[n])}
 const I={kind,c,model,mixer,acts,mats,cur:null,one:null,oneEnd:0,last:performance.now(),dead:false,scale:L.scale};
 hideOld(c);c.g.add(model);
 if(c.hand){/* keep weapon socket: move it onto the right hand bone */
  let bone=null;model.traverse(o=>{if(o.isBone&&/^hand_r$/i.test(o.name))bone=o});
  if(bone){I.handBone=bone;const sock=c.hand;if(sock.parent)sock.parent.remove(sock);bone.add(sock);
   sock.position.set(0,0,0);sock.rotation.set(0,0,0);sock.scale.setScalar(1/L.scale/(bone.getWorldScale?1:1));I.sock=sock}}
 play(I,L.clips.Idle?"Idle":Object.keys(L.clips)[0],0);
 c.__gfx=I;live.add(I);return I}

function play(I,name,fade,once,speed){
 const a=I.acts[name];if(!a)return false;
 if(once){a.reset();a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.timeScale=speed||1;a.enabled=true;a.setEffectiveWeight(1);
  a.fadeIn(fade||.08);a.play();if(I.cur&&I.cur!==a)I.cur.fadeOut(fade||.08);if(I.one&&I.one!==a)I.one.fadeOut(.05);
  I.one=a;I.oneEnd=performance.now()+a.getClip().duration/(speed||1)*1000;return true}
 if(I.cur===a&&!I.one){a.timeScale=speed||1;return true}
 const f=fade==null?.2:fade;a.enabled=true;a.setLoop(THREE.LoopRepeat);a.timeScale=speed||1;
 if(I.cur!==a){a.reset();a.setEffectiveWeight(1);a.fadeIn(f);a.play();if(I.cur)I.cur.fadeOut(f)}
 else if(I.one){a.stopFading();a.setEffectiveWeight(1);a.fadeIn(.15);a.play()}
 if(I.one){I.one.fadeOut(.15);I.one=null}
 I.cur=a;return true}
function busy(I){const o=I.one;return !!(o&&o.isRunning()&&o.time<o.getClip().duration-.09*o.timeScale)}

/* ---------- player and citizens ---------- */
let swingN=0;
/* combos: each weapon cycles its own moves; a pause longer than the cooldown starts over */
const ATK={fist:["Punch","Punch2","Heavy"],dagger:["SlashA","Punch","SlashB"],sword:["SlashA","SlashB","SwordAttack"],longsword:["Heavy","SlashC","SwordAttack"],
 axe:["Chop","SlashA","Heavy"],spear:["Punch","Interact","SlashC"],pick:["Chop","Mine"],rod:["Cast"]};
/* gathering moves the game asks for through P.act */
const ACT={chop:"Chop",mine:"Mine",butcher:"PickUp"};
let lastAtkAt=0;const sfx=(n,a)=>{if(window.__sfx)window.__sfx.play(n,a)};
const BLADE={dagger:.55,sword:1.02,longsword:1.62,axe:.95,spear:2.3,pick:1.0};
function humanAnim(I,isPlayer,npc){
 return function(t,s){
  const now=performance.now(),dt=Math.min(window.__gfxDtMax||.05,(now-I.last)/1000);I.last=now;
  if(isPlayer){
   if(P.dead){if(!I.dead){I.dead=true;play(I,"Death",.1,true)}I.mixer.update(dt);return}
   if(I.dead){I.dead=false;play(I,"Idle",.1)}
   if(P.swing>I.lastSwing+.5){/* new attack */
    const hand=P.hand||"fist";const list=ATK[hand]||ATK.sword;const act=P.act;P.act=null;
    const cd=({dagger:.38,sword:.55,longsword:.75,axe:.85,spear:1.05,fist:.5,pick:.7,rod:.6})[hand]||.6;
    if(now-lastAtkAt>cd*1000+650)swingN=0;lastAtkAt=now;
    const name=act&&ACT[act]?ACT[act]:list[swingN++%list.length];
    const clip=I.acts[name]&&I.acts[name].getClip();const sp=clip?Math.max(1,clip.duration/(cd*1.15)):1;
    play(I,name,.05,true,act==="butcher"?2.2:sp);I.trail=BLADE[hand]&&act!=="butcher"?now+clip.duration/sp*1000:0;I.atkStart=now;I.atkDur=clip?clip.duration/sp*1000:400;
    if(act==="butcher"){[480,960].forEach(ms=>setTimeout(()=>{if(!P.dead)play(I,"PickUp",.05,true,2.2)},ms))}
    else if(!act&&hand!=="rod")setTimeout(()=>sfx("swoosh",hand),(clip?clip.duration/sp*1000:300)*.28);
   }
   I.lastSwing=P.swing;
   if(!busy(I)){
    const swim=P.y<-.45&&P.kind==="human";
    if(swim)play(I,s>.08?"Swim":"SwimIdle",.25);
    else if(P.jy>.15)play(I,"JumpLoop",.12,false,1.2);
    else if(s<.06)play(I,P.hand&&P.hand!=="rod"&&BLADE[P.hand]?"SwordIdle":"Idle",.25);
    else if(s<1.05)play(I,"Run",.18,false,Math.max(.75,s*1.05));
    else play(I,"Sprint",.18,false,Math.max(.8,s*.8));
   }
  }else{
   if(!busy(I)){if(s<.05)play(I,npc&&npc.busy>0?"Talk":"Idle",.3);else play(I,"Walk",.25,false,1.25)}
  }
  I.mixer.update(dt);
 }}
/* outfits: human.glb carries optional parts named V_*; each person shows a set of them */
const LOOKS={marcus:{beard:1},lucius:{beard:1,noCloak:1},gaius:{noCloak:1},julia:{female:1},claudia:{female:1,stola:1,palla:0x2f6f8f},flavia:{female:1,stola:1,palla:0xe6dcc4}};
const SKINS={marcus:0xc98a5e,lucius:0xb57650,gaius:0xd9a070,julia:0xe0b088,claudia:0xd29a70,flavia:0xc68660};
function lookParts(L){const p=L.female?["HairF","Bun"]:["HairM"];
 if(L.stola)p.push("Stola","Instita","Palla","Drape");else{p.push("SkirtM","HemM");if(!L.female)p.push("ApronM");if(!L.noCloak)p.push("Cloak","Fibula")}
 if(L.beard)p.push("Beard");return p}
function applyLook(I,L,tint){const want=lookParts(L);
 I.model.traverse(o=>{if(o.isMesh&&/^V_/.test(o.name)){const k=o.name.slice(2);o.visible=want.some(w=>k.startsWith(w))}});
 I.mats.forEach(m=>{if(m.name==="Stola"&&tint!=null)m.color.setHex(tint);if(m.name==="Palla"&&L.palla)m.color.setHex(L.palla);
  if(m.name==="Tunic"&&L.stola&&tint!=null)m.color.setHex(tint).offsetHSL(0,-.1,.12)})}
function upgradeHuman(c,isPlayer,npc){
 let tint=null;c.g.traverse(o=>{if(!tint&&o.isMesh&&o.material&&o.material.color&&o.material.color.getHex()!==0xb83a26&&npc){}});
 if(npc&&npc.__tint!=null)tint=npc.__tint;
 const I=makeInstance("human",c,{ownMats:!!npc});if(!I)return;
 if(tint!=null){I.mats.forEach(m=>{if(m.name==="Tunic")m.color.setHex(tint)})}
 applyLook(I,npc?LOOKS[npc.id]||{}:{},tint);
 if(npc&&SKINS[npc.id])I.mats.forEach(m=>{if(m.name==="Skin")m.color.setHex(SKINS[npc.id])});
 I.lastSwing=0;c.anim=humanAnim(I,isPlayer,npc);c.armR=new THREE.Object3D();/* swing code rotates this harmlessly */
}

/* ---------- fauna ---------- */
const FAUNA_ATK={wolf:{clip:"Attack",sp:1.7,lunge:.9},bear:{clip:"Attack",sp:1.15,lunge:.6},boar:{clip:"Attack",sp:1.5,lunge:1.1},deer:{clip:"Kick",sp:1.3,lunge:.2}};
function faunaAnim(I,a){
 I.bite=a.bite;I.hp=a.hp;
 return function(t,mv){
  const now=performance.now(),dt=Math.min(window.__gfxDtMax||.05,(now-I.last)/1000);I.last=now;
  /* cheap LOD: far animals tick slowly, very far ones not at all */
  const d=camera.position.distanceTo(a.c.g.position);
  I.model.visible=d<230;
  if(a.dead){if(!I.dead){I.dead=true;I.model.rotation.z=-Math.PI/2;play(I,"Death",.1,true,1.2)}}
  else{if(I.dead){I.dead=false;I.model.rotation.z=0;play(I,"Idle",.1)}
   if(a.bite>I.bite+.3&&FAUNA_ATK[a.kind]){const f=FAUNA_ATK[a.kind];play(I,f.clip,.05,true,f.sp);I.lunge=now;I.lungeLen=f.lunge;
    if(a.kind==="wolf"||a.kind==="bear")fx.claw(a);}
   if(a.hp<I.hp-.01&&!busy(I)){play(I,"Hit",.05,true,1.6);fx.hitSpark(a.c.g.position,a.kind);sfx("flesh")}
   if(!busy(I)){if(mv>.7)play(I,"Run",.2,false,a.kind==="bear"?1:1.15);else if(mv>.05)play(I,"Walk",.2,false,1.3);else play(I,"Idle",.35)}}
  I.bite=a.bite;I.hp=a.hp;
  /* lunge: snap forward then recover */
  if(I.lunge){const k=(now-I.lunge)/350;if(k>=1){I.lunge=0;I.model.position.z=0}else I.model.position.z=Math.sin(k*Math.PI)*I.lungeLen/ a.c.g.scale.z}
  if(d<70)I.mixer.update(dt);else if(d<160&&(I.skip=(I.skip||0)+1)%3===0)I.mixer.update(dt*3);
 }}
function upgradeFauna(a){
 if(!LIB[a.kind]||a.c.__gfx)return;
 const I=makeInstance(a.kind,a.c,{ownMats:true,tag:["fauna",a]});if(!I)return;
 /* flash code drives emissive on a.mats */
 a.mats.length=0;I.mats.forEach(m=>{if(m.emissive)a.mats.push(m)});
 a.c.anim=faunaAnim(I,a);
}
function upgradePlayerAnimal(c,kind){
 const I=makeInstance(kind,c,{ownMats:false});if(!I)return;
 c.anim=function(t,s){const now=performance.now(),dt=Math.min(window.__gfxDtMax||.05,(now-I.last)/1000);I.last=now;
  if(P.dead){if(!I.dead){I.dead=true;play(I,"Death",.1,true)}}else{if(I.dead){I.dead=false;play(I,"Idle",.1)}
   if(P.swing>(I.ls||0)+.5&&FAUNA_ATK[kind]){const f=FAUNA_ATK[kind];play(I,f.clip,.05,true,f.sp*1.1);I.lunge=now;I.lungeLen=f.lunge}
   I.ls=P.swing;
   if(!busy(I)){if(kind==="fish")play(I,"Swim",.2,false,.6+s*1.4);else if(s<.06)play(I,"Idle",.3);else if(s<.9)play(I,"Walk",.2,false,1.3);else play(I,"Run",.2,false,1.2)}}
  if(I.lunge){const k=(now-I.lunge)/350;if(k>=1){I.lunge=0;I.model.position.z=0}else I.model.position.z=Math.sin(k*Math.PI)*I.lungeLen}
  I.mixer.update(dt)};
 /* the beast swing code tilts the whole group; soften it since the clip already sells the hit */
}

/* ---------- effects: blade trail, sparks, claw arcs, hit stop, shake ---------- */
const fx=(function(){
 const N=14;const trailGeo=new THREE.BufferGeometry();const tp=new Float32Array(N*2*3),ta=new Float32Array(N*2);
 const idx=[];for(let i=0;i<N-1;i++){const a=i*2,b=a+1,c=a+2,d=a+3;idx.push(a,b,c,b,d,c)}
 trailGeo.setIndex(idx);trailGeo.setAttribute("position",new THREE.BufferAttribute(tp,3));trailGeo.setAttribute("alpha",new THREE.BufferAttribute(ta,1));
 const trailMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  uniforms:{col:{value:new THREE.Color(1,.92,.7)}},
  vertexShader:"attribute float alpha;varying float va;void main(){va=alpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
  fragmentShader:"uniform vec3 col;varying float va;void main(){gl_FragColor=vec4(col*va,va);}"});
 const trail=new THREE.Mesh(trailGeo,trailMat);trail.frustumCulled=false;trail.visible=false;scene.add(trail);
 const hist=[];
 function sampleBlade(){const I=P.c&&P.c.__gfx;if(!I||!P.handMesh)return null;const len=BLADE[P.hand]||1;
  P.handMesh.updateMatrixWorld(true);const base=P.handMesh.localToWorld(V.set(0,len*.2,0)).clone(),tip=P.handMesh.localToWorld(V2.set(0,len,0)).clone();return [base,tip]}
 function updTrail(){const I=P.c&&P.c.__gfx;const now=performance.now();
  const o=I&&I.one,on=I&&I.trail&&o&&o.isRunning()&&o.time>o.getClip().duration*.15&&o.time<o.getClip().duration*.8;
  if(on){const s=sampleBlade();if(s){hist.unshift(s);if(hist.length>N)hist.pop()}}else if(hist.length){hist.pop();if(hist.length)hist.pop()}
  if(hist.length<2){trail.visible=false;return}
  trail.visible=true;for(let i=0;i<N;i++){const h=hist[Math.min(i,hist.length-1)];const f=i<hist.length?1-i/hist.length:0;
   tp.set([h[0].x,h[0].y,h[0].z],i*6);tp.set([h[1].x,h[1].y,h[1].z],i*6+3);ta[i*2]=0;ta[i*2+1]=f*1.1}
  trailGeo.attributes.position.needsUpdate=true;trailGeo.attributes.alpha.needsUpdate=true;trailGeo.computeBoundingSphere()}
 /* sparks */
 const SP=[];const spGeo=new THREE.TetrahedronGeometry(.07,0);
 const spMat={spark:new THREE.MeshBasicMaterial({color:0xffe2a0}),blood:new THREE.MeshBasicMaterial({color:0xa8261c}),dust:new THREE.MeshBasicMaterial({color:0xcbb894,transparent:true,opacity:.8})};
 function burst(pos,kind,n,up){for(let i=0;i<n;i++){const m=new THREE.Mesh(spGeo,spMat[kind]);m.position.copy(pos);
  const a=Math.random()*6.28,s=2+Math.random()*4;m.userData.v=new THREE.Vector3(Math.cos(a)*s,(up||3)+Math.random()*3,Math.sin(a)*s);m.userData.life=.35+Math.random()*.3;
  m.scale.setScalar(.6+Math.random()*1.2);scene.add(m);SP.push(m)}}
 function updSparks(dt){for(let i=SP.length-1;i>=0;i--){const m=SP[i];m.userData.life-=dt;if(m.userData.life<=0){scene.remove(m);SP.splice(i,1);continue}
  m.userData.v.y-=14*dt;m.position.addScaledVector(m.userData.v,dt);m.rotation.x+=dt*9;m.rotation.y+=dt*7;m.scale.multiplyScalar(.97)}}
 /* claw arcs: three slashes that flash across the attacker's mouth line */
 const arcs=[];const arcMat=new THREE.MeshBasicMaterial({color:0xfff4e0,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
 const arcGeo=new THREE.RingGeometry(.55,.62,18,1,-.9,1.8);
 function claw(a){const g=new THREE.Group();for(let i=0;i<3;i++){const m=new THREE.Mesh(arcGeo,arcMat.clone());m.position.set((i-1)*.16,0,0);m.rotation.set(0,Math.PI/2,.5+i*.1);g.add(m)}
  const tx=P.x,tz=P.z;g.position.set(a.x+(tx-a.x)*.7,a.c.g.position.y+ (a.kind==="bear"?1.5:.9),a.z+(tz-a.z)*.7);g.rotation.y=Math.atan2(tx-a.x,tz-a.z);g.userData.t=0;scene.add(g);arcs.push(g);
  shake(a.kind==="bear"?.35:.18);if(window.__sfx)window.__sfx.play("flesh");burst(V.set(P.x,P.y+1.2,P.z),"blood",5,2)}
 function updArcs(dt){for(let i=arcs.length-1;i>=0;i--){const g=arcs[i];g.userData.t+=dt;const k=g.userData.t/.22;
  if(k>=1){scene.remove(g);arcs.splice(i,1);continue}g.children.forEach((m,j)=>{m.material.opacity=(1-k)*.95;m.rotation.z=.5+j*.1-k*1.6;m.scale.setScalar(.8+k*.6)})}}
 let shakeAmt=0;function shake(a){shakeAmt=Math.max(shakeAmt,a)}
 function hitSpark(pos,kind){burst(V.set(pos.x,pos.y+(kind==="bear"?1.3:kind==="hare"?.3:.8),pos.z),"spark",7,3);burst(V,"blood",4,2);shake(.12);}
 let hitStop=0;
 return {updTrail,updSparks,updArcs,claw,hitSpark,burst,shake,get shake(){return shakeAmt},set shake(v){shakeAmt=v},
  consumeStop(dt){if(hitStop>0){hitStop-=dt;return true}return false},getShake(){return shakeAmt},decay(dt){shakeAmt=Math.max(0,shakeAmt-dt*1.6)}};
})();

/* ---------- discovery loop: upgrade whatever creature objects exist ---------- */
let lastPC=null;
function scan(){
 if(P.c&&P.c!==lastPC){lastPC=P.c;if(!P.c.__gfx){if(P.kind==="human")upgradeHuman(P.c,true);else if(LIB[P.kind])upgradePlayerAnimal(P.c,P.kind)}}
 for(const n of NPCS)if(!n.c.__gfx)upgradeHuman(n.c,false,n);
 for(const a of fauna)if(!a.c.__gfx&&LIB[a.kind])upgradeFauna(a);
}
/* NPC tunic colours were applied to the procedural mesh; read them before hiding */
const HUMAN_PAL=new Set([0xe0a77a,0xb83a26,0x4a3424,0x3b2a1e,0xd8b25a,0xf2e8cf,0x7a2a1e,0x1c1712]);
function readTints(){for(const n of NPCS){let col=null;n.c.g.traverse(o=>{if(col==null&&o.isMesh&&o.material&&o.material.color&&!HUMAN_PAL.has(o.material.color.getHex()))col=o.material.color.getHex()});n.__tint=col}}

/* per-frame work runs right before the game renders, after its camera update */
let lastT=performance.now();const R=H.renderer,origRender=R.render.bind(R);
R.render=function(sc,cam){
 const now=performance.now(),dt=Math.min(.05,(now-lastT)/1000);lastT=now;let ox=0,oy=0;
 if(ready&&sc===scene){try{scan();fx.updTrail();fx.updSparks(dt);fx.updArcs(dt)}catch(e){console.warn("[gfx]",e)}
  const s=fx.getShake();if(s>0&&H.mode==="play"){ox=(Math.random()-.5)*s*.45;oy=(Math.random()-.5)*s*.45;cam.position.x+=ox;cam.position.y+=oy;fx.decay(dt)}}
 origRender(sc,cam);if(ox||oy){cam.position.x-=ox;cam.position.y-=oy}};
function start(){readTints();ready=true;console.log("[gfx] ready",Object.keys(LIB).join(","))}
window.__gfx={LIB,live,fx};
})();
