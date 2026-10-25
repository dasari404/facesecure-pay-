// Report Fraud Form Handling

// Submit fraud report
document.getElementById('public-report-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        
        const formData = {
            reportType: document.getElementById('report-type').value,
            subject: document.getElementById('report-subject').value,
            description: document.getElementById('report-description').value,
            reporterEmail: document.getElementById('reporter-email').value || null,
            reporterName: document.getElementById('reporter-name').value || null,
            transactionId: document.getElementById('transaction-id').value || null
        };
        
        const response = await apiCall(API.REPORT_SUBMIT, {
            method: 'POST',
            body: formData
        });
        
        if (response.success) {
            // Show success message with reference number
            showSuccessModal(response.referenceNumber, response.estimatedResponse);
            
            // Reset form
            e.target.reset();
        }
        
    } catch (error) {
        showErrorAlert(error.message || 'Failed to submit report. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

// Check report status
document.getElementById('check-status-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    const referenceInput = document.getElementById('reference-number');
    const reference = referenceInput.value.trim().toUpperCase();
    
    if (!reference.startsWith('FS')) {
        showErrorAlert('Invalid reference number format. Reference numbers start with "FS"');
        return;
    }
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Checking...';
        
        const response = await apiCall(API.REPORT_STATUS(reference));
        
        if (response.success) {
            showStatusModal(response.report);
        }
        
    } catch (error) {
        if (error.message.includes('not found')) {
            showErrorAlert('Report not found. Please check your reference number.');
        } else {
            showErrorAlert(error.message || 'Failed to check status. Please try again.');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

// Show success modal with reference number
function showSuccessModal(referenceNumber, estimatedResponse) {
    const modal = document.createElement('div');
    modal.className = 'report-modal';
    modal.innerHTML = `
        <div class="report-modal-content">
            <div class="report-modal-header">
                <div class="success-icon">✓</div>
                <h3>Report Submitted Successfully</h3>
            </div>
            <div class="report-modal-body">
                <p>Your report has been received and assigned a reference number:</p>
                <div class="reference-number-display">
                    <code>${referenceNumber}</code>
                    <button onclick="copyToClipboard('${referenceNumber}')" class="copy-btn">
                        Copy
                    </button>
                </div>
                <p class="text-secondary">
                    <strong>Estimated Response Time:</strong> ${estimatedResponse}
                </p>
                <p class="text-secondary">
                    Please save this reference number. You can use it to check the status of your report.
                </p>
            </div>
            <div class="report-modal-footer">
                <button onclick="this.closest('.report-modal').remove()" class="btn-primary">
                    Got it
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Show status modal
function showStatusModal(report) {
    const modal = document.createElement('div');
    modal.className = 'report-modal';
    
    const statusIcons = {
        'submitted': '📝',
        'under_review': '👀',
        'investigating': '🔍',
        'resolved': '✅',
        'closed': '🔒'
    };
    
    const statusColors = {
        'submitted': '#6366f1',
        'under_review': '#f59e0b',
        'investigating': '#3b82f6',
        'resolved': '#10b981',
        'closed': '#6b7280'
    };
    
    const timelineHTML = report.timeline?.map(update => `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <div class="timeline-status">${update.status}</div>
                ${update.update_note ? `<p class="timeline-note">${update.update_note}</p>` : ''}
                <div class="timeline-date">${formatDate(update.created_at)}</div>
            </div>
        </div>
    `).join('') || '';
    
    modal.innerHTML = `
        <div class="report-modal-content report-status-modal">
            <div class="report-modal-header">
                <h3>Report Status</h3>
                <button onclick="this.closest('.report-modal').remove()" class="close-btn">&times;</button>
            </div>
            <div class="report-modal-body">
                <div class="status-overview">
                    <div class="status-badge" style="background: ${statusColors[report.status]}20; color: ${statusColors[report.status]}">
                        <span class="status-icon">${statusIcons[report.status]}</span>
                        <span>${report.statusLabel}</span>
                    </div>
                    <div class="reference-display">
                        <span class="text-secondary">Reference:</span>
                        <code>${report.referenceNumber}</code>
                    </div>
                </div>
                
                <div class="status-details">
                    <div class="detail-row">
                        <span>Type:</span>
                        <span>${formatReportType(report.type)}</span>
                    </div>
                    <div class="detail-row">
                        <span>Subject:</span>
                        <span>${report.subject}</span>
                    </div>
                    <div class="detail-row">
                        <span>Priority:</span>
                        <span class="priority-badge priority-${report.priority}">${report.priority.toUpperCase()}</span>
                    </div>
                    <div class="detail-row">
                        <span>Submitted:</span>
                        <span>${formatDate(report.submittedAt)}</span>
                    </div>
                    <div class="detail-row">
                        <span>Last Updated:</span>
                        <span>${formatDate(report.lastUpdated)}</span>
                    </div>
                    ${report.resolvedAt ? `
                    <div class="detail-row">
                        <span>Resolved:</span>
                        <span>${formatDate(report.resolvedAt)}</span>
                    </div>
                    ` : ''}
                </div>
                
                ${report.resolution ? `
                <div class="resolution-section">
                    <h4>Resolution</h4>
                    <p>${report.resolution}</p>
                </div>
                ` : ''}
                
                ${timelineHTML ? `
                <div class="timeline-section">
                    <h4>Timeline</h4>
                    <div class="timeline">
                        ${timelineHTML}
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Helper functions
function showErrorAlert(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-error';
    alert.innerHTML = `
        <span>❌ ${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    document.body.appendChild(alert);
    
    setTimeout(() => alert.remove(), 5000);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatReportType(type) {
    return type.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// Add CSS for modals and alerts
const style = document.createElement('style');
style.textContent = `
    .report-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(11, 16, 32, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    }
    
    .report-modal-content {
        background: var(--bg-secondary);
        border-radius: 12px;
        max-width: 600px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    
    .report-modal-header {
        padding: 24px 24px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        position: relative;
    }
    
    .close-btn {
        position: absolute;
        top: 16px;
        right: 16px;
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 28px;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s;
    }
    
    .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text-primary);
    }
    
    .success-icon {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--success), #059669);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        font-weight: bold;
    }
    
    .report-modal-header h3 {
        margin: 0;
        font-size: 20px;
        color: var(--text-primary);
    }
    
    .report-modal-body {
        padding: 24px;
    }
    
    .reference-number-display {
        background: rgba(99, 102, 241, 0.1);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 8px;
        padding: 16px;
        margin: 16px 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    
    .reference-number-display code {
        font-size: 18px;
        font-weight: 600;
        color: var(--accent-primary);
        font-family: 'Courier New', monospace;
        letter-spacing: 1px;
    }
    
    .copy-btn {
        padding: 8px 16px;
        background: var(--accent-primary);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        white-space: nowrap;
    }
    
    .copy-btn:hover {
        background: var(--accent-secondary);
        transform: scale(1.05);
    }
    
    .report-modal-footer {
        padding: 16px 24px 24px;
        display: flex;
        justify-content: center;
    }
    
    .report-modal-footer .btn-primary {
        padding: 12px 32px;
    }
    
    .status-overview {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 24px;
    }
    
    .status-badge {
        padding: 12px 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        font-size: 16px;
    }
    
    .status-icon {
        font-size: 20px;
    }
    
    .reference-display {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
    }
    
    .reference-display code {
        color: var(--accent-primary);
        font-weight: 600;
    }
    
    .status-details {
        background: rgba(255, 255, 255, 0.02);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
    }
    
    .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .detail-row:last-child {
        border-bottom: none;
    }
    
    .detail-row span:first-child {
        color: var(--text-secondary);
        font-size: 14px;
    }
    
    .detail-row span:last-child {
        color: var(--text-primary);
        font-weight: 500;
    }
    
    .priority-badge {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .priority-low { background: rgba(107, 114, 128, 0.2); color: #9ca3af; }
    .priority-medium { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
    .priority-high { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .priority-critical { background: rgba(220, 38, 38, 0.2); color: #dc2626; }
    
    .resolution-section, .timeline-section {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .resolution-section h4, .timeline-section h4 {
        margin: 0 0 12px 0;
        font-size: 16px;
        color: var(--text-primary);
    }
    
    .resolution-section p {
        color: var(--text-secondary);
        line-height: 1.6;
    }
    
    .timeline {
        position: relative;
        padding-left: 24px;
    }
    
    .timeline::before {
        content: '';
        position: absolute;
        left: 6px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: rgba(255, 255, 255, 0.1);
    }
    
    .timeline-item {
        position: relative;
        padding-bottom: 20px;
    }
    
    .timeline-item:last-child {
        padding-bottom: 0;
    }
    
    .timeline-dot {
        position: absolute;
        left: -24px;
        top: 4px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--accent-primary);
        border: 3px solid var(--bg-secondary);
    }
    
    .timeline-content {
        background: rgba(255, 255, 255, 0.02);
        padding: 12px;
        border-radius: 8px;
    }
    
    .timeline-status {
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 4px;
    }
    
    .timeline-note {
        color: var(--text-secondary);
        font-size: 14px;
        margin: 4px 0;
    }
    
    .timeline-date {
        color: var(--text-tertiary);
        font-size: 12px;
        margin-top: 4px;
    }
    
    .alert {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 20px;
        border-radius: 8px;
        background: var(--bg-secondary);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: var(--text-primary);
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 10001;
        animation: slideIn 0.3s ease-out;
    }
    
    .alert button {
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
