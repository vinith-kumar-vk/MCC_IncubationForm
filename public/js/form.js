// form.js - MCC-MRF Dynamic Multi-Step Logic
let currentStep = 1;
const totalSteps = 4;
let dynamicFieldsConfig = [];

let step1TitleStr = "Application Form for Incubation @ MCCMRFIP";
let step1SubStr = "Begin your entrepreneurship journey with us. Fill in your personal details below.";

const stepTitles = {
  2: { title: "Startup Vision", subtitle: "Share the problem you're solving and your solution." },
  3: { title: "Incubation Support", subtitle: "Select the resources and support you need to succeed." },
  4: { title: "Final Confirmation", subtitle: "Please review all information and sign the declaration." }
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadCMSSettings();
  await loadDynamicFields();
  initFormLogic();
});

async function loadCMSSettings() {
  try {
    const res = await fetch('/api/settings');
    const s = await res.json();
    const stitle = id('siteTitle'); if (stitle && s.site_title) stitle.textContent = s.site_title;
    const ssub = id('siteSubtitle'); if (ssub && s.site_subtitle) ssub.textContent = s.site_subtitle;
    const ftitle = id('formTitle'); if (ftitle && s.form_title) { ftitle.textContent = s.form_title; step1TitleStr = s.form_title; }
    const fsub = id('formSubtitle'); if (fsub && s.form_subtitle) { fsub.textContent = s.form_subtitle; step1SubStr = s.form_subtitle; }
    const footer = id('footerText'); if (footer && s.footer_text) footer.textContent = s.footer_text;
    const logo = id('siteLogo'); if (logo && s.logo_path) logo.src = s.logo_path;
  } catch (e) { console.error('CMS Settings load error', e); }
}

async function loadDynamicFields() {
  try {
    // Add cache buster to ensure latest changes are fetched
    const res = await fetch('/api/form-fields?t=' + Date.now());
    dynamicFieldsConfig = await res.json();
    
    // Sort by step FIRST, then sort_order SECOND (Crucial Fix)
    dynamicFieldsConfig.sort((a, b) => (a.step - b.step) || (a.sort_order - b.sort_order));

    const stepsGroup = { 1: [], 2: [], 3: [] };
    dynamicFieldsConfig.forEach(f => {
      if (stepsGroup[f.step]) {
        stepsGroup[f.step].push(f);
      }
    });

    for (let s = 1; s <= 3; s++) {
      const container = id(`dynamicFieldsStep${s}`);
      if (!container) continue;
      
      let html = stepsGroup[s].map(f => renderField(f)).join('');

      // Step 2 pitch deck - special fixed field
      if (s === 2) {
        html += `
          <div class="col-12 mt-3">
            <div class="premium-field">
              <label>Upload your pitch deck (PDF) <span class="required-star">*</span></label>
              <div class="file-premium-zone mt-2" id="fileUploadZone">
                <div class="p-4 border rounded-3 text-center transition-all bg-light">
                  <div class="icon-circle mb-3 mx-auto">📎</div>
                  <p class="mb-1 fw-medium">Upload Pitchdeck (PDF)</p>
                  <button type="button" class="btn btn-outline-dark btn-sm rounded-pill px-4 mt-2">Choose File</button>
                </div>
                <input type="file" id="startup_file" name="startup_file" class="d-none" accept=".pdf" />
                <div id="fileName" class="text-center mt-2 small fw-bold text-maroon">No file chosen</div>
                <div class="error-msg text-center mt-1" id="err_startup_file"></div>
              </div>
            </div>
          </div>
        `;
      }
      
      // Step 3 services - special fixed field
      if (s === 3) {
        html = `
          <div class="premium-field mb-4 w-100">
            <label class="mb-3">Please select the incubation services that you need: <span class="required-star">*</span></label>
            <div class="checkbox-multi-select g-3 row">
              ${['Office Space','Maker Space','Mentor Access','Lab equipment / Tech Support','Business / Network / Marketing','Seed money Assistance'].map((svc, i) => `
                <div class="col-md-6 col-lg-4">
                  <div class="premium-check-card">
                    <input type="checkbox" name="services_needed" value="${svc}" id="svc${i}" />
                    <label for="svc${i}"><span>${svc}</span></label>
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="error-msg mt-2" id="err_services"></div>
          </div>
        ` + html;
      }

      container.innerHTML = html;
    }
  } catch (e) { console.error('Dynamic fields load error', e); }
}

function renderField(f) {
  const reqAttr = f.required ? 'required' : '';
  const star = f.required ? '<span class="required-star">*</span>' : '';
  let inputHtml = '';

  if (['text', 'email', 'tel', 'number', 'date', 'url'].includes(f.field_type)) {
    inputHtml = `<input type="${f.field_type}" class="form-control premium-input" name="${f.field_name}" id="${f.field_name}" placeholder="${f.placeholder || ''}" ${reqAttr} />`;
  } else if (f.field_type === 'textarea') {
    inputHtml = `<textarea class="form-control premium-input" name="${f.field_name}" id="${f.field_name}" rows="2" placeholder="${f.placeholder || ''}" ${reqAttr}></textarea>`;
  } else if (f.field_type === 'select') {
    const opts = (f.options || '').split(',').map(o => `<option value="${o.trim()}">${o.trim()}</option>`).join('');
    inputHtml = `<select class="form-control premium-input form-select" name="${f.field_name}" id="${f.field_name}" ${reqAttr}>
      <option value="" disabled selected>${f.placeholder || 'Select...'}</option>
      ${opts}
    </select>`;
  }
  const colWidth = f.column_width || (f.field_type === 'textarea' ? 12 : 6);
  const colClass = `col-md-${colWidth}`;
  
  return `
    <div class="${colClass} mb-3">
      <div class="premium-field">
        <label for="${f.field_name}">${f.label} ${star}</label>
        ${inputHtml}
        <div class="error-msg" id="err_${f.field_name}"></div>
      </div>
    </div>`;
}

function id(name) { return document.getElementById(name); }

function initFormLogic() {
  const form = id('incubationForm');
  const steps = document.querySelectorAll('.form-step');
  const navItems = document.querySelectorAll('.nav-item');
  const nextBtn = id('nextBtn');
  const prevBtn = id('prevBtn');
  const submitBtn = id('submitBtn');
  const progressBar = id('progressBar');
  const currentStepText = id('currentStepText');

  function updateStep() {
    steps.forEach((step, idx) => {
      step.classList.toggle('active', idx + 1 === currentStep);
      step.classList.toggle('d-none', idx + 1 !== currentStep);
    });
    navItems.forEach((item, idx) => {
      item.classList.toggle('active', idx + 1 === currentStep);
      item.classList.toggle('completed', idx + 1 < currentStep);
    });
    prevBtn.classList.toggle('d-none', currentStep === 1);
    if (currentStep === totalSteps) {
      nextBtn.classList.add('d-none');
      submitBtn.classList.remove('d-none');
    } else {
      nextBtn.classList.remove('d-none');
      submitBtn.classList.add('d-none');
    }
    progressBar.style.width = `${(currentStep / totalSteps) * 100}%`;
    currentStepText.textContent = currentStep;
    
    // Update sticky header title
    const ftitle = id('formTitle');
    const fsub = id('formSubtitle');
    if (ftitle && fsub) {
      if (currentStep === 1) {
        ftitle.textContent = step1TitleStr;
        fsub.textContent = step1SubStr;
      } else {
        ftitle.textContent = stepTitles[currentStep].title;
        fsub.textContent = stepTitles[currentStep].subtitle;
      }
    }
    
    document.querySelector('.form-container-scroll').scrollTop = 0;
  }

  nextBtn.addEventListener('click', () => { if (validateStep(currentStep)) { currentStep++; updateStep(); } });
  prevBtn.addEventListener('click', () => { if (currentStep > 1) { currentStep--; updateStep(); } });

  const fileInput = id('startup_file');
  const fileName = id('fileName');
  const fileZone = id('fileUploadZone');
  if (fileInput && fileZone) {
    fileZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { fileName.textContent = fileInput.files[0]?.name || 'No file chosen'; });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep(4)) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    try {
      const res = await fetch('/api/apply', { method: 'POST', body: new FormData(form) });
      const data = await res.json();
      if (data.success) { id('successModal').classList.add('active'); form.reset(); }
      else alert(data.message);
    } catch (err) { alert('Network error'); }
    finally { submitBtn.disabled = false; submitBtn.textContent = 'Finish & Submit'; }
  });

  function validateStep(sNum) {
    clearAllErrors();
    let isValid = true;
    if (sNum <= 3) {
      const stepFields = dynamicFieldsConfig.filter(f => f.step === sNum && f.required);
      stepFields.forEach(f => {
        const el = id(f.field_name);
        if (!el) return;
        
        let val = el.value.trim();
        
        // 1. Required Check
        if (!val) {
          isValid = false;
          showError(`err_${f.field_name}`, 'This field is required');
          el.classList.add('error');
          return;
        }
        
        // 2. Format Validation
        if (f.field_type === 'email') {
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(val)) {
            isValid = false;
            showError(`err_${f.field_name}`, 'Please enter a valid email address');
            el.classList.add('error');
          }
        } 
        else if (f.field_type === 'tel') {
          // Allow spaces, +, - and digits. Typically 10 to 15 numbers long
          const phonePattern = /^[+\d\s-]{10,15}$/;
          if (!phonePattern.test(val)) {
            isValid = false;
            showError(`err_${f.field_name}`, 'Please enter a valid phone number (10-15 chars)');
            el.classList.add('error');
          }
        }
      });

      if (sNum === 2) {
        const fileInp = id('startup_file');
        if (!fileInp.files[0]) {
          isValid = false; showError('err_startup_file', 'Please upload your pitchdeck (PDF)');
        } else if (fileInp.files[0].type !== 'application/pdf' && !fileInp.files[0].name.toLowerCase().endsWith('.pdf')) {
          isValid = false; showError('err_startup_file', 'Only PDF files are allowed');
        } else if (fileInp.files[0].size > 10 * 1024 * 1024) {
          isValid = false; showError('err_startup_file', 'File size must be less than 10MB');
        }
      }
      if (sNum === 3 && !document.querySelector('input[name="services_needed"]:checked')) {
        isValid = false; showError('err_services', 'Please select at least one service');
      }
    } else {
      // Step 4: Final Confirmation checks
      const d1 = id('decl1')?.checked;
      const d2 = id('decl2')?.checked;
      const d3 = id('decl3')?.checked;
      const d4 = id('decl4')?.checked;
      if (!d1 || !d2 || !d3 || !d4) { 
        isValid = false; 
        showError('err_declaration', 'Please accept all declarations to proceed'); 
      }
    }
    return isValid;
  }

  function showError(tid, msg) { const el = id(tid); if (el) el.textContent = msg; }
  function clearAllErrors() {
    document.querySelectorAll('.error-msg').forEach(e => e.textContent = '');
    document.querySelectorAll('.premium-input').forEach(e => e.classList.remove('error'));
  }
  updateStep();
}

function closeModal() { id('successModal').classList.remove('active'); window.location.reload(); }

