/** Column-major right-handed math; world +Y is up; train local +Z is forward. */
export const TAU = Math.PI * 2;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
export const mod = (a,n) => ((a%n)+n)%n;
export const v3 = (x=0,y=0,z=0) => [x,y,z];
export const add = (a,b) => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub = (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const mul = (a,n) => [a[0]*n,a[1]*n,a[2]*n];
export const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const length = a => Math.hypot(...a);
export const norm = a => {const l=length(a)||1;return mul(a,1/l);};
export const mix3 = (a,b,t) => [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
export function rng(seed=1) { let a=seed>>>0; return () => {a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}; }
export function hash2(x,z,seed=0){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(seed|0,1274126177);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
export function noise2(x,z,seed=0){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);return lerp(lerp(hash2(ix,iz,seed),hash2(ix+1,iz,seed),u),lerp(hash2(ix,iz+1,seed),hash2(ix+1,iz+1,seed),u),v);}
export function fbm(x,z,seed=0,octaves=5){let v=0,a=.5;for(let i=0;i<octaves;i++){v+=noise2(x,z,seed+i*31)*a;x=x*2.03+15.7;z=z*2.03-6.3;a*=.5;}return v;}
export function mat4Identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
export function mat4Mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
export function perspective(fov,aspect,near,far,webgpu=true){const f=1/Math.tan(fov/2),m=new Float32Array(16);m[0]=f/aspect;m[5]=f;m[11]=-1;if(webgpu){m[10]=far/(near-far);m[14]=far*near/(near-far);}else{m[10]=(far+near)/(near-far);m[14]=2*far*near/(near-far);}return m;}
export function orthographic(l,r,b,t,n,f,webgpu=true){const m=mat4Identity();m[0]=2/(r-l);m[5]=2/(t-b);m[12]=-(r+l)/(r-l);m[13]=-(t+b)/(t-b);m[10]=(webgpu?1:2)/(n-f);m[14]=webgpu?n/(n-f):(f+n)/(n-f);return m;}
export function lookAt(eye,target,up=[0,1,0]){const z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
export function mat4Inverse(a){const out=new Float32Array(16);const aug=Array.from({length:4},(_,r)=>[a[r],a[4+r],a[8+r],a[12+r],...Array.from({length:4},(_,c)=>+(c===r))]);for(let i=0;i<4;i++){let p=i;for(let r=i+1;r<4;r++)if(Math.abs(aug[r][i])>Math.abs(aug[p][i]))p=r;if(Math.abs(aug[p][i])<1e-12)return mat4Identity();[aug[i],aug[p]]=[aug[p],aug[i]];const d=aug[i][i];for(let c=0;c<8;c++)aug[i][c]/=d;for(let r=0;r<4;r++)if(r!==i){const s=aug[r][i];for(let c=0;c<8;c++)aug[r][c]-=aug[i][c]*s;}}for(let r=0;r<4;r++)for(let c=0;c<4;c++)out[c*4+r]=aug[r][c+4];return out;}
export function transform(p,scale=[1,1,1],yaw=0,pitch=0,roll=0){const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);const m=mat4Identity();m[0]=(cy*cr+sy*sp*sr)*scale[0];m[1]=cp*sr*scale[0];m[2]=(-sy*cr+cy*sp*sr)*scale[0];m[4]=(-cy*sr+sy*sp*cr)*scale[1];m[5]=cp*cr*scale[1];m[6]=(sy*sr+cy*sp*cr)*scale[1];m[8]=sy*cp*scale[2];m[9]=-sp*scale[2];m[10]=cy*cp*scale[2];m[12]=p[0];m[13]=p[1];m[14]=p[2];return m;}
export function frameMatrix(p,tangent,scale=[1,1,1]){const f=norm(tangent),right=norm(cross([0,1,0],f)),up=cross(f,right);return new Float32Array([right[0]*scale[0],right[1]*scale[0],right[2]*scale[0],0,up[0]*scale[1],up[1]*scale[1],up[2]*scale[1],0,f[0]*scale[2],f[1]*scale[2],f[2]*scale[2],0,...p,1]);}
export function pointTransform(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
export function hex(s){const n=parseInt(s.replace('#',''),16);return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255,1];}
export function catmull(p0,p1,p2,p3,t){const t2=t*t,t3=t2*t;return [0,1,2].map(i=>.5*((2*p1[i])+(-p0[i]+p2[i])*t+(2*p0[i]-5*p1[i]+4*p2[i]-p3[i])*t2+(-p0[i]+3*p1[i]-3*p2[i]+p3[i])*t3));}
export function downloadFile(name,data,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
