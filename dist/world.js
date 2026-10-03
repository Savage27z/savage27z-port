import * as T from './vendor/three.module.min.js';
import { buildAvatar } from './avatar.js';

// An original, modelled rooftop diorama. Static repeated parts are instanced by
// material: this scene does not use a physics engine or real-time shadow maps.
export function buildWorld(makeLabel, previewTexture) {
  const root = new T.Group();
  root.name = 'SAVAGE / after-hours hideout';
  const palette = { floor: 0x50576b, edge: 0x30394e, metal: 0x263b49, cream: 0xc5b9a3, red: 0xb66459, wood: 0x855d53, dark: 0x111c2b, teal: 0x456d70, paper: 0xe4d6b2, pink: 0xca8392 };
  const materials = new Map(), batches = new Map(), pickables = [];
  const unit = new T.BoxGeometry(1, 1, 1);
  const edges = new T.LineBasicMaterial({ color: 0x192333, transparent: true, opacity: .75 });
  function material(color, basic = false) {
    const key = color + ':' + basic;
    if (!materials.has(key)) materials.set(key, basic ? new T.MeshBasicMaterial({ color }) : new T.MeshToonMaterial({ color }));
    return materials.get(key);
  }
  function box(w, h, d, x, y, z, color, { outline = false, rotation = 0, parent = root, pick = null, basic = false } = {}) {
    const mesh = new T.Mesh(unit, material(color, basic));
    mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.rotation.y = rotation;
    if (!outline && !pick && parent === root) {
      mesh.updateMatrix();
      const key = color + ':' + basic;
      if (!batches.has(key)) batches.set(key, { material: mesh.material, matrices: [] });
      batches.get(key).matrices.push(mesh.matrix.clone());
    } else {
      parent.add(mesh);
      if (outline) {
        const lines = new T.LineSegments(new T.EdgesGeometry(unit), edges);
        mesh.add(lines);
      }
    }
    if (pick) { mesh.userData.view = pick; pickables.push(mesh); }
    return mesh;
  }
  function mesh(geometry, color, x, y, z, parent = root, basic = false) {
    const item = new T.Mesh(geometry, material(color, basic)); item.position.set(x, y, z); parent.add(item); return item;
  }
  function cylinder(top, bottom, height, x, y, z, color, parent = root) {
    return mesh(new T.CylinderGeometry(top, bottom, height, 10), color, x, y, z, parent);
  }
  function rod(a, b, radius, color, parent = root) {
    const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
    const item = cylinder(radius, radius, delta.length(), 0, 0, 0, color, parent);
    item.position.copy(start.add(end).multiplyScalar(.5));
    item.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()); return item;
  }
  function label(lines, w, h, x, y, z, options = {}) {
    const texture = makeLabel(lines, options);
    const item = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: texture, transparent: false }));
    item.position.set(x, y, z); (options.parent || root).add(item); return item;
  }
  function shadow(x, z, sx, sz, opacity = .18) {
    const item = new T.Mesh(new T.CircleGeometry(1, 24), new T.MeshBasicMaterial({ color: 0x0c1725, transparent: true, opacity, depthWrite: false }));
    item.rotation.x = -Math.PI / 2; item.position.set(x, .015, z); item.scale.set(sx, sz, 1); root.add(item);
  }

  // Raised concrete island and the edge of a city roof.
  box(10, .55, 7.4, 0, -.3, 0, palette.edge, { outline: true });
  box(9.9, .12, 7.3, 0, -.02, 0, palette.floor);
  box(10.02, .13, .12, 0, -.37, 3.7, palette.red);
  const floorLines = [];
  for (let x = -4; x < 5; x += 1.25) floorLines.push(x, .048, -3.5, x, .048, 3.5);
  for (let z = -3; z < 3.6; z += 1.25) floorLines.push(-4.8, .048, z, 4.8, .048, z);
  const lineGeometry = new T.BufferGeometry(); lineGeometry.setAttribute('position', new T.Float32BufferAttribute(floorLines, 3));
  root.add(new T.LineSegments(lineGeometry, new T.LineBasicMaterial({ color: 0x313d51, transparent: true, opacity: .5 })));
  box(9.9, .36, .24, 0, .18, -3.55, palette.cream);
  for (const x of [-4.82, 4.82]) {
    box(.2, .34, 7.1, x, .17, 0, palette.cream);
    for (let z = -3.4; z <= 3.4; z += 1.35) box(.065, 1.05, .065, x, .85, z, palette.metal);
    box(.07, .07, 7.1, x, 1.37, 0, palette.metal);
    box(.05, .05, 7.1, x, .79, 0, palette.metal);
  }
  for (let x = -4.8; x <= 4.9; x += 1.35) box(.06, 1.04, .06, x, .87, -3.5, palette.metal);
  box(9.7, .07, .07, 0, 1.37, -3.5, palette.metal);
  box(9.7, .05, .05, 0, .79, -3.5, palette.metal);

  // Rooftop access room: sun-faded paint, an amber door and corrugated canopy.
  shadow(-3.2, -1.9, 2.1, 1.6);
  box(2.45, 3.35, 2.25, -3.22, 1.675, -2.15, 0xa2786e, { outline: true });
  box(2.48, .58, 2.28, -3.22, .29, -2.15, 0x6c6969);
  box(2.85, .18, 2.7, -3.22, 3.45, -2.12, palette.teal, { outline: true });
  for (let x = -4.55; x < -1.85; x += .24) box(.045, .06, 2.65, x, 3.56, -2.12, 0x385762);
  box(1.13, 2.55, .075, -3.13, 1.31, -.986, palette.dark);
  box(.94, 2.35, .07, -3.13, 1.29, -.934, 0x805d4d, { outline: true });
  box(.71, 1.28, .014, -3.13, 1.72, -.89, 0xe4ac78, { basic: true });
  box(.025, 1.3, .025, -3.13, 1.72, -.872, 0x896550);
  box(.73, .025, .025, -3.13, 1.63, -.872, 0x896550);
  box(.06, .23, .06, -2.78, 1.05, -.855, 0xccb393);
  box(1.65, .12, .54, -3.15, .08, -.78, 0x8a827e);
  label(['AFTER HOURS'], 1.35, .25, -3.13, 2.84, -.998, { background: '#293845', color: '#edd1a3', size: 45 });
  box(.6, .7, .06, -4.05, 1.63, -.98, 0xcbbda2);
  label(['愛', 'MAKE SOMETHING'], .47, .6, -4.05, 1.63, -.94, { background: '#cbbda2', color: '#914b4f', size: 55 });
  rod([-1.93, .1, -2.1], [-1.93, 3.8, -2.1], .07, palette.metal);

  // Custom low-profile workstation, deliberately not an arcade cabinet.
  shadow(.5, -.25, 2.6, 1.4, .27);
  box(4.35, .16, 1.6, .4, 1.05, -.36, palette.wood, { outline: true });
  for (const x of [-1.4, 2.2]) {
    box(.09, 1.0, .09, x, .5, -.93, palette.metal);
    box(.09, 1.0, .09, x, .5, .25, palette.metal);
    box(.09, .1, 1.3, x, .15, -.35, palette.metal);
  }
  box(3.6, .075, .075, .4, .3, -.92, palette.metal);
  box(.55, .11, .46, .4, 1.18, -.97, 0x627876);
  box(.13, .49, .14, .4, 1.39, -1.07, palette.metal);
  const screenCenter = new T.Vector3(.4, 2.28, -1.105);
  const screenWidth = 2.9, screenHeight = 1.83;
  box(3.22, 2.15, .24, .4, 2.28, -1.26, 0xd2c9ad, { outline: true, pick: 'projects' });
  box(3.02, 1.95, .025, .4, 2.28, -1.125, palette.dark);
  const screen = new T.Mesh(new T.PlaneGeometry(screenWidth, screenHeight), new T.MeshBasicMaterial({ color: 0xffffff, map: previewTexture }));
  screen.position.copy(screenCenter); screen.userData.view = 'projects'; pickables.push(screen); root.add(screen);
  label(['SAVAGE / WORKSTATION'], 1.26, .065, .34, 1.276, -1.128, { background: '#c2bba5', color: '#344b4c', size: 43 });
  box(.05, .025, .015, 1.72, 1.284, -1.12, 0xe8ac77, { basic: true });
  // Mechanical keyboard, mouse mat and one set of headphones.
  box(1.65, .095, .55, .25, 1.18, .12, 0x33434b, { outline: true });
  for (let row = 0; row < 4; row++) for (let col = 0; col < 12; col++) {
    const color = col === 0 || col === 11 ? 0xb5786d : 0xbabfac;
    box(.1, .025, .079, -.46 + col * .128, 1.24, -.055 + row * .108, color);
  }
  box(.45, .01, .56, 1.54, 1.143, .12, 0x233a46);
  const mouse = mesh(new T.SphereGeometry(.13, 10, 7), 0xc7bea5, 1.55, 1.22, .11); mouse.scale.set(.7, .5, 1.2);
  const mug = cylinder(.13, .115, .28, -1.15, 1.26, -.38, 0xd2b79b);
  cylinder(.105, .105, .01, -1.15, 1.405, -.38, 0x3b292a);
  const mugHandle = mesh(new T.TorusGeometry(.1, .024, 5, 10), 0xd2b79b, -1.29, 1.28, -.38); mugHandle.rotation.y = Math.PI / 2;
  const cable = new T.CatmullRomCurve3([new T.Vector3(.5, 1.05, -1.4), new T.Vector3(.8, .3, -1.5), new T.Vector3(1.7, .05, -1.6), new T.Vector3(3.8, .05, -2.5)]);
  mesh(new T.TubeGeometry(cable, 20, .023, 5, false), palette.dark, 0, 0, 0);

  // Journal and pen on a crate, with an oversized page tab as its affordance.
  shadow(-2.65, 1.5, 1.3, 1.0);
  box(1.45, .73, 1.18, -2.7, .365, 1.38, 0x7d6559, { outline: true });
  for (const y of [.15, .4, .65]) box(1.46, .04, .025, -2.7, y, 1.99, 0x433d3a);
  const journal = new T.Group(); journal.position.set(-2.7, .83, 1.34); journal.rotation.y = -.2; root.add(journal);
  box(1.14, .065, .85, 0, 0, 0, 0xb0655a, { parent: journal, outline: true, pick: 'about' });
  box(1.05, .045, .79, 0, .05, 0, palette.paper, { parent: journal, pick: 'about' });
  box(.025, .055, .79, 0, .079, 0, 0xab967e, { parent: journal });
  const journalText = label(['NOTES TO SELF', 'SAVAGE 愛'], .45, .66, .275, .08, 0, { parent: journal, background: '#e4d6b2', color: '#615448', size: 36 });
  journalText.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 5; i++) box(.37, .003, .01, -.26, .079, -.23 + i * .09, 0xb7a48b, { parent: journal });
  box(.08, .013, .27, -.29, .073, .46, 0xb65357, { parent: journal });
  const pen = rod([-2.0, .79, 1.1], [-1.91, .79, 1.65], .023, 0x152e3d);

  // A pocket radio: warm analogue details, an original contact object.
  shadow(3.25, .42, 1.1, .85);
  box(1.6, .55, 1.15, 3.25, .275, .22, 0x677074, { outline: true });
  box(1.36, .76, .48, 3.25, .97, .14, 0xba795e, { outline: true, pick: 'contact' });
  box(1.22, .62, .03, 3.25, .97, .397, 0x2a3941, { pick: 'contact' });
  const speaker = cylinder(.22, .22, .035, 2.96, .98, .433, 0x15252d); speaker.rotation.x = Math.PI / 2;
  for (let i = -2; i < 3; i++) box(.32, .017, .012, 2.96, .98 + i * .064, .462, 0x73807a);
  label(['SAVAGE FM'], .47, .16, 3.56, 1.1, .424, { background: '#d2b386', color: '#4b4737', size: 44 });
  for (const x of [3.44, 3.73]) { const knob = cylinder(.085, .085, .055, x, .82, .451, 0xbfb196); knob.rotation.x = Math.PI / 2; }
  rod([3.75, 1.33, .12], [4.05, 2.36, .12], .019, 0xbac4b7);
  box(.84, .06, .065, 3.25, 1.52, .14, palette.dark);
  for (const x of [2.84, 3.66]) box(.06, .24, .065, x, 1.4, .14, palette.dark);

  // Water tank, antenna, ventilation and a small rooftop sakura.
  shadow(2.9, -2.65, 1.4, .85);
  for (const x of [2.3, 3.4]) for (const z of [-3.0, -2.0]) box(.07, .64, .07, x, .32, z, palette.metal);
  cylinder(.71, .71, 1.48, 2.85, 1.4, -2.5, 0x607982);
  cylinder(.77, .77, .065, 2.85, .7, -2.5, palette.dark);
  cylinder(.77, .77, .065, 2.85, 2.11, -2.5, palette.dark);
  cylinder(.57, .78, .24, 2.85, 2.25, -2.5, 0x8b9290);
  rod([4.1, .1, -3.0], [4.1, 4.35, -3.0], .026, palette.metal);
  rod([3.5, 3.95, -3.0], [4.65, 3.95, -3.0], .02, palette.metal);
  for (const x of [3.6, 3.88, 4.15, 4.43, 4.6]) rod([x, 3.95, -3.3], [x, 3.95, -2.7], .013, palette.metal);
  box(.9, .48, .75, 1.0, .24, -2.63, 0x748382);
  for (let i = 0; i < 5; i++) box(.65, .028, .025, 1, .12 + i * .07, -2.24, palette.dark);
  cylinder(.5, .36, .55, 3.73, .3, 2.42, 0x976d62);
  cylinder(.46, .46, .03, 3.73, .58, 2.42, 0x3a3437);
  rod([3.73, .55, 2.42], [3.68, 2.05, 2.4], .075, 0x6a5149);
  rod([3.7, 1.2, 2.4], [3.09, 1.99, 2.28], .04, 0x6a5149);
  rod([3.68, 1.5, 2.4], [4.19, 2.1, 2.55], .04, 0x6a5149);
  const blossomGeometry = new T.IcosahedronGeometry(.6, 1);
  for (const [x,y,z,s,c] of [[3.66,2.33,2.4,1,0xe592ad],[3.13,2.14,2.24,.7,0xf2a9be],[4.17,2.18,2.55,.78,0xd9799c],[3.68,2.64,2.3,.64,0xf7bccb],[3.45,2.08,2.84,.7,0xea96b0]]) mesh(blossomGeometry,c,x,y,z).scale.set(s,s*.65,s);
  // Small sleeping cat. Its silhouette is geometry, not a copied anime character.
  const cat = new T.Group(); cat.position.set(1.58, .09, 2.57); cat.rotation.y = -.25; root.add(cat);
  const fur = 0xdcc6a2;
  const catBody = mesh(new T.SphereGeometry(.35, 12, 8), fur, 0, .23, 0, cat); catBody.scale.set(1.3,.7,.86);
  catBody.userData.view = 'cat'; pickables.push(catBody);
  const catHead = mesh(new T.SphereGeometry(.21, 12, 8), fur, -.28, .29, .15, cat);
  for (const x of [-.4,-.18]) { const ear = mesh(new T.ConeGeometry(.1,.22,4),fur,x+.28,.19,-.02,catHead); ear.rotation.z = x < -.3 ? .15 : -.15; }
  for (const x of [-.35,-.22]) box(.061,.015,.016,x+.28,.01,.197,0x4d4142,{parent:catHead});
  const tailCurve = new T.CatmullRomCurve3([new T.Vector3(.36,.2,-.1),new T.Vector3(.48,.17,.17),new T.Vector3(.24,.12,.36),new T.Vector3(-.01,.12,.32)]);
  const catTail = mesh(new T.TubeGeometry(tailCurve,10,.063,6,false),0xad8270,0,0,0,cat);
  const catLegs=[];
  for(const x of [-.22,.23]) for(const z of [-.16,.18]) {
    const leg=cylinder(.052,.047,.22,x,.11,z,fur,cat); leg.visible=false; catLegs.push(leg);
  }

  const avatar = buildAvatar();
  root.add(avatar.seating); pickables.push(...avatar.pickables);
  const { character, head, arm, torso, blink } = avatar;

  // Strung paper lanterns and a fabric banner, framing the little world.
  const lineCurve = new T.CatmullRomCurve3([new T.Vector3(-3.6,3.95,-1.4),new T.Vector3(.2,3.72,-2),new T.Vector3(4.4,4.55,-2.2)]);
  rod([4.4,0,-2.2],[4.4,4.6,-2.2],.045,palette.metal);
  mesh(new T.TubeGeometry(lineCurve,24,.018,4,false),palette.dark,0,0,0);
  const lanterns = [];
  for (const t of [.32,.57,.83]) {
    const point = lineCurve.getPoint(t), group = new T.Group(); group.position.copy(point); root.add(group);
    rod([0,0,0],[0,-.19,0],.014,palette.dark,group);
    const globe = mesh(new T.SphereGeometry(.24,12,8),0xf5bc8b,0,-.4,0,group,true); globe.scale.set(.85,1.2,.85);
    cylinder(.11,.11,.055,0,-.13,0,palette.dark,group); cylinder(.11,.11,.055,0,-.68,0,palette.dark,group);
    label(['愛'],.21,.26,0,-.4,.216,{parent:group,background:'#f5bc8b',color:'#a04f48',size:100}); lanterns.push(group);
  }
  box(1.65,.62,.028,-.65,3.62,-2.91,0x69424b);
  label(['SAVAGE 愛'],1.49,.41,-.65,3.62,-2.887,{background:'#69424b',color:'#e9c8ad',size:67});
  for (const x of [-1.38,.08]) rod([x,3.92,-2.91],[x,4.08,-2.91],.014,palette.dark);

  // Repeated architectural parts use one draw call per material.
  for (const batch of batches.values()) {
    const instances = new T.InstancedMesh(unit, batch.material, batch.matrices.length);
    batch.matrices.forEach((matrix, i) => instances.setMatrixAt(i, matrix));
    instances.instanceMatrix.needsUpdate = true; root.add(instances);
  }
  root.updateMatrixWorld(true);
  return { root, pickables, lanterns, cat, catBody, catHead, catTail, catLegs, character, characterHead:head, waveArm:arm,
    seating:avatar.seating, faceViewer:avatar.faceViewer, torso, blink,
    animatables:[cat,catBody,catHead,catTail,...catLegs,head,arm,torso], screen, screenCenter, screenWidth, screenHeight,
    glows: { door: new T.Vector3(-3.13,1.72,-.8), screen: screenCenter.clone() },
    anchors: { projects: new T.Vector3(.4,3.49,-1.1), about: new T.Vector3(-2.7,1.2,1.6), contact: new T.Vector3(3.3,1.76,.45) },
    targets: { projects: screenCenter.clone(), about: new T.Vector3(-2.65,.84,1.4), contact: new T.Vector3(3.25,1.06,.25) }
  };
}
