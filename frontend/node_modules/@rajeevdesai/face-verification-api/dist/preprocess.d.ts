import { TensorLayout, ChannelOrder } from './types.js';
/** Fully-resolved (no optional fields) preprocessing spec. */
export interface ResolvedTensorSpec {
    inputSize: number;
    layout: TensorLayout;
    channelOrder: ChannelOrder;
    mean: [number, number, number];
    std: [number, number, number];
}
/** onnxruntime Tensor dims for a square input of the given layout. */
export declare function tensorDims(layout: TensorLayout, size: number): number[];
/** Expand a scalar mean/std to a per-channel triplet. */
export declare function triplet(v: number | [number, number, number]): [number, number, number];
/**
 * Guard against an absurd inputSize that would allocate a huge tensor
 * (3 × size² floats). Throws at config-resolution time, before any allocation.
 */
export declare function validateInputSize(n: number): number;
/**
 * Convert an RGBA ImageData (already sized to spec.inputSize²) into a Float32
 * input tensor.
 *
 * Per output channel position p: value = (pixel - mean[p]) / std[p], where the
 * source byte for p is chosen by channelOrder (RGB → R,G,B; BGR → B,G,R), and
 * element placement follows layout (NCHW vs NHWC). mean/std are indexed by the
 * output channel position, i.e. they follow channelOrder.
 */
export declare function buildInputTensor(img: ImageData, spec: ResolvedTensorSpec): Float32Array;
