/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
/** Keyboard / button zoom step: geometric, so each press feels the same at any zoom. */
export const ZOOM_STEP = 1.25;
/** Wheel zoom sensitivity per pixel of scroll delta (trackpad pinches send small deltas). */
export const WHEEL_ZOOM_RATE = 0.0022;

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
