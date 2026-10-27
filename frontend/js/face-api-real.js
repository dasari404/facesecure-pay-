/**
 * Real Face Verification Integration
 * Uses @rajeevdesai/face-verification-api for actual face comparison
 * 
 * SECURITY NOTE: This verification runs CLIENT-SIDE in the browser.
 * Browser-provided scores are NOT tamper-proof. The backend must validate:
 * - JWT authentication
 * - Verification session expiration (2 min)
 * - User has face registration
 * - Fraud screening results
 * - Dual verification flow (sender + recipient)
 */

import { loadModels, compareFaces } from './face-api-bundle.js';

// Global state
let modelsLoaded = false;
let modelsLoadingPromise = null;

/**
 * Initialize face verification models (call once on page load)
 * Models are ~7.67 MB total, loaded from /models/ directory
 */
export async function initializeFaceVerification() {
  if (modelsLoaded) {
    console.log('✅ Face verification models already loaded');
    return true;
  }
  
  if (modelsLoadingPromise) {
    console.log('⏳ Models already loading, waiting...');
    return modelsLoadingPromise;
  }
  
  console.log('🔄 Loading face verification models...');
  
  modelsLoadingPromise = (async () => {
    try {
      await loadModels({
        faceLandmarkerPath: '/models/face_landmarker.task',
        recognitionModelPath: '/models/mobilefacenet.onnx',
        livenessModelPath: [
          '/models/minifasnet_v2.onnx',
          '/models/minifasnet_v1se.onnx'
        ],
        liveness: [
          { cropScale: 2.7 },
          { cropScale: 4.0 }
        ]
      });
      
      modelsLoaded = true;
      console.log('✅ Face verification models loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to load face verification models:', error);
      modelsLoadingPromise = null;
      throw new Error('Failed to initialize face verification: ' + error.message);
    }
  })();
  
  return modelsLoadingPromise;
}

/**
 * Compare two face images using real face verification
 * @param {string} registeredImageData - Base64 data URL of registered face
 * @param {string} currentImageData - Base64 data URL of current frame
 * @param {object} options - Verification options
 * @returns {Promise<object>} Verification result with match, confidence, flags, details
 */
export async function verifyFace(registeredImageData, currentImageData, options = {}) {
  // Ensure models are loaded
  if (!modelsLoaded) {
    await initializeFaceVerification();
  }
  
  const {
    threshold = 0.5,           // Match threshold (0-1)
    livenessThreshold = 0.5,   // Liveness threshold (0-1)
    checkLiveness = true       // Enable liveness detection
  } = options;
  
  try {
    console.log('🔍 Comparing faces with real verification...');
    
    // Convert data URLs to Image objects
    const registeredImage = await loadImageFromDataURL(registeredImageData);
    const currentImage = await loadImageFromDataURL(currentImageData);
    
    // Run face comparison with liveness detection
    const result = await compareFaces(registeredImage, currentImage, {
      threshold,
      livenessThreshold,
      checkLiveness
    });
    
    console.log('✅ Face verification result:', result);
    
    // Result format:
    // {
    //   match: boolean,              // true if faces match above threshold
    //   confidence: number,          // 0-1 confidence score
    //   flags: string[],             // ['baseline_missing', 'face_missing', 'multiple_faces', 'identity_mismatch', 'low_confidence', 'liveness_fail']
    //   details: {
    //     distance: number,          // Face distance metric (lower = more similar)
    //     livenessScore: number      // 0-1 liveness score
    //   }
    // }
    
    return {
      success: true,
      match: result.match,
      confidence: Math.round(result.confidence * 100), // Convert to percentage
      flags: result.flags || [],
      distance: result.details?.distance,
      livenessScore: result.details?.livenessScore ? Math.round(result.details.livenessScore * 100) : null,
      passed: result.match && (!checkLiveness || result.details?.livenessScore >= livenessThreshold)
    };
    
  } catch (error) {
    console.error('❌ Face verification error:', error);
    return {
      success: false,
      error: error.message,
      match: false,
      confidence: 0,
      flags: ['verification_error'],
      passed: false
    };
  }
}

/**
 * Detect face in single image (for registration validation)
 * @param {string} imageData - Base64 data URL
 * @returns {Promise<object>} Detection result
 */
export async function detectFace(imageData) {
  if (!modelsLoaded) {
    await initializeFaceVerification();
  }
  
  try {
    console.log('🔍 Detecting face in image...');
    
    const image = await loadImageFromDataURL(imageData);
    
    // Use compareFaces with same image to check for face presence
    // This will return flags like 'face_missing', 'multiple_faces', 'baseline_ambiguous'
    const result = await compareFaces(image, image, {
      threshold: 0.5,
      checkLiveness: false
    });
    
    // Analyze flags to determine face presence
    const hasFace = !result.flags.includes('face_missing') && !result.flags.includes('baseline_missing');
    const multipleFaces = result.flags.includes('multiple_faces') || result.flags.includes('baseline_ambiguous');
    
    return {
      success: true,
      hasFace,
      multipleFaces,
      flags: result.flags,
      message: hasFace 
        ? (multipleFaces ? 'Multiple faces detected - please ensure only one face is visible' : 'Face detected successfully')
        : 'No face detected - please center your face in the camera'
    };
    
  } catch (error) {
    console.error('❌ Face detection error:', error);
    return {
      success: false,
      hasFace: false,
      multipleFaces: false,
      flags: ['detection_error'],
      message: 'Face detection failed: ' + error.message
    };
  }
}

/**
 * Helper: Load image from data URL
 * @param {string} dataURL - Base64 data URL
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageFromDataURL(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataURL;
  });
}

/**
 * Check if face verification is available
 * @returns {boolean}
 */
export function isFaceVerificationAvailable() {
  return modelsLoaded;
}

/**
 * Get verification status
 * @returns {object}
 */
export function getVerificationStatus() {
  return {
    modelsLoaded,
    modelsLoading: modelsLoadingPromise !== null && !modelsLoaded,
    available: modelsLoaded
  };
}

console.log('✅ Real face verification module loaded (client-side)');
