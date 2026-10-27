import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { LivenessConfig } from './types.js';
import { ResolvedTensorSpec } from './preprocess.js';
/**
 * Passive liveness / anti-spoofing via MiniFASNetV2 (Silent-Face), with
 * configurable preprocessing and class index for bring-your-own models.
 *
 * Crops an expanded region around the face, runs the anti-spoofing model, and
 * returns a single liveness probability in [0, 1].
 *
 * LIMITATIONS (see README → Open Risks):
 *   - Screen/video replay is reliably rejected (scores the replay class).
 *   - PRINT attacks are detected UNRELIABLY: a print can leak into the live
 *     class and false-accept. Mitigation: add MiniFASNetV1SE (4.0 crop) and
 *     ensemble, as upstream minivision does. Tracked as an Open Risk.
 */
import * as ort from 'onnxruntime-web';
export interface ResolvedLivenessConfig extends ResolvedTensorSpec {
    cropScale: number;
    liveClassIndex: number;
    applySoftmax: boolean;
}
/**
 * Defaults for the bundled MiniFASNetV2 (garciafido export).
 *
 * NOTE: this export expects raw [0,255] BGR (mean 0, std 1), NOT the [0,1] that
 * the minivision ToTensor pipeline produces — at [0,1] it is degenerate,
 * collapsing every input to one class. Live is index 1 (minivision convention:
 * label 1 = real); index 2 is screen/video replay.
 */
export declare const LIVENESS_DEFAULTS: ResolvedLivenessConfig;
/** Merge a user LivenessConfig over the defaults. */
export declare function resolveLivenessConfig(c?: LivenessConfig): ResolvedLivenessConfig;
/**
 * Silent-Face crop: an expanded square bounding box around the face landmarks,
 * resized to inputSize². The model needs context beyond the tight face region
 * to detect texture/reflection artifacts; scale 2.7 matches MiniFASNetV2 training.
 */
export declare function cropForLiveness(source: ImageData, landmarks: NormalizedLandmark[], scale?: number, inputSize?: number): ImageData;
/**
 * Run the liveness model on a crop and return the live-class probability.
 *
 * Output is softmaxed (unless cfg.applySoftmax is false) and cfg.liveClassIndex
 * is returned. See LIVENESS_DEFAULTS for the bundled model's class mapping.
 */
export declare function scoreLiveness(session: ort.InferenceSession, crop: ImageData, cfg?: ResolvedLivenessConfig): Promise<number>;
