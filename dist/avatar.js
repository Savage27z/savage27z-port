import * as T from './vendor/three.module.min.js';

// A small cel-shaded resident styled after the owner's current PFP: fluffy
// white hair, sleepy half-lidded yellow-green eyes, pale skin and a dark teal
// turtleneck. Built the way anime-style 3D characters usually are: a smooth
// head with the face painted onto it, hair made of tapered locks, and an ink
// outline. A stylized adaptation from local geometry, not a reproduction.
export function buildAvatar() {
  const seating = new T.Group();
  seating.name = 'Resident / beside the workstation';
  seating.position.set(-2.45, 0, 2.5);
  seating.rotation.y = .69;
  const character = new T.Group(); character.position.y = .72; seating.add(character);
  const colors = { top: 0x2c4753, collar: 0x1c313b, pants: 0x2d3241, skin: 0xfcefe2, sole: 0xd7cbb5, shoe: 0x22262f, hair: 0xf7f8fb, ink: 0x23263a };
  const materials = new Map(), pickables = [];
  const unitBox = new T.BoxGeometry(1, 1, 1);
  function material(color) {
    if (!materials.has(color)) materials.set(color, new T.MeshToonMaterial({ color }));
    return materials.get(color);
  }
  function part(geometry, color, x, y, z, parent = character) {
    const item = new T.Mesh(geometry, typeof color === 'number' ? material(color) : color);
    item.position.set(x, y, z); parent.add(item); return item;
  }
  function box(w, h, d, x, y, z, color, parent = character) {
    const item = part(unitBox, color, x, y, z, parent); item.scale.set(w, h, d); return item;
  }
  function pick(item) { item.userData.view = 'character'; pickables.push(item); return item; }
  // An inverted hull: the same surface pushed out along its normals and drawn
  // from behind, which reads as an ink line around the silhouette.
  const inkMaterial = new T.MeshBasicMaterial({ color: colors.ink, side: T.BackSide });
  function outline(source, thickness, parent, ink = inkMaterial) {
    const geometry = source.geometry.clone();
    const position = geometry.attributes.position, normal = geometry.attributes.normal;
    for (let i = 0; i < position.count; i++) {
      position.setXYZ(i, position.getX(i) + normal.getX(i) * thickness, position.getY(i) + normal.getY(i) * thickness, position.getZ(i) + normal.getZ(i) * thickness);
    }
    const hull = new T.Mesh(geometry, ink);
    hull.position.copy(source.position); hull.quaternion.copy(source.quaternion); hull.scale.copy(source.scale);
    parent.add(hull); return hull;
  }

  // Seat and resident share the same transform, away from the screen sightline.
  for (const x of [-.35, .35]) for (const z of [-.28, .28]) box(.07, .57, .07, x, .285, z, 0x283945, seating);
  for (const x of [-.35, .35]) box(.07, .055, .62, x, .22, 0, 0x283945, seating);
  box(.76, .055, .055, 0, .22, -.28, 0x283945, seating);
  const cushion = part(new T.CylinderGeometry(.5, .48, .16, 12), 0xa56565, 0, .64, 0, seating);
  cushion.scale.z = .86;

  // Skin and hair keep their own gentle ramps: anime faces carry almost no
  // shading, and white hair only needs a soft blue-grey shadow tone.
  function ramp(steps) {
    const texture = new T.DataTexture(new Uint8Array(steps), steps.length, 1, T.RedFormat);
    texture.minFilter = texture.magFilter = T.NearestFilter; texture.needsUpdate = true; return texture;
  }
  const skin = new T.MeshToonMaterial({ color: colors.skin, emissive: 0x4a3c30, gradientMap: ramp([206, 255]) });
  skin.userData.ownRamp = true;
  // Clothes are smooth surfaces in the scene's crisper cel shading.
  const cloth = color => new T.MeshToonMaterial({ color, side: T.DoubleSide });
  const sweater = cloth(colors.top), trousers = cloth(colors.pants), shoeMaterial = cloth(colors.shoe), soleMaterial = cloth(colors.sole);
  const bodyInk = new T.MeshBasicMaterial({ color: colors.ink, side: T.BackSide });
  // A smooth tube along a curve: sleeves and trouser legs. radius(t) shapes the
  // profile from start to end; the open ends always sit inside another part.
  function tube(points, radius, { sides = 10, rings = 14, squash = 1 } = {}) {
    const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
    const frames = curve.computeFrenetFrames(rings, false);
    const positions = [], indices = [], p = new T.Vector3();
    for (let i = 0; i <= rings; i++) {
      const t = i / rings, r = radius(t); curve.getPointAt(t, p);
      const n = frames.normals[i], b = frames.binormals[i];
      for (let j = 0; j < sides; j++) {
        const a = j / sides * Math.PI * 2, u = Math.cos(a) * r, v = Math.sin(a) * r * squash;
        positions.push(p.x + n.x * u + b.x * v, p.y + n.y * u + b.y * v, p.z + n.z * u + b.z * v);
      }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
      const a = i * sides + j, b = i * sides + (j + 1) % sides;
      indices.push(a, b, a + sides, b, b + sides, a + sides);
    }
    // Faces must point outward so the ink hull grows outward, not inward.
    const vertex = i => new T.Vector3().fromArray(positions, i * 3);
    const normal = new T.Vector3().crossVectors(vertex(1).sub(vertex(0)), vertex(sides).sub(vertex(0)));
    if (normal.dot(vertex(0).sub(curve.getPointAt(0))) < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
    geometry.computeVertexNormals(); return geometry;
  }
  const blob = (x, y, z, sx, sy, sz, segments = 12) => new T.SphereGeometry(1, segments, Math.round(segments * .75)).scale(sx, sy, sz).translate(x, y, z);
  // The ink hull is a child of its part, so it follows breathing and the wave.
  function dressed(geometry, materialToUse, parent = character, ink = .008) {
    const mesh = new T.Mesh(geometry, materialToUse); parent.add(mesh);
    outline(mesh, ink, mesh, bodyInk); return mesh;
  }
  // Sleeves taper from shoulder to wrist and flare a little at the cuff.
  const sleeve = t => t > .9 ? .086 + (t - .9) * .08 : .104 - t * .022;

  // Relaxed seated pose: supported hips, bent knees, hands resting in the lap.
  const leg = side => tube([[side * .18, .13, .05], [side * .215, .095, .3], [side * .235, .04, .47], [side * .238, -.24, .495], [side * .235, -.52, .5]],
    t => t < .4 ? .132 - t * .04 : .116 - (t - .4) * .035, { rings: 16 });
  dressed(mergeGeometries([blob(0, .11, .04, .29, .14, .21), leg(-1), leg(1)]), trousers);
  dressed(mergeGeometries([-1, 1].map(side => blob(side * .235, -.565, .585, .15, .1, .24))), shoeMaterial);
  dressed(mergeGeometries([-1, 1].map(side => blob(side * .235, -.632, .6, .155, .035, .25))), soleMaterial, character, .006);
  // A sweater with sloping shoulders, revolved from one profile.
  const torsoProfile = [[0, 0], [.28, 0], [.285, .1], [.295, .33], [.305, .5], [.298, .6], [.265, .66], [.19, .7], [.13, .72], [0, .725]]
    .map(([r, y]) => new T.Vector2(r, y));
  const torso = pick(dressed(new T.LatheGeometry(torsoProfile, 22), sweater));
  torso.position.set(0, .18, -.005); torso.scale.z = .8;
  // The turtleneck rolls up behind the chin in soft folds, as in the PFP.
  const collarProfile = [[.17, 0], [.172, .05], [.158, .09], [.165, .12], [.152, .17], [.158, .2], [.146, .25], [.12, .27], [.1, .25]]
    .map(([r, y]) => new T.Vector2(r, y));
  const collar = dressed(new T.LatheGeometry(collarProfile, 18), cloth(colors.collar), character, .006);
  collar.position.set(0, .86, -.03); collar.scale.z = .9;
  // Hands: a soft mitten with a small thumb.
  const hand = (x, y, z, turn) => mergeGeometries([blob(0, 0, 0, .075, .058, .095), blob(.045, .02, -.02, .03, .026, .045, 10)])
    .rotateY(turn).translate(x, y, z);
  // A rounded joint caps each sleeve where it meets the shoulder.
  dressed(mergeGeometries([tube([[-.32, .81, .015], [-.37, .64, .04], [-.395, .47, .08], [-.31, .33, .26], [-.2, .235, .39]], sleeve),
    blob(-.305, .79, .015, .112, .105, .11)]), sweater);
  dressed(hand(-.175, .215, .415, .3), skin, character, .006);
  // The right arm is its own group, pivoting at the shoulder for the wave.
  const arm = new T.Group(); arm.position.set(.32, .81, .015); character.add(arm);
  dressed(mergeGeometries([tube([[0, 0, 0], [.045, -.17, .03], [.075, -.34, .065], [-.02, -.48, .24], [-.12, -.575, .37]], sleeve),
    blob(-.015, -.02, 0, .112, .105, .11)]), sweater, arm);
  dressed(hand(-.145, -.6, .4, -.3), skin, arm, .006);

  // Head: a smooth egg with a soft, narrow chin and a slightly flat face.
  const head = new T.Group(); head.position.set(0, 1.27, -.015); character.add(head);
  const size = new T.Vector3(.33, .37, .32);
  function shapeHead(v) {
    let { x, y, z } = v;
    if (y < 0) { const t = -y; x *= 1 - .27 * t * t; z *= 1 - .12 * t * t; y *= 1.1; }
    if (z > 0) z *= .93;
    return v.set(x * size.x, y * size.y, z * size.z);
  }
  function shaped(geometry, inflate = 1) {
    const position = geometry.attributes.position, v = new T.Vector3();
    for (let i = 0; i < position.count; i++) {
      shapeHead(v.fromBufferAttribute(position, i)).multiplyScalar(inflate);
      position.setXYZ(i, v.x, v.y, v.z);
    }
    geometry.computeVertexNormals(); return geometry;
  }
  const face = pick(part(shaped(new T.SphereGeometry(1, 40, 26)), skin, 0, 0, 0, head));
  outline(face, .008, head);

  // The face is painted on a patch that hugs the front of the head. Features
  // are placed by angle: phi around the head, theta down from the crown.
  const patch = { phiStart: Math.PI / 2 - .85, phiLength: 1.7, thetaStart: .95, thetaLength: 1.45 };
  const canvasPoint = (offset, theta) => [(offset + .85) / patch.phiLength * 1024, (theta - patch.thetaStart) / patch.thetaLength * 1024];
  const surface = (offset, theta) => shapeHead(new T.Vector3(Math.sin(offset) * Math.sin(theta), Math.cos(theta), Math.cos(offset) * Math.sin(theta)));
  const eyes = [[-.4, 1.66, -1], [.4, 1.66, 1]];
  function paintFace(closed) {
    if (typeof document === 'undefined') return new T.Texture();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
    const c = canvas.getContext('2d');
    c.lineCap = c.lineJoin = 'round';
    const stroke = (path, width, color) => { c.lineWidth = width; c.strokeStyle = color; c.stroke(new Path2D(path)); };
    for (const [offset, theta, side] of eyes) {
      const [x, y] = canvasPoint(offset, theta);
      c.save(); c.translate(x, y); c.scale(side * 1.08, .94);
      // Tired creases under the eyes, as in the PFP.
      stroke('M -104 104 Q 8 132 124 96', 5, 'rgba(124,100,118,.7)');
      stroke('M -52 136 Q 18 150 88 130', 4, 'rgba(146,122,136,.45)');
      if (closed) {
        stroke('M -150 22 Q 0 58 156 12', 12, '#1d1f2b');
        stroke('M 150 14 L 182 30', 9, '#1d1f2b');
      } else {
        // A half-lidded eye: the heavy lid covers the top of a large iris.
        const opening = new Path2D('M -150 12 C -96 -12 64 -22 154 -8 C 126 70 -74 86 -150 12 Z');
        c.fillStyle = '#f8f5ef'; c.fill(opening);
        c.save(); c.clip(opening);
        const iris = c.createRadialGradient(4, 30, 8, 4, 22, 66);
        iris.addColorStop(0, '#eef0aa'); iris.addColorStop(.5, '#cacb66'); iris.addColorStop(1, '#808b35');
        c.fillStyle = iris; c.beginPath(); c.arc(4, 22, 64, 0, Math.PI * 2); c.fill();
        c.lineWidth = 7; c.strokeStyle = '#4a5020'; c.stroke();
        c.fillStyle = '#1c1e13'; c.beginPath(); c.arc(4, 26, 20, 0, Math.PI * 2); c.fill();
        const shade = c.createLinearGradient(0, -14, 0, 34);
        shade.addColorStop(0, 'rgba(44,40,66,.62)'); shade.addColorStop(1, 'rgba(44,40,66,0)');
        c.fillStyle = shade; c.fillRect(-170, -30, 340, 70);
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(32, 56, 7, 0, Math.PI * 2); c.fill();
        c.restore();
        // Upper lid and lashes: a thick band that droops at the outer corner.
        c.fillStyle = '#1d1f2b';
        c.fill(new Path2D('M -160 14 C -96 -14 64 -26 156 -10 L 188 10 L 170 -34 C 70 -52 -92 -40 -162 -2 Z'));
        stroke('M -24 76 Q 78 68 152 -2', 5, '#2b2c38');
      }
      // A soft crease above the heavy lid.
      stroke('M -104 -58 Q 30 -84 148 -48', 5, 'rgba(58,52,66,.8)');
      c.restore();
    }
    const [nx, ny] = canvasPoint(.02, 1.93);
    stroke('M ' + nx + ' ' + (ny - 14) + ' q 9 18 -4 28', 4, 'rgba(190,150,132,.85)');
    const [mx, my] = canvasPoint(0, 2.13);
    c.save(); c.translate(mx, my); c.scale(1, .9);
    stroke('M -40 0 Q 0 -9 40 5', 7, '#5b3d3b');
    stroke('M -16 20 Q 0 25 16 20', 4, 'rgba(170,120,110,.32)');
    c.restore();
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
    return texture;
  }
  const open = paintFace(false), shut = paintFace(true);
  const decal = part(shaped(new T.SphereGeometry(1, 26, 20, patch.phiStart, patch.phiLength, patch.thetaStart, patch.thetaLength), 1.004),
    new T.MeshBasicMaterial({ map: open, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0, 0, head);
  decal.renderOrder = 1;
  // Each eye's main highlight is a real mesh, so it can be checked for
  // visibility past the hair. Both sit on the same side, lit from one source.
  const gleams = eyes.map(([offset, theta], i) => {
    const point = surface(offset - .03 + (i ? .006 : 0), theta + .012);
    const normal = new T.Vector3(point.x / size.x ** 2, point.y / size.y ** 2, point.z / size.z ** 2).normalize();
    // Offset a hair so the mesh origin sits inside a triangle, not on the shared centre vertex.
    const gleam = part(new T.CircleGeometry(.0085, 14).translate(.0013, .0009, 0), new T.MeshBasicMaterial({ color: 0xffffff }), 0, 0, 0, head);
    gleam.position.copy(point).addScaledVector(normal, .006);
    gleam.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), normal);
    gleam.name = i === 0 ? 'left-eye' : 'right-eye';
    return gleam;
  });

  // Hair: a scalp cap plus leaf-shaped clumps that stay full, then round off
  // at the tip. Wide overlapping bangs, a fluffy crown and locks to the jaw.
  const center = new T.Vector3(0, .02, -.03);
  function clump(points, width, thickness = width * .38) {
    const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
    const rings = 10, sides = 6, positions = [], indices = [];
    const p = new T.Vector3(), tangent = new T.Vector3(), out = new T.Vector3(), across = new T.Vector3(), up = new T.Vector3();
    for (let i = 0; i <= rings; i++) {
      const t = i / rings; curve.getPoint(t, p); curve.getTangent(t, tangent);
      out.copy(p).sub(center).normalize();
      across.crossVectors(tangent, out).normalize(); up.crossVectors(across, tangent).normalize();
      const body = t < .45 ? .86 + t * .3 : Math.cos((t - .45) / .55 * Math.PI / 2) ** .75;
      const taper = Math.max(.07, body);
      for (let j = 0; j < sides; j++) {
        const a = j / sides * Math.PI * 2, w = Math.cos(a) * width * taper, h = Math.sin(a) * thickness * taper;
        positions.push(p.x + across.x * w + up.x * h, p.y + across.y * w + up.y * h, p.z + across.z * w + up.z * h);
      }
    }
    curve.getPoint(1, p); curve.getTangent(1, tangent); p.addScaledVector(tangent, .02);
    const tip = positions.length / 3; positions.push(p.x, p.y, p.z);
    for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
      const a = i * sides + j, b = i * sides + (j + 1) % sides, c2 = a + sides, d = b + sides;
      indices.push(a, b, c2, b, d, c2);
    }
    for (let j = 0; j < sides; j++) indices.push(rings * sides + j, rings * sides + (j + 1) % sides, tip);
    // Keep faces pointing outward whichever way the frame turned: the first
    // triangle is (0, 1, sides) and its normal should point away from the curve.
    const v = i => new T.Vector3().fromArray(positions, i * 3);
    const n = new T.Vector3().crossVectors(v(1).sub(v(0)), v(sides).sub(v(0)));
    if (n.dot(v(0).sub(curve.getPoint(0))) < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
    geometry.computeVertexNormals(); return geometry;
  }
  const mirror = points => points.map(([x, y, z]) => [-x, y, z]);
  const both = (points, width) => [clump(points, width), clump(mirror(points), width)];
  // Crown clumps radiate from the top of the head and curl outward and down.
  const crown = new T.Vector3(0, .26, -.06);
  const radiate = ([dx, dy, dz], length, width, droop = .05) => {
    const direction = new T.Vector3(dx, dy, dz).normalize();
    const start = crown.clone().addScaledVector(direction, .2), bend = new T.Vector3(0, -droop, 0);
    const middle = start.clone().addScaledVector(direction, length * .55).addScaledVector(bend, .4);
    const end = start.clone().addScaledVector(direction, length).add(bend);
    return clump([start.toArray(), middle.toArray(), end.toArray()], width);
  };
  const locks = [
    // Bangs: wide, overlapping, stopping just above the eyes. One narrow strand
    // drops between them to the bridge of the nose, as in the PFP.
    ...[[-.3, -.32, .07, .11], [-.2, -.23, .1, .12], [-.1, -.12, .05, .12], [.09, .1, .08, .12], [.19, .21, .04, .12], [.29, .31, .09, .11]]
      .map(([root, tip, tipY, width]) => clump([[root * .9, .35, .16], [(root + tip) / 2, .22, .31], [tip, tipY, .33]], width)),
    clump([[0, .36, .18], [.005, .21, .315], [-.004, .03, .333], [.008, -.09, .318]], .055),
    // Layers lie over the top of the head and lift slightly at the tips, so
    // the crown reads as fluffy volume rather than a bun.
    ...[-.21, -.07, .07, .21].map(x => clump([[x * .6, .35, -.24], [x * .95, .435, -.05], [x * 1.2, .425, .12]], .15)),
    radiate([-.85, .5, .05], .18, .14), radiate([.85, .5, .05], .18, .14),
    radiate([-1, .2, 0], .19, .13, .07), radiate([1, .2, 0], .19, .13, .07),
    radiate([0, .45, -.9], .22, .15, .06), radiate([-.6, .35, -.7], .2, .14, .08), radiate([.6, .35, -.7], .2, .14, .08),
    // Locks framing the face hang to the jaw; the nape is covered from behind.
    ...both([[-.3, .18, .13], [-.345, .02, .18], [-.32, -.16, .2], [-.27, -.28, .19]], .085),
    ...both([[-.33, .14, -.02], [-.38, -.06, 0], [-.35, -.25, -.02]], .09),
    clump([[0, -.02, -.3], [0, -.18, -.35], [.02, -.3, -.31]], .12),
    ...both([[-.16, -.02, -.28], [-.21, -.18, -.31], [-.23, -.29, -.27]], .11)
  ];
  const cap = shaped(new T.SphereGeometry(1, 32, 11, 0, Math.PI * 2, 0, 1.15), 1.07);
  const back = shaped(new T.SphereGeometry(1, 24, 14, Math.PI - .55, Math.PI + 1.1, .4, 1.9), 1.06);
  const hairMaterial = new T.MeshToonMaterial({ color: colors.hair, emissive: 0x50525c, side: T.DoubleSide, gradientMap: ramp([150, 214, 255]) });
  hairMaterial.userData.ownRamp = true;
  const hair = pick(part(mergeGeometries([cap, back, ...locks]), hairMaterial, 0, 0, 0, head));
  // A soft blue-grey line on the hair keeps it fluffy; dark ink stays on the face.
  outline(hair, .006, head, new T.MeshBasicMaterial({ color: 0x67718f, side: T.BackSide }));

  const origin = new T.Vector3(), towards = new T.Vector3(), inverse = new T.Quaternion();
  function faceViewer(cameraPosition) {
    head.getWorldPosition(origin); character.getWorldQuaternion(inverse).invert();
    towards.copy(cameraPosition).sub(origin).applyQuaternion(inverse);
    head.rotation.y = T.MathUtils.clamp(Math.atan2(towards.x, towards.z), -.55, .55);
    head.rotation.x = -T.MathUtils.clamp(Math.atan2(towards.y, Math.hypot(towards.x, towards.z)), -.12, .5);
  }
  function blink(closed) {
    decal.material.map = closed ? shut : open;
    gleams.forEach(gleam => { gleam.visible = !closed; });
  }
  return { seating, character, head, torso, arm, face, hairBack: hair, pickables, faceViewer, blink, gleams };
}

// Concatenates indexed geometries (position and normal) into one draw call.
function mergeGeometries(geometries) {
  const positions = [], normals = [], indices = [];
  let offset = 0;
  for (const geometry of geometries) {
    const index = geometry.index ? geometry.index.array : [...Array(geometry.attributes.position.count).keys()];
    positions.push(...geometry.attributes.position.array); normals.push(...geometry.attributes.normal.array);
    for (const i of index) indices.push(i + offset);
    offset += geometry.attributes.position.count;
    geometry.dispose();
  }
  const merged = new T.BufferGeometry();
  merged.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
}
