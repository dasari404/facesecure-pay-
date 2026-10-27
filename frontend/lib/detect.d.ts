import { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
export interface DetectedFace {
    /** Normalized [0,1] landmarks. 468 or 478 points depending on model variant. */
    landmarks: NormalizedLandmark[];
    /** Bounding box area in normalized units (for picking largest face). */
    boundingBoxArea: number;
}
/** Run FaceLandmarker and return all detected faces sorted largest-first. */
export declare function detectFaces(faceLandmarker: FaceLandmarker, imageData: ImageData): DetectedFace[];
