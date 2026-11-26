/* Capitolino World · world.js
 * Look of the ground and the water, without changing their shape or the game rules.
 * Ground: smooth shading, blended vertex colors and a procedural detail layer.
 * Water: depth tinted shallows, shore foam and moving glints from a height texture.
 */
(function(){
"use strict";
const H=window.__gfxHooks;if(!H||!window.THREE)return;
const {scene,heightAt}=H;
const U={time:{value:0}};
const NOISE=`
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm3(vec2 p){return vn(p)*.5+vn(p*2.03+7.1)*.3+vn(p*4.11-3.7)*.2;}
`;

/* ---------- ground ---------- */
/* road and Forum surfaces: a mask texture (r road, g Forum) drives procedural paving in the ground shader */
const PAVING=`
vec2 h22(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
vec3 basalt(vec2 w){vec2 p=w*1.15,i=floor(p),f=fract(p);float d1=8.,d2=8.;vec2 id=vec2(0.);
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y)),o=h22(i+g)*.85+.07;float d=length(g+o-f);
  if(d<d1){d2=d1;d1=d;id=i+g;}else if(d<d2)d2=d;}
 float e=d2-d1,t=h21(id);
 vec3 st=mix(vec3(.39,.37,.35),vec3(.5,.47,.42),t)*(.88+.22*vn(w*3.1))*(1.-.18*smoothstep(.0,.5,d1));
 return mix(vec3(.27,.24,.2),st,smoothstep(.03,.11,e));}
vec3 slabs(vec2 w){vec2 s=vec2(3.2,2.4);float row=floor(w.y/s.y);vec2 p=vec2(w.x/s.x+.5*mod(row,2.),w.y/s.y);vec2 i=floor(p),f=fract(p);
 float t=h21(i);vec2 b=min(f,1.-f)*s;float e=min(b.x,b.y);
 vec3 c=mix(vec3(.86,.81,.7),vec3(.93,.89,.8),t)*(.9+.14*vn(w*1.7+t*9.))*(1.-.1*smoothstep(.62,.8,vn(w*7.)));
 c*=1.-.07*smoothstep(.35,0.,e);
 return mix(vec3(.55,.5,.42),c,smoothstep(.02,.07,e));}
`;
function surfaceTex(){const R=H.roadDistM,F=H.inForum,G=H.G;if(!R||!F||!G)return null;
 const N=1024,S=H.SIZE,x0=H.CX-S/2,z0=H.CZ-S/2,px=S/N;const d=new Uint8Array(N*N*4);
 /* coarse pass so only pixels near a road pay for the exact distance */
 const C=64,cs=S/C,coarse=new Float32Array(C*C);
 for(let j=0;j<C;j++)for(let i=0;i<C;i++)coarse[j*C+i]=R((x0+(i+.5)*cs)/G,(z0+(j+.5)*cs)/G);
 const reach=2.4+cs*.75/G;const sm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
 for(let j=0;j<N;j++){const z=z0+(j+.5)*px,cj=Math.min(C-1,Math.floor((j+.5)*px/cs));
  for(let i=0;i<N;i++){const x=x0+(i+.5)*px,ci=Math.min(C-1,Math.floor((i+.5)*px/cs));const k=(j*N+i)*4;d[k+3]=255;
   if(coarse[cj*C+ci]<reach&&heightAt(x,z)>-.4){const rd=R(x/G,z/G);if(rd<2.4)d[k]=255*(1-sm(1.3,2.4,rd))}
   if(F(x,z,0))d[k+1]=255}}
 const tex=new THREE.DataTexture(d,N,N,THREE.RGBAFormat);tex.magFilter=tex.minFilter=THREE.LinearFilter;tex.needsUpdate=true;
 return {tex,box:new THREE.Vector4(x0,z0,S,S)}}
function ground(){
 let tm=null;scene.traverse(o=>{if(!tm&&o.isMesh&&!o.isInstancedMesh&&o.material&&o.material.vertexColors&&o.material.flatShading&&o.geometry.attributes.position.count>100000)tm=o});
 if(!tm)return false;
 const g=tm.geometry,P=g.attributes.position,C=g.attributes.color,n=P.count;
 /* the terrain is a regular grid: find the cell size and average colors and normals per grid point */
 let cell=1e9;for(let i=0;i<9;i++){const d=Math.abs(P.getX(i)-P.getX(i+1));if(d>1e-3&&d<cell)cell=d}
 let minX=1e9,minZ=1e9,maxX=-1e9,maxZ=-1e9;for(let i=0;i<n;i++){const x=P.getX(i),z=P.getZ(i);if(x<minX)minX=x;if(z<minZ)minZ=z;if(x>maxX)maxX=x;if(z>maxZ)maxZ=z}
 const W=Math.round((maxX-minX)/cell)+1,Hh=Math.round((maxZ-minZ)/cell)+1;
 const acc=new Float32Array(W*Hh*3),cnt=new Uint8Array(W*Hh),key=new Uint32Array(n);
 for(let i=0;i<n;i++){const k=Math.round((P.getZ(i)-minZ)/cell)*W+Math.round((P.getX(i)-minX)/cell);key[i]=k;
  acc[k*3]+=C.getX(i);acc[k*3+1]+=C.getY(i);acc[k*3+2]+=C.getZ(i);cnt[k]++}
 for(let i=0;i<n;i++){const k=key[i],c=cnt[k];C.setXYZ(i,acc[k*3]/c,acc[k*3+1]/c,acc[k*3+2]/c)}
 C.needsUpdate=true;
 /* smooth normals from the same grid */
 const nacc=new Float32Array(W*Hh*3),a=new THREE.Vector3(),b=new THREE.Vector3(),c3=new THREE.Vector3(),fn=new THREE.Vector3();
 for(let i=0;i<n;i+=3){a.fromBufferAttribute(P,i);b.fromBufferAttribute(P,i+1);c3.fromBufferAttribute(P,i+2);
  fn.subVectors(c3,b).cross(a.clone().sub(b));for(let j=0;j<3;j++){const k=key[i+j];nacc[k*3]+=fn.x;nacc[k*3+1]+=fn.y;nacc[k*3+2]+=fn.z}}
 const N=g.attributes.normal;for(let i=0;i<n;i++){const k=key[i];fn.set(nacc[k*3],nacc[k*3+1],nacc[k*3+2]).normalize();N.setXYZ(i,fn.x,fn.y,fn.z)}
 N.needsUpdate=true;
 const m=tm.material;m.flatShading=false;
 const surf=surfaceTex();
 m.onBeforeCompile=sh=>{
  if(surf){sh.uniforms.uSurf={value:surf.tex};sh.uniforms.uSB={value:surf.box}}
  sh.vertexShader="varying vec3 vWp;\n"+sh.vertexShader.replace("#include <worldpos_vertex>","#include <worldpos_vertex>\n vWp=(modelMatrix*vec4(transformed,1.)).xyz;");
  sh.fragmentShader=(surf?"#define SURF\nuniform sampler2D uSurf;uniform vec4 uSB;\n":"")+"varying vec3 vWp;\n"+NOISE+PAVING+sh.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
  { float big=fbm3(vWp.xz*.045), mid=fbm3(vWp.xz*.33), fine=vn(vWp.xz*2.7);
    float lum=dot(diffuseColor.rgb,vec3(.3,.59,.11));
    float green=clamp((diffuseColor.g-max(diffuseColor.r,diffuseColor.b))*4.,0.,1.);
    vec3 c=diffuseColor.rgb*(.84+.3*big);
    c=mix(c,c*vec3(1.08,1.02,.82),green*smoothstep(.55,.8,mid)*.6);
    c*=.92+.16*fine;
    c=mix(c,c*vec3(.86,.9,.8),green*smoothstep(.6,.2,mid)*.35);
    diffuseColor.rgb=c;
  #ifdef SURF
    vec4 sm=texture2D(uSurf,(vWp.xz-uSB.xy)/uSB.zw);
    if(sm.r>.004){ float city=1.-smoothstep(230.,330.,length(vWp.xz-vec2(30.,40.)));
      vec3 dirt=diffuseColor.rgb*(.86+.22*fbm3(vWp.xz*1.4));
      dirt*=1.-.12*smoothstep(.75,.95,abs(sin(dot(vWp.xz,vec2(.7,.7))*.9)))*(1.-city);
      diffuseColor.rgb=mix(diffuseColor.rgb,mix(dirt,basalt(vWp.xz),city),smoothstep(0.,.55,sm.r)); }
    if(sm.g>.004) diffuseColor.rgb=mix(diffuseColor.rgb,slabs(vWp.xz),sm.g);
  #endif
  }`)};
 m.customProgramCacheKey=()=>"capground";m.needsUpdate=true;
 return true}

/* ---------- water ---------- */
function water(){
 let w=null;scene.traverse(o=>{if(!w&&o.isMesh&&o.material&&o.material.transparent&&o.material.color&&o.material.color.getHex()===0x22a6c0)w=o});
 if(!w)return false;
 /* terrain height texture over the water mesh bounds */
 const box=new THREE.Box3().setFromObject(w);const RES=384,data=new Uint8Array(RES*RES*4);
 const sx=box.max.x-box.min.x,sz=box.max.z-box.min.z;
 for(let j=0;j<RES;j++)for(let i=0;i<RES;i++){const x=box.min.x+(i+.5)/RES*sx,z=box.min.z+(j+.5)/RES*sz;
  const d=Math.max(0,Math.min(1,(-heightAt(x,z))/4));const k=(j*RES+i)*4;data[k]=d*255;data[k+1]=data[k+2]=0;data[k+3]=255}
 const ht=new THREE.DataTexture(data,RES,RES,THREE.RGBAFormat);ht.magFilter=ht.minFilter=THREE.LinearFilter;ht.needsUpdate=true;
 const m=new THREE.MeshPhongMaterial({color:0x2a8fa8,transparent:true,opacity:1,shininess:70,specular:0x7f97a0,depthWrite:false});
 m.onBeforeCompile=sh=>{sh.uniforms.uTime=U.time;sh.uniforms.uH={value:ht};
  sh.uniforms.uB={value:new THREE.Vector4(box.min.x,box.min.z,sx,sz)};
  sh.vertexShader="varying vec3 vWp;\n"+sh.vertexShader.replace("#include <worldpos_vertex>","#include <worldpos_vertex>\n vWp=(modelMatrix*vec4(transformed,1.)).xyz;");
  sh.fragmentShader="uniform float uTime;uniform sampler2D uH;uniform vec4 uB;varying vec3 vWp;\n"+NOISE+sh.fragmentShader
   .replace("#include <color_fragment>",`#include <color_fragment>
   float depth=texture2D(uH,(vWp.xz-uB.xy)/uB.zw).r*4.;
   vec2 q=vWp.xz*.18;float t=uTime;
   float wv=fbm3(q+vec2(t*.13,t*.07))+fbm3(q*1.7-vec2(t*.09,-t*.11));
   vec3 shallow=vec3(.36,.78,.74),deep=vec3(.06,.33,.45);
   diffuseColor.rgb=mix(shallow,deep,smoothstep(.0,2.6,depth))*(.9+.16*wv);
   float foam=smoothstep(.2,.02,depth+(wv-1.)*.07)*(.55+.45*sin(t*1.7+wv*6.));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.95,.97,.95),clamp(foam,0.,1.)*.75);
   diffuseColor.a=mix(.72,.93,smoothstep(.0,1.6,depth));`)
   .replace("#include <normal_fragment_begin>",`#include <normal_fragment_begin>
   { vec2 e=vec2(.6,0.);vec2 p=vWp.xz*.55;float tt=uTime*.6;
     float h0=fbm3(p+tt),hx=fbm3(p+e.xy+tt),hz=fbm3(p+e.yx+tt);
     vec3 pn=normalize(vec3((h0-hx)*.7,1.,(h0-hz)*.7));
     normal=normalize(normal+(viewMatrix*vec4(pn-vec3(0,1,0),0.)).xyz); }`)};
 m.customProgramCacheKey=()=>"capwater";
 w.material=m;w.renderOrder=2;return true}

/* ---------- light: warm late afternoon (approved style: travertine, terracotta, olive, bronze) ---------- */
const SUN=new THREE.Vector3(-.62,.5,.6).normalize();let sunL=null;
function light(){
 let hemi=null;scene.traverse(o=>{if(o.isHemisphereLight)hemi=o;if(o.isDirectionalLight&&o.castShadow)sunL=o});
 if(hemi){hemi.color.set(0xcfe2f2);hemi.groundColor.set(0x7a6242);hemi.intensity=.56}
 if(sunL){sunL.color.set(0xffd9a6);sunL.intensity=.98}
 const FOG=0xe6dcc8;if(scene.fog){scene.fog.color.set(FOG);scene.fog.near=150;scene.fog.far=760}
 if(scene.background&&scene.background.isColor)scene.background.set(FOG);
 const sky=scene.userData.sky;if(sky&&sky.material.uniforms){const u=sky.material.uniforms;u.top.value.set(0x3b78c4);u.mid.value.set(0xf0d9b0);if(u.bot.value!==scene.background)u.bot.value.set(FOG);u.sun.value.copy(SUN)}}
light();
const okG=ground(),okW=water();
console.log("[world] ground",okG,"water",okW);
const R=H.renderer,prev=R.render.bind(R);
R.render=function(sc,cam){U.time.value=performance.now()/1000;
 if(sunL&&sc===scene){sunL.position.copy(sunL.target.position).addScaledVector(SUN,110);sunL.updateMatrixWorld()}
 prev(sc,cam)};
})();
