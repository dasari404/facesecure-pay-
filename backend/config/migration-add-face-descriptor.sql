-- Add face descriptor column for face-api.js
-- Face descriptors are 128-dimensional vectors used for comparison

ALTER TABLE face_registrations 
ADD COLUMN face_descriptor TEXT DEFAULT NULL
COMMENT 'JSON array of 128 face descriptor values from face-api.js';

-- Update existing records to have empty descriptor
UPDATE face_registrations 
SET face_descriptor = NULL 
WHERE face_descriptor IS NULL;

SELECT 'Migration complete: face_descriptor column added' as status;
