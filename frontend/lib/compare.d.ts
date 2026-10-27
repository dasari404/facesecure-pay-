import { CompareOptions, CompareResult } from './types.js';
/**
 * Uncalibrated default threshold (cosine distance).
 *
 * 0.5 is a conservative starting point; tune against your own same/different image set
 * before production use. Lower = stricter. Common ArcFace LFW thresholds: ~0.4–0.5.
 */
export declare const DEFAULT_THRESHOLD = 0.5;
/**
 * Compare two face images and return a structured match result.
 *
 * @param baseline - Reference identity (ID photo, enrollment frame, etc.)
 * @param current  - Image to verify
 */
export declare function compareFaces(baseline: HTMLImageElement | ImageData | string, current: HTMLImageElement | ImageData | string, options?: CompareOptions): Promise<CompareResult>;
