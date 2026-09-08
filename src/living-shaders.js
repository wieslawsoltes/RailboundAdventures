/** Matched WebGPU/WebGL botanical silhouettes and world-space architectural materials. */
export const LEAF_WGSL=/* wgsl */`
fn leafMask(uv:vec2f,needle:f32)->f32 {
 let p=uv-vec2f(.5);var mask=-1.;
 if(needle>.5){
  let width=(.5-abs(p.y))*.85;
  let tooth=abs(fract((p.y+abs(p.x)*.65)*17.)-.5);
  mask=min(width-abs(p.x),.16-tooth)*8.;mask=max(mask,(.018-abs(p.x))*15.);
 }else{
  for(var i=0;i<7;i++){
   let row=f32(i/2);let side=select(-1.,1.,i%2==0);let center=select(vec2f(side*.20,-.30+row*.19),vec2f(0,.34),i==6);
   let q=(p-center)/select(vec2f(.18,.145),vec2f(.13,.18),i==6);mask=max(mask,1.-dot(q,q));
  }
  mask=max(mask,(.009-abs(p.x))*20.);
 }
 return smoothstep(-.08,.13,mask);
}
fn canopyWind(p:vec3f,root:vec3f,local:vec3f,height:f32,uv:vec2f)->vec3f{
 let gust=sin(u.cameraTime.w*.85+root.x*.021+root.z*.017);
 let bend=local.y*local.y*height*.012*u.viewport.w;
 let flutter=sin(u.cameraTime.w*3.2+p.x*1.3+p.z*.9)*.035*uv.y*u.viewport.w;
 return p+vec3f(gust*bend+flutter,flutter*.24,cos(u.cameraTime.w*.71+root.z*.019)*bend*.52);
}
`;
export const LEAF_GLSL=/* glsl */`
float leafMask(vec2 uv,float needle){
 vec2 p=uv-vec2(.5);float mask=-1.;
 if(needle>.5){float width=(.5-abs(p.y))*.85;float tooth=abs(fract((p.y+abs(p.x)*.65)*17.)-.5);mask=min(width-abs(p.x),.16-tooth)*8.;mask=max(mask,(.018-abs(p.x))*15.);}
 else{for(int i=0;i<7;i++){float row=float(i/2),side=i%2==0?1.:-1.;vec2 center=i==6?vec2(0,.34):vec2(side*.20,-.30+row*.19);vec2 q=(p-center)/(i==6?vec2(.13,.18):vec2(.18,.145));mask=max(mask,1.-dot(q,q));}mask=max(mask,(.009-abs(p.x))*20.);}
 return smoothstep(-.08,.13,mask);
}
vec3 canopyWind(vec3 p,vec3 root,vec3 local,float height,vec2 uv){float gust=sin(u.cameraTime.w*.85+root.x*.021+root.z*.017),bend=local.y*local.y*height*.012*u.viewport.w,flutter=sin(u.cameraTime.w*3.2+p.x*1.3+p.z*.9)*.035*uv.y*u.viewport.w;return p+vec3(gust*bend+flutter,flutter*.24,cos(u.cameraTime.w*.71+root.z*.019)*bend*.52);}
`;
export const MATERIAL_WGSL=/* wgsl */`
 var coverage=1.;var glassAmount=0.;
 if(kind>10.5&&kind<11.5){coverage=leafMask(v.uv,v.props.z);if(coverage<.25){discard;}
  metal=0.;emissive=0.;rough=.89;let veins=.82+.18*abs(sin(v.uv.y*73.+v.uv.x*24.));
  col*=veins*(.80+.20*v.uv.y);n=normalize(n+vec3f(0,.15,0));
 }
 if(kind>11.5&&kind<12.5){
  emissive=0.;metal=0.;let grid=v.uv/vec2f(3.,3.2);let cell=fract(grid);let room=floor(grid);
  let modern=v.props.z>.5;let margin=select(.19,.065,modern);
  let win=step(margin,cell.x)*step(cell.x,1.-margin)*step(.21,cell.y)*step(cell.y,.84)*step(abs(n.y),.5);
  let pane=step(.017,abs(cell.x-.5))*step(.013,abs(cell.y-.53));
  let blinds=.62+.38*step(.07,fract(cell.y*14.));let seed=hash(room+vec2f(floor(v.props.w*4096.+.5)));
  let det=uvDx.x*uvDy.y-uvDx.y*uvDy.x;
  let tangent=normalize((worldDx*uvDy.y-worldDy*uvDx.y)*sign(det+.0000001)+vec3f(.0000001,0,0));
  let interior=roomRay((cell-vec2f(margin,.21))/vec2f(1.-2.*margin,.63),view,n,tangent,seed);
  let brick=fract(vec2f(v.uv.x*2.+floor(v.uv.y*5.)*.5,v.uv.y*5.));let mortar=1.-step(.055,min(brick.x,brick.y));
  let wall=col*(.90+noise(v.world.xz*3.+vec2f(v.world.y))*.12)*(1.-mortar*.16);
  col=mix(wall,interior*blinds,win);col=mix(col,vec3f(.035,.05,.052),win*(1.-pane));
  let cornice=1.-smoothstep(.025,.065,abs(cell.y-.985));col*=1.-cornice*.28;
  glassAmount=win*pane;rough=mix(.88,.18,glassAmount);metal=glassAmount*.18;
  emissive=win*pane*step(.52,seed)*(1.-u.sunDay.w)*3.4;
 }
 if(kind>12.5&&kind<13.5){
  let grit=noise(v.world.xz*18.);let wear=noise(v.world.xz*.24);col*=.72+grit*.35+wear*.12;
  let wet=u.env.y*(.4+.6*smoothstep(.35,.72,wear));rough=mix(.95,.2,wet);metal=.02;
 }
 if(kind>13.5&&kind<14.5){let tile=fract(v.uv*vec2f(2.,3.));let seam=1.-step(.07,min(tile.x,tile.y));col*=.92-seam*.22+noise(v.world.xz*2.)*.10;}
 if(kind>14.5&&kind<15.5){let ridge=noise(vec2f(v.uv.x*47.,v.uv.y*.04));col*=.6+ridge*.65;rough=.98;}
`;
export const MATERIAL_GLSL=/* glsl */`
 float coverage=1.,glassAmount=0.;
 if(kind>10.5&&kind<11.5){coverage=leafMask(uv,props.z);if(coverage<.25)discard;metal=0.;emissive=0.;rough=.89;float veins=.82+.18*abs(sin(uv.y*73.+uv.x*24.));col*=veins*(.80+.20*uv.y);n=normalize(n+vec3(0,.15,0));}
 if(kind>11.5&&kind<12.5){
  emissive=0.;metal=0.;vec2 grid=uv/vec2(3.,3.2),cell=fract(grid),room=floor(grid);bool modern=props.z>.5;float margin=modern?.065:.19;
  float win=step(margin,cell.x)*step(cell.x,1.-margin)*step(.21,cell.y)*step(cell.y,.84)*step(abs(n.y),.5);
  float pane=step(.017,abs(cell.x-.5))*step(.013,abs(cell.y-.53));float blinds=.62+.38*step(.07,fract(cell.y*14.)),seed=hash(room+vec2(floor(props.w*4096.+.5)));
  float det=uvDx.x*uvDy.y-uvDx.y*uvDy.x;vec3 tangent=normalize((worldDx*uvDy.y-worldDy*uvDx.y)*sign(det+.0000001)+vec3(.0000001,0,0));
  vec3 interior=roomRay((cell-vec2(margin,.21))/vec2(1.-2.*margin,.63),view,n,tangent,seed);vec2 brick=fract(vec2(uv.x*2.+floor(uv.y*5.)*.5,uv.y*5.));float mortar=1.-step(.055,min(brick.x,brick.y));
  vec3 wall=col*(.90+noise(world.xz*3.+world.y)*.12)*(1.-mortar*.16);col=mix(wall,interior*blinds,win);col=mix(col,vec3(.035,.05,.052),win*(1.-pane));
  float cornice=1.-smoothstep(.025,.065,abs(cell.y-.985));col*=1.-cornice*.28;glassAmount=win*pane;rough=mix(.88,.18,glassAmount);metal=glassAmount*.18;emissive=win*pane*step(.52,seed)*(1.-u.sunDay.w)*3.4;
 }
 if(kind>12.5&&kind<13.5){float grit=noise(world.xz*18.),wear=noise(world.xz*.24);col*=.72+grit*.35+wear*.12;float wet=u.env.y*(.4+.6*smoothstep(.35,.72,wear));rough=mix(.95,.2,wet);metal=.02;}
 if(kind>13.5&&kind<14.5){vec2 tile=fract(uv*vec2(2.,3.));float seam=1.-step(.07,min(tile.x,tile.y));col*=.92-seam*.22+noise(world.xz*2.)*.10;}
 if(kind>14.5&&kind<15.5){float ridge=noise(vec2(uv.x*47.,uv.y*.04));col*=.6+ridge*.65;rough=.98;}
`;
