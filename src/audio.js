/** Procedural layered sound, bounded voice count, no autoplay or external media.
 * A compressor protects against rail, rain, brake and horn transients summing.
 */
import {clamp,rng} from './math.js';
export function audioMix(train,weather,cameraMode='chase',hour=12){
 const speed=Math.abs(train.speed),c=train.controls,cab=cameraMode==='cab',steam=train.stock.kind==='steam';
 const diesel=['diesel','regional'].includes(train.stock.kind),rain=['rain','storm'].includes(weather);
 return {pitch:steam?42+speed*2.6:diesel?32+c.throttle*32+speed*.6:45+speed*5.4,
  motor:c.master?(diesel?.035+c.throttle*.085:steam?.026:.008+c.throttle*.045):0,
  rail:clamp(speed*.006,0,.32)*(cab?.62:1),wind:clamp(speed*speed*.000017,0,.14)*(cab?.4:1),
  squeal:clamp((train.risk||0)*.027,0,.08)*clamp(speed/5,0,1),brake:clamp(c.brake*speed*.003,0,.075),
  rain:rain?(cab?.022:.065):0,ambient:hour>6&&hour<20?(rain?.003:.013):.006,cab,steam,diesel};
}
export class RailAudio {
 constructor(){this.enabled=false;this.context=null;this.volume=.36;this.horning=false;this.ambience=true;this.lastJoint=0;this.lastChirp=-100;this.nodes=[];}
 async enable(){
  if(!this.context){
   const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return;
   const c=this.context=new C(),own=n=>{this.nodes.push(n);return n;};
   this.master=own(c.createGain());this.master.gain.value=0;this.compressor=own(c.createDynamicsCompressor());
   this.compressor.threshold.value=-12;this.compressor.knee.value=18;this.compressor.ratio.value=5;this.master.connect(this.compressor).connect(c.destination);
   const oscillator=(type,f)=>{const o=own(c.createOscillator()),g=own(c.createGain());g.gain.value=0;o.type=type;o.frequency.value=f;o.connect(g).connect(this.master);o.start();return {o,g};};
   const n=c.createBuffer(1,c.sampleRate*3,c.sampleRate),a=n.getChannelData(0),random=rng(47391);let low=0;
   for(let i=0;i<a.length;i++){low=(low+(random()*2-1)*.12)*.985;a[i]=low;}
   this.noise=own(c.createBufferSource());this.noise.buffer=n;this.noise.loop=true;this.noise.start();
   const noise=(type,f,q=.6)=>{const filter=own(c.createBiquadFilter()),gain=own(c.createGain());filter.type=type;filter.frequency.value=f;filter.Q.value=q;gain.gain.value=0;this.noise.connect(filter).connect(gain).connect(this.master);return {filter,gain};};
   this.engine=oscillator('sawtooth',40);this.harmonic=oscillator('triangle',80);
   this.rail=noise('bandpass',600);this.wind=noise('lowpass',420);this.rain=noise('highpass',1500);
   this.brake=noise('bandpass',1800,2.5);this.joint=noise('lowpass',170);
   this.squeal=oscillator('sine',1900);this.chirp=oscillator('sine',2300);
   this.horns=[185,233,277].map(f=>oscillator('triangle',f));
  }
  await this.context.resume();this.enabled=true;this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,.1);
 }
 toggle(){if(this.enabled){this.enabled=false;this.master?.gain.setTargetAtTime(0,this.context.currentTime,.05);}else return this.enable();}
 horn(on){this.horning=on;if(this.context)for(const h of this.horns)h.g.gain.setTargetAtTime(on?.11:0,this.context.currentTime,.035);}
 update(train,weather,paused,cameraMode='chase',hour=12){
  if(!this.context)return;
  const c=this.context,t=c.currentTime,m=audioMix(train,weather,cameraMode,hour),smooth=(p,v,tau=.10)=>p.setTargetAtTime(v,t,tau);
  smooth(this.master.gain,this.enabled&&!paused?this.volume:0,.08);
  smooth(this.engine.o.frequency,m.pitch);smooth(this.harmonic.o.frequency,m.pitch*2.01);
  smooth(this.engine.g.gain,m.motor*(m.cab?.70:1));smooth(this.harmonic.g.gain,m.motor*.23);
  smooth(this.rail.gain.gain,m.rail);smooth(this.rail.filter.frequency,400+Math.abs(train.speed)*18);
  smooth(this.wind.gain.gain,m.wind);smooth(this.rain.gain.gain,this.ambience?m.rain:0);
  smooth(this.brake.gain.gain,m.brake);smooth(this.squeal.g.gain,m.squeal);
  smooth(this.squeal.o.frequency,1750+Math.sin(train.cursor.odometer*.08)*130);
  if(paused||!this.enabled)return;
  const joint=Math.floor(Math.abs(train.cursor.odometer)/(m.steam?2.0:18));
  if(joint!==this.lastJoint){this.lastJoint=joint;const p=this.joint.gain.gain;p.cancelScheduledValues(t);p.setValueAtTime(Math.min(.21,.03+Math.abs(train.speed)*.003),t);p.exponentialRampToValueAtTime(.0001,t+.10);}
  if(this.ambience&&t-this.lastChirp>4.7&&m.ambient>.008){
   this.lastChirp=t;const p=this.chirp.g.gain,f=this.chirp.o.frequency;p.cancelScheduledValues(t);f.cancelScheduledValues(t);
   p.setValueAtTime(.0001,t);p.exponentialRampToValueAtTime(m.ambient,t+.05);p.exponentialRampToValueAtTime(.0001,t+.5);
   f.setValueAtTime(2100,t);f.exponentialRampToValueAtTime(3300,t+.15);f.exponentialRampToValueAtTime(2400,t+.44);
  }
 }
 stop(){this.horn(false);if(this.context)this.master.gain.setTargetAtTime(0,this.context.currentTime,.01);}
 async dispose(){this.stop();for(const n of this.nodes){try{n.stop?.();n.disconnect();}catch{}}this.nodes=[];await this.context?.close();this.context=null;this.enabled=false;}
}
