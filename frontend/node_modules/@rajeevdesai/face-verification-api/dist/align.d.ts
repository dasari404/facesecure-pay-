import { NormalizedLandmark } from '@mediapipe/tasks-vision';
/** ArcFace standard destination template (112×112). Order: [left_eye, right_eye, nose, left_mouth, right_mouth]. */
export declare const ARCFACE_DST: [number, number][];
/**
 * Extract 5 ArcFace keypoints from MediaPipe FaceLandmarker output.
 *
 * Returns pixel-space coords [left_eye, right_eye, nose, left_mouth, right_mouth].
 * Landmarks are normalized [0,1]; multiply by image dimensions here.
 *
 * Iris indices (478-landmark model): 468 = left iris center, 473 = right iris center.
 * Eye-corner fallback (468-landmark model): left eye 33/133, right eye 263/362.
 * Indices 1, 61, 291 are stable across both model variants.
 *
 * Verified 2026-06-02 against the float16 face_landmarker.task: detect emits 478
 * landmarks, and these five points fit ARCFACE_DST at ~1-2px RMS — i.e. the
 * image-side pairing is correct, with no left/right swap. (468 lands at image-left,
 * matching ARCFACE_DST[0]; 473 at image-right.)
 */
export declare function extractFivePoints(landmarks: NormalizedLandmark[], imageWidth: number, imageHeight: number): [number, number][];
/**
 * Umeyama similarity transform: least-squares rotation + uniform scale + translation.
 * Maps src → dst.
 *
 * Returns affine coefficients [a, b, tx, d, e, ty] where:
 *   x' = a*x + b*y + tx
 *   y' = d*x + e*y + ty
 */
export declare function umeyama(src: [number, number][], dst: [number, number][]): [number, number, number, number, number, number];
/**
 * Warp source face into an aligned square crop using the Umeyama affine transform.
 * Browser-only (requires OffscreenCanvas).
 *
 * The ArcFace template is defined at 112×112; for a different outputSize it is
 * scaled uniformly, so recognition models with other input sizes (e.g. 160)
 * still receive a correctly-aligned crop.
 *
 * @param source - Full source image
 * @param fivePoints - Pixel-space [left_eye, right_eye, nose, left_mouth, right_mouth]
 * @param outputSize - Square output side in pixels (default 112)
 * @returns outputSize×outputSize ImageData of the aligned face crop
 */
export declare function warpFace(source: ImageData, fivePoints: [number, number][], outputSize?: number): ImageData;
