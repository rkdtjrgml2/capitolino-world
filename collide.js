/* Capitolino World · collide.js
 * Solid world: buildings, the rostra, columns, stalls, the bridge, rocks and signs stop the player,
 * and anything with a flat top (stairs, platforms, steps of a temple) can be climbed and walked on.
 *
 * How it works: every registered object is laid onto a flat grid of CELL sized squares. For each square
 * we keep the solid height ranges of that object, found from its upward faces (a top) and downward faces
 * (a bottom). A range whose top is within STEP of the feet is ground to stand on; a range that reaches
 * into the body (between STEP and HEAD above the feet) blocks the way.
 *
 * The game registers objects through window.__colAdd(key, object, opt). The same key replaces the old
 * entry (a house rebuilt, the simple rostra swapped for the detailed one). An entry counts only while its
 * object (or opt.vis) is visible and still in the scene, so hidden or removed things stop colliding.
 */
(function(){
"use strict";
const H=window.__gfxHooks;if(!H||!window.THREE)return;
const CELL=.25,INV=1/CELL,STEP=.62,HEAD=1.55,RAD=.32;
const cells=new Map();const owners=new Map();let seq=0;
const ck=(i,j)=>(i+32768)*65536+(j+32768);
const A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3(),M=new THREE.Matrix4(),MI=new THREE.Matrix4();

function readPos(attr){
 /* positions may be quantized (normalized ints) in packed glb files; r128 getX does not scale them */
 const a=attr.array,n=attr.count,s=attr.itemSize,out=new Float32Array(n*3);
 let k=1;if(attr.normalized){k=a instanceof Int16Array?1/32767:a instanceof Uint16Array?1/65535:a instanceof Int8Array?1/127:a instanceof Uint8Array?1/255:1}
 if(attr.isInterleavedBufferAttribute){for(let i=0;i<n;i++){out[i*3]=attr.getX(i)*k;out[i*3+1]=attr.getY(i)*k;out[i*3+2]=attr.getZ(i)*k}return out}
 for(let i=0;i<n;i++){out[i*3]=a[i*s]*k;out[i*3+1]=a[i*s+1]*k;out[i*3+2]=a[i*s+2]*k}return out}

/* lay one mesh (world matrix m) into the per cell sample lists of this owner */
function addWall(wall,k,y){let L=wall.get(k);if(!L){wall.set(k,[y,y]);return}
 for(let i=0;i<L.length;i+=2){if(y>=L[i]-.3&&y<=L[i+1]+.3){if(y<L[i])L[i]=y;if(y>L[i+1])L[i+1]=y;return}}L.push(y,y)}
function raster(geo,m,acc,wall){
 const pa=geo.attributes&&geo.attributes.position;if(!pa)return;
 const P=readPos(pa),idx=geo.index?geo.index.array:null,n=idx?idx.length:pa.count;
 const flip=m.determinant()<0;const e=m.elements;
 const tx=(i)=>{const x=P[i*3],y=P[i*3+1],z=P[i*3+2];return [e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]]};
 for(let t=0;t+2<n;t+=3){
  const a=tx(idx?idx[t]:t),b=tx(idx?idx[t+1]:t+1),c=tx(idx?idx[t+2]:t+2);
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,nl=Math.hypot(nx,ny,nz);if(nl<1e-9)continue;
  if(Math.abs(ny)/nl<.22){/* steep faces (walls, risers, column shafts): the column of cells they pass through is solid over their height */
   const L1=Math.hypot(ux,uy,uz),L2=Math.hypot(vx,vy,vz),nu=Math.min(400,Math.ceil(L1/(CELL*.5))),nv=Math.min(400,Math.ceil(L2/(CELL*.5)));
   for(let p=0;p<=nu;p++)for(let q=0;q<=nv-Math.floor(p*nv/nu);q++){const w1=p/nu,w2=nv?q/nv:0;if(w1+w2>1.0001)continue;
    const x=a[0]+w1*ux+w2*vx,y=a[1]+w1*uy+w2*vy,z=a[2]+w1*uz+w2*vz;addWall(wall,ck(Math.floor(x*INV),Math.floor(z*INV)),y)}
   continue}
  const up=(ny>0)!==flip;
  const d=(b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]);if(Math.abs(d)<1e-9)continue;
  const x0=Math.min(a[0],b[0],c[0]),x1=Math.max(a[0],b[0],c[0]),z0=Math.min(a[2],b[2],c[2]),z1=Math.max(a[2],b[2],c[2]);
  const i0=Math.floor(x0*INV),i1=Math.floor(x1*INV),j0=Math.floor(z0*INV),j1=Math.floor(z1*INV);let hit=0;
  const put=(i,j,w1,w2)=>{const h=a[1]+w1*(b[1]-a[1])+w2*(c[1]-a[1]);const k=ck(i,j);let L=acc.get(k);if(!L)acc.set(k,L=[]);L.push(h,up?1:-1);hit++};
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){
   const px=(i+.5)*CELL-a[0],pz=(j+.5)*CELL-a[2];
   const w1=(px*(c[2]-a[2])-(c[0]-a[0])*pz)/d,w2=((b[0]-a[0])*pz-px*(b[2]-a[2]))/d;
   if(w1>=-.04&&w2>=-.04&&w1+w2<=1.04)put(i,j,Math.max(0,w1),Math.max(0,w2))}
  if(!hit){/* smaller than a cell: mark the cells under its corners */
   put(Math.floor(a[0]*INV),Math.floor(a[2]*INV),0,0);put(Math.floor(b[0]*INV),Math.floor(b[2]*INV),1,0);put(Math.floor(c[0]*INV),Math.floor(c[2]*INV),0,1)}}}

/* turn the samples of one cell into solid ranges [bottom, top, bottom, top, ...] */
function spans(L,W){
 const s=[];if(L)for(let i=0;i<L.length;i+=2)s.push([L[i],L[i+1]]);s.sort((p,q)=>q[0]-p[0]);
 const out=[];let i=0;
 while(i<s.length){const [h,up]=s[i];
  if(up<0){out.push(h,h+.2);i++;while(i<s.length&&s[i][1]<0&&h-s[i][0]<.05)i++;continue}
  let j=i+1;while(j<s.length&&s[j][1]>0&&h-s[j][0]<.04)j++;/* same surface counted twice */
  if(j>=s.length){out.push(-1e4,h);break}
  if(s[j][1]<0){out.push(s[j][0],h);i=j+1}else{out.push(s[j][0],h);i=j}}
 if(W)for(let k=0;k<W.length;k+=2)out.push(W[k],Math.max(W[k+1],W[k]+.05));
 /* merge overlapping ranges, highest first */
 const r=[];for(let k=0;k<out.length;k+=2)r.push([out[k],out[k+1]]);r.sort((p,q)=>q[1]-p[1]);
 const m=[];for(const [b,t] of r){if(m.length&&t>=m[m.length-2]-.02){m[m.length-2]=Math.min(m[m.length-2],b)}else m.push(b,t)}
 return new Float32Array(m)}

function drop(key){const o=owners.get(key);if(!o)return;owners.delete(key);
 for(const k of o.cells){const L=cells.get(k);if(!L)continue;const f=L.filter(e=>e.o!==o);if(f.length)cells.set(k,f);else cells.delete(k)}}

function add(key,obj,opt){opt=opt||{};drop(key);if(!obj)return;
 const o={key,obj,vis:opt.vis||obj,id:++seq,cells:[]};const acc=new Map(),wall=new Map();
 obj.updateWorldMatrix(true,true);
 obj.traverse(m=>{if(!m.isMesh||m.isSkinnedMesh||!m.geometry)return;if(m.userData&&m.userData.noCollide)return;
  const mats=Array.isArray(m.material)?m.material:[m.material];if(mats.every(x=>x&&(x.transparent&&x.opacity<.6||x.visible===false)))return;
  if(m.isInstancedMesh){const n=m.count;for(let i=0;i<n;i++){m.getMatrixAt(i,MI);if(Math.abs(MI.elements[0])+Math.abs(MI.elements[5])+Math.abs(MI.elements[10])<.01)continue;M.multiplyMatrices(m.matrixWorld,MI);raster(m.geometry,M,acc,wall)}}
  else raster(m.geometry,m.matrixWorld,acc,wall)});
 for(const k of wall.keys())if(!acc.has(k))acc.set(k,null);
 for(const [k,L] of acc){const s=spans(L,wall.get(k));if(!s.length)continue;let C2=cells.get(k);if(!C2)cells.set(k,C2=[]);C2.push({o,s});o.cells.push(k)}
 owners.set(key,o);return o}

function live(o){let v=o.vis;if(o.obj!==v&&!inScene(o.obj))return false;while(v){if(!v.visible)return false;if(v===H.scene)return true;v=v.parent}return false}
function inScene(v){while(v){if(v===H.scene)return true;v=v.parent}return false}
const lv=new Map();let lvF=-1;
function alive(o){const f=H.renderer&&H.renderer.info?H.renderer.info.render.frame:0;if(f!==lvF){lv.clear();lvF=f}let r=lv.get(o);if(r===undefined){r=live(o);lv.set(o,r)}return r}

function cellAt(x,z){return cells.get(ck(Math.floor(x*INV),Math.floor(z*INV)))}
/* highest standing surface at x,z reachable from feet at foot (a step up of at most STEP) */
function support(x,z,foot,ground){let best=ground;const L=cellAt(x,z);if(!L)return best;
 for(const e of L){if(!alive(e.o))continue;const s=e.s;for(let k=0;k<s.length;k+=2){const t=s[k+1];if(t>best&&t<=foot+STEP)best=t}}return best}
function solidIn(x,z,lo,hi){const L=cellAt(x,z);if(!L)return false;
 for(const e of L){if(!alive(e.o))continue;const s=e.s;for(let k=0;k<s.length;k+=2)if(s[k+1]>lo&&s[k]<hi)return true}return false}
/* does a body standing with its feet at foot overlap something solid at x,z */
const RING=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[.7,.7],[.7,-.7],[-.7,.7],[-.7,-.7]];
function blocked(x,z,foot,r){r=r==null?RAD:r;for(const [a,b] of RING)if(solidIn(x+a*r,z+b*r,foot+STEP,foot+HEAD))return true;return false}
function solidAt(x,z,y){return solidIn(x,z,y-.05,y+.05)}

function spansAt(x,z){const L=cellAt(x,z);return L?L.map(e=>e.o.key+(alive(e.o)?'':'(off)')+':'+Array.from(e.s).map(v=>v<-1e3?'-inf':v.toFixed(2)).join(',')):[]}
window.__col={add,drop,support,blocked,solidAt,spansAt,STEP,HEAD,get size(){return cells.size},owners};
window.__colAdd=(k,o,opt)=>add(k,o,opt);
const T0=performance.now();const Q=window.__colQ||[];window.__colQ=null;for(const [k,o,opt] of Q)add(k,o,opt);
console.log("[collide] ready",Math.round(performance.now()-T0)+"ms",owners.size,"objects",cells.size,"cells");
})();
