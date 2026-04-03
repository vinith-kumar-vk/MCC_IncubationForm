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


      // Step 3 services - special fixed field
      // Step 3 services - removed to avoid duplication with dynamic form builder

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
  } else if (f.field_type === 'file') {
    inputHtml = `
      <div class="file-premium-zone mt-2" onclick="document.getElementById('${f.field_name}').click()">
        <div class="p-4 border rounded-4 text-center transition-all bg-light hover-shadow-sm" style="transition: 1s;">
          <div class="icon-circle mb-3 mx-auto shadow-sm" style="width: 45px; height: 45px; background: white; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid #eee;">
            <i class="fas fa-file-upload text-maroon opacity-75"></i>
          </div>
          <p class="mb-1 fw-bold small text-uppercase opacity-75">Upload Document</p>
          <button type="button" class="btn btn-outline-dark btn-sm rounded-pill px-4 mt-2">Choose File</button>
        </div>
        <input type="file" name="${f.field_name}" id="${f.field_name}" class="d-none" ${reqAttr} 
          onchange="document.getElementById('${f.field_name}_filename').textContent = this.files[0]?.name || '${f.placeholder || 'No file chosen'}'" />
        <div id="${f.field_name}_filename" class="text-center mt-2 small fw-bold text-maroon">${f.placeholder || 'No file chosen'}</div>
      </div>`;
  } else if (f.field_type === 'radio' || f.field_type === 'checkbox') {
    const opts = (f.options || '').split(';').map(o => o.trim());
    const inputType = f.field_type;
    const itemsHtml = opts.map((opt, i) => {
      const fieldId = `${f.field_name}_${i}`;
      // Special handlers for conditional fields
      let onchangeAttr = '';
      const lowLabel = (f.label || '').toLowerCase();
      const lowName = (f.field_name || '').toLowerCase();
      if (lowName.includes('financial') || lowLabel.includes('financial support')) {
        onchangeAttr = `onchange="toggleFinancialProof(this.value)"`;
      } else if (lowName.includes('incubation') || lowLabel.includes('incubator') || lowLabel.includes('accelerator')) {
        onchangeAttr = `onchange="toggleIncubationSupport(this.value)"`;
      }

      // Consistent 3-column layout for services as requested
      let itemColClass = 'col-md-4';
      if (lowName.includes('services') || lowLabel.includes('services')) {
        itemColClass = 'col-md-4';
      } else if (f.field_type === 'radio') {
        itemColClass = 'col-md-6';
      }

      return `
        <div class="${itemColClass}">
          <div class="premium-check-card">
            <input type="${inputType}" name="${f.field_name}" value="${opt}" id="${fieldId}" ${reqAttr} ${onchangeAttr} />
            <label for="${fieldId}"><span>${opt}</span></label>
          </div>
        </div>
      `;
    }).join('');

    inputHtml = `<div class="row g-3 mt-1">${itemsHtml}</div>`;

    const lowLabel = (f.label || '').toLowerCase();
    const lowName = (f.field_name || '').toLowerCase();

    // If it's financial support, append the hidden proof upload field
    if (lowName.includes('financial') || lowLabel.includes('financial support')) {
      inputHtml += `
        <div id="financialProofSection" class="mt-4 financial-proof-zone mb-2" style="display:none;">
          <label class="mb-2 fw-bold small text-uppercase opacity-75">Upload Proof Document (PDF) <span class="required-star">*</span></label>
          <div class="file-premium-zone dynamic-upload-area p-3 border rounded-3 bg-white" onclick="document.getElementById('financial_proof').click()" style="cursor:pointer; border: 2px dashed #e2e8f0 !important;">
            <div class="d-flex align-items-center gap-3">
              <div class="icon-circle" style="width:40px; height:40px; font-size:16px;">📄</div>
              <div>
                <p class="mb-0 fw-bold small" id="proofFileName">Click to upload proof document</p>
                <p class="mb-0 text-muted" style="font-size:11px;">Official grant/investment letter (PDF only, max 5MB)</p>
              </div>
            </div>
            <input type="file" name="financial_proof" id="financial_proof" class="d-none" accept=".pdf" onchange="document.getElementById('proofFileName').textContent = this.files[0]?.name || ''" />
          </div>
          <div class="error-msg mt-1" id="err_financial_proof"></div>
        </div>
      `;
    }

    // If it's incubation status, append the incubator name field
    if (lowName.includes('incubation') || lowLabel.includes('incubator') || lowLabel.includes('accelerator')) {
      inputHtml += `
        <div id="incubationDetailsSection" class="mt-4 financial-proof-zone mb-2" style="display:none;">
          <label class="mb-2 fw-bold small text-uppercase opacity-75">Specify Incubator / Accelerator Name <span class="required-star">*</span></label>
          <input type="text" name="previous_incubator_name" id="previous_incubator_name" class="form-control premium-input" placeholder="e.g. T-Hub, StartupTN, IIT Incubator etc." />
          <div class="error-msg mt-1" id="err_previous_incubator_name"></div>
        </div>
      `;
    }
  }

  const colWidth = f.column_width || (['textarea', 'radio', 'checkbox'].includes(f.field_type) ? 12 : 6);
  const colClass = `col-md-${colWidth}`;

  const labelTag = f.field_type === 'file'
    ? `<label class="mb-2 fw-bold text-uppercase opacity-75 small">${f.label} ${star}</label>`
    : `<label for="${f.field_name}">${f.label} ${star}</label>`;

  let hintHtml = '';
  if (f.validation_rules) {
    try {
      const rules = JSON.parse(f.validation_rules);
      if (rules.max_words) hintHtml = `<div class="rule-hint">Word limit: ${rules.max_words} words</div>`;
      if (rules.max_size_mb) hintHtml = `<div class="rule-hint">Allowed: ${rules.allowed_ext || 'files'}, Max: ${rules.max_size_mb}MB</div>`;
    } catch(e){}
  }

  return `
    <div class="${colClass} mb-3">
      <div class="premium-field">
        ${labelTag}
        ${inputHtml}
        ${hintHtml}
        <div class="error-msg" id="err_${f.field_name}"></div>
      </div>
    </div>`;
}

function toggleFinancialProof(val) {
  // Logic handled by the general toggle conditional function if needed, 
  // but for simplicity we keep these specific ones for the requested fields.
  const section = document.getElementById('financialProofSection');
  if (section) section.style.display = val.toLowerCase() === 'yes' ? 'block' : 'none';
}

function toggleIncubationSupport(val) {
  const section = document.getElementById('incubationDetailsSection');
  if (section) section.style.display = val.toLowerCase() === 'yes' ? 'block' : 'none';
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


  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep(4)) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    try {
      const res = await fetch('/api/apply', { method: 'POST', body: new FormData(form) });
      const data = await res.json();
      if (data.success) { 
        id('successModal').classList.add('active'); 
        form.reset(); 
      } else {
        alert(data.message || 'Submission failed');
      }
    } catch (err) { 
      console.error('Submission error:', err);
      alert('Network error: ' + err.message); 
    }
    finally { submitBtn.disabled = false; submitBtn.textContent = 'Finish & Submit'; }
  });

  function validateStep(sNum) {
    clearAllErrors();
    let isValid = true;
    if (sNum <= 3) {
      const stepFields = dynamicFieldsConfig.filter(f => f.step === sNum && f.required);
      stepFields.forEach(f => {
        const el = (f.field_type === 'radio' || f.field_type === 'checkbox') ? document.querySelector(`input[name="${f.field_name}"]`) : id(f.field_name);
        if (!el) return;

        let val = el.value ? el.value.trim() : '';

        // 1. Required Check - Enhanced for Radios/Checkboxes/Files
        let hasValue = false;
        if (f.field_type === 'radio' || f.field_type === 'checkbox') {
          hasValue = !!document.querySelector(`input[name="${f.field_name}"]:checked`);
        } else if (f.field_type === 'file') {
          hasValue = !!el.files?.[0];
        } else {
          hasValue = !!val;
        }

        if (!hasValue) {
          isValid = false;
          showError(`err_${f.field_name}`, 'This field is required');
          const errEl = (f.field_type === 'file') ? el.parentElement : el;
          errEl.classList.add('error');
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
          const phonePattern = /^[+\d\s-]{10,15}$/;
          if (!phonePattern.test(val)) {
            isValid = false;
            showError(`err_${f.field_name}`, 'Please enter a valid phone number (10-15 chars)');
            el.classList.add('error');
          }
        }

        // 3. Dynamic Validation Rules
        if (f.validation_rules) {
          try {
            const rules = JSON.parse(f.validation_rules);
            // Textarea Word Count
            if (f.field_type === 'textarea' && rules.max_words) {
              const words = val.trim().split(/\s+/).filter(w => w.length > 0).length;
              if (words > rules.max_words) {
                isValid = false;
                showError(`err_${f.field_name}`, `Please limit to ${rules.max_words} words (Current: ${words})`);
                el.classList.add('error');
              }
            }
            // File Validation
            if (f.field_type === 'file' && el.files[0]) {
              const file = el.files[0];
              if (rules.allowed_ext === 'pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                isValid = false; showError(`err_${f.field_name}`, 'Only PDF files are allowed');
                el.parentElement.classList.add('error');
              }
              if (rules.max_size_mb && file.size > rules.max_size_mb * 1024 * 1024) {
                isValid = false; showError(`err_${f.field_name}`, `File size must be less than ${rules.max_size_mb}MB`);
                el.parentElement.classList.add('error');
              }
            }
          } catch(e){}
        }
      });

      if (sNum === 3) {
        if (!document.querySelector('input[name="services_needed"]:checked')) {
          isValid = false; showError('err_services', 'Please select at least one service');
        }

        // Dynamic conditional validation based on keywords
        dynamicFieldsConfig.filter(f => f.step === 3).forEach(f => {
          const lowLabel = (f.label || '').toLowerCase();
          const lowName = (f.field_name || '').toLowerCase();
          const val = document.querySelector(`input[name="${f.field_name}"]:checked`)?.value?.toLowerCase();

          if (val === 'yes') {
            if (lowName.includes('financial') || lowLabel.includes('financial support')) {
              const proofInp = id('financial_proof');
              if (!proofInp?.files[0]) {
                isValid = false; showError('err_financial_proof', 'Please upload your proof document (PDF)');
              } else if (proofInp.files[0].size > 5 * 1024 * 1024) {
                isValid = false; showError('err_financial_proof', 'File size must be less than 5MB');
              }
            } else if (lowName.includes('incubation') || lowLabel.includes('incubator') || lowLabel.includes('accelerator')) {
              const incNameInp = id('previous_incubator_name');
              if (!incNameInp?.value.trim()) {
                isValid = false;
                showError('err_previous_incubator_name', 'Please specify the incubator name');
                incNameInp?.classList.add('error');
              }
            }
          }

          // Always validate "Services" field if label contains 'services'
          if (lowLabel.includes('services') && f.field_type === 'checkbox') {
            if (!document.querySelector(`input[name="${f.field_name}"]:checked`)) {
              isValid = false;
              showError(`err_${f.field_name}`, 'Please select at least one service');
            }
          }
        });
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

