// dashboard.js - MCC-MRF Dashboard Logic

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadStats();
  await loadRecentUsers();
});

async function checkAuth() {
  try {
    const res = await fetch('/api/auth-check');
    const data = await res.json();
    if (!data.authenticated) {
      window.location.href = '/login.html';
      return;
    }
    // Set user info
    document.getElementById('sbUsername').textContent = data.username || 'mccmrfadmin';
    document.getElementById('sbAvatar').textContent = (data.username || 'M')[0].toUpperCase();
  } catch (e) {
    window.location.href = '/login.html';
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    
    // Animate numbers for pixel perfect feel
    animateValue("stat-total", 0, data.total || 0, 1000);
    animateValue("stat-students", 0, data.students || 0, 1000);
    animateValue("stat-staff", 0, data.staff || 0, 1000);
    animateValue("stat-certs", 0, data.certs || 0, 1000);
  } catch (e) {
    console.error('Stats error:', e);
  }
}

async function loadRecentUsers() {
  const tbody = document.getElementById('recentTbody');
  try {
    const res = await fetch('/api/applications?limit=5');
    const data = await res.json();
    const apps = data.applications || [];

    if (apps.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-empty">No users found. Submit a form to see data here.</td></tr>';
      return;
    }

    tbody.innerHTML = apps.map(app => {
      const type = app.professional_status && app.professional_status.toLowerCase().includes('student') ? 'STUDENT' : 'STAFF';
      const badgeClass = type === 'STUDENT' ? 'badge-student' : 'badge-staff';
      const date = new Date(app.submitted_at);
      const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
      
      return `
        <tr>
          <td style="font-weight: 600;">${esc(app.applicant_name)}</td>
          <td><span class="badge ${badgeClass}">${type}</span></td>
          <td style="color: #64748b;">${esc(app.email)}</td>
          <td style="color: #64748b;">${formattedDate}</td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Error loading data.</td></tr>';
  }
}

// Sidebar Navigation
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');
  
  document.querySelectorAll('.sb-nav-item').forEach(n => n.classList.remove('active'));
  const nav = document.getElementById('nav-' + pageId);
  if (nav) nav.classList.add('active');

  if (pageId === 'applications') {
    loadAllUsers();
  } else if (pageId === 'dashboard') {
    loadStats();
    loadRecentUsers();
  }
}

let currentPage = 1;
const limit = 10;

async function loadAllUsers(pageOffset = 0) {
  currentPage += pageOffset;
  if (currentPage < 1) currentPage = 1;

  const tbody = document.getElementById('allUsersTbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Loading...</td></tr>';
  
  const search = document.getElementById('searchInput')?.value || '';
  const startDate = document.getElementById('startDate')?.value || '';
  const endDate = document.getElementById('endDate')?.value || '';

  try {
    const queryParams = new URLSearchParams({
      page: currentPage,
      limit: limit,
      search: search,
      startDate: startDate,
      endDate: endDate
    });

    const res = await fetch('/api/applications?' + queryParams.toString());
    const data = await res.json();
    const apps = data.applications || [];
    
    // update pagination UI
    document.getElementById('paginationInfo').textContent = `Showing page ${data.page} of ${Math.ceil(data.total / data.limit) || 1} (${data.total} total entries)`;
    document.getElementById('prevPageBtn').disabled = data.page <= 1;
    document.getElementById('nextPageBtn').disabled = data.page >= Math.ceil(data.total / data.limit);

    if (apps.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = apps.map(app => {
      const type = app.professional_status && app.professional_status.toLowerCase().includes('student') ? 'STUDENT' : 'STAFF';
      return `
        <tr>
          <td style="font-weight: 600;">${esc(app.applicant_name)}</td>
          <td><span class="badge ${type === 'STUDENT' ? 'badge-student' : 'badge-staff'}">${type}</span></td>
          <td style="color: #64748b;">${esc(app.email)}</td>
          <td><span class="badge badge-pending">${esc(app.status)}</span></td>
          <td><button class="action-btn" onclick="viewDetail(${app.id})" style="padding:6px 10px; font-size:12px; cursor:pointer; color: #1e293b; background: #f1f5f9; border:none; border-radius:4px;"><i class="fa-solid fa-eye"></i> View</button></td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Error loading users.</td></tr>';
  }
}

function changePage(offset) {
  loadAllUsers(offset);
}

async function exportToExcel() {
  const search = document.getElementById('searchInput')?.value || '';
  const startDate = document.getElementById('startDate')?.value || '';
  const endDate = document.getElementById('endDate')?.value || '';

  try {
    const queryParams = new URLSearchParams({
      page: 1,
      limit: 10000, 
      search: search,
      startDate: startDate,
      endDate: endDate
    });

    const res = await fetch('/api/applications?' + queryParams.toString());
    const data = await res.json();
    const apps = data.applications || [];
    
    if (apps.length === 0) {
      alert("No data available to export based on current filters.");
      return;
    }

    const excelData = apps.map(app => ({
      'ID': app.id,
      'Date Submitted': new Date(app.submitted_at).toLocaleDateString(),
      'Name': app.applicant_name,
      'Email': app.email,
      'WhatsApp': app.whatsapp,
      'Startup Name': app.startup_name,
      'Professional Status': app.professional_status,
      'Growth Plan': app.plan_to_grow,
      'Services Needed': app.services_needed,
      'Financial Support': app.financial_support,
      'Incubation Support': app.incubation_support,
      'Incubation Duration': app.incubation_duration,
      'Association Type': app.association_type,
      'Incubation Help Needed': app.incubation_help,
      'Status': app.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Applications");
    XLSX.writeFile(workbook, `MCC_Incubation_Applications_Report.xlsx`);

  } catch (e) {
    console.error('Export Error:', e);
    alert('Failed to export data to Excel.');
  }
}

function viewDetail(id) {
  fetch(`/api/applications/${id}`)
    .then(r => r.json())
    .then(app => {
      const modal = document.getElementById('detailModal');
      const body = document.getElementById('modalBody');
      const title = document.getElementById('modalTitle');
      title.textContent = "Application: " + app.applicant_name;
      
      const docPreview = app.file_path 
        ? `<div style="margin-top: 20px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #f8fafc;">
             <div style="padding: 10px 15px; background: #f1f5f9; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0;">
               <span style="font-weight: 600; font-size: 14px; color: #334155;"><i class="fa-solid fa-file-pdf"></i> Attached Document Preview</span>
               <a href="${app.file_path}" target="_blank" download class="btn" style="background:#10b981; color:white; padding: 6px 12px; font-size: 12px; border-radius: 4px; text-decoration: none;">Download File</a>
             </div>
             <iframe src="${app.file_path}" width="100%" height="400px" style="border: none;"></iframe>
           </div>` 
        : '<div style="margin-top:20px; padding:15px; background:#fef2f2; border:1px solid #fecaca; color:#ef4444; border-radius:6px;">No attachment provided.</div>';

      body.innerHTML = `
        <div style="font-size: 14px; line-height: 1.6; display: grid; gap: 15px; grid-template-columns: 1fr 1fr;">
          <div style="background:#f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
             <span style="display:block; font-size:11px; color:#64748b; text-transform:uppercase; font-weight:600;">Startup Name</span>
             <strong style="font-size: 15px;">${esc(app.startup_name)}</strong>
          </div>
          <div style="background:#f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
             <span style="display:block; font-size:11px; color:#64748b; text-transform:uppercase; font-weight:600;">Email Address</span>
             <strong>${esc(app.email)}</strong>
          </div>
          <div style="background:#f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
             <span style="display:block; font-size:11px; color:#64748b; text-transform:uppercase; font-weight:600;">Phone Number</span>
             <strong>${esc(app.whatsapp)}</strong>
          </div>
          <div style="background:#f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
             <span style="display:block; font-size:11px; color:#64748b; text-transform:uppercase; font-weight:600;">Professional Status</span>
             <strong>${esc(app.professional_status)}</strong>
          </div>
          <div style="grid-column: 1 / -1; background:#f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
             <span style="display:block; font-size:11px; color:#64748b; text-transform:uppercase; font-weight:600;">Services Needed</span>
             <strong>${esc(app.services_needed || 'N/A')}</strong>
          </div>
          <div style="grid-column: 1 / -1; background:#f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
             <span style="display:block; font-size:11px; color:#64748b; text-transform:uppercase; font-weight:600;">Plan to Grow</span>
             <div style="margin-top:5px;">${esc(app.plan_to_grow || 'N/A')}</div>
          </div>
          <div style="background:#f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
             <span style="display:block; font-size:11px; color:#64748b; text-transform:uppercase; font-weight:600;">Financial Support</span>
             <strong>${esc(app.financial_support)}</strong>
          </div>
          <div style="background:#f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
             <span style="display:block; font-size:11px; color:#64748b; text-transform:uppercase; font-weight:600;">Incubation Support Needed</span>
             <strong>${esc(app.incubation_support)}</strong>
          </div>
          <div style="background:#f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
             <span style="display:block; font-size:11px; color:#64748b; text-transform:uppercase; font-weight:600;">Duration</span>
             <strong>${esc(app.incubation_duration)}</strong>
          </div>
          <div style="background:#f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
             <span style="display:block; font-size:11px; color:#64748b; text-transform:uppercase; font-weight:600;">Association Type</span>
             <strong>${esc(app.association_type)}</strong>
          </div>
          <div style="grid-column: 1 / -1; background:#f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
             <span style="display:block; font-size:11px; color:#64748b; text-transform:uppercase; font-weight:600;">Pitch/Company Brief</span>
             <div style="margin-top:5px; white-space:pre-wrap;">${esc(app.incubation_help)}</div>
          </div>
        </div>
        ${docPreview}
      `;
      // Expand modal max-width gracefully if possible
      modal.querySelector('.modal').style.maxWidth = '1000px';
      modal.classList.add('active');
    });
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('active');
}

async function handleLogout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (e) {}
  window.location.href = '/login.html';
}

function animateValue(id, start, end, duration) {
  const obj = document.getElementById(id);
  if (!obj) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    obj.innerHTML = Math.floor(progress * (end - start) + start);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
