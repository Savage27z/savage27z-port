import * as T from './vendor/three.module.min.js';

// Finite, input-triggered resident animations. No autonomous movement loop.
export function createResidents(world) {
  const restingSpots=[new T.Vector3(1.58,.09,2.57),new T.Vector3(2.35,.09,1.56)];
  let spot=0, catAction=null, waveAction=null;
  function restCat() {
    world.cat.position.copy(restingSpots[spot]);world.cat.rotation.y=-.25;
    world.catBody.position.y=.23;world.catBody.scale.set(1.3,.7,.86);
    world.catHead.position.y=.29;world.catTail.rotation.y=0;
    world.catLegs.forEach(leg=>{leg.visible=false;leg.rotation.x=0;});
  }
  function sampleCat(now) {
    if(!catAction)return;
    const elapsed=Math.max(0,now-catAction.start);
    if(elapsed>=5300){spot=catAction.destination;catAction=null;restCat();return;}
    const rise=Math.min(1,elapsed/700), curl=Math.max(0,(elapsed-4500)/800), upright=rise*(1-curl);
    world.catBody.position.y=.23+upright*.1;
    const stretch=elapsed<1400?Math.sin(Math.max(0,elapsed-500)/900*Math.PI)*.16:0;
    world.catBody.scale.set(1.3+stretch,.7+upright*.14,.86);
    world.catHead.position.y=.29+upright*.11;
    const travel=T.MathUtils.clamp((elapsed-1400)/2900,0,1), eased=travel*travel*(3-2*travel);
    world.cat.position.lerpVectors(catAction.from,restingSpots[catAction.destination],eased);
    const direction=restingSpots[catAction.destination].clone().sub(catAction.from);
    if(travel>0&&travel<1) {
      world.cat.rotation.y=Math.atan2(direction.z,-direction.x);
      world.cat.position.y+=Math.abs(Math.sin(elapsed*.013))*.022;
    }
    world.catTail.rotation.y=Math.sin(elapsed*.007)*.12*upright;
    world.catLegs.forEach((leg,i)=>{leg.visible=upright>.3;leg.rotation.x=travel>0&&travel<1?Math.sin(elapsed*.014+(i%2)*Math.PI)*.4:0;});
  }
  function sampleWave(now) {
    if(!waveAction)return;
    const t=(now-waveAction.start)/1500;
    if(t>=1){const resolve=waveAction.resolve;waveAction=null;world.waveArm.rotation.z=0;world.waveArm.rotation.x=0;resolve(true);return;}
    const envelope=Math.min(1,Math.max(0,t/.2))*Math.min(1,Math.max(0,(1-t)/.2));
    world.waveArm.rotation.z=envelope*(2.4+Math.sin(t*Math.PI*8)*.15);
    world.waveArm.rotation.x=-envelope*.22;
  }
  return {
    get active(){return Boolean(catAction||waveAction);},
    playCat(now,animate=true){
      if(catAction)return false;
      if(!animate){spot=1-spot;restCat();return true;}
      catAction={start:now,from:world.cat.position.clone(),destination:1-spot};return true;
    },
    wave(now,animate=true){
      if(waveAction)return waveAction.promise;
      if(!animate)return Promise.resolve(true);
      let resolve;const promise=new Promise(done=>{resolve=done;});waveAction={start:now,resolve,promise};return promise;
    },
    tick(now){sampleCat(now);sampleWave(now);},
    finish(){if(catAction)sampleCat(catAction.start+5300);if(waveAction)sampleWave(waveAction.start+1500);}
  };
}
