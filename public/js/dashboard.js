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

  if (pageId === 'applications') loadAllUsers();
}

async function loadAllUsers() {
  const tbody = document.getElementById('allUsersTbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Loading...</td></tr>';
  try {
    const res = await fetch('/api/applications?limit=50');
    const data = await res.json();
    const apps = data.applications || [];

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
          <td><button class="action-btn" onclick="viewDetail(${app.id})" style="padding:4px 8px; font-size:11px; cursor:pointer;">View</button></td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Error loading users.</td></tr>';
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
      body.innerHTML = `
        <div style="font-size: 14px; line-height: 1.6;">
          <p><strong>Startup:</strong> ${app.startup_name}</p>
          <p><strong>Email:</strong> ${app.email}</p>
          <p><strong>Status:</strong> ${app.status}</p>
          <p><strong>Professional Status:</strong> ${app.professional_status}</p>
          <p><strong>Startup Description:</strong> ${app.startup_description}</p>
          <p><strong>Services Needed:</strong> ${app.services_needed || 'N/A'}</p>
        </div>
      `;
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
