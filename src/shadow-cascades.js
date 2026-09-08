/** Nested directional shadow projections, stabilized to texels in light space.
 * No cascade owns geometry; only its depth layer and uniform-buffer snapshot.
 */
import {mat4Mul,lookAt,orthographic,add,mul,norm} from './math.js';
export const SHADOW_EXTENTS=Object.freeze([72,280,1100]);
export function stabilizedShadow(target,direction,extent,size,gpu=true){
 if(!target.every(Number.isFinite)||!direction.every(Number.isFinite)||!(extent>0)||!(size>0))throw new RangeError('Invalid shadow projection');
 const light=norm(direction),matrix=mat4Mul(orthographic(-extent,extent,-extent,extent,1,5000,gpu),lookAt(add(target,mul(light,2300)),target));
 matrix[12]=Math.round(matrix[12]*size*.5)/(size*.5);matrix[13]=Math.round(matrix[13]*size*.5)/(size*.5);return matrix;
}
export function shadowCascadeCount(quality){return quality==='low'?1:3;}
