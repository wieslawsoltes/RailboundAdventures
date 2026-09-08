/** Spatial reservations shared by vegetation and natural props.
 * Station construction is independent of settlement districts. Reserve the actual
 * track-aligned platform bays and rotated station kit, not an unrelated city box.
 */
const stationCache=new WeakMap();
function rectangle(p,across,halfWidth,halfLength){
 const length=Math.hypot(p.f[0],p.f[2]);
 if(!Number.isFinite(length)||length<1e-8||!p.p.every(Number.isFinite))return null;
 const fx=p.f[0]/length,fz=p.f[2]/length,rx=fz,rz=-fx;
 return {x:p.p[0]+rx*across,z:p.p[2]+rz*across,fx,fz,rx,rz,halfWidth,halfLength};
}
export function stationReservations(world){
 if(!world||!world.network||!Array.isArray(world.stations))return [];
 const cached=stationCache.get(world);
 if(cached?.stations===world.stations&&cached.network===world.network)return cached.groups;
 const groups=[];
 for(const station of world.stations){
  const edge=world.network.edges.get(station.edge);
  if(!edge||!Number.isFinite(station.s)||!Number.isFinite(station.platform)||station.platform<=0)continue;
  const bays=[],platform=Math.min(station.platform,2000);
  // The platform geometry is emitted in seven-metre, track-aligned bays.
  for(let ds=-platform;ds<14;ds+=7){const r=rectangle(edge.at(station.s+ds),4.7,3.7,4.5);if(r)bays.push(r);}
  const building=rectangle(edge.at(station.s-92),17,7.3,19.2);if(building)bays.push(building);
  if(!bays.length)continue;
  const group={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity,bays};
  for(const r of bays){const ex=Math.abs(r.rx)*r.halfWidth+Math.abs(r.fx)*r.halfLength,ez=Math.abs(r.rz)*r.halfWidth+Math.abs(r.fz)*r.halfLength;
   group.minX=Math.min(group.minX,r.x-ex);group.maxX=Math.max(group.maxX,r.x+ex);group.minZ=Math.min(group.minZ,r.z-ez);group.maxZ=Math.max(group.maxZ,r.z+ez);Object.freeze(r);}
  Object.freeze(bays);groups.push(Object.freeze(group));
 }
 Object.freeze(groups);stationCache.set(world,{network:world.network,stations:world.stations,groups});return groups;
}
export function stationLandUse(world,x,z,padding=0){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(padding)||padding<0)return false;
 for(const group of stationReservations(world)){
  if(x<group.minX-padding||x>group.maxX+padding||z<group.minZ-padding||z>group.maxZ+padding)continue;
  for(const r of group.bays){const dx=x-r.x,dz=z-r.z;
   if(Math.abs(dx*r.rx+dz*r.rz)<=r.halfWidth+padding&&Math.abs(dx*r.fx+dz*r.fz)<=r.halfLength+padding)return true;}
 }
 return false;
}
