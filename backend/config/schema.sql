-- FaceSecure Pay Database Schema

-- Drop existing tables if they exist
DROP TABLE IF EXISTS report_updates;
DROP TABLE IF EXISTS user_reports;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS face_registrations;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admins;

-- Admins table
CREATE TABLE admins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(100),
  role ENUM('admin', 'super_admin') DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users table
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  balance DECIMAL(12, 2) DEFAULT 0.00,
  is_verified BOOLEAN DEFAULT FALSE,
  face_registered BOOLEAN DEFAULT FALSE,
  kyc_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  account_status ENUM('active', 'suspended', 'blocked') DEFAULT 'active',
  fraud_score INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  INDEX idx_email (email),
  INDEX idx_account_status (account_status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Face registrations table
CREATE TABLE face_registrations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  face_encoding TEXT NOT NULL,
  liveness_score DECIMAL(5, 2),
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_verified TIMESTAMP NULL,
  verification_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transactions table
CREATE TABLE transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  transaction_id VARCHAR(50) UNIQUE NOT NULL,
  sender_id INT NOT NULL,
  recipient_id INT,
  recipient_email VARCHAR(100) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  transaction_type ENUM('send', 'receive', 'add_money', 'withdraw', 'personal', 'business', 'bill') NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
  face_verified BOOLEAN DEFAULT FALSE,
  liveness_verified BOOLEAN DEFAULT FALSE,
  verification_time DECIMAL(5, 2),
  fraud_check_passed BOOLEAN DEFAULT TRUE,
  fraud_score INT DEFAULT 0,
  fraud_check_result VARCHAR(20),
  description TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_transaction_id (transaction_id),
  INDEX idx_sender_id (sender_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User reports table (fraud/issue reports submitted by public/users)
CREATE TABLE user_reports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  reference_number VARCHAR(20) UNIQUE NOT NULL,
  report_type ENUM('fraud', 'suspicious_activity', 'unauthorized_transaction', 'account_issue', 'technical', 'other') NOT NULL,
  reporter_email VARCHAR(100),
  reporter_name VARCHAR(100),
  subject VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  transaction_id VARCHAR(50),
  evidence_urls JSON,
  status ENUM('submitted', 'under_review', 'investigating', 'resolved', 'closed') DEFAULT 'submitted',
  priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  assigned_to INT,
  admin_notes TEXT,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  FOREIGN KEY (assigned_to) REFERENCES admins(id) ON DELETE SET NULL,
  INDEX idx_reference_number (reference_number),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_created_at (created_at),
  INDEX idx_reporter_email (reporter_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Report updates table (status change history)
CREATE TABLE report_updates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  report_id INT NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  update_note TEXT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES user_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL,
  INDEX idx_report_id (report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin account
-- Password: admin123 (bcrypt hash)
INSERT INTO admins (username, password_hash, email, full_name, role) 
VALUES ('admin', '$2a$10$XQZ9u.QJ9vK3LQk.8xHvYuF3xYyW4R5yqF8hN9kQ2mE7pL3zC8K2e', 'admin@facesecure.com', 'System Administrator', 'super_admin');
