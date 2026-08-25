import * as THREE from 'three';

/**
 * Shared scratch objects.
 *
 * Scene updates run one at a time inside a single frame, so a handful of
 * module-level temporaries is safe and keeps the garbage collector out of the
 * frame budget — which is the difference between smooth and nearly smooth on a
 * mid-range phone rendering a data centre corridor.
 */
export const M4 = new THREE.Matrix4();
export const M4b = new THREE.Matrix4();
export const Q = new THREE.Quaternion();
export const E = new THREE.Euler();
export const V = new THREE.Vector3();
export const V2 = new THREE.Vector3();
export const V3 = new THREE.Vector3();
export const S = new THREE.Vector3(1, 1, 1);
export const COL = new THREE.Color();
export const COLb = new THREE.Color();
