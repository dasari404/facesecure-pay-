import { RecognitionConfig, DistanceMetric } from './types.js';
import { ResolvedTensorSpec } from './preprocess.js';
/**
 * Face embedding + similarity. Runs the recognition model on an aligned crop
 * and compares embeddings by the configured distance metric. Preprocessing and
 * metric are configurable to support bring-your-own recognition models.
 */
import * as ort from 'onnxruntime-web';
export interface ResolvedRecognitionConfig extends ResolvedTensorSpec {
    l2normalize: boolean;
    metric: DistanceMetric;
}
/** Defaults for the bundled facex_nano / MobileFaceNet weights. */
export declare const RECOGNITION_DEFAULTS: ResolvedRecognitionConfig;
/** Merge a user RecognitionConfig over the defaults. */
export declare function resolveRecognitionConfig(c?: RecognitionConfig): ResolvedRecognitionConfig;
/** L2-normalize an embedding vector in-place. Returns the same array. */
export declare function l2normalize(v: Float32Array): Float32Array;
/** Cosine distance. Range [0, 2]; 0 = identical. Handles non-normalized inputs. */
export declare function cosineDistance(a: Float32Array, b: Float32Array): number;
/** Euclidean (L2) distance between two embeddings. */
export declare function euclideanDistance(a: Float32Array, b: Float32Array): number;
/** Distance under the configured metric. Lower = more similar. */
export declare function distance(a: Float32Array, b: Float32Array, metric?: DistanceMetric): number;
/**
 * Run the recognition model on an aligned face crop (sized cfg.inputSize²).
 * Returns the embedding, L2-normalized unless cfg.l2normalize is false.
 */
export declare function embed(session: ort.InferenceSession, alignedFace: ImageData, cfg?: ResolvedRecognitionConfig): Promise<Float32Array>;
