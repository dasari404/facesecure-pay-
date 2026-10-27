/**
 * Face Verification API Wrapper
 * 
 * Wraps @rajeevdesai/face-verification-api for use in FaceSecure Pay
 * 
 * Security Note: This runs in the browser (client-side). Results are NOT tamper-proof.
 * Backend must validate through verification sessions, not trust client-provided match flags.
 */

// Import the library dynamically since we're not using a bundler
let faceAPI = null;
let modelsLoaded = false;
let modelLoadError = null;

/**
 * Initialize the face verification library
 * Loads models once and caches them
 * 
 * @returns {Promise<boolean>} true if successful, false otherwise
 */
async function initializeFaceAPI() {
  if (modelsLoaded) {
    return true;
  }
  
  if (modelLoadError) {
    console.error('Face API previously failed to load:', modelLoadError);
    return false;
  }
  
  try {
    console.log('🔄 Loading face verification library...');
    
    // Import the library
    // Note: This requires the node_modules to be served or a bundler
    // For Live Server without bundler, we'll use a different approach below
    const module = await import('../node_modules/@rajeevdesai/face-verification-api/dist/index.js');
    faceAPI = module;
    
    console.log('📦 Library loaded, initializing models...');
    
    // Load the models
    await faceAPI.loadModels({
      faceLandmarkerPath: '/models/face_landmarker.task',
      recognitionModelPath: '/models/mobilefacenet.onnx',
      livenessModelPath: [
        '/models/minifasnet_v2.onnx',
        '/models/minifasnet_v1se.onnx'
      ],
      liveness: [
        { cropScale: 2.7 },   // MiniFASNetV2
        { cropScale: 4.0 }    // MiniFASNetV1SE
      ],
      warmup: true  // Run dummy inference to avoid first-call latency
    });
    
    modelsLoaded = true;
    console.log('✅ Face verification models loaded successfully');
    
    return true;
  } catch (error) {
    modelLoadError = error;
    console.error('❌ Failed to load face verification API:', error);
    console.error('Stack:', error.stack);
    return false;
  }
}

/**
 * Compare two face images
 * 
 * @param {string|HTMLImageElement|ImageData} baselineImage - Registered face photo
 * @param {string|HTMLImageElement|ImageData} currentImage - Live capture
 * @param {Object} options - Comparison options
 * @param {number} options.threshold - Match threshold (default 0.5, lower = stricter)
 * @param {number} options.livenessThreshold - Liveness threshold (default 0.5)
 * @param {boolean} options.checkLiveness - Whether to run liveness check (default true)
 * @returns {Promise<CompareResult>} Comparison result
 */
async function compareFaceImages(baselineImage, currentImage, options = {}) {
  if (!modelsLoaded) {
    throw new Error('Face verification models not loaded. Call initializeFaceAPI() first.');
  }
  
  if (!faceAPI) {
    throw new Error('Face verification API not available');
  }
  
  try {
    const result = await faceAPI.compareFaces(baselineImage, currentImage, {
      threshold: options.threshold || 0.5,
      livenessThreshold: options.livenessThreshold || 0.5,
      checkLiveness: options.checkLiveness !== undefined ? options.checkLiveness : true
    });
    
    // Log for debugging (remove in production)
    console.log('🔍 Face comparison result:', {
      match: result.match,
      confidence: result.confidence,
      distance: result.details.distance,
      livenessScore: result.details.livenessScore,
      flags: result.flags
    });
    
    return result;
  } catch (error) {
    console.error('❌ Face comparison failed:', error);
    throw error;
  }
}

/**
 * Get human-readable description of fraud flags
 * 
 * @param {string[]} flags - Array of fraud flag strings
 * @returns {string[]} Human-readable descriptions
 */
function describeFraudFlags(flags) {
  const descriptions = {
    'baseline_missing': 'No face detected in registered photo',
    'baseline_ambiguous': 'Multiple faces in registered photo (using largest)',
    'face_missing': 'No face detected in current photo',
    'multiple_faces': 'Multiple faces detected (using best match)',
    'identity_mismatch': 'Face does not match registered photo',
    'low_confidence': 'Match confidence is low (grey zone)',
    'liveness_fail': 'Liveness check failed (possible spoof detected)'
  };
  
  return flags.map(flag => descriptions[flag] || flag);
}

/**
 * Check if face verification is available
 * 
 * @returns {boolean} true if library is loaded and ready
 */
function isFaceAPIReady() {
  return modelsLoaded && faceAPI !== null;
}

/**
 * Get the current model load status
 * 
 * @returns {Object} Status object
 */
function getFaceAPIStatus() {
  return {
    loaded: modelsLoaded,
    error: modelLoadError,
    available: faceAPI !== null
  };
}

// Export functions for use in other modules
window.FaceVerificationAPI = {
  initialize: initializeFaceAPI,
  compare: compareFaceImages,
  isReady: isFaceAPIReady,
  getStatus: getFaceAPIStatus,
  describeFlags: describeFraudFlags
};

console.log('📸 Face Verification API wrapper loaded');
