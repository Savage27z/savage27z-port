import * as T from './vendor/three.module.min.js';

// A continuous street block beneath the hideout, with simple, instanced detail.
export function buildNeighborhood() {
  const root = new T.Group(), batches = new Map();
  const dummy = new T.Object3D();
  function box(x,y,z,w,h,d,color,lit=false) {
    const key = color + ':' + lit;
    if (!batches.has(key)) batches.set(key,{color,lit,items:[]});
    dummy.position.set(x,y,z); dummy.scale.set(w,h,d); dummy.rotation.set(0,0,0); dummy.updateMatrix();
    batches.get(key).items.push(dummy.matrix.clone());
  }
  function building(x,z,w,d,roof,color,main=false) {
    const ground = -10.4, height = roof - ground;
    box(x,ground+height/2,z,w,height,d,color);
    box(x,roof-.12,z,w+.18,.24,d+.18,0x4a5363);
    if (!main) {
      box(x,roof+.11,z-d/2,w,.32,.16,0x69717b);
      box(x-w/2,roof+.11,z,.16,.32,d,0x69717b);
      box(x+w/2,roof+.11,z,.16,.32,d,0x69717b);
      box(x+.4,roof+.36,z-.4,1.4,.7,.95,0x4b666c);
      for (let i=0;i<4;i++) box(x+.4,roof+.2+i*.1,z+.084,1.05,.035,.025,0x28394a);
    }
    for (let floor=0;floor<Math.floor(height/1.6);floor++) {
      const y=ground+1.15+floor*1.6;
      box(x,y-.64,z+d/2+.06,w,.07,.15,0x4e5c6a);
      for (let col=0;col<Math.floor(w/1.5);col++) {
        const wx=x-w/2+.85+col*1.5;
        box(wx,y,z+d/2+.035,.81,1.03,.07,0x172737);
        if ((floor+col+Math.round(x))%3!==0) box(wx,y,z+d/2+.077,.65,.87,.02,(floor+col)%2?0xc79b6a:0x879989,true);
        box(wx,y,z+d/2+.095,.04,.98,.025,0x485462);
        box(wx,y-.55,z+d/2+.13,.97,.075,.26,0x647080);
      }
      for (let col=0;col<Math.floor(d/1.5);col++) {
        const wz=z-d/2+.85+col*1.5;
        box(x+w/2+.035,y,wz,.07,1.03,.8,0x172737);
        if ((floor+col)%3!==0) box(x+w/2+.077,y,wz,.02,.87,.65,0xbaa17d,true);
        box(x+w/2+.095,y,wz,.025,.98,.04,0x485462);
      }
    }
    box(x-w/2+.18,ground+height/2,z+d/2+.11,.075,height,.075,0x35434e);
    box(x+w/2-.2,ground+height/2,z+d/2+.1,.075,height,.075,0x35434e);
  }
  building(0,0,9.82,7.22,-.55,0x465263,true);
  building(-11,-1,6.3,7.8,-1.7,0x394a60);
  building(10.8,-3.8,6.8,7.5,1.1,0x4a5266);
  building(-5.4,-11.8,6.6,6.2,2.8,0x455364);
  building(3.4,-12.4,6.6,5.8,.3,0x35485a);
  building(12,-15.5,7.4,7.2,4.4,0x39495d);
  building(-15,-14,7.1,7.2,3.4,0x34485c);
  // Two intersecting streets, pavements and fixed pools of lamplight.
  box(0,-10.6,-4,39,.18,37,0x172433);
  box(0,-10.49,6.1,34,.025,3.1,0x202d3b);
  box(6.35,-10.48,-3,3.1,.025,30,0x202d3b);
  for(let i=-15;i<18;i+=3) box(i,-10.46,6.1,1.1,.02,.07,0x74776d);
  for(let i=-15;i<14;i+=3) box(6.35,-10.45,i,.07,.02,1.1,0x74776d);
  for(const x of [-7.4,5,14]) {
    box(x,-8.85,4.95,.075,3.2,.075,0x344758);
    box(x,-7.25,5.15,.13,.09,.45,0xe3bc82,true);
    box(x,-10.455,5.12,1.6,.01,1.4,0x4b4840);
  }
  for(const batch of batches.values()) {
    const material = batch.lit ? new T.MeshBasicMaterial({color:batch.color}) : new T.MeshToonMaterial({color:batch.color});
    const mesh = new T.InstancedMesh(new T.BoxGeometry(1,1,1),material,batch.items.length);
    batch.items.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix)); mesh.instanceMatrix.needsUpdate=true; root.add(mesh);
  }
  return root;
}
