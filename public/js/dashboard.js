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

// ─── Sidebar Navigation ─────────────────────────────────────────────────────
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
  } else if (pageId === 'site-settings') {
    loadSiteSettings();
  } else if (pageId === 'form-builder') {
    loadFormFields();
  }
}

// ─── CMS: SITE SETTINGS ─────────────────────────────────────────────────────
async function loadSiteSettings() {
  try {
    const res = await fetch('/api/settings');
    const s = await res.json();
    const stitle = document.getElementById('set_site_title'); if(stitle) stitle.value = s.site_title || '';
    const ssub = document.getElementById('set_site_subtitle'); if(ssub) ssub.value = s.site_subtitle || '';
    const sloc = document.getElementById('set_site_location'); if(sloc) sloc.value = s.site_location || '';
    const ftitle = document.getElementById('set_form_title'); if(ftitle) ftitle.value = s.form_title || '';
    const fsub = document.getElementById('set_form_subtitle'); if(fsub) fsub.value = s.form_subtitle || '';
    const ftext = document.getElementById('set_footer_text'); if(ftext) ftext.value = s.footer_text || '';
    const lprev = document.getElementById('logoPreview'); if(lprev && s.logo_path) lprev.src = s.logo_path + '?t=' + Date.now();
  } catch (e) { console.error('Settings load error', e); }
}

function previewLogo(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('logoPreview').src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function uploadLogo() {
  const fileInput = document.getElementById('logoFileInput');
  if (!fileInput.files[0]) { alert('Please choose a logo file first.'); return; }
  const formData = new FormData();
  formData.append('logo', fileInput.files[0]);
  try {
    const res = await fetch('/api/settings/logo', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      // Update sidebar logo too
      document.getElementById('sbLogo').src = data.logo_path + '?t=' + Date.now();
      showSettingsMsg();
    } else { alert('Logo upload failed: ' + data.message); }
  } catch (e) { alert('Upload error.'); }
}

async function saveBrandSettings() {
  const payload = {
    site_title: document.getElementById('set_site_title').value,
    site_subtitle: document.getElementById('set_site_subtitle').value,
    site_location: document.getElementById('set_site_location').value,
  };
  await saveSettings(payload);
  // Update sidebar live
  const bname = document.getElementById('sbBrandName'); if(bname) bname.textContent = payload.site_title;
  const bsub = document.getElementById('sbBrandSub'); if(bsub) bsub.textContent = payload.site_subtitle;
  const bloc = document.getElementById('sbBrandLoc'); if(bloc) bloc.textContent = payload.site_location;
}

async function saveContentSettings() {
  const payload = {
    form_title: document.getElementById('set_form_title').value,
    form_subtitle: document.getElementById('set_form_subtitle').value,
    footer_text: document.getElementById('set_footer_text').value,
  };
  await saveSettings(payload);
}

async function saveSettings(payload) {
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) showSettingsMsg();
    else alert('Save failed.');
  } catch (e) { alert('Error saving settings.'); }
}

function showSettingsMsg() {
  const msg = document.getElementById('settingsSaveMsg');
  msg.style.display = 'block';
  setTimeout(() => msg.style.display = 'none', 3500);
}

// ─── CMS: FORM BUILDER ──────────────────────────────────────────────────────
let allFields = [];
let activeStepFilter = 0;

async function loadFormFields() {
  try {
    const res = await fetch('/api/admin/form-fields');
    allFields = await res.json();
    renderFieldsTable(allFields);
  } catch (e) { console.error('Fields load error', e); }
}

function filterStep(step) {
  activeStepFilter = step;
  document.querySelectorAll('.step-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + step).classList.add('active');
  const filtered = step === 0 ? allFields : allFields.filter(f => f.step === step);
  renderFieldsTable(filtered);
}

function renderFieldsTable(fields) {
  const tbody = document.getElementById('fieldsTbody');
  if (!fields.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No fields found.</td></tr>';
    return;
  }
  tbody.innerHTML = fields.map(f => `
    <tr>
      <td style="color:#94a3b8;">${f.sort_order}</td>
      <td><span class="badge" style="background:#f1f5f9;color:#475569;">Step ${f.step}</span></td>
      <td style="font-family:monospace; font-size:12px; color:#64748b;">${esc(f.field_name)}</td>
      <td style="font-weight:600; max-width:200px;">${esc(f.label)}</td>
      <td><span class="badge" style="background:#eff6ff;color:#1d4ed8;text-transform:uppercase;">${esc(f.field_type)}</span></td>
      <td>${f.required ? '<span class="badge" style="background:#fef2f2;color:#dc2626;">YES</span>' : '<span class="badge" style="background:#f1f5f9;color:#94a3b8;">NO</span>'}</td>
      <td>${f.is_active ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-inactive">Hidden</span>'}</td>
      <td>
        <button class="action-btn-edit" onclick="openFieldModal(${f.id})"><i class="fa-solid fa-pen"></i> Edit</button>
        <button class="action-btn-del" onclick="deleteField(${f.id})"><i class="fa-solid fa-trash"></i> Delete</button>
      </td>
    </tr>
  `).join('');
}

function openFieldModal(id) {
  const modal = document.getElementById('fieldModal');
  document.getElementById('fieldSaveMsg').style.display = 'none';
  if (id === null) {
    // New field
    document.getElementById('fieldModalTitle').textContent = 'Add New Field';
    document.getElementById('fld_id').value = '';
    document.getElementById('fld_step').value = '1';
    document.getElementById('fld_type').value = 'text';
    document.getElementById('fld_name').value = '';
    document.getElementById('fld_label').value = '';
    document.getElementById('fld_placeholder').value = '';
    document.getElementById('fld_options').value = '';
    document.getElementById('fld_order').value = '99';
    document.getElementById('fld_required').checked = true;
    document.getElementById('fld_active').checked = true;
    document.getElementById('row_field_name').style.display = '';
    toggleOptionsRow();
  } else {
    // Edit existing
    const f = allFields.find(x => x.id === id);
    if (!f) return;
    document.getElementById('fieldModalTitle').textContent = 'Edit Field';
    document.getElementById('fld_id').value = f.id;
    document.getElementById('fld_step').value = f.step;
    document.getElementById('fld_type').value = f.field_type;
    document.getElementById('fld_name').value = f.field_name;
    document.getElementById('fld_label').value = f.label;
    document.getElementById('fld_placeholder').value = f.placeholder || '';
    document.getElementById('fld_options').value = f.options || '';
    document.getElementById('fld_order').value = f.sort_order;
    document.getElementById('fld_required').checked = !!f.required;
    document.getElementById('fld_active').checked = !!f.is_active;
    document.getElementById('row_field_name').style.display = 'none'; // can't change name of existing
    toggleOptionsRow();
  }
  modal.classList.add('active');
}

function closeFieldModal() {
  document.getElementById('fieldModal').classList.remove('active');
}

function toggleOptionsRow() {
  const t = document.getElementById('fld_type').value;
  const showOpts = ['select','checkbox','radio'].includes(t);
  document.getElementById('row_options').style.display = showOpts ? '' : 'none';
}

async function saveField() {
  const id = document.getElementById('fld_id').value;
  const payload = {
    step: parseInt(document.getElementById('fld_step').value),
    field_type: document.getElementById('fld_type').value,
    field_name: document.getElementById('fld_name').value.trim().replace(/\s+/g, '_'),
    label: document.getElementById('fld_label').value.trim(),
    placeholder: document.getElementById('fld_placeholder').value.trim(),
    options: document.getElementById('fld_options').value.trim() || null,
    sort_order: parseInt(document.getElementById('fld_order').value),
    required: document.getElementById('fld_required').checked ? 1 : 0,
    is_active: document.getElementById('fld_active').checked ? 1 : 0,
  };

  if (!payload.label) { alert('Label is required.'); return; }
  if (!id && !payload.field_name) { alert('Field name is required.'); return; }

  try {
    const url = id ? `/api/admin/form-fields/${id}` : '/api/admin/form-fields';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      const msg = document.getElementById('fieldSaveMsg');
      msg.textContent = id ? '✅ Field updated successfully!' : '✅ Field added successfully!';
      msg.style.display = 'block';
      setTimeout(() => closeFieldModal(), 1200);
      await loadFormFields();
      filterStep(activeStepFilter);
    } else {
      alert('Error: ' + (data.message || 'Save failed'));
    }
  } catch (e) { alert('Error saving field.'); }
}

async function deleteField(id) {
  if (!confirm('Delete this field? This cannot be undone.')) return;
  try {
    await fetch(`/api/admin/form-fields/${id}`, { method: 'DELETE' });
    await loadFormFields();
    filterStep(activeStepFilter);
  } catch (e) { alert('Delete failed.'); }
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}


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
