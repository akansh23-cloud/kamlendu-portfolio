/**
 * pose.js — the shared vocabulary between every animation clip and the rig.
 *
 * A pose is a flat bag of numbers. Clips write into a scratch pose, the mixer
 * blends two scratch poses into one, and the rig applies it. No allocation
 * happens after start-up, which matters when a mid-range phone is already
 * paying for a data centre corridor.
 */

export const JOINTS = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'elbowL', 'wristL',
  'shoulderR', 'elbowR', 'wristR',
  'thighL', 'kneeL', 'ankleL',
  'thighR', 'kneeR', 'ankleR',
];

/** Scalars that live outside the joint hierarchy. */
export const SCALARS = ['bobY', 'sway', 'lean', 'breath'];

export function createPose() {
  const p = { j: {} };
  for (const name of JOINTS) p.j[name] = { x: 0, y: 0, z: 0 };
  for (const s of SCALARS) p[s] = 0;
  return p;
}

export function resetPose(p) {
  for (const name of JOINTS) {
    const j = p.j[name];
    j.x = j.y = j.z = 0;
  }
  for (const s of SCALARS) p[s] = 0;
  return p;
}

export function copyPose(src, dst) {
  for (const name of JOINTS) {
    const a = src.j[name];
    const b = dst.j[name];
    b.x = a.x; b.y = a.y; b.z = a.z;
  }
  for (const s of SCALARS) dst[s] = src[s];
  return dst;
}

/** dst = a*(1-t) + b*t */
export function blendPose(a, b, t, dst) {
  const it = 1 - t;
  for (const name of JOINTS) {
    const ja = a.j[name];
    const jb = b.j[name];
    const jd = dst.j[name];
    jd.x = ja.x * it + jb.x * t;
    jd.y = ja.y * it + jb.y * t;
    jd.z = ja.z * it + jb.z * t;
  }
  for (const s of SCALARS) dst[s] = a[s] * it + b[s] * t;
  return dst;
}

/** Applies a pose onto a map of THREE.Object3D joints. */
export function applyPose(pose, bones) {
  for (const name of JOINTS) {
    const bone = bones[name];
    if (!bone) continue;
    const j = pose.j[name];
    bone.rotation.set(j.x, j.y, j.z);
  }
}
