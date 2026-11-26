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
 m.onBeforeCompile=sh=>{
  sh.vertexShader="varying vec3 vWp;\n"+sh.vertexShader.replace("#include <worldpos_vertex>","#include <worldpos_vertex>\n vWp=(modelMatrix*vec4(transformed,1.)).xyz;");
  sh.fragmentShader="varying vec3 vWp;\n"+NOISE+sh.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
  { float big=fbm3(vWp.xz*.045), mid=fbm3(vWp.xz*.33), fine=vn(vWp.xz*2.7);
    float lum=dot(diffuseColor.rgb,vec3(.3,.59,.11));
    float green=clamp((diffuseColor.g-max(diffuseColor.r,diffuseColor.b))*4.,0.,1.);
    vec3 c=diffuseColor.rgb*(.84+.3*big);
    c=mix(c,c*vec3(1.08,1.02,.82),green*smoothstep(.55,.8,mid)*.6);
    c*=.92+.16*fine;
    c=mix(c,c*vec3(.86,.9,.8),green*smoothstep(.6,.2,mid)*.35);
    diffuseColor.rgb=c; }`)};
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
