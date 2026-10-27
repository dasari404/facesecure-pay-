const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');

// Configure multer for memory storage (store in RAM, then save to database)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Register/Update face photo
router.post('/register', verifyToken, (req, res, next) => {
  console.log('🔍 [Face Register] Auth passed, user:', req.user?.id);
  next();
}, upload.single('facePhoto'), (err, req, res, next) => {
  // Multer error handler
  if (err) {
    console.error('❌ [Face Register] Multer error:', err.message);
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload failed'
    });
  }
  next();
}, async (req, res) => {
  try {
    console.log('📸 [Face Register] Handler reached');
    console.log('   File:', req.file ? `YES (${req.file.size} bytes)` : 'NO');
    console.log('   Body keys:', Object.keys(req.body));
    console.log('   Face descriptor:', req.body.faceDescriptor ? 'YES' : 'NO');
    
    if (!req.file) {
      console.warn('⚠️ [Face Register] No file in request');
      return res.status(400).json({
        success: false,
        message: 'No face photo provided'
      });
    }

    const userId = req.user.id;
    const facePhoto = req.file.buffer;
    const photoFormat = req.file.mimetype.split('/')[1]; // jpeg, png, etc.
    const photoSize = req.file.size;
    
    console.log(`💾 [Face Register] Saving for user ${userId}, format: ${photoFormat}, size: ${photoSize}`);
    
    // Get face descriptor from request body (optional, sent from frontend)
    const faceDescriptor = req.body.faceDescriptor ? JSON.stringify(JSON.parse(req.body.faceDescriptor)) : null;

    // Check if user already has a face registration
    const [existing] = await db.query(
      'SELECT id FROM face_registrations WHERE user_id = ?',
      [userId]
    );

    if (existing.length > 0) {
      console.log(`🔄 [Face Register] Updating existing registration for user ${userId}`);
      // Update existing registration
      await db.query(`
        UPDATE face_registrations 
        SET face_photo = ?,
            photo_format = ?,
            photo_size = ?,
            photo_uploaded_at = NOW(),
            face_descriptor = ?,
            is_active = TRUE
        WHERE user_id = ?
      `, [facePhoto, photoFormat, photoSize, faceDescriptor, userId]);

      // Update user's face_registered flag
      await db.query(
        'UPDATE users SET face_registered = TRUE WHERE id = ?',
        [userId]
      );

      console.log(`✅ [Face Register] Updated successfully for user ${userId}`);
      return res.json({
        success: true,
        message: 'Face photo updated successfully',
        photoSize: photoSize,
        photoFormat: photoFormat,
        hasDescriptor: !!faceDescriptor
      });
    } else {
      console.log(`➕ [Face Register] Creating new registration for user ${userId}`);
      // Create new registration
      await db.query(`
        INSERT INTO face_registrations 
        (user_id, face_encoding, face_photo, photo_format, photo_size, photo_uploaded_at, face_descriptor, is_active)
        VALUES (?, 'stored_as_photo', ?, ?, ?, NOW(), ?, TRUE)
      `, [userId, facePhoto, photoFormat, photoSize, faceDescriptor]);

      // Update user's face_registered flag
      await db.query(
        'UPDATE users SET face_registered = TRUE WHERE id = ?',
        [userId]
      );

      console.log(`✅ [Face Register] Created successfully for user ${userId}`);
      return res.json({
        success: true,
        message: 'Face photo registered successfully',
        photoSize: photoSize,
        photoFormat: photoFormat,
        hasDescriptor: !!faceDescriptor
      });
    }
  } catch (error) {
    console.error('❌ [Face Register] Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register face photo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get face photo (for verification comparison)
router.get('/photo/:userId', verifyToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    // Only allow users to view their own photo or recipient's photo during transaction
    // For now, allow authenticated users to view (add more restrictions as needed)

    const [registrations] = await db.query(
      'SELECT face_photo, photo_format FROM face_registrations WHERE user_id = ? AND is_active = TRUE',
      [userId]
    );

    if (registrations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No face photo registered for this user'
      });
    }

    const { face_photo, photo_format } = registrations[0];

    // Set appropriate content type
    res.set('Content-Type', `image/${photo_format}`);
    res.send(face_photo);
  } catch (error) {
    console.error('Face photo retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve face photo'
    });
  }
});

// Check if user has registered face
router.get('/status', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [registrations] = await db.query(
      'SELECT id, photo_format, photo_size, photo_uploaded_at, is_active FROM face_registrations WHERE user_id = ? AND is_active = TRUE',
      [userId]
    );

    res.json({
      success: true,
      hasRegisteredFace: registrations.length > 0,
      registration: registrations.length > 0 ? {
        format: registrations[0].photo_format,
        size: registrations[0].photo_size,
        uploadedAt: registrations[0].photo_uploaded_at
      } : null
    });
  } catch (error) {
    console.error('Face status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check face registration status'
    });
  }
});

// Get registered face photo as base64 (for client-side verification)
router.get('/get-registered', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [registrations] = await db.query(
      'SELECT face_photo, photo_format FROM face_registrations WHERE user_id = ? AND is_active = TRUE',
      [userId]
    );

    if (registrations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No face photo registered. Please register your face first.'
      });
    }

    const { face_photo, photo_format } = registrations[0];

    // Convert Buffer to base64 data URL
    const base64Photo = face_photo.toString('base64');
    const dataURL = `data:image/${photo_format};base64,${base64Photo}`;

    res.json({
      success: true,
      facePhoto: dataURL,
      format: photo_format
    });
  } catch (error) {
    console.error('Get registered face error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve registered face'
    });
  }
});

module.exports = router;
