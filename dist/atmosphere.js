import * as T from './vendor/three.module.min.js';

// Night atmosphere around the rooftop: gradient sky, twinkling stars, a haloed
// moon, drifting clouds, warm practical lights with glow halos and falling
// sakura petals. Everything here is cheap: one sky draw, one points draw,
// sprites, and a single instanced mesh for the petals.

function glowTexture(stops, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  context.fillStyle = gradient; context.fillRect(0, 0, size, size);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; return texture;
}
function cloudTexture(seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const context = canvas.getContext('2d');
  let s = seed; const random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 14; i++) {
    const x = 40 + random() * 176, y = 52 + random() * 34, r = 18 + random() * 30;
    const gradient = context.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, 'rgba(120,112,160,.55)'); gradient.addColorStop(1, 'rgba(120,112,160,0)');
    context.fillStyle = gradient; context.beginPath(); context.arc(x, y, r, 0, Math.PI * 2); context.fill();
  }
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; return texture;
}

export function createAtmosphere(scene, world, { quality, random, beaconSpots = [] }) {
  const sky = new T.Group(); sky.name = 'Sky (follows the camera)'; scene.add(sky);

  // Gradient dome: deep indigo overhead, violet mid sky, warm city glow at the horizon.
  const dome = new T.Mesh(new T.SphereGeometry(90, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new T.Color(0x060a1a) }, mid: { value: new T.Color(0x161838) }, horizon: { value: new T.Color(0x34284f) }, glow: { value: new T.Color(0xc77a6a) } },
    vertexShader: 'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top,mid,horizon,glow;varying vec3 vDir;void main(){float h=vDir.y;vec3 c=mix(horizon,mid,smoothstep(.0,.22,h));c=mix(c,top,smoothstep(.22,.75,h));c=mix(c,horizon*.55,smoothstep(.0,-.25,h));c+=glow*pow(1.-min(1.,abs(h)),10.)*.3;gl_FragColor=vec4(c,1.);}'
  }));
  dome.renderOrder = -10; sky.add(dome);

  // Stars twinkle in the vertex shader; the CPU only advances one uniform.
  const starCount = quality === 'high' ? 420 : 240;
  const starPositions = new Float32Array(starCount * 3), phases = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const azimuth = random() * Math.PI * 2, elevation = .06 + Math.pow(random(), .7) * 1.3;
    starPositions.set([Math.cos(azimuth) * Math.cos(elevation) * 84, Math.sin(elevation) * 84, Math.sin(azimuth) * Math.cos(elevation) * 84], i * 3);
    phases[i] = random();
  }
  const starGeometry = new T.BufferGeometry();
  starGeometry.setAttribute('position', new T.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('phase', new T.BufferAttribute(phases, 1));
  const starMaterial = new T.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: T.AdditiveBlending,
    uniforms: { time: { value: 0 }, scale: { value: Math.min(devicePixelRatio || 1, 2) } },
    vertexShader: 'attribute float phase;uniform float time,scale;varying float vA;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);vA=.45+.55*sin(time*(.8+phase*1.6)+phase*40.);gl_PointSize=(1.2+phase*2.2)*scale;}',
    fragmentShader: 'varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.96,.92,1.,vA*smoothstep(.5,.0,d));}'
  });
  sky.add(new T.Points(starGeometry, starMaterial));

  // Moon with a soft halo, kept "infinitely" far by riding with the camera.
  const moonDirection = new T.Vector3(-.34, .4, -.85).normalize();
  const moonCanvas = document.createElement('canvas'); moonCanvas.width = 256; moonCanvas.height = 128;
  const moonPaint = moonCanvas.getContext('2d'); moonPaint.fillStyle = '#f7e9cb'; moonPaint.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 26; i++) {
    const x = random() * 256, y = 16 + random() * 96, r = 3 + random() * 12;
    moonPaint.fillStyle = 'rgba(196,176,150,' + (.18 + random() * .25) + ')'; moonPaint.beginPath(); moonPaint.ellipse(x, y, r * 1.6, r, 0, 0, Math.PI * 2); moonPaint.fill();
  }
  const moonMap = new T.CanvasTexture(moonCanvas); moonMap.colorSpace = T.SRGBColorSpace;
  const moon = new T.Mesh(new T.SphereGeometry(2.6, 32, 16), new T.MeshBasicMaterial({ map: moonMap, fog: false }));
  moon.rotation.y = 1.9;
  moon.position.copy(moonDirection).multiplyScalar(76); sky.add(moon);
  const halo = new T.Sprite(new T.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,236,205,.55)'], [.18, 'rgba(255,220,190,.22)'], [1, 'rgba(120,110,200,0)']]), blending: T.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  halo.position.copy(moon.position); halo.scale.setScalar(30); sky.add(halo);

  const clouds = [];
  const placeCloud = cloud => {
    const { azimuth: a, elevation: e } = cloud.userData;
    cloud.position.set(Math.cos(a) * Math.cos(e) * 70, Math.sin(e) * 70, Math.sin(a) * Math.cos(e) * 70);
  };
  for (let i = 0; i < 5; i++) {
    const cloud = new T.Sprite(new T.SpriteMaterial({ map: cloudTexture(9 + i * 31), transparent: true, depthWrite: false, fog: false, opacity: .5 }));
    cloud.userData = { azimuth: -2.1 + i * .55 + random() * .3, elevation: .08 + random() * .16, speed: .004 + random() * .004 };
    cloud.scale.set(34 + random() * 18, 10 + random() * 5, 1); placeCloud(cloud); sky.add(cloud); clouds.push(cloud);
  }

  // Lights: cool moonlight casts the only shadow; practical lights stay warm.
  const hemi = new T.HemisphereLight(0xa3b2e6, 0x4d3643, 1.3); scene.add(hemi);
  const moonLight = new T.DirectionalLight(0xd4ddff, 1.55);
  moonLight.position.set(-5.5, 10, 6.5); moonLight.target.position.set(0, 0, 0);
  scene.add(moonLight, moonLight.target);
  const shadow = moonLight.shadow;
  shadow.mapSize.set(2048, 2048); shadow.bias = -.0006; shadow.normalBias = .025; shadow.radius = 3;
  Object.assign(shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
  const rim = new T.DirectionalLight(0x9a7fd8, .45); rim.position.set(6, 5, -7); scene.add(rim);
  // Warm bounce from the street lights and lit windows below.
  const cityGlow = new T.DirectionalLight(0xffc49a, .4); cityGlow.position.set(7, 3, 9); scene.add(cityGlow);

  const practical = [];
  function pointLight(color, intensity, distance, parent, position) {
    const light = new T.PointLight(color, intensity, distance, 2);
    light.position.copy(position); parent.add(light); light.userData.base = intensity; practical.push(light); return light;
  }
  world.lanterns.forEach((lantern, i) => pointLight(0xffa860, 5.5, 6.5, lantern, new T.Vector3(0, -.4, 0)).userData.flicker = i + 1);
  pointLight(0xffb070, 4, 5, scene, world.glows.door.clone().add(new T.Vector3(0, -.2, .6)));
  pointLight(0xbfd6ff, 3.2, 4.2, scene, world.glows.screen.clone().add(new T.Vector3(0, -.25, .7)));

  // Additive halos fake the bloom of every light source.
  const warmGlow = glowTexture([[0, 'rgba(255,190,120,.85)'], [.25, 'rgba(255,160,90,.32)'], [1, 'rgba(255,140,80,0)']]);
  const coolGlow = glowTexture([[0, 'rgba(190,215,255,.5)'], [.35, 'rgba(150,180,255,.16)'], [1, 'rgba(120,150,255,0)']]);
  const sprite = (map, scale, parent, position, opacity = 1) => {
    const item = new T.Sprite(new T.SpriteMaterial({ map, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
    item.position.copy(position); item.scale.setScalar(scale); parent.add(item); return item;
  };
  const lanternHalos = world.lanterns.map(lantern => sprite(warmGlow, 1.25, lantern, new T.Vector3(0, -.4, .02)));
  sprite(warmGlow, 1.9, scene, world.glows.door.clone().add(new T.Vector3(0, 0, .12)), .75);
  const screenGlow = sprite(coolGlow, 4.6, scene, world.glows.screen.clone().add(new T.Vector3(0, 0, -.2)), .55);
  for (const x of [-7.4, 5, 14]) sprite(warmGlow, 3.2, scene, new T.Vector3(x, -7.25, 5.2), .8);

  // Red aircraft beacons on the distant towers blink slowly.
  const dummy = new T.Object3D();
  const beacons = new T.InstancedMesh(new T.SphereGeometry(.09, 8, 6), new T.MeshBasicMaterial({ color: 0xff4b4b, fog: false }), Math.max(1, beaconSpots.length));
  beacons.count = beaconSpots.length;
  const redGlow = glowTexture([[0, 'rgba(255,90,90,.9)'], [1, 'rgba(255,60,60,0)']], 64);
  const beaconHalos = beaconSpots.map((spot, i) => {
    dummy.position.copy(spot); dummy.updateMatrix(); beacons.setMatrixAt(i, dummy.matrix);
    return sprite(redGlow, 1.1, scene, spot);
  });
  scene.add(beacons);

  // Sakura petals drift off the potted tree and across the roof.
  const petalMax = 90;
  const petalShape = new T.Shape();
  petalShape.moveTo(0, -.03); petalShape.quadraticCurveTo(.034, -.004, 0, .034); petalShape.quadraticCurveTo(-.034, -.004, 0, -.03);
  const petals = new T.InstancedMesh(new T.ShapeGeometry(petalShape, 3), new T.MeshBasicMaterial({ color: 0xf2b6c4, side: T.DoubleSide }), petalMax);
  petals.instanceMatrix.setUsage(T.DynamicDrawUsage); petals.frustumCulled = false; scene.add(petals);
  const petalState = Array.from({ length: petalMax }, () => ({ p: new T.Vector3(), v: new T.Vector3(), r: new T.Euler(), spin: new T.Vector3(), phase: 0 }));
  function spawn(petal, anywhere = false) {
    petal.p.set(2.9 + random() * 1.5, 1.95 + random() * .9, 1.8 + random() * 1.2);
    if (anywhere) { petal.p.x -= random() * 7; petal.p.y = .2 + random() * 2.8; }
    petal.v.set(-.16 - random() * .3, -.17 - random() * .16, (random() - .5) * .12);
    petal.r.set(random() * 6, random() * 6, random() * 6);
    petal.spin.set(.6 + random() * 1.8, .4 + random() * 1.4, .3 + random());
    petal.phase = random() * 6.28;
  }
  petalState.forEach(petal => spawn(petal, true));
  let petalCount = quality === 'high' ? petalMax : quality === 'medium' ? 46 : 0;
  petals.count = petalCount;

  const lanternLights = practical.filter(light => light.userData.flicker);
  function setQuality(level) {
    petalCount = level === 'high' ? petalMax : level === 'medium' ? 46 : 0;
    petals.count = petalCount;
    // Fewer lights on modest devices: lanterns keep their halos either way.
    lanternLights.forEach((light, i) => { light.visible = level === 'high' || i === 1; });
    clouds.forEach(cloud => { cloud.visible = level !== 'low'; });
  }
  setQuality(quality);

  let beaconOn = true;
  return {
    sky, moonLight, petals, starMaterial, lanternHalos, setQuality,
    follow(camera) { sky.position.copy(camera.position); },
    update(now, dt) {
      const t = now / 1000;
      starMaterial.uniforms.time.value = t;
      clouds.forEach(cloud => { cloud.userData.azimuth += cloud.userData.speed * dt; placeCloud(cloud); });
      for (const light of lanternLights) light.intensity = light.userData.base * (.9 + .1 * Math.sin(t * 2.3 * light.userData.flicker + light.userData.flicker));
      lanternHalos.forEach((h, i) => h.material.opacity = .88 + .12 * Math.sin(t * 2.3 * (i + 1) + i + 1));
      screenGlow.material.opacity = .5 + .05 * Math.sin(t * 7.1) * Math.sin(t * 2.9);
      const on = Math.floor(t / 1.4) % 2 === 0;
      if (on !== beaconOn) { beaconOn = on; beacons.visible = on; beaconHalos.forEach(h => { h.visible = on; }); }
      for (let i = 0; i < petalCount; i++) {
        const petal = petalState[i];
        const sway = Math.sin(t * 1.3 + petal.phase);
        petal.p.x += (petal.v.x + sway * .05) * dt; petal.p.y += petal.v.y * dt; petal.p.z += (petal.v.z + Math.cos(t + petal.phase) * .04) * dt;
        petal.r.x += petal.spin.x * dt; petal.r.y += petal.spin.y * dt; petal.r.z += petal.spin.z * dt;
        const offRoof = Math.abs(petal.p.x) > 4.9 || Math.abs(petal.p.z) > 3.7;
        if ((!offRoof && petal.p.y < .07) || petal.p.y < -4) spawn(petal);
        dummy.position.copy(petal.p); dummy.rotation.copy(petal.r); dummy.scale.setScalar(1.4); dummy.updateMatrix();
        petals.setMatrixAt(i, dummy.matrix);
      }
      if (petalCount) petals.instanceMatrix.needsUpdate = true;
    },
    // A first frame with settled petals, for still renders without motion.
    settle() { this.update(performance.now(), 0); }
  };
}
