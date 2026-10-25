const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { body, validationResult } = require('express-validator');
const { verifyToken, verifyAdmin, optionalAuth } = require('../middleware/auth');

// Generate unique reference number
function generateReferenceNumber() {
  const prefix = 'FS';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

// Submit a report (public endpoint - no auth required)
router.post('/submit', [
  body('reportType').isIn(['fraud', 'suspicious_activity', 'unauthorized_transaction', 'account_issue', 'technical', 'other']),
  body('subject').trim().isLength({ min: 5, max: 200 }),
  body('description').trim().isLength({ min: 20, max: 5000 }),
  body('reporterEmail').optional().isEmail(),
  body('reporterName').optional().trim().isLength({ min: 2, max: 100 }),
  body('transactionId').optional().trim().isLength({ max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }
    
    const { 
      reportType, 
      subject, 
      description, 
      reporterEmail, 
      reporterName,
      transactionId 
    } = req.body;
    
    // Generate unique reference number
    const referenceNumber = generateReferenceNumber();
    
    // Determine priority based on report type
    let priority = 'medium';
    if (reportType === 'fraud' || reportType === 'unauthorized_transaction') {
      priority = 'high';
    } else if (reportType === 'technical') {
      priority = 'low';
    }
    
    // Insert report
    const [result] = await db.query(`
      INSERT INTO user_reports 
      (reference_number, report_type, reporter_email, reporter_name, subject, description, transaction_id, priority, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted')
    `, [
      referenceNumber,
      reportType,
      reporterEmail || null,
      reporterName || 'Anonymous',
      subject,
      description,
      transactionId || null,
      priority
    ]);
    
    // Log initial status
    await db.query(`
      INSERT INTO report_updates (report_id, new_status, update_note)
      VALUES (?, 'submitted', 'Report submitted')
    `, [result.insertId]);
    
    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      referenceNumber,
      reportId: result.insertId,
      estimatedResponse: priority === 'high' ? '24 hours' : '48-72 hours'
    });
    
  } catch (error) {
    console.error('Report submission error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit report' 
    });
  }
});

// Check report status (public endpoint with reference number)
router.get('/status/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    
    if (!reference || !reference.startsWith('FS')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid reference number format' 
      });
    }
    
    const [reports] = await db.query(`
      SELECT 
        reference_number,
        report_type,
        subject,
        status,
        priority,
        created_at,
        updated_at,
        resolved_at,
        resolution_notes
      FROM user_reports
      WHERE reference_number = ?
    `, [reference]);
    
    if (reports.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Report not found' 
      });
    }
    
    const report = reports[0];
    
    // Get status history
    const [updates] = await db.query(`
      SELECT 
        new_status as status,
        update_note,
        created_at
      FROM report_updates
      WHERE report_id = (SELECT id FROM user_reports WHERE reference_number = ?)
      ORDER BY created_at ASC
    `, [reference]);
    
    // Format status for public
    const statusMap = {
      'submitted': 'Submitted - Awaiting review',
      'under_review': 'Under Review - Being evaluated by our team',
      'investigating': 'Under Investigation - Actively working on your case',
      'resolved': 'Resolved - Your case has been resolved',
      'closed': 'Closed - Case closed'
    };
    
    res.json({
      success: true,
      report: {
        referenceNumber: report.reference_number,
        type: report.report_type,
        subject: report.subject,
        status: report.status,
        statusLabel: statusMap[report.status] || report.status,
        priority: report.priority,
        submittedAt: report.created_at,
        lastUpdated: report.updated_at,
        resolvedAt: report.resolved_at,
        resolution: report.resolution_notes,
        timeline: updates
      }
    });
    
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check status' 
    });
  }
});

// Get all reports (admin only)
router.get('/admin/all', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const priority = req.query.priority;
    const type = req.query.type;
    
    let whereConditions = [];
    let params = [];
    
    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }
    if (priority) {
      whereConditions.push('priority = ?');
      params.push(priority);
    }
    if (type) {
      whereConditions.push('report_type = ?');
      params.push(type);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM user_reports ${whereClause}`,
      params
    );
    
    // Get reports
    const [reports] = await db.query(`
      SELECT 
        ur.*,
        a.username as assigned_to_username
      FROM user_reports ur
      LEFT JOIN admins a ON ur.assigned_to = a.id
      ${whereClause}
      ORDER BY 
        FIELD(priority, 'critical', 'high', 'medium', 'low'),
        created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    
    res.json({
      success: true,
      reports,
      pagination: {
        page,
        limit,
        total: parseInt(total),
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Fetch reports error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch reports' 
    });
  }
});

// Get report statistics (admin only)
router.get('/admin/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    // Total reports
    const [[{ total_reports }]] = await db.query(
      'SELECT COUNT(*) as total_reports FROM user_reports'
    );
    
    // By status
    const [byStatus] = await db.query(`
      SELECT status, COUNT(*) as count
      FROM user_reports
      GROUP BY status
    `);
    
    // By priority
    const [byPriority] = await db.query(`
      SELECT priority, COUNT(*) as count
      FROM user_reports
      GROUP BY priority
    `);
    
    // By type
    const [byType] = await db.query(`
      SELECT report_type, COUNT(*) as count
      FROM user_reports
      GROUP BY report_type
    `);
    
    // Pending/Open reports
    const [[{ open_reports }]] = await db.query(`
      SELECT COUNT(*) as open_reports 
      FROM user_reports 
      WHERE status IN ('submitted', 'under_review', 'investigating')
    `);
    
    // Average resolution time (in hours)
    const [[{ avg_resolution_hours }]] = await db.query(`
      SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as avg_resolution_hours
      FROM user_reports
      WHERE status = 'resolved' AND resolved_at IS NOT NULL
    `);
    
    res.json({
      success: true,
      stats: {
        total: parseInt(total_reports),
        open: parseInt(open_reports),
        avgResolutionHours: parseFloat(avg_resolution_hours) || 0,
        byStatus: byStatus.reduce((acc, item) => {
          acc[item.status] = parseInt(item.count);
          return acc;
        }, {}),
        byPriority: byPriority.reduce((acc, item) => {
          acc[item.priority] = parseInt(item.count);
          return acc;
        }, {}),
        byType: byType.reduce((acc, item) => {
          acc[item.report_type] = parseInt(item.count);
          return acc;
        }, {})
      }
    });
    
  } catch (error) {
    console.error('Report stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch report statistics' 
    });
  }
});

// Update report status (admin only)
router.patch('/admin/:id/status', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    if (!status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status required' 
      });
    }
    
    const validStatuses = ['submitted', 'under_review', 'investigating', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status' 
      });
    }
    
    // Get current report
    const [reports] = await db.query('SELECT * FROM user_reports WHERE id = ?', [id]);
    if (reports.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Report not found' 
      });
    }
    
    const report = reports[0];
    
    // Update report
    const updates = {
      status,
      ...(notes && { admin_notes: notes }),
      ...(status === 'resolved' && { resolved_at: new Date() })
    };
    
    await db.query(
      'UPDATE user_reports SET ? WHERE id = ?',
      [updates, id]
    );
    
    // Log status change
    await db.query(`
      INSERT INTO report_updates (report_id, old_status, new_status, update_note, updated_by)
      VALUES (?, ?, ?, ?, ?)
    `, [id, report.status, status, notes || `Status changed to ${status}`, req.user.id]);
    
    res.json({
      success: true,
      message: 'Report status updated'
    });
    
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update report status' 
    });
  }
});

// Assign report to admin (admin only)
router.patch('/admin/:id/assign', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;
    
    await db.query(
      'UPDATE user_reports SET assigned_to = ? WHERE id = ?',
      [adminId || req.user.id, id]
    );
    
    res.json({
      success: true,
      message: 'Report assigned successfully'
    });
    
  } catch (error) {
    console.error('Assign report error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to assign report' 
    });
  }
});

module.exports = router;
