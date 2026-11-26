/* Capitolino World · harvest.js
 * The feel of gathering: sounds, chips and dust on every hit, trees that fall over,
 * carcasses you butcher, and resource icons that pop out and fly into the resource bar.
 * The game calls window.__gainFx and window.__hitFx; everything here is presentation.
 */
(function(){
"use strict";
const H=window.__gfxHooks;if(!H||!window.THREE)return;
const {scene,camera,TREES,heightAt,P}=H;
const isTouch=matchMedia("(pointer:coarse)").matches;
const LANG=()=>(document.documentElement.lang||"ko").slice(0,2);

/* ---------- sound: small synthesized effects, no files ---------- */
const SFX=(()=>{let ac=null,master=null,nb=null,muted=false;
 try{muted=localStorage.getItem("capSfxMute")==="1"}catch(e){}
 function init(){if(ac)return ac;const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
  ac=new C();master=ac.createGain();master.gain.value=.5;master.connect(ac.destination);
  nb=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return ac}
 const wake=()=>{if(init()&&ac.state==="suspended")ac.resume()};
 addEventListener("pointerdown",wake,{capture:true,passive:true});addEventListener("keydown",wake,{capture:true});
 function env(g,t0,a,peak,dec){g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(peak,t0+a);g.gain.exponentialRampToValueAtTime(.0001,t0+a+dec)}
 function noise(o){const t0=ac.currentTime+(o.at||0);const s=ac.createBufferSource();s.buffer=nb;s.playbackRate.value=o.rate||1;
  const f=ac.createBiquadFilter();f.type=o.type||"bandpass";f.frequency.setValueAtTime(o.f,t0);if(o.f2)f.frequency.exponentialRampToValueAtTime(o.f2,t0+o.d);f.Q.value=o.q||1;
  const g=ac.createGain();env(g,t0,o.a||.004,o.g,o.d);s.connect(f);f.connect(g);g.connect(master);s.start(t0,Math.random()*.5);s.stop(t0+(o.a||0)+o.d+.05)}
 function tone(o){const t0=ac.currentTime+(o.at||0);const s=ac.createOscillator();s.type=o.type||"sine";s.frequency.setValueAtTime(o.f,t0);
  if(o.f2)s.frequency.exponentialRampToValueAtTime(o.f2,t0+o.d);const g=ac.createGain();env(g,t0,o.a||.003,o.g,o.d);s.connect(g);g.connect(master);s.start(t0);s.stop(t0+(o.a||0)+o.d+.05)}
 const v=()=>.9+Math.random()*.2;
 const LIB={
  chop(){noise({f:900*v(),q:1.2,g:.7,d:.13});tone({f:150*v(),f2:70,g:.6,d:.12});tone({f:480*v(),type:"triangle",g:.18,d:.05})},
  clink(m){const b=(m==="stone"?1250:m==="iron"?1800:2400)*v();tone({f:b,g:.2,d:.3});tone({f:b*1.51,g:.1,d:.2});noise({type:"highpass",f:3200,g:.35,d:.04});noise({f:650,g:.35,d:.08})},
  crumble(){for(let i=0;i<6;i++)noise({at:i*.05+Math.random()*.03,f:500+Math.random()*900,q:2,g:.35,d:.09});noise({type:"lowpass",f:600,g:.5,d:.45})},
  swoosh(h){const big=h==="longsword"||h==="axe"||h==="spear";noise({f:big?450:650,f2:big?1500:2300,q:1.4,g:big?.3:.2,d:big?.22:.15,a:.03})},
  flesh(){noise({type:"lowpass",f:700,g:.55,d:.1});tone({f:110,f2:50,g:.45,d:.12})},
  squish(){noise({f:1100*v(),f2:380,q:3,g:.42,d:.16,a:.01});noise({type:"lowpass",f:420,g:.3,d:.08})},
  pop(i){const f=620*Math.pow(1.06,Math.min(i||0,10));tone({f,f2:f*1.5,type:"triangle",g:.15,d:.09});tone({f:f*2,g:.05,d:.06})},
  creak(){tone({f:190,f2:120,type:"sawtooth",g:.045,d:.7,a:.12});tone({f:95,f2:70,type:"triangle",g:.08,d:.6,a:.1})},
  thud(){tone({f:75,f2:32,g:.9,d:.55});noise({type:"lowpass",f:380,g:.7,d:.6,a:.01});for(let i=0;i<5;i++)noise({at:.05+i*.07,f:1300,q:1,g:.14,d:.12})},
  splash(){noise({f:1600,f2:450,q:.8,g:.35,d:.3,a:.01})}};
 return {play(n,a){if(muted||!init()||ac.state!=="running")return;try{LIB[n]&&LIB[n](a)}catch(e){}},
  get muted(){return muted},set muted(m){muted=!!m;try{localStorage.setItem("capSfxMute",m?"1":"0")}catch(e){}}}})();
window.__sfx=SFX;
const later=(ms,f)=>setTimeout(()=>{try{f()}catch(e){console.warn("[harvest]",e)}},ms);

/* ---------- particles: chips, leaves, blood, sparks, dust ---------- */
const PT=[],DUST=[];const boxG=new THREE.BoxGeometry(1,1,1),tetG=new THREE.TetrahedronGeometry(.8,0),leafG=new THREE.PlaneGeometry(1,.6);
const mats={};function pm(col,glow){const k=col+(glow?"g":"");if(!mats[k])mats[k]=glow?new THREE.MeshBasicMaterial({color:col}):new THREE.MeshLambertMaterial({color:col,side:THREE.DoubleSide});return mats[k]}
const V=new THREE.Vector3();
function spray(x,y,z,o){const n=Math.round(o.n*(isTouch?.7:1));for(let i=0;i<n;i++){const col=o.col[i%o.col.length];
 const m=new THREE.Mesh(o.geo||boxG,pm(col,o.glow));const s=o.size*(.6+Math.random()*.8);m.scale.set(s,s*(o.flat||1),s*(o.long||1));
 m.position.set(x+(Math.random()-.5)*(o.spread||.3),y+(Math.random()-.5)*(o.spread||.3),z+(Math.random()-.5)*(o.spread||.3));
 const a=Math.random()*6.28,sp=o.speed*(.4+Math.random()*.8);let vx=Math.cos(a)*sp,vz=Math.sin(a)*sp;if(o.dir){vx+=o.dir.x*o.speed*.8;vz+=o.dir.z*o.speed*.8}
 m.userData={v:new THREE.Vector3(vx,o.up*(.5+Math.random()*.8),vz),life:o.life*(.7+Math.random()*.6),g:o.grav==null?14:o.grav,drag:o.drag||0,spin:(o.spin==null?10:o.spin)*(Math.random()-.5),floor:o.floor};
 m.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);scene.add(m);PT.push(m)}
 while(PT.length>260){scene.remove(PT.shift())}}
function updPT(dt){for(let i=PT.length-1;i>=0;i--){const m=PT[i],u=m.userData;u.life-=dt;if(u.life<=0){scene.remove(m);PT.splice(i,1);continue}
 u.v.y-=u.g*dt;if(u.drag)u.v.multiplyScalar(1-u.drag*dt);m.position.addScaledVector(u.v,dt);
 if(u.floor!=null&&m.position.y<u.floor){m.position.y=u.floor;u.v.set(u.v.x*.3,0,u.v.z*.3);u.spin*=.5}
 m.rotation.x+=u.spin*dt;m.rotation.y+=u.spin*.7*dt;if(u.life<.25)m.scale.multiplyScalar(.9)}}
const dustG=new THREE.PlaneGeometry(1,1);
const dustTex=(()=>{const c=document.createElement("canvas");c.width=c.height=64;const x=c.getContext("2d");const g=x.createRadialGradient(32,32,2,32,32,31);
 g.addColorStop(0,"rgba(255,255,255,1)");g.addColorStop(.45,"rgba(255,255,255,.55)");g.addColorStop(1,"rgba(255,255,255,0)");x.fillStyle=g;x.fillRect(0,0,64,64);
 const t=new THREE.CanvasTexture(c);return t})();
function dust(x,y,z,n,size,col){n=Math.round(n*(isTouch?.6:1));for(let i=0;i<n;i++){const m=new THREE.Mesh(dustG,new THREE.MeshBasicMaterial({color:col||0xcbb894,map:dustTex,transparent:true,opacity:.55,depthWrite:false}));
 const a=Math.random()*6.28,r=Math.random()*size*.4;m.position.set(x+Math.cos(a)*r,y+Math.random()*.4,z+Math.sin(a)*r);
 m.userData={v:new THREE.Vector3(Math.cos(a)*(1+Math.random()*2),.6+Math.random()*1.2,Math.sin(a)*(1+Math.random()*2)),life:1+Math.random()*.6,max:0,s:size*(.5+Math.random()*.6)};
 m.userData.max=m.userData.life;scene.add(m);DUST.push(m)}}
function updDust(dt){for(let i=DUST.length-1;i>=0;i--){const m=DUST[i],u=m.userData;u.life-=dt;if(u.life<=0){scene.remove(m);m.material.dispose();DUST.splice(i,1);continue}
 const k=1-u.life/u.max;m.position.addScaledVector(u.v,dt);u.v.multiplyScalar(1-1.8*dt);m.quaternion.copy(camera.quaternion);m.scale.setScalar(u.s*(.6+k*1.4));m.material.opacity=.5*(1-k)}}
const shake=a=>{const f=window.__gfx&&window.__gfx.fx;if(f)f.shake=Math.max(f.getShake(),a)};
const toPlayer=(x,z)=>{const dx=P.x-x,dz=P.z-z,l=Math.hypot(dx,dz)||1;return {x:dx/l,z:dz/l}};

/* ---------- trees: chips on every hit, then the tree falls away from you ---------- */
const FALL=[];
function speciesOf(t){for(const k in TREES)if(TREES[k].trunk===t.tm.geometry)return k;return null}
function fell(t){const sp=speciesOf(t);const q=t.q;let parts=sp&&window.__natureTree&&window.__natureTree(sp);
 if(!parts&&sp)parts=[{geo:TREES[sp].trunk,mat:new THREE.MeshPhongMaterial({color:TREES[sp].tc,flatShading:true})},{geo:TREES[sp].leaf,mat:new THREE.MeshPhongMaterial({color:TREES[sp].lc[0],flatShading:true})}];
 if(!parts)return;
 const pivot=new THREE.Group(),inner=new THREE.Group();pivot.position.set(q[0],q[1],q[2]);inner.rotation.y=q[4];inner.scale.setScalar(q[3]);
 for(const p of parts){const m=new THREE.Mesh(p.geo,p.mat);m.castShadow=true;m.receiveShadow=true;inner.add(m)}
 pivot.add(inner);scene.add(pivot);
 const d=toPlayer(q[0],q[2]);const dir={x:-d.x,z:-d.z};
 FALL.push({pivot,axis:new THREE.Vector3(dir.z,0,-dir.x).normalize(),dir,t:0,h:q[3],landed:false,x:q[0],y:q[1],z:q[2],sp});
 SFX.play("creak")}
function updFall(dt){for(let i=FALL.length-1;i>=0;i--){const f=FALL[i];f.t+=dt;const t=f.t;let ang;
 if(t<.3)ang=Math.sin(t*40)*.012;
 else if(t<1.45){const k=(t-.3)/1.15;ang=Math.pow(k,2.3)*1.5}
 else{const k=t-1.45;ang=1.5-Math.sin(Math.min(k/.3,1)*Math.PI)*.09*(1-Math.min(k/.6,1))}
 if(!f.landed&&t>=1.45){f.landed=true;SFX.play("thud");shake(.28);
  const L=(f.sp==="pine"?6:f.sp==="cypress"?5:4)*f.h;
  for(let s=1;s<=3;s++)dust(f.x+f.dir.x*L*s/3,f.y+.2,f.z+f.dir.z*L*s/3,5,2.2);
  spray(f.x+f.dir.x*L*.7,f.y+1,f.z+f.dir.z*L*.7,{n:16,col:[0x5f8f34,0x7aa63e,0x4a7a2a],geo:leafG,size:.22,speed:3,up:4,grav:3,drag:1.5,life:2.2,spread:2.5,spin:6})}
 f.pivot.quaternion.setFromAxisAngle(f.axis,ang);
 if(t>3.4){const k=Math.min((t-3.4)/.9,1);f.pivot.position.y=f.y-k*1.2;f.pivot.scale.setScalar(1-k*.9)}
 if(t>4.3){scene.remove(f.pivot);FALL.splice(i,1)}}}
function treeHit(t){const q=t.q,d=toPlayer(q[0],q[2]);const y=q[1]+.9*q[3];
 later(200,()=>{SFX.play("chop");shake(.06);
  spray(q[0]+d.x*.35,y,q[2]+d.z*.35,{n:9,col:[0xc9a26a,0xa87a46,0xe0c08a],size:.09,long:2.2,speed:3,up:4,dir:d,life:.9,floor:q[1]+.05});
  spray(q[0],q[1]+3.3*q[3],q[2],{n:6,col:[0x6c9a3a,0x86b048,0x557f2e],geo:leafG,size:.2,speed:1,up:1,grav:2.2,drag:1.5,life:2,spread:2,spin:5})})}

/* ---------- rocks and ore ---------- */
const ORE={stone:[0xcfc6b0,0xa89d88,0xe2dccd],iron:[0x8a4a30,0x5a4a40,0xa86a48],silver:[0xd9e2ea,0x9aa6b0,0xf4f8fb],gold:[0xf4c430,0xb0882a,0xffe27a]};
function rockHit(n,done){const d=toPlayer(n.x,n.z);const g=heightAt(n.x,n.z);const y=g+.8;
 later(200,()=>{SFX.play("clink",n.res);shake(.05);
  spray(n.x+d.x*.6,y,n.z+d.z*.6,{n:done?22:9,col:ORE[n.res]||ORE.stone,geo:tetG,size:.11,speed:3.2,up:4.5,dir:d,life:1,floor:g+.05});
  spray(n.x+d.x*.7,y+.1,n.z+d.z*.7,{n:5,col:[0xffe2a0,0xfff1c8],size:.04,speed:4,up:3,dir:d,life:.3,glow:true,grav:9});
  dust(n.x+d.x*.5,g+.4,n.z+d.z*.5,done?8:2,done?2.4:1.2);
  if(done)later(60,()=>SFX.play("crumble"));
  const ms=n.meshes||[];const orig=ms.map(m=>m.position.clone());let k=0;const iv=setInterval(()=>{k++;ms.forEach((m,i)=>{m.position.copy(orig[i]);if(k<6){m.position.x+=(Math.random()-.5)*.08;m.position.z+=(Math.random()-.5)*.08}});if(k>=6)clearInterval(iv)},22)})}

/* ---------- carcass and butchering ---------- */
function carcassAt(a){return {x:a.x,y:heightAt(a.x,a.z)+.35,z:a.z}}
function butcherFx(a){[150,600,1050].forEach((ms,i)=>later(ms,()=>{const c=carcassAt(a);SFX.play("squish");
 spray(c.x,c.y+.2,c.z,{n:6,col:[0x8a1a14,0xa8261c,0x6e130e],geo:tetG,size:.05,speed:1.6,up:3,life:.6,floor:c.y-.3});
 if(i===2)spray(c.x,c.y+.2,c.z,{n:4,col:[0xc8665a,0xe0b8a0],size:.08,speed:1.2,up:3.5,life:.7,floor:c.y-.3})}))}
const SHRINK=[];
function butchered(a){SHRINK.push({a,t:0})}
function updShrink(dt){for(let i=SHRINK.length-1;i>=0;i--){const s=SHRINK[i];s.t+=dt;const k=Math.min(s.t/.8,1);s.a.c.g.scale.setScalar(Math.max(.001,1-k));if(k>=1)SHRINK.splice(i,1)}
 for(const a of H.fauna)if(!a.dead&&a.c.g.scale.x<1&&!SHRINK.some(s=>s.a===a))a.c.g.scale.setScalar(1)}

window.__hitFx=function(kind,o){
 if(kind==="tree")treeHit(o);
 else if(kind==="fell")later(150,()=>fell(o));
 else if(kind==="rock")rockHit(o,false);
 else if(kind==="rockDone")rockHit(o,true);
 else if(kind==="butcher")butcherFx(o);
 else if(kind==="butchered")butchered(o);
 else if(kind==="kill"){later(60,()=>{const c=carcassAt(o);SFX.play("flesh");shake(.16);spray(c.x,c.y+.5,c.z,{n:8,col:[0x8a1a14,0xa8261c],geo:tetG,size:.06,speed:2,up:3,life:.6,floor:c.y-.3})})}
 else if(kind==="fish"){SFX.play("splash");spray(o.x,.1,o.z,{n:10,col:[0xd8f0f4,0x9fd4e0],size:.07,speed:1.5,up:4,life:.7})}
 if(kind==="tree"||kind==="rock"||kind==="rockDone")delayNext=230};

/* ---------- icons that pop out of the world and fly to the resource bar ---------- */
let delayNext=0;
const css=document.createElement("style");css.textContent=`
#hvLayer{position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden}
.hv-ico{position:absolute;left:0;top:0;width:30px;height:30px;margin:-15px 0 0 -15px;will-change:transform;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))}
.hv-ico>*{width:100%;height:100%;display:block;object-fit:contain}
.hv-ico i{border-radius:50%;box-shadow:inset 0 -3px 0 rgba(0,0,0,.25),0 0 0 2px rgba(255,240,210,.8)}
.hv-txt{position:absolute;left:0;top:0;font:700 17px/1 "Cinzel","Trajan Pro",Georgia,serif;color:#fff3d6;white-space:nowrap;will-change:transform,opacity;
 text-shadow:0 2px 3px rgba(0,0,0,.75),0 0 2px rgba(0,0,0,.9);letter-spacing:.02em}
.hv-tip{position:absolute;left:0;top:0;transform:translate(-50%,-100%);padding:5px 10px;border-radius:999px;background:rgba(28,22,16,.82);border:1px solid rgba(231,201,135,.7);
 color:#f3ead8;font:600 13px/1.1 system-ui,sans-serif;white-space:nowrap}
.hv-tip b{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-right:6px;border-radius:4px;background:#e7c987;color:#2a1f14;font-size:11.5px}
#resBar .r.hv-bump{animation:hvBump .34s ease-out}
@keyframes hvBump{0%{transform:scale(1)}30%{transform:scale(1.32);filter:brightness(1.5)}100%{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.hv-ico,.hv-txt{display:none}}`;document.head.appendChild(css);
const layer=document.createElement("div");layer.id="hvLayer";document.body.appendChild(layer);
const RCOL={denarius:"#e7c987",food:"#d98a5c",wood:"#8a5a32",stone:"#cfc6b0",iron:"#8a3f24",silver:"#d9e2ea",gold:"#f4c430",hide:"#b48a5a"};
function screenOf(x,y,z){V.set(x,y,z).project(camera);if(V.z>1||V.z<-1)return null;return {x:(V.x+1)/2*innerWidth,y:(1-V.y)/2*innerHeight}}
function barSpan(label){const L=document.querySelectorAll("#resBar .r");for(const s of L)if(s.title===label)return s;return null}
function iconHtml(k,label){const s=barSpan(label);const ic=s&&(s.querySelector(".u2i")||s.querySelector("i"));
 if(ic&&ic.classList.contains("u2i"))return ic.innerHTML;return `<i style="background:${RCOL[k]||"#ccc"}"></i>`}
const ease=t=>1-Math.pow(1-t,3);
let popN=0,popT=0;
function anim(dur,step,done){const t0=performance.now();const f=now=>{const k=Math.min((now-t0)/dur,1);step(k);if(k<1)requestAnimationFrame(f);else done&&done()};requestAnimationFrame(f)}
function floatText(sx,sy,text){const el=document.createElement("div");el.className="hv-txt";el.textContent=text;layer.appendChild(el);
 const w=el.offsetWidth;anim(1100,k=>{el.style.transform=`translate(${sx-w/2}px,${sy-28-k*46}px) scale(${k<.15?.6+k/.15*.5:1.1-Math.min(k,.3)/3})`;el.style.opacity=k<.6?1:1-(k-.6)/.4},()=>el.remove())}
window.__gainFx=function(k,n,x,y,z,label,add){
 if(document.hidden)return false;
 const d=delayNext;delayNext=0;
 later(d,()=>{const p=screenOf(x,y,z)||{x:innerWidth/2,y:innerHeight*.55};
  floatText(p.x,p.y,`+${n} ${label}`);
  const c=Math.min(n,6);let left=n;const html=iconHtml(k,label);
  for(let i=0;i<c;i++){const part=i===c-1?left:1;left-=part;
   later(i*85,()=>{const el=document.createElement("div");el.className="hv-ico";el.innerHTML=html;layer.appendChild(el);
    const a=-Math.PI/2+(Math.random()-.5)*1.6,r=40+Math.random()*30;const px=p.x+Math.cos(a)*r,py=p.y+Math.sin(a)*r-20;
    anim(300,t=>{const e=ease(t);el.style.transform=`translate(${p.x+(px-p.x)*e}px,${p.y+(py-p.y)*e-Math.sin(t*Math.PI)*18}px) scale(${.4+e*.8})`},()=>{
     const s=barSpan(label),r2=s&&s.getBoundingClientRect();const visible=r2&&r2.width>0&&getComputedStyle(s).visibility!=="hidden";
     const tx=visible?r2.left+Math.min(r2.width,40)/2+4:px,ty=visible?r2.top+r2.height/2:py-60;
     const cx=(px+tx)/2+(Math.random()-.5)*80,cy=Math.min(py,ty)-90;
     later(120,()=>anim(520,t=>{const e=t*t*(3-2*t);const ix=(1-e)*(1-e)*px+2*(1-e)*e*cx+e*e*tx,iy=(1-e)*(1-e)*py+2*(1-e)*e*cy+e*e*ty;
      el.style.transform=`translate(${ix}px,${iy}px) scale(${1.2-e*.55})`;if(!visible)el.style.opacity=1-e},()=>{el.remove();add(part);
      const now=performance.now();popN=now-popT<700?popN+1:0;popT=now;SFX.play("pop",popN);
      const s2=barSpan(label);if(s2){s2.classList.remove("hv-bump");void s2.offsetWidth;s2.classList.add("hv-bump")}}))})})}});
 return true};

/* ---------- prompt above a carcass you can butcher ---------- */
const tip=document.createElement("div");tip.className="hv-tip";tip.hidden=true;layer.appendChild(tip);
const TIP={ko:["F","손질하기","눌러서 손질하기"],en:["F","Butcher","Tap to butcher"],ja:["F","解体する","タップで解体"]};
function updTip(){const hv=window.__harvest;const a=H.mode==="play"&&P.kind==="human"&&!P.dead&&hv&&hv.nearCarcass();
 if(!a){tip.hidden=true;return}const c=carcassAt(a);const s=screenOf(c.x,c.y+1.1,c.z);if(!s){tip.hidden=true;return}
 const L=TIP[LANG()]||TIP.en;tip.innerHTML=isTouch?L[2]:`<b>${L[0]}</b>${L[1]}`;tip.hidden=false;tip.style.left=s.x+"px";tip.style.top=s.y+"px"}

/* ---------- frame hook ---------- */
const R=H.renderer,prev=R.render.bind(R);let last=performance.now();
R.render=function(sc,cam){const now=performance.now(),dt=Math.min(.2,(now-last)/1000);last=now;
 if(sc===scene){try{updPT(dt);updDust(dt);updFall(dt);updShrink(dt);updTip()}catch(e){console.warn("[harvest]",e)}}
 prev(sc,cam)};
window.__harvestDbg={FALL,PT};console.log("[harvest] ready");
})();
