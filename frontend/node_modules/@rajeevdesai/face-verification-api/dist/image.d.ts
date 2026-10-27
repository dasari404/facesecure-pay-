/**
 * Image input handling. Normalizes the accepted input types into ImageData and
 * bridges ImageData back to a canvas for MediaPipe.
 * Browser-only: relies on createImageBitmap / OffscreenCanvas.
 */
/**
 * Reject string inputs with an unexpected URL scheme before fetching. A string
 * with no scheme is a relative/same-origin path and is allowed. Defense-in-depth:
 * callers should still only pass image sources they trust — toImageData will
 * fetch whatever URL it is given (with the page's credentials for same-origin).
 */
export declare function assertSafeImageSource(input: string): void;
/**
 * Normalize any supported input type to ImageData.
 *
 * Supported: HTMLImageElement, ImageData, data: URLs, blob: URLs,
 * same-origin URLs, and CORS-enabled cross-origin URLs.
 * Cross-origin non-CORS URLs will fail; use data-URL, blob:, or same-origin paths.
 *
 * String inputs are fetched, so pass only sources you trust (see assertSafeImageSource).
 */
export declare function toImageData(input: HTMLImageElement | ImageData | string): Promise<ImageData>;
/** Draw ImageData onto a visible HTMLCanvasElement (for passing to MediaPipe). */
export declare function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement;
