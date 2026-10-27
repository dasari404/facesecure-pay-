import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { ModelConfig } from './types.js';
import { ResolvedRecognitionConfig } from './embed.js';
import { ResolvedLivenessConfig } from './liveness.js';
import * as ort from 'onnxruntime-web';
/**
 * Load (or reuse) the models: FaceLandmarker, recognition, and any liveness models.
 *
 * Omit livenessModelPath to disable liveness; pass an array to ensemble. Must be
 * called before compareFaces(). Safe to call multiple times — subsequent calls are
 * no-ops if models are already loaded.
 *
 * Common failure: onnxruntime-web cannot find its .wasm blobs.
 * Set wasmBasePath to wherever ort .wasm files are served, or rely on the CDN default.
 */
export declare function loadModels(config?: ModelConfig): Promise<void>;
export declare function getModels(): {
    faceLandmarker: FaceLandmarker;
    session: ort.InferenceSession;
    livenessSessions: ort.InferenceSession[];
    recognitionConfig: ResolvedRecognitionConfig;
    livenessConfigs: ResolvedLivenessConfig[];
};
/** Reset singletons (useful in tests). */
export declare function _resetModels(): void;
