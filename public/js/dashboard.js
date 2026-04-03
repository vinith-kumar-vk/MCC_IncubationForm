// dashboard.js - MCC-MRF Dashboard Logic
let currentPage = 1;
const limit = 10;

// Helper for shortening getElementById
const id = (uid) => document.getElementById(uid);

async function showToast(msg) {
  const toast = id('toast');
  const toastMsg = id('toastMsg');
  if (toast && toastMsg) {
    toastMsg.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadStats();
  await loadRecentUsers();

  // Mobile sidebar toggle
  const toggleBtn = id('toggleSidebar');
  const sidebar = id('sidebar');
  const overlay = id('sidebarOverlay');
  if (toggleBtn && sidebar && overlay) {
    const toggle = () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    };
    toggleBtn.addEventListener('click', toggle);
    overlay.addEventListener('click', toggle);
  }
});

let sortableInstance = null;

function initSortable() {
  const el = document.getElementById('fieldsTbody');
  if (!el) { console.log('Tbody not found'); return; }
  
  // Clear existing
  if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }

  // Drag works ONLY in step-specific views (as requested to avoid confusion)
  if (activeStepFilter === 0) {
    console.log('Drag disabled: Please select Step 1, 2, or 3');
    return;
  }

  console.log('Initializing Sortable for Step:', activeStepFilter);
  sortableInstance = Sortable.create(el, {
    handle: '.drag-handle',
    animation: 200,
    ghostClass: 'sortable-ghost',
    onEnd: () => {
      const btn = document.getElementById('saveOrderBtn');
      if (btn) { btn.style.display = 'inline-flex'; btn.classList.add('pulse-animation'); }
      
      const rows = Array.from(el.querySelectorAll('tr.field-row'));
      rows.forEach((r, i) => {
        const orderTd = r.querySelector('.order-label');
        if(orderTd) orderTd.textContent = i + 1;
      });
    }
  });
}

async function saveFieldsOrder() {
  const tbody = id('fieldsTbody');
  const btn = id('saveOrderBtn');
  const rows = Array.from(tbody.querySelectorAll('tr.field-row'));
  
  const orders = rows.map((row, index) => ({
    id: parseInt(row.getAttribute('data-id')),
    step: parseInt(row.getAttribute('data-step')),
    sort_order: index + 1
  }));

  try {
    const res = await fetch('/api/admin/form-fields/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders })
    });
    const data = await res.json();
    if (data.success) {
      if (btn) { btn.style.display = 'none'; btn.classList.remove('pulse-animation'); }
      showToast('Order saved successfully');
      
      // Update local allFields to match the UI state
      orders.forEach(ord => {
        const found = allFields.find(x => x.id === ord.id);
        if (found) {
          found.sort_order = ord.sort_order;
          found.step = ord.step;
        }
      });
      // Important: Re-sort the array based on updated sort_order
      allFields.sort((a, b) => (a.step - b.step) || (a.sort_order - b.sort_order));
      filterStep(activeStepFilter);
    }
  } catch (e) { showToast('Failed to save.'); }
}

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
  // Close sidebar on mobile after choosing a page
  const sidebar = id('sidebar');
  const overlay = id('sidebarOverlay');
  if (sidebar && window.innerWidth <= 768) {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  }
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
  if (!fileInput.files[0]) { showToast('Please choose a logo file first.'); return; }
  const formData = new FormData();
  formData.append('logo', fileInput.files[0]);
  try {
    const res = await fetch('/api/settings/logo', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      document.getElementById('sbLogo').src = data.logo_path + '?t=' + Date.now();
      showToast('Logo saved successfully');
    } else { showToast('Logo upload failed: ' + data.message); }
  } catch (e) { showToast('Upload error.'); }
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
    if (data.success) showToast('Saved successfully');
    else showToast('Save failed.');
  } catch (e) { showToast('Error saving settings.'); }
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
    // Increased timeout for better stability
    setTimeout(initSortable, 300);
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
    tbody.innerHTML = '<tr><td colspan="10" class="table-empty">No fields found.</td></tr>';
    return;
  }
  
  // Sort incoming fields by step first, then sort_order
  fields.sort((a, b) => (a.step - b.step) || (a.sort_order - b.sort_order));

  let html = '';
  let lastStep = null;

  fields.forEach((f, index) => {
    // Header for "All Steps" view
    if (activeStepFilter === 0 && f.step !== lastStep) {
      const stepNames = { 1: 'Bio & Contact', 2: 'Startup Vision', 3: 'Incubation Needs' };
      html += `<tr class="step-header-row" data-step-header="${f.step}"><td colspan="10" style="background:#f8fafc; padding:12px 24px; font-weight:700; color:#8B1A2E; font-size:12px;"><i class="fa-solid fa-layer-group"></i> STEP ${f.step} – ${stepNames[f.step] || 'General'}</td></tr>`;
      lastStep = f.step;
    }

    const isFilteredView = activeStepFilter > 0;
    html += `
    <tr class="field-row" data-id="${f.id}" data-step="${f.step}">
      <td class="drag-handle" style="color:#94a3b8; text-align:center; width:40px;">${isFilteredView ? '<i class="fa-solid fa-grip-vertical" style="cursor:grab;"></i>' : ''}</td>
      <td class="order-label" style="color:#94a3b8; font-size:12px; text-align:center; width:60px;">${index + 1}</td>
      <td style="width:100px; text-align:center;"><span class="badge" style="background:#f1f5f9; color:#475569; font-size:10px; width:70px; display:inline-block;">STEP ${f.step}</span></td>
      <td style="font-family:monospace; font-size:11px; color:#64748b; width:150px;">${esc(f.field_name)}</td>
      <td style="font-weight:600; color:#1e293b; min-width:200px;">${esc(f.label)}</td>
      <td style="width:100px; text-align:center;"><span class="badge" style="background:#eff6ff; color:#1d4ed8; text-transform:uppercase; font-size:10px; min-width:60px; display:inline-block;">${esc(f.field_type)}</span></td>
      <td style="width:60px; text-align:center;">${f.required ? '<i class="fa-solid fa-star" style="color:#dc2626; font-size:10px;"></i>' : '<i class="fa-regular fa-star" style="color:#cbd5e1; font-size:10px;"></i>'}</td>
      <td style="width:120px; text-align:center;">${f.is_active ? '<span class="badge" style="background:#dcfce7; color:#166534; font-size:10px; width:80px; display:inline-block;"><i class="fa-solid fa-eye"></i> Active</span>' : '<span class="badge" style="background:#f1f5f9; color:#64748b; font-size:10px; width:80px; display:inline-block;"><i class="fa-solid fa-eye-slash"></i> Hidden</span>'}</td>
      <td style="width:100px; text-align:right;">
        <div style="display:flex; gap:5px; justify-content: flex-end;">
          <button class="action-btn-edit" onclick="openFieldModal(${f.id})" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn-del" onclick="deleteField(${f.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  });

  tbody.innerHTML = html;
  // Always trigger initSortable when rendering is done
  initSortable();
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
    document.getElementById('fld_width').value = '12';
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
    document.getElementById('fld_width').value = f.column_width || '12';
    document.getElementById('fld_required').checked = !!f.required;
    document.getElementById('fld_active').checked = !!f.is_active;
    
    // Process validation rules
    let rules = {}; try { rules = JSON.parse(f.validation_rules || '{}'); } catch(e){}
    document.getElementById('fld_limit_words').value = rules.max_words || '';
    document.getElementById('fld_limit_size').value = rules.max_size || '';
    document.getElementById('fld_size_unit').value = rules.size_unit || 'MB';
    document.getElementById('fld_allowed_ext').value = rules.allowed_ext || 'pdf';
    document.getElementById('fld_custom_hint').value = rules.custom_hint || '';
    document.getElementById('fld_allow_url').checked = !!rules.allow_url;

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
  
  // Toggle Validation Rows
  document.getElementById('row_validation_textarea').style.display = ['text','textarea'].includes(t) ? '' : 'none';
  document.getElementById('row_validation_file').style.display = (t === 'file') ? '' : 'none';
}

async function saveField() {
  const id = document.getElementById('fld_id').value;
  const label = document.getElementById('fld_label').value.trim();
  let name = document.getElementById('fld_name').value.trim().replace(/\s+/g, '_').toLowerCase();
  
  // Auto-generate name from label if name is missing (for simplified UI)
  if (!name && label) {
    name = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  const payload = {
    step: parseInt(document.getElementById('fld_step').value),
    field_type: document.getElementById('fld_type').value,
    field_name: name,
    label,
    placeholder: document.getElementById('fld_placeholder').value.trim(),
    options: document.getElementById('fld_options').value.trim() || null,
    sort_order: parseInt(document.getElementById('fld_order').value) || 0,
    column_width: parseInt(document.getElementById('fld_width').value) || 12,
    required: document.getElementById('fld_required').checked ? 1 : 0,
    is_active: document.getElementById('fld_active').checked ? 1 : 0,
  };

  // Build validation rules JSON
  const rules = {};
  if (['text','textarea','email','url'].includes(payload.field_type)) {
    const mw = parseInt(document.getElementById('fld_limit_words').value);
    if (mw) rules.max_words = mw;
  }
  if (payload.field_type === 'file') {
    const ms = parseFloat(document.getElementById('fld_limit_size').value);
    if (ms) {
      rules.max_size = ms;
      rules.size_unit = document.getElementById('fld_size_unit').value;
    }
    rules.allowed_ext = document.getElementById('fld_allowed_ext').value.trim() || 'pdf';
    rules.custom_hint = document.getElementById('fld_custom_hint').value.trim();
    rules.allow_url = document.getElementById('fld_allow_url').checked;
  }
  payload.validation_rules = Object.keys(rules).length > 0 ? JSON.stringify(rules) : null;

  if (!payload.label) { showToast('Label is required'); return; }
  if (!id && !payload.field_name) { showToast('Please enter a valid field label'); return; }

  try {
    const url = id ? `/api/admin/form-fields/${id}` : '/api/admin/form-fields';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.success) {
      showToast(id ? 'Field updated' : 'Field added');
      closeFieldModal();
      await loadFormFields();
      filterStep(activeStepFilter);
    } else { showToast('Error: ' + (data.message || 'Save failed')); }
  } catch (e) { showToast('Error saving field'); }
}

async function deleteField(id) {
  if (!confirm('Are you sure you want to delete this field?')) return;
  try {
    const res = await fetch(`/api/admin/form-fields/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Field deleted');
      await loadFormFields();
      filterStep(activeStepFilter);
    } else { showToast('Delete failed'); }
  } catch (e) { showToast('Delete failed'); }
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

    // Fetch applications AND fields configuration concurrently for dynamic column generation
    const [appRes, fRes] = await Promise.all([
      fetch('/api/applications?' + queryParams.toString()),
      fetch('/api/admin/form-fields')
    ]);
    
    const data = await appRes.json();
    const fields = await fRes.json();
    const apps = data.applications || [];
    
    if (apps.length === 0) {
      showToast("No data available to export");
      return;
    }
    // Filter for active fields only as per user request (Hide fields with is_active = 0)
    fields = fields.filter(f => f.is_active === 1);
    
    // Sort fields logically to match the Excel column sequence with the Form steps
    fields.sort((a, b) => (a.step - b.step) || (a.sort_order - b.sort_order));

    const excelData = apps.map(app => {
      let dynamicData = {};
      try { if (app.full_data) dynamicData = JSON.parse(app.full_data); } catch(e){}

      // Build row structure dynamically
      const row = {
        'ID': app.id,
        'Date Submitted': new Date(app.submitted_at).toLocaleDateString()
      };

      // Form builder columns mapping
      fields.forEach(f => {
        let val = dynamicData[f.field_name] || app[f.field_name] || 'Not specified';
        if (Array.isArray(val)) val = val.join(', ');
        row[f.label] = val; // The field's Label naturally becomes the Excel Column Header!
      });

      // Removed redundant hardcoded services row to avoid duplication
      row['Status'] = app.status;
      
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Applications");
    XLSX.writeFile(workbook, `MCC_Incubation_Applications_Report.xlsx`);

  } catch (e) {
    console.error('Export Error:', e);
    showToast('Failed to export data');
  }
}

async function viewDetail(id) {
  try {
    const [appRes, fRes, sRes] = await Promise.all([
      fetch(`/api/applications/${id}`),
      fetch('/api/admin/form-fields'),
      fetch('/api/settings')
    ]);
    const app = await appRes.json();
    let fields = await fRes.json();
    const settings = await sRes.json();
    
    // Filter for active fields only as per user request (Hide fields with is_active = 0)
    fields = fields.filter(f => f.is_active === 1);
    fields.sort((a, b) => (a.step - b.step) || (a.sort_order - b.sort_order));

    const modal = document.getElementById('detailModal');
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');
    title.textContent = "Application Detail - " + (app.applicant_name || 'N/A');
    
    let dynamicData = {};
    try { if (app.full_data) dynamicData = JSON.parse(app.full_data); } catch(e){}

    // Construct the Tables based on Steps
    const steps = [1, 2, 3];
    const stepNames = { 1: 'APPLICANT PROFILE - PART I', 2: 'STARTUP VISION - PART II', 3: 'INCUBATION DETAILS - PART III' };
    
    let tablesHtml = "";
    steps.forEach(stepNum => {
      const stepFields = fields.filter(f => f.step === stepNum);
      if (stepFields.length === 0 && stepNum !== 3) return;

      tablesHtml += `
        <div class="print-section">
          <div class="section-title-bar">${stepNames[stepNum]}</div>
          <table class="print-table">
            <tbody>
      `;

      stepFields.forEach(f => {
        // Skip redundant fields already shown in header
        if (f.field_name === 'applicant_name') return;
        
        let val = dynamicData[f.field_name] || app[f.field_name] || null;
        if (Array.isArray(val)) val = val.join(', ');
        
        // Skip rendering if value is empty or just a placeholder '-'
        if (!val || val === '-' || val === 'Not specified') return;

        // Clean up file paths for PDF display
        let displayVal = val;
        if (typeof val === 'string' && val.startsWith('/uploads/')) {
          const fileName = val.split('/').pop();
          const dashIdx = fileName.indexOf('-');
          displayVal = dashIdx !== -1 ? fileName.substring(dashIdx + 1) : fileName;
        }

        tablesHtml += `
          <tr>
            <td class="field-label">${f.label.toUpperCase()}</td>
            <td class="field-value">${esc(displayVal)}</td>
          </tr>
        `;
      });

      // Removed redundant hardcoded services row to avoid duplication

      tablesHtml += `</tbody></table></div>`;
    });

    // Handle Attachment Preview (Video, PDF, Image) - NO PRINT
    let attachmentPreview = "";
    if (app.file_path) {
      const isPdf = app.file_path.toLowerCase().endsWith('.pdf');
      const isVideo = ['.mp4', '.webm', '.ogg'].some(ext => app.file_path.toLowerCase().endsWith(ext));
      const isImg = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => app.file_path.toLowerCase().endsWith(ext));

      attachmentPreview = `<div class="no-print" style="margin-top: 30px; border-top: 2px dashed #ddd; padding-top: 20px;">
        <h4 style="color: #64748b; font-size: 14px; margin-bottom: 12px;"><i class="fa-solid fa-paperclip"></i> Attachment Preview (Admin Only)</h4>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">`;

      if (isPdf) {
        attachmentPreview += `<iframe src="${app.file_path}" width="100%" height="500px" style="border: none;"></iframe>`;
      } else if (isVideo) {
        attachmentPreview += `<video controls style="width: 100%; max-height: 500px; display: block; outline: none; background: #000;"><source src="${app.file_path}" type="video/mp4">Your browser does not support video.</video>`;
      } else if (isImg) {
        attachmentPreview += `<img src="${app.file_path}" style="max-width: 100%; display: block; margin: 0 auto;">`;
      } else {
        attachmentPreview += `<div style="padding: 20px; text-align: center; color: #64748b;"><i class="fa-solid fa-file" style="font-size: 32px; margin-bottom: 10px; display: block;"></i> <a href="${app.file_path}" target="_blank" style="color: var(--mcc-maroon); font-weight: 600;">Download and View File</a></div>`;
      }

      attachmentPreview += `</div></div>`;
    }

    // Handle Financial Proof Preview
    if (app.financial_proof_path) {
      const isPdf = app.financial_proof_path.toLowerCase().endsWith('.pdf');
      attachmentPreview += `<div class="no-print" style="margin-top: 20px; border-top: 2px dashed #ddd; padding-top: 20px;">
        <h4 style="color: #64748b; font-size: 14px; margin-bottom: 12px;"><i class="fa-solid fa-money-bill-transfer"></i> Financial Proof (Admin Only)</h4>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">`;
      if (isPdf) {
        attachmentPreview += `<iframe src="${app.financial_proof_path}" width="100%" height="400px" style="border: none;"></iframe>`;
      } else {
        attachmentPreview += `<div style="padding: 20px; text-align: center; color: #64748b;"><i class="fa-solid fa-file-contract" style="font-size: 32px; margin-bottom: 10px; display: block;"></i> <a href="${app.financial_proof_path}" target="_blank" style="color: var(--mcc-maroon); font-weight: 600;">View Financial Proof Document</a></div>`;
      }
      attachmentPreview += `</div></div>`;
    }

    const appDate = new Date(app.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    body.innerHTML = `
      <div class="no-print" style="display:flex; justify-content:flex-end; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px;">
         <button onclick="window.print()" class="print-btn-action"><i class="fa-solid fa-cloud-arrow-down"></i> SAVE AS PDF / PRINT</button>
      </div>

      <div id="mcc-print-container" class="mcc-application-document">
        <!-- HEADER -->
        <div class="mcc-print-header">
           <div class="mcc-logo-container">
              <img src="${settings.logo_path || '/images/logo.png'}" alt="Logo">
           </div>
           <div class="mcc-header-text">
              <h1>MCC - MRF</h1>
              <h1>INNOVATION PARK</h1>
              <h3>Application form for Incubation @ MCCMRFIP</h3>
           </div>
        </div>

        <div class="mcc-metadata-row">
           <div class="meta-item main-name">
              <span class="meta-label">NAME OF THE APPLICANT :</span>
              <span class="meta-val highlight">${(app.applicant_name || 'N/A').toUpperCase()}</span>
           </div>
           <div class="meta-item-side">
              <div class="side-item">
                 <span class="meta-label">APPLICATION DATE</span>
                 <span class="meta-val">${appDate}</span>
              </div>
           </div>
        </div>

        <!-- CONTENT TABLES -->
        ${tablesHtml}
      </div>

      ${attachmentPreview}

      <style>
        :root { --mcc-maroon: #8B1A2E; }
        #detailModal .modal { background: #fff; border: none; }
        
        .print-btn-action {
          background: #8B1A2E; color: white; border: none; padding: 10px 24px; border-radius: 8px;
          font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 10px;
        }

        .mcc-application-document {
          width: 210mm; min-height: 297mm; padding: 15mm; margin: 0 auto;
          background: white; color: #000; font-family: 'Inter', Arial, sans-serif;
          border: 1px solid #eee; position: relative;
        }

        .mcc-print-header { display: flex; align-items: center; gap: 20px; border-bottom: 2px solid var(--mcc-maroon); padding-bottom: 20px; margin-bottom: 25px; }
        .mcc-logo-container img { height: 85px; width: auto; }
        .mcc-header-text { flex-grow: 1; text-align: center; }
        .mcc-header-text h1 { color: var(--mcc-maroon); font-size: 26px; font-weight: 800; margin: 0; line-height: 1.1; }
        .mcc-header-text h3 { font-size: 12px; font-weight: 700; color: #1a1a1a; margin-top: 10px; opacity: 0.9; }

        .mcc-metadata-row { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: none; padding-bottom: 15px; }
        .meta-label { font-size: 10px; font-weight: 700; color: #666; margin-bottom: 2px; }
        .meta-val { font-size: 13px; font-weight: 700; }
        .meta-val.highlight { font-size: 20px; color: var(--mcc-maroon); font-weight: 800; }
        .mcc-metadata-row .meta-item-side { display: flex; gap: 30px; text-align: right; }

        .section-title-bar { background: var(--mcc-maroon); color: white; padding: 8px 15px; font-weight: 700; font-size: 12px; page-break-after: avoid; }
        .print-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; page-break-inside: auto; }
        .print-table tr { page-break-inside: avoid; page-break-after: auto; }
        .print-table td { padding: 10px 15px; border: 1px solid #ddd; font-size: 12.5px; line-height: 1.4; }
        .field-label { background: #f9f9f9; width: 35%; font-weight: 700; color: #333; text-transform: uppercase; font-size: 10px; }
        .field-value { width: 65%; font-weight: 500; }

        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 0; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm;
            background: #fff !important;
            -webkit-print-color-adjust: exact;
          }
          #detailModal.modal-overlay { 
            position: static !important; 
            display: block !important; 
            background: #fff !important; 
            padding: 0 !important; 
            margin: 0 !important;
          }
          .modal { 
            position: static !important; 
            width: 100% !important; 
            max-width: none !important; 
            border: none !important; 
            box-shadow: none !important; 
            margin: 0 !important; 
            padding: 0 !important;
          }
          .modal-header, .close-btn { display: none !important; }
          .modal-body { padding: 0 !important; overflow: visible !important; }
          .layout-wrapper, .modal-overlay:not(#detailModal), .main-content, .sidebar, .mobile-header, .stat-card, .table-card, .card-header, .table-wrap, .filter-bar, .cms-toast { display: none !important; }
          
          .mcc-application-document { 
            border: none !important; 
            padding: 10mm 15mm !important; 
            margin: 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }
          
          .mcc-print-header { 
            margin-top: 0 !important;
            padding-bottom: 15px !important; 
            margin-bottom: 5px !important; 
          }

          .print-section { 
            padding-top: 45px !important; 
            page-break-inside: avoid !important;
          }

          .print-section:first-of-type {
            padding-top: 0 !important;
          }
          
          .print-table { 
            page-break-inside: avoid !important;
            margin-top: 5px !important;
          }

          .mcc-metadata-row { margin-bottom: 15px; padding-bottom: 15px; }
          .print-table td { padding: 8px 15px; }
          .section-title-bar { padding: 8px 15px; }
        }
      </style>
    `;

    modal.querySelector('.modal').style.maxWidth = '1000px';
    modal.classList.add('active');

  } catch (err) {
    console.error("Error drawing dynamic popup view:", err);
  }
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
