/* Capitolino World · audio.js
 * Footsteps that follow the ground under your feet, sampled layers on gathering and combat,
 * coins, button clicks, and a quiet ambience of wind, river, birds and the Forum crowd.
 * Samples: Kenney Impact Sounds and Interface Sounds (CC0), packed into sfx/sfx.mp3.
 * Ambience is synthesized. Everything goes through window.__sfx, so the mute setting applies.
 */
(function(){
"use strict";
const S=window.__sfx,H=window.__gfxHooks,C=window.__cap;
if(!S||!S._ctx||!H||!C)return;
const {heightAt,inForum,roadDistM,FORUM}=H;const G=H.G||2.2;

/* ---------- the sample sprite ---------- */
const OFF=[0,1.1247,2.1454,3.1849,4.2013,5.1387,5.5917,6.0464,6.5063,6.9639,7.4254,8.0467,8.6454,9.2439,9.8425,10.4375,11.1588,11.8801,12.6014,13.3228,14.0441,14.7042,15.3644,16.0245,17.3119,18.5313,19.686,21.0277,22.208,22.9886,23.7403,24.6317,25.3546,25.9536,26.5365,27.3685,27.929,28.4401,28.9047,29.4158,29.8809,30.4113,30.8522];
const DUR=[.775,.671,.69,.666,.587,.103,.105,.11,.108,.111,.271,.249,.248,.249,.245,.371,.371,.371,.371,.371,.31,.31,.31,.937,.869,.805,.992,.83,.431,.402,.541,.373,.249,.233,.482,.21,.161,.115,.161,.115,.18,.091,.318];
const GR={grass:[0,5],stone:[5,10],wood:[10,15],gravel:[15,20],chop:[20,23],mine:[23,28],punch:[28,31],coin:[31,36],soft:[36,39],land:[39,41],click:[41,42],toggle:[42,43]};
let buf=null,shift=0,raw=null,decoding=false;const last={};
fetch("sfx/sfx.mp3").then(r=>r.ok?r.arrayBuffer():null).then(a=>{raw=a;decode()}).catch(()=>{});
function decode(){const ac=S._ctx();if(!ac||!raw||buf||decoding)return;decoding=true;const a=raw;raw=null;
 const ok=b=>{const d=b.getChannelData(0);let i=0;const n=Math.min(d.length,b.sampleRate*.2);while(i<n&&Math.abs(d[i])<.01)i++;shift=i<n?i/b.sampleRate:0;buf=b};
 try{const p=ac.decodeAudioData(a,ok,e=>console.warn("[audio] decode",e));if(p&&p.catch)p.catch(()=>{})}catch(e){console.warn("[audio]",e)}}
const rnd=(a,b)=>a+Math.random()*(b-a);
function smp(g,o){if(!buf||S.muted)return;const ac=S._ctx();if(!ac||ac.state!=="running")return;o=o||{};
 const [a,b]=GR[g];let k=a+Math.floor(Math.random()*(b-a));if(b-a>1&&k===last[g])k=a+((k-a+1)%(b-a));last[g]=k;
 const t0=ac.currentTime+(o.at||0);const s=ac.createBufferSource();s.buffer=buf;const rate=o.rate||1;s.playbackRate.value=rate;
 let node=s;if(o.lp){const f=ac.createBiquadFilter();f.type="lowpass";f.frequency.value=o.lp;node.connect(f);node=f}
 const gn=ac.createGain();gn.gain.value=o.g==null?.6:o.g;node.connect(gn);
 if(o.pan&&ac.createStereoPanner){const p=ac.createStereoPanner();p.pan.value=o.pan;gn.connect(p);p.connect(S._out())}else gn.connect(S._out());
 const st=Math.max(0,OFF[k]+shift-.004),d=DUR[k]+.02;s.start(t0,st,d);}

/* ---------- sampled layers on the existing synthesized effects ---------- */
const L=S._lib;
function layer(n,f){const o=L[n];L[n]=a=>{o&&o(a);try{f(a)}catch(e){}}}
layer("chop",()=>smp("chop",{g:.75,rate:rnd(.85,1.05)}));
layer("clink",m=>smp("mine",{g:.7,rate:m==="stone"?rnd(.85,.95):rnd(1,1.15)}));
layer("thud",()=>{smp("chop",{g:.9,rate:.5,lp:900});smp("land",{g:.6,rate:.6,at:.08})});
layer("flesh",()=>smp("punch",{g:.6,rate:rnd(.9,1.1)}));
layer("squish",()=>smp("soft",{g:.35,rate:rnd(.7,.85)}));
layer("pop",i=>{if(!(i>0))smp("soft",{g:.28,rate:rnd(1.3,1.5)})});
L.coin=n=>{for(let i=0;i<Math.min(4,n||3);i++)smp("coin",{at:i*rnd(.045,.075),g:.3,rate:rnd(1.25,1.6)})};
L.click=()=>smp("click",{g:.35,rate:rnd(.95,1.05)});
L.toggle=()=>smp("toggle",{g:.3});

/* button clicks in menus and panels (not on the 3D view) */
addEventListener("pointerdown",e=>{decode();const b=e.target&&e.target.closest&&e.target.closest("button,[role=button],.who,[data-who],[data-snd]");
 if(b&&!b.disabled)setTimeout(()=>S.play(b.matches("[data-snd],[type=checkbox]")?"toggle":"click"),0)},{capture:true,passive:true});
addEventListener("keydown",decode,{capture:true});

/* ---------- footsteps ---------- */
const GAIT={human:{g:.55,r:1,cad:1.9},deer:{g:.42,r:1.15,cad:2.6},wolf:{g:.36,r:1.2,cad:2.8},boar:{g:.5,r:.9,cad:2.6},
 bear:{g:.85,r:.7,cad:1.6},hare:{g:.22,r:1.4,cad:2.2},crow:{g:.12,r:1.6,cad:3}};
function surface(x,z,y){const h=heightAt(x,z);if(h<-.25)return "water";
 if(Math.abs(z/G-28.5)<.9&&x/G<-21&&x/G>-67)return "stone";
 if(inForum(x,z,0))return "stone";
 const rd=roadDistM(x/G,z/G);if(rd<1.9)return Math.hypot(x-30,z-40)<280?"stone":"dirt";
 return "grass"}
function step(kind,run,heavy){const P=C.P,gt=GAIT[kind]||GAIT.human;const sf=surface(P.x,P.z,P.y);
 const g=gt.g*(run?1.15:1)*(heavy||1),r=gt.r*rnd(.93,1.07);
 if(sf==="water"){S.play("_wade",{g:g*.6,r});return}
 if(sf==="stone")smp("stone",{g:g*1.05,rate:r});
 else if(sf==="dirt")smp("gravel",{g:g*.55,rate:r*.72,lp:2600});
 else smp("grass",{g:g*.75,rate:r*1.05,lp:kind==="human"?6000:4000});}
L._wade=o=>{const ac=S._ctx(),nb=S._noise(),t0=ac.currentTime;const s=ac.createBufferSource();s.buffer=nb;
 const f=ac.createBiquadFilter();f.type="bandpass";f.Q.value=.9;f.frequency.setValueAtTime(1400*o.r,t0);f.frequency.exponentialRampToValueAtTime(420,t0+.26);
 const g=ac.createGain();g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(Math.max(.002,.32*o.g),t0+.03);g.gain.exponentialRampToValueAtTime(.0001,t0+.3);
 s.connect(f);f.connect(g);g.connect(S._out());s.start(t0,Math.random()*.5);s.stop(t0+.35)};
let lastIdx=-1,lx=null,lz=null,acc=0,air=false,lastT=performance.now(),coins=null,playSince=0;

/* ---------- ambience ---------- */
let A=null;
function ambInit(){if(A)return A;const ac=S._ctx();if(!ac)return null;const nb=S._noise();const out=ac.createGain();out.gain.value=0;out.connect(S._out());
 const loop=(rate)=>{const s=ac.createBufferSource();s.buffer=nb;s.loop=true;s.playbackRate.value=rate;s.start();return s};
 const chain=(src,type,f,q)=>{const b=ac.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q||.7;src.connect(b);return b};
 const gain=(node,v)=>{const g=ac.createGain();g.gain.value=v;node.connect(g);g.connect(out);return g};
 /* wind: two slow layers so gusts never repeat in step */
 const w1=gain(chain(loop(.5),"lowpass",380,.5),0),w2=gain(chain(loop(.37),"bandpass",900,1.6),0);
 /* river: a broad hiss and a lower rumble */
 const rv=ac.createGain();rv.gain.value=0;rv.connect(out);
 {const a=chain(loop(1),"bandpass",1100,.6),b=chain(loop(.8),"lowpass",320,.7);const ga=ac.createGain(),gb=ac.createGain();ga.gain.value=.6;gb.gain.value=.9;a.connect(ga);b.connect(gb);ga.connect(rv);gb.connect(rv)}
 /* forum crowd: noise through three voice formants whose levels flicker at syllable pace */
 const cr=ac.createGain();cr.gain.value=0;cr.connect(out);const forms=[];
 for(const [f,q,r] of [[340,4,.9],[780,5,1.1],[1350,6,1.3]]){const b=chain(loop(r),"bandpass",f,q);const g=ac.createGain();g.gain.value=.3;b.connect(g);g.connect(cr);forms.push({g,f,b})}
 A={ac,out,w1,w2,rv,cr,forms,birdAt:0,gustAt:0,formAt:0,waterAt:0,water:99,ham:0};return A}
function setT(p,v,tc){p.setTargetAtTime(v,A.ac.currentTime,tc||.4)}
function waterDist(x,z){for(const r of [3,7,13,22,34,50]){for(let i=0;i<14;i++){const a=i/14*Math.PI*2;if(heightAt(x+Math.cos(a)*r,z+Math.sin(a)*r)<-.6)return r}}return 99}
function forumDist(x,z){const dx=Math.max(FORUM.x0-x,0,x-FORUM.x1),dz=Math.max(FORUM.z0-z,0,z-FORUM.z1);return Math.hypot(dx,dz)}
function bird(pan,far){const ac=A.ac,t0=ac.currentTime;const type=Math.floor(Math.random()*4);const base=rnd(2300,4200);const vol=far?rnd(.012,.025):rnd(.025,.05);
 const p=ac.createStereoPanner?ac.createStereoPanner():null;const g=ac.createGain();g.gain.value=1;if(p){p.pan.value=pan;g.connect(p);p.connect(A.out)}else g.connect(A.out);
 const note=(at,f1,f2,d)=>{const o=ac.createOscillator();o.type="sine";const e=ac.createGain();o.frequency.setValueAtTime(f1,t0+at);o.frequency.exponentialRampToValueAtTime(f2,t0+at+d);
  e.gain.setValueAtTime(.0001,t0+at);e.gain.exponentialRampToValueAtTime(vol,t0+at+d*.25);e.gain.exponentialRampToValueAtTime(.0001,t0+at+d);o.connect(e);e.connect(g);o.start(t0+at);o.stop(t0+at+d+.02)};
 if(type===0){note(0,base,base*1.35,.12);note(.18,base*1.3,base*.95,.14)}
 else if(type===1){const n=5+Math.floor(Math.random()*6);for(let i=0;i<n;i++)note(i*.07,base*1.1,base*.8,.055)}
 else if(type===2){for(let i=0;i<4;i++)note(i*.13,base*(1.2-i*.08),base*(1.05-i*.08),.1)}
 else{note(0,base*.7,base*1.1,.22);note(.3,base*1.1,base*.7,.25)}}
function hammer(){const ac=A.ac;for(let i=0;i<(Math.random()<.5?2:3);i++){const t0=ac.currentTime+i*.42;const o=ac.createOscillator();o.type="triangle";o.frequency.value=rnd(1700,1900);
 const e=ac.createGain();e.gain.setValueAtTime(.0001,t0);e.gain.exponentialRampToValueAtTime(.022,t0+.003);e.gain.exponentialRampToValueAtTime(.0001,t0+.35);o.connect(e);e.connect(A.out);o.start(t0);o.stop(t0+.4)}}
function ambience(now,P,play){if(!ambInit())return;const on=play&&!S.muted&&!document.hidden&&A.ac.state==="running";setT(A.out.gain,on?1:0,.6);if(!on)return;
 const x=P.x,z=P.z,alt=Math.max(0,P.y-Math.max(heightAt(x,z),0));const fish=P.kind==="fish";
 if(now>A.gustAt){A.gustAt=now+rnd(1500,4000);const base=.05+Math.min(.12,alt*.004);const gust=Math.random()<.25?rnd(1.6,2.4):rnd(.6,1.2);
  setT(A.w1.gain,fish?0:base*gust,1.2);setT(A.w2.gain,fish?0:base*.35*gust,1.5)}
 if(now>A.waterAt){A.waterAt=now+500;A.water=fish?0:waterDist(x,z)}
 setT(A.rv.gain,fish?.04:.2*Math.max(0,1-A.water/55),.8);
 const fd=forumDist(x,z),crowd=.2*Math.max(0,1-fd/70)*(fish?0:1);setT(A.cr.gain,crowd,.8);
 if(crowd>.01&&now>A.formAt){A.formAt=now+rnd(90,160);for(const f of A.forms){setT(f.g.gain,rnd(.05,.5),.05);f.b.frequency.setTargetAtTime(f.f*rnd(.85,1.2),A.ac.currentTime,.06)}}
 if(crowd>.03&&now>A.ham){A.ham=now+rnd(6000,14000);if(Math.random()<.6)hammer()}
 const city=Math.hypot(x-30,z-40);if(!fish&&now>A.birdAt){const wild=city>120,rate=wild?1:city>60?.4:.15;A.birdAt=now+rnd(1800,5500)/rate;bird(rnd(-.8,.8),!wild)}}

/* ---------- per frame ---------- */
function tick(){requestAnimationFrame(tick);const now=performance.now(),dt=Math.min(.1,(now-lastT)/1000);lastT=now;
 const P=C.P;if(!P)return;const play=C.mode==="play";
 if(!play){lx=null;coins=null;ambience(now,P,false);return}
 if(!playSince)playSince=now;
 /* coins: a jingle when money comes in, a single coin when it goes out */
 const dn=C.RES&&C.RES.denarius;if(coins!=null&&dn!==coins&&now-playSince>1500){if(dn>coins)S.play("coin",dn-coins>=10?4:3);else S.play("coin",1)}coins=dn;
 if(lx==null){lx=P.x;lz=P.z}
 let d=Math.hypot(P.x-lx,P.z-lz);lx=P.x;lz=P.z;if(d>3)d=0;
 const kind=P.kind,inAir=P.jy>.05||(kind==="crow"&&P.flying);
 if(kind==="fish"||P.dead||(kind==="crow"&&P.flying)){acc=0}
 else{if(air&&!inAir&&kind!=="crow"){smp("land",{g:.4*(GAIT[kind]||GAIT.human).g/.55,rate:rnd(.8,.95)});step(kind,false,.8);acc=0;lastIdx=-1}
  const I=P.c&&P.c.__gfx,act=I&&I.cur,clip=act&&act.getClip&&act.getClip();
  const gaitClip=clip&&/walk|run|sprint|gallop|trot|swim|hop/i.test(clip.name)&&!/idle/i.test(clip.name);
  if(!inAir&&gaitClip&&act.isRunning()){
   /* lock steps to the animation: two contacts per cycle for two legs, four for four legs */
   const n=/swim/i.test(clip.name)?1:(kind==="human"||kind==="crow"||kind==="hare")?2:4;
   const idx=Math.floor((act.time/clip.duration)*n+.15)%n;const run=/run|sprint|gallop/i.test(clip.name)&&kind!=="human"||/sprint/i.test(clip.name);
   if(lastIdx>=0&&idx!==lastIdx)step(kind,run,(n===4&&idx%2?.7:1)*(kind==="human"&&/walk/i.test(clip.name)?.7:1));lastIdx=idx;acc=0}
  else{lastIdx=-1;
   if(!inAir&&d>0&&dt>0){const sp=d/dt,gt=GAIT[kind]||GAIT.human;const cad=gt.cad*(.85+Math.min(.5,sp*.04));
    acc+=d;if(acc>=Math.max(.3,sp/cad)){acc=0;step(kind,false)}}
   else if(d===0)acc=Math.min(acc,.15)}}
 air=inAir;
 ambience(now,P,true)}
requestAnimationFrame(tick);
window.__audioDbg={get ready(){return !!buf},get shift(){return shift},surface:(x,z,y)=>surface(x,z,y),smp};
})();
