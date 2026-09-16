import * as T from './vendor/three.module.min.js';

// Cache the head's local bounds once, including the instanced braids.
export function getHeadCorners(head) {
  head.updateWorldMatrix(true, true);
  const inverse = head.matrixWorld.clone().invert();
  const bounds = new T.Box3(), partBounds = new T.Box3(), relative = new T.Matrix4();
  head.traverse(part => {
    if (!part.isMesh) return;
    if (part.isInstancedMesh) {
      part.computeBoundingBox(); partBounds.copy(part.boundingBox);
    } else {
      if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
      partBounds.copy(part.geometry.boundingBox);
    }
    relative.multiplyMatrices(inverse, part.matrixWorld);
    bounds.union(partBounds.applyMatrix4(relative));
  });
  const corners = [];
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y])
    for (const z of [bounds.min.z, bounds.max.z]) corners.push(new T.Vector3(x, y, z));
  return corners;
}

const projected = new T.Vector3();
export function projectHead(corners, matrixWorld, camera, width, height) {
  const rect = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const corner of corners) {
    projected.copy(corner).applyMatrix4(matrixWorld).project(camera);
    const x = (projected.x * .5 + .5) * width, y = (-projected.y * .5 + .5) * height;
    rect.left = Math.min(rect.left, x); rect.right = Math.max(rect.right, x);
    rect.top = Math.min(rect.top, y); rect.bottom = Math.max(rect.bottom, y);
  }
  return rect;
}

export function overlaps(a, b, gap = 0) {
  return a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
}

// A few candidate positions around protected rectangles keep labels near their
// objects. All calculations use cached DOM sizes; no layout reads per frame.
export function placeHotspot(anchor, size, bounds, obstacles, gap = 14) {
  const half = size.width / 2;
  const minX = bounds.left + half, maxX = bounds.right - half;
  const minY = bounds.top + size.height, maxY = bounds.bottom;
  if (maxX < minX || maxY < minY) return null;
  const clampX = x => Math.max(minX, Math.min(maxX, x));
  const clampY = y => Math.max(minY, Math.min(maxY, y));
  const xs = [clampX(anchor.x), minX, maxX], ys = [clampY(anchor.y), minY, maxY];
  for (const rect of obstacles) {
    xs.push(clampX(rect.left - gap - half), clampX(rect.right + gap + half));
    ys.push(clampY(rect.top - gap), clampY(rect.bottom + gap + size.height));
  }
  let best = null, bestDistance = Infinity;
  for (const x of xs) for (const y of ys) {
    const rect = { left: x - half, top: y - size.height, right: x + half, bottom: y };
    if (obstacles.some(obstacle => overlaps(rect, obstacle, gap - .01))) continue;
    const distance = (x - anchor.x) ** 2 + (y - anchor.y) ** 2;
    if (distance < bestDistance) { bestDistance = distance; best = { x, y, rect }; }
  }
  return best;
}
