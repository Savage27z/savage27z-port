import * as T from './vendor/three.module.min.js';

// A small cel-shaded resident, with the supplied PFP's graphic facial features.
// All parts are local geometry. Braided strands share one instanced mesh.
export function buildAvatar() {
  const seating = new T.Group();
  seating.name = 'Resident / beside the workstation';
  seating.position.set(-2.45, 0, 2.5);
  seating.rotation.y = .69;
  const character = new T.Group(); character.position.y = .72; seating.add(character);
  const colors = { shirt: 0x20212b, pants: 0x373a48, skin: 0xe5d2a5, hair: 0x11131b, braid: 0x33323b, sole: 0xd7cbb5 };
  const materials = new Map(), pickables = [];
  const unitBox = new T.BoxGeometry(1, 1, 1);
  const unitLimb = new T.CylinderGeometry(1, 1, 1, 8);
  const unitSphere = new T.SphereGeometry(1, 10, 7);
  function material(color, graphic = false) {
    const key = color + ':' + graphic;
    if (!materials.has(key)) materials.set(key, graphic ? new T.MeshBasicMaterial({ color }) : new T.MeshToonMaterial({ color }));
    return materials.get(key);
  }
  function part(geometry, color, x, y, z, parent = character, graphic = false) {
    const item = new T.Mesh(geometry, material(color, graphic));
    item.position.set(x, y, z); parent.add(item); return item;
  }
  function box(w, h, d, x, y, z, color, parent = character) {
    const item = part(unitBox, color, x, y, z, parent); item.scale.set(w, h, d); return item;
  }
  function ball(x, y, z, sx, sy, sz, color, parent = character) {
    const item = part(unitSphere, color, x, y, z, parent); item.scale.set(sx, sy, sz); return item;
  }
  function limb(start, end, radius, color, parent = character) {
    const a = new T.Vector3(...start), b = new T.Vector3(...end), direction = b.clone().sub(a);
    const item = part(unitLimb, color, 0, 0, 0, parent);
    item.position.copy(a.add(b).multiplyScalar(.5));
    item.scale.set(radius, direction.length(), radius);
    item.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize()); return item;
  }
  function graphic(points, color, x, y, z, parent) {
    const shape = new T.Shape(points.map(([px, py]) => new T.Vector2(px, py)));
    return part(new T.ShapeGeometry(shape, 6), color, x, y, z, parent, true);
  }
  function pick(item) { item.userData.view = 'character'; pickables.push(item); return item; }

  // Seat and resident share the same transform, away from the screen sightline.
  for (const x of [-.35, .35]) for (const z of [-.28, .28]) box(.07, .57, .07, x, .285, z, 0x283945, seating);
  for (const x of [-.35, .35]) box(.07, .055, .62, x, .22, 0, 0x283945, seating);
  box(.76, .055, .055, 0, .22, -.28, 0x283945, seating);
  const cushion = part(new T.CylinderGeometry(.5, .48, .16, 12), 0xa56565, 0, .64, 0, seating);
  cushion.scale.z = .86;

  // Relaxed seated pose: supported hips, bent knees, hands resting in the lap.
  box(.55, .2, .35, 0, .1, .035, colors.pants);
  for (const side of [-1, 1]) {
    const hip = side * .18, knee = side * .235;
    limb([hip, .12, .06], [knee, .045, .47], .13, colors.pants);
    ball(knee, .045, .47, .13, .12, .125, colors.pants);
    limb([knee, .03, .47], [knee, -.5, .5], .105, colors.pants);
    ball(knee, -.565, .59, .145, .09, .225, colors.shirt);
    box(.285, .037, .43, knee, -.64, .595, colors.sole);
  }
  const torso = pick(part(new T.CylinderGeometry(.29, .345, .7, 10), colors.shirt, 0, .535, -.005));
  torso.scale.z = .81;
  limb([0, .87, -.015], [0, 1.01, -.015], .105, colors.skin);
  const arm = new T.Group(); arm.position.set(.32, .81, .015); character.add(arm);
  limb([0, 0, 0], [.075, -.34, .065], .112, colors.shirt, arm);
  limb([.075, -.34, .065], [-.13, -.585, .38], .087, colors.shirt, arm);
  ball(-.145, -.6, .4, .085, .064, .1, colors.skin, arm);
  limb([-.32, .81, .015], [-.395, .47, .08], .112, colors.shirt);
  limb([-.395, .47, .08], [-.19, .225, .395], .087, colors.shirt);
  ball(-.175, .21, .415, .085, .064, .1, colors.skin);

  const head = new T.Group(); head.position.set(0, 1.27, -.015); character.add(head);
  // A broad face with a defined chin and a shallow bevel. The eyes sit on one
  // flat front surface, so they cannot sink into a sphere at an oblique angle.
  const faceShape = new T.Shape();
  faceShape.moveTo(-.21, .37); faceShape.lineTo(.21, .37);
  faceShape.quadraticCurveTo(.36, .34, .375, .16);
  faceShape.lineTo(.345, -.2); faceShape.quadraticCurveTo(.3, -.32, .19, -.355);
  faceShape.lineTo(0, -.395); faceShape.lineTo(-.19, -.355);
  faceShape.quadraticCurveTo(-.3, -.32, -.345, -.2);
  faceShape.lineTo(-.375, .16); faceShape.quadraticCurveTo(-.36, .34, -.21, .37);
  const faceGeometry = new T.ExtrudeGeometry(faceShape, { depth: .22, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .023, bevelThickness: .025, curveSegments: 5 });
  faceGeometry.translate(0, 0, -.01);
  const face = pick(part(faceGeometry, colors.skin, 0, 0, 0, head));
  const hairBack = pick(ball(0, .047, -.04, .405, .402, .268, colors.hair, head));
  for (const side of [-1, 1]) ball(side * .382, -.07, .065, .053, .079, .051, colors.skin, head);

  // Six substantial braids, with a subtle dark weave instead of grey beads.
  const links = [], dummy = new T.Object3D();
  for (const side of [-1, 1]) for (let strand = 0; strand < 3; strand++) {
    const x = side * (.35 + strand * .034), z = .2 - strand * .12;
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(side * (.035 + strand * .045), .415, -.035 - strand * .045),
      new T.Vector3(side * .245, .375, z),
      new T.Vector3(x, .13, z + .04),
      new T.Vector3(x + side * .015, -.22, z + .035),
      new T.Vector3(x - side * .022, -.47 + strand * .035, z + .02)
    ]);
    part(new T.TubeGeometry(curve, 16, .039, 5, false), colors.hair, 0, 0, 0, head);
    for (let i = 0; i < 15; i++) {
      dummy.position.copy(curve.getPoint(i / 14));
      dummy.position.x += Math.sin(i * Math.PI * .85) * .013;
      dummy.rotation.set(0, 0, side * (i % 2 ? -.38 : .38));
      dummy.scale.set(.039, .029, .039); dummy.updateMatrix(); links.push(dummy.matrix.clone());
    }
  }
  const braidLinks = new T.InstancedMesh(new T.SphereGeometry(1, 6, 4), material(colors.braid), links.length);
  links.forEach((matrix, i) => braidLinks.setMatrixAt(i, matrix));
  braidLinks.instanceMatrix.needsUpdate = true; head.add(braidLinks);
  for (const side of [-1, 1]) {
    const parting = new T.CatmullRomCurve3([new T.Vector3(0, .38, .239), new T.Vector3(side * .1, .31, .243), new T.Vector3(side * .21, .275, .237)]);
    part(new T.TubeGeometry(parting, 5, .007, 4, false), 0xc7b595, 0, 0, 0, head);
  }

  // Parted front sections give the braids a full hairline around the forehead.
  for (const side of [-1, 1]) {
    const fringe = new T.Shape();
    fringe.moveTo(-.35, .253); fringe.quadraticCurveTo(-.37, .366, -.23, .407);
    fringe.quadraticCurveTo(-.112, .426, -.018, .302);
    fringe.quadraticCurveTo(-.13, .265, -.35, .253);
    const item = part(new T.ShapeGeometry(fringe, 6), colors.hair, 0, 0, .247, head, true);
    item.rotation.y = side === -1 ? 0 : Math.PI; item.material.side = T.DoubleSide;
  }
  const front = .243;
  for (const side of [-1, 1]) {
    const eye = new T.Shape();
    eye.moveTo(-.112, .077); eye.quadraticCurveTo(-.07, .134, .092, .09);
    eye.lineTo(.103, -.027); eye.quadraticCurveTo(.07, -.145, -.04, -.112);
    eye.quadraticCurveTo(-.113, -.08, -.112, .077);
    const eyeMesh = part(new T.ShapeGeometry(eye, 6), 0x10121b, side * .155, -.018, front, head, true);
    eyeMesh.name = side === -1 ? 'left-eye' : 'right-eye';
    eyeMesh.rotation.y = side === -1 ? 0 : Math.PI;
    eyeMesh.material.side = T.DoubleSide;
    const gleam = part(new T.CircleGeometry(.029, 12), 0xfffae9, side * .155 - .027, .024, front + .003, head, true);
    gleam.scale.set(.67, 1.5, 1);
    part(new T.CircleGeometry(.011, 8), 0xb4c0cd, side * .155 + .035, -.075, front + .004, head, true);
    const brow = graphic([[-.121, .021], [.104, -.009], [.106, -.037], [-.12, -.007]], colors.hair, side * .155, .173, front, head);
    brow.rotation.y = side === -1 ? 0 : Math.PI; brow.material.side = T.DoubleSide;
    const cheek = part(new T.PlaneGeometry(.072, .054), 0xe6443e, side * .247, -.193, front + .001, head, true);
    cheek.rotation.z = side * .08;
  }
  graphic([[-.05, -.228], [.06, -.224], [.022, -.326], [-.015, -.323]], 0x13131a, 0, 0, front + .002, head);

  const origin = new T.Vector3(), towards = new T.Vector3(), inverse = new T.Quaternion();
  function faceViewer(cameraPosition) {
    head.getWorldPosition(origin); character.getWorldQuaternion(inverse).invert();
    towards.copy(cameraPosition).sub(origin).applyQuaternion(inverse);
    head.rotation.y = T.MathUtils.clamp(Math.atan2(towards.x, towards.z), -.55, .55);
    head.rotation.x = -T.MathUtils.clamp(Math.atan2(towards.y, Math.hypot(towards.x, towards.z)), -.12, .5);
  }
  return { seating, character, head, arm, face, hairBack, pickables, faceViewer };
}
