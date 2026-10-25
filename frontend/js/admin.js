// Admin Dashboard JavaScript

// Show specific admin section
function showAdminSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    const section = document.getElementById(sectionId + '-section');
    if (section) {
        section.classList.add('active');
    }
    
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    event.target.classList.add('active');
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear admin auth data from both storage types
        localStorage.removeItem('adminAuthToken');
        localStorage.removeItem('adminData');
        sessionStorage.removeItem('adminAuthToken');
        sessionStorage.removeItem('adminData');
        
        // Redirect to admin login
        window.location.href = 'admin-login.html';
    }
}

// Load real-time statistics from backend
async function loadDashboardStats() {
    try {
        const response = await apiCall(API.ADMIN_STATS, { isAdmin: true });
        
        if (response.success) {
            const { stats } = response;
            
            // Update dashboard stats
            document.getElementById('total-users').textContent = stats.users?.total || 0;
            document.getElementById('active-users').textContent = stats.users?.active || 0;
            document.getElementById('total-transactions').textContent = stats.transactions?.total || 0;
            document.getElementById('today-transactions').textContent = stats.transactions?.today || 0;
            
            // Format transaction volume
            const volume = stats.transactions?.volume || 0;
            document.getElementById('transaction-volume').textContent = 
                `₹${volume.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            
            document.getElementById('pending-reports').textContent = stats.reports?.pending || 0;
            document.getElementById('fraud-alerts').textContent = stats.reports?.fraud_alerts || 0;
        }
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Load user-submitted reports
async function loadUserReports(page = 1, filters = {}) {
    try {
        const queryParams = new URLSearchParams({
            page,
            limit: 20,
            ...filters
        });
        
        const response = await apiCall(
            `${API.ADMIN_REPORTS_ALL}?${queryParams}`,
            { isAdmin: true }
        );
        
        if (response.success) {
            displayUserReports(response.reports, response.pagination);
            await loadReportStats();
        }
        
    } catch (error) {
        console.error('Error loading user reports:', error);
    }
}

// Load report statistics
async function loadReportStats() {
    try {
        const response = await apiCall(API.ADMIN_REPORTS_STATS, { isAdmin: true });
        
        if (response.success) {
            const { stats } = response;
            
            // Update report stats
            document.getElementById('reports-total').textContent = stats.total || 0;
            document.getElementById('reports-pending').textContent = stats.open || 0;
            
            const avgHours = stats.avgResolutionHours || 0;
            if (avgHours < 1) {
                document.getElementById('reports-avg-resolution').textContent = '<1h';
            } else if (avgHours < 24) {
                document.getElementById('reports-avg-resolution').textContent = `${Math.round(avgHours)}h`;
            } else {
                const days = (avgHours / 24).toFixed(1);
                document.getElementById('reports-avg-resolution').textContent = `${days}d`;
            }
        }
        
    } catch (error) {
        console.error('Error loading report stats:', error);
    }
}

// Display user reports in table
function displayUserReports(reports, pagination) {
    const tableBody = document.querySelector('#user-reports-table tbody');
    
    if (!reports || reports.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <span class="empty-icon" style="font-size: 48px;">📭</span>
                    <p>No reports found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = reports.map(report => `
        <tr>
            <td><code>${report.reference_number}</code></td>
            <td>
                <span class="report-type-badge">${formatReportType(report.report_type)}</span>
            </td>
            <td>${report.subject}</td>
            <td><span class="priority-badge priority-${report.priority}">${report.priority}</span></td>
            <td>
                <span class="status-badge status-${report.status}">
                    ${formatStatus(report.status)}
                </span>
            </td>
            <td>${report.reporter_name || 'Anonymous'}</td>
            <td>${formatDate(report.created_at)}</td>
            <td>
                <button class="btn-sm" onclick="viewReportDetails(${report.id})">View</button>
                <button class="btn-sm" onclick="updateReportStatus(${report.id})">Update</button>
            </td>
        </tr>
    `).join('');
    
    // Update pagination
    updateReportPagination(pagination);
}

// Format report type
function formatReportType(type) {
    return type.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// Format status
function formatStatus(status) {
    return status.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric'
    });
}

// Update report pagination
function updateReportPagination(pagination) {
    const paginationDiv = document.getElementById('report-pagination');
    if (!paginationDiv) return;
    
    const { page, totalPages } = pagination;
    
    let html = '';
    
    // Previous button
    if (page > 1) {
        html += `<button onclick="loadUserReports(${page - 1})">← Previous</button>`;
    }
    
    // Page numbers
    html += `<span>Page ${page} of ${totalPages}</span>`;
    
    // Next button
    if (page < totalPages) {
        html += `<button onclick="loadUserReports(${page + 1})">Next →</button>`;
    }
    
    paginationDiv.innerHTML = html;
}

// View report details (placeholder)
function viewReportDetails(reportId) {
    console.log('View report:', reportId);
    alert('Report details view - to be implemented');
}

// Update report status
async function updateReportStatus(reportId) {
    const newStatus = prompt('Enter new status:\n- submitted\n- under_review\n- investigating\n- resolved\n- closed');
    
    if (!newStatus) return;
    
    const validStatuses = ['submitted', 'under_review', 'investigating', 'resolved', 'closed'];
    if (!validStatuses.includes(newStatus)) {
        alert('Invalid status');
        return;
    }
    
    const notes = prompt('Add notes (optional):');
    
    try {
        const response = await apiCall(API.ADMIN_REPORT_UPDATE(reportId), {
            method: 'PATCH',
            body: { status: newStatus, notes },
            isAdmin: true
        });
        
        if (response.success) {
            alert('Report status updated successfully');
            loadUserReports();
        }
        
    } catch (error) {
        alert('Failed to update report status: ' + error.message);
    }
}

// Load recent activity from backend
async function loadRecentActivity() {
    try {
        // TODO: Replace with actual API call
        // const response = await fetch(API_CONFIG.BASE_URL + '/admin/activity');
        // const activities = await response.json();
        
        // For now, show empty state until backend is connected
        console.log('Recent activity will load from backend API');
        
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

// Load system performance metrics from backend
async function loadSystemPerformance() {
    try {
        // TODO: Replace with actual API call
        // const response = await fetch(API_CONFIG.BASE_URL + '/admin/performance');
        // const metrics = await response.json();
        
        // For now, keep at 0% until backend is connected
        console.log('System performance will load from backend API');
        
    } catch (error) {
        console.error('Error loading system performance:', error);
    }
}

// Generate Report
async function generateReport(reportType) {
    try {
        // Get the selected date range
        const rangeSelect = document.getElementById(`${reportType}-report-range`);
        const dateRange = rangeSelect ? rangeSelect.value : 'month';
        
        console.log(`Generating ${reportType} report for ${dateRange}`);
        
        // TODO: Replace with actual API call
        // const response = await fetch(API_CONFIG.BASE_URL + '/admin/reports/generate', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ type: reportType, range: dateRange })
        // });
        
        // Show success message
        alert(`${capitalizeFirst(reportType)} report generation started!\n\nDate Range: ${dateRange}\n\nThe report will be ready for download shortly.`);
        
        // Add to recent reports (mock data for now)
        addRecentReport(reportType, dateRange);
        
    } catch (error) {
        console.error('Error generating report:', error);
        alert('Failed to generate report. Please try again.');
    }
}

// Add recent report to table
function addRecentReport(reportType, dateRange) {
    const tbody = document.getElementById('reports-tbody');
    
    // Remove empty state if exists
    const emptyState = tbody.querySelector('.empty-state');
    if (emptyState && emptyState.parentElement.parentElement) {
        emptyState.parentElement.parentElement.remove();
    }
    
    // Create new row
    const row = document.createElement('tr');
    const now = new Date();
    const reportId = 'RPT-' + Date.now();
    
    row.innerHTML = `
        <td>${capitalizeFirst(reportType)} Report</td>
        <td>${formatDateRange(dateRange)}</td>
        <td>${now.toLocaleString()}</td>
        <td><span class="report-status processing">Processing</span></td>
        <td>
            <button class="btn btn-sm btn-ghost" onclick="downloadReport('${reportId}')" disabled>
                Download
            </button>
        </td>
    `;
    
    tbody.insertBefore(row, tbody.firstChild);
    
    // Simulate processing complete after 3 seconds
    setTimeout(() => {
        const statusBadge = row.querySelector('.report-status');
        const downloadBtn = row.querySelector('button');
        statusBadge.textContent = 'Completed';
        statusBadge.className = 'report-status completed';
        downloadBtn.disabled = false;
    }, 3000);
}

// Download Report
function downloadReport(reportId) {
    // TODO: Replace with actual download logic
    console.log('Downloading report:', reportId);
    alert(`Report ${reportId} download started!\n\nFormat: PDF\n\nThe file will be saved to your downloads folder.`);
}

// Clear Report History
function clearReportHistory() {
    if (confirm('Are you sure you want to clear all report history?')) {
        const tbody = document.getElementById('reports-tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state" style="padding: var(--space-xl);">
                        <span class="empty-icon" style="font-size: 2rem;">📋</span>
                        <p>No reports generated yet</p>
                        <small>Generate your first report above</small>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Helper: Capitalize first letter
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper: Format date range
function formatDateRange(range) {
    const ranges = {
        'today': 'Today',
        'week': 'Last 7 Days',
        'month': 'Last 30 Days',
        'quarter': 'Last 90 Days',
        'year': 'Last Year',
        'custom': 'Custom Range'
    };
    return ranges[range] || range;
}

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin Dashboard Loaded');
    
    // Check admin authentication
    const authToken = localStorage.getItem('adminAuthToken') || sessionStorage.getItem('adminAuthToken');
    const adminData = localStorage.getItem('adminData') || sessionStorage.getItem('adminData');
    
    if (!authToken || !adminData) {
        console.log('No admin authentication found - redirecting to login');
        window.location.href = 'admin-login.html';
        return;
    }
    
    // Parse admin data
    try {
        const admin = JSON.parse(adminData);
        console.log('Admin authenticated:', admin.username);
        
        // Update navbar with admin name
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) {
            userNameElement.textContent = admin.username;
        }
    } catch (error) {
        console.error('Error parsing admin data:', error);
        window.location.href = 'admin-login.html';
        return;
    }
    
    // Load initial data
    loadDashboardStats();
    loadRecentActivity();
    loadSystemPerformance();
    
    // Refresh data every 30 seconds
    setInterval(() => {
        loadDashboardStats();
        loadRecentActivity();
        loadSystemPerformance();
    }, 30000);
});


// Filter User Reports
function filterUserReports(status) {
    // TODO: Implement filtering logic
    console.log('Filtering user reports by:', status);
    
    // Update active button
    event.target.parentElement.querySelectorAll('.btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}


// Initialize admin dashboard on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check admin authentication
    const adminToken = localStorage.getItem('facepay_admin_token');
    if (!adminToken) {
        window.location.href = 'admin-login.html';
        return;
    }
    
    // Load dashboard data
    loadDashboardStats();
    loadRecentActivity();
    loadSystemPerformance();
    
    // Load user reports if on user-reports section
    const userReportsSection = document.getElementById('user-reports-section');
    if (userReportsSection) {
        loadUserReports();
    }
    
    // Refresh stats every 30 seconds
    setInterval(() => {
        loadDashboardStats();
        if (document.getElementById('user-reports-section')?.classList.contains('active')) {
            loadUserReports();
        }
    }, 30000);
});

// Filter reports
function filterReports(status) {
    loadUserReports(1, status ? { status } : {});
}
