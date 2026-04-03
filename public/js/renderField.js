function renderField(f) {
  const reqAttr = f.required ? 'required' : '';
  const star = f.required ? '<span class="required-star">*</span>' : '';
  const colClass = f.column_width || (['textarea', 'radio', 'checkbox'].includes(f.field_type) ? 'col-12' : 'col-md-6');
  let inputHtml = '';

  if (['text', 'email', 'tel', 'number', 'date', 'url'].includes(f.field_type)) {
    let counterHtml = '';
    let rules = {};
    if (f.validation_rules) {
      try { rules = JSON.parse(f.validation_rules); } catch(e){}
    }
    if (rules.max_words) {
      counterHtml = `<div id="counter_${f.field_name}" class="mt-1 small opacity-75 text-end">0 / ${rules.max_words} words</div>`;
    }
    inputHtml = `<input type="${f.field_type}" class="form-control premium-input" name="${f.field_name}" id="${f.field_name}" placeholder="${f.placeholder || ''}" ${reqAttr} oninput="updateWordCount('${f.field_name}', ${rules.max_words || 0})" />${counterHtml}`;
  } else if (f.field_type === 'textarea') {
    let counterHtml = '';
    let rules = {};
    if (f.validation_rules) {
      try { rules = JSON.parse(f.validation_rules); } catch(e){}
    }
    if (rules.max_words) {
      counterHtml = `<div id="counter_${f.field_name}" class="mt-1 small opacity-75 text-end">0 / ${rules.max_words} words</div>`;
    }
    inputHtml = `
      <textarea class="form-control premium-input" name="${f.field_name}" id="${f.field_name}" rows="3" placeholder="${f.placeholder || ''}" ${reqAttr} oninput="updateWordCount('${f.field_name}', ${rules.max_words || 0})"></textarea>
      ${counterHtml}
    `;
  } else if (f.field_type === 'select') {
    const opts = (f.options || '').split(',').map(o => `<option value="${o.trim()}">${o.trim()}</option>`).join('');
    inputHtml = `<select class="form-control premium-input form-select" name="${f.field_name}" id="${f.field_name}" ${reqAttr}>
      <option value="" disabled selected>${f.placeholder || 'Select...'}</option>
      ${opts}
    </select>`;
  } else if (f.field_type === 'file') {
    let rules = {}; try { rules = JSON.parse(f.validation_rules || '{}'); } catch(e){}
    const allowUrl = !!rules.allow_url;
    const maxSize = rules.max_size || 5;
    const sizeUnit = rules.size_unit || 'MB';
    const customHint = rules.custom_hint || '';
    const labelUpper = (f.label || "").toUpperCase();
    const restrictionText = `Allowed: ${rules.allowed_ext || 'PDF'} ${allowUrl ? 'or Website Link' : ''}, Max: ${maxSize}${sizeUnit} ${customHint ? '('+customHint+')' : ''}`;
    
    inputHtml = `
      <div class="file-premium-zone mt-2" onclick="document.getElementById('${f.field_name}').click()">
        <div class="p-4 border rounded-4 text-center transition-all bg-light hover-shadow-sm" style="transition: 1s;">
          <div class="icon-circle mb-3 mx-auto shadow-sm" style="width: 45px; height: 45px; background: white; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid #eee;">
            <i class="fas fa-file-upload text-maroon opacity-75"></i>
          </div>
          <p class="mb-1 fw-bold small text-uppercase opacity-75">${labelUpper.includes('PITCH DECK') ? 'Upload Pitch Deck' : 'Upload Document'}</p>
          <button type="button" class="btn btn-outline-dark btn-sm rounded-pill px-4 mt-2">Choose File</button>
        </div>
        <input type="file" name="${f.field_name}" id="${f.field_name}" class="d-none" ${reqAttr} 
          onchange="handleFileSelection('${f.field_name}', this)" />
        <div id="${f.field_name}_filename" class="text-center mt-2 small fw-bold text-maroon">${f.placeholder || 'No file chosen'}</div>
        <div class="text-center text-muted mt-1" style="font-size: 11px;">${restrictionText}</div>
      </div>`;

    if (allowUrl) {
      inputHtml += `
        <div class="mt-3 text-center separator-text"><span class="bg-white px-2 small text-muted">OR</span></div>
        <div class="mt-2 text-start">
          <label class="form-label small fw-bold opacity-75">Provide URL (e.g. Google Drive, Canva)</label>
          <input type="url" name="${f.field_name}_url" id="${f.field_name}_url" class="form-control premium-input shadow-none" placeholder="https://..." oninput="handleUrlInput('${f.field_name}')" />
        </div>
      `;
    }
  } else if (f.field_type === 'radio' || f.field_type === 'checkbox') {
    const opts = (f.options || '').split(';').map(o => o.trim());
    const inputType = f.field_type;
    const itemsHtml = opts.map((opt, i) => {
      const fieldId = `${f.field_name}_${i}`;
      let onchangeAttr = '';
      const lowLabel = (f.label || '').toLowerCase();
      const lowName = (f.field_name || '').toLowerCase();
      if (lowName.includes('financial') || lowLabel.includes('financial support')) {
        onchangeAttr = `onchange="toggleFinancialProof(this.value)"`;
      } else if (lowName.includes('incubation') || lowLabel.includes('incubator') || lowLabel.includes('accelerator')) {
        onchangeAttr = `onchange="toggleIncubationSupport(this.value)"`;
      }

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

  const labelHtml = f.field_type === 'file' 
    ? '' 
    : `<label class="form-label small fw-bold opacity-75 text-uppercase tracking-wider" for="${f.field_name}">
        ${f.label} ${star}
      </label>`;

  return `
    <div class="${colClass}">
      <div class="mb-3">
        ${labelHtml}
        ${inputHtml}
        <div id="err_${f.field_name}" class="error-msg text-danger small mt-1"></div>
      </div>
    </div>
  `;
}
