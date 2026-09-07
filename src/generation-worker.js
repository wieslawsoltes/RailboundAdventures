/** Transfer the shared numerical terrain field, never renderer-owned resources. */
import {TerrainField} from './generation.js';
self.onmessage = ({data}) => {
 try {
  const field = new TerrainField(data.def, data.seed, data.options).prepare();
  self.postMessage({heights:field.heights,flow:field.flow,stats:field.stats},[field.heights.buffer,field.flow.buffer]);
 } catch (error) {self.postMessage({error:String(error.message||error)});}
};
