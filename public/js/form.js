// form.js - MCC-MRF Incubation Form Logic

document.addEventListener('DOMContentLoaded', () => {

  // File upload display
  const fileInput = document.getElementById('startup_file');
  const fileName = document.getElementById('fileName');
  const fileZone = document.getElementById('fileUploadZone');

  if (fileInput && fileName) {
    fileInput.addEventListener('change', () => {
      fileName.textContent = fileInput.files[0] ? fileInput.files[0].name : 'No file chosen';
    });
  }

  if (fileZone && fileInput) {
    fileZone.addEventListener('click', (e) => {
      // Don't trigger if we clicked the actual input or label just to be safe
      if (e.target !== fileInput) {
        fileInput.click();
      }
    });
  }

  // Clear form button
  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to clear all form fields?')) {
        document.getElementById('incubationForm').reset();
        if (fileName) fileName.textContent = 'No file chosen';
        clearAllErrors();
      }
    });
  }

  // Form submit
  const form = document.getElementById('incubationForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.classList.add('loading');
    submitBtn.textContent = 'Submitting...';

    try {
      const formData = new FormData(form);
      const response = await fetch('/api/apply', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();

      if (result.success) {
        form.reset();
        if (fileName) fileName.textContent = 'No file chosen';
        document.getElementById('successModal').classList.add('active');
      } else {
        alert(result.message || 'Submission failed. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Please check your connection and try again.');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.textContent = 'Submit';
    }
  });
});

function validateForm() {
  clearAllErrors();
  let isValid = true;

  const required = [
    { id: 'applicant_name',     errId: 'err_applicant_name',     msg: 'Please enter your name.' },
    { id: 'startup_name',       errId: 'err_startup_name',       msg: 'Please enter the startup name.' },
    { id: 'address',            errId: 'err_address',            msg: 'Please enter your address/contact.' },
    { id: 'email',              errId: 'err_email',              msg: 'Please enter a valid email.', type: 'email' },
    { id: 'whatsapp',           errId: 'err_whatsapp',           msg: 'Please enter your WhatsApp number.' },
    { id: 'startup_description',errId: 'err_startup_description',msg: 'Please describe your startup idea.' },
    { id: 'plan_to_grow',       errId: 'err_plan_to_grow',       msg: 'Please answer this question.' },
    { id: 'how_connected',      errId: 'err_how_connected',      msg: 'Please answer this question.' },
    { id: 'dialog_approach',    errId: 'err_dialog_approach',    msg: 'Please answer this question.' },
    { id: 'reason_to_incubate', errId: 'err_reason_to_incubate', msg: 'Please answer this question.' },
    { id: 'contributor',        errId: 'err_contributor',        msg: 'Please answer this question.' },
    { id: 'success_establishing',errId:'err_success_establishing',msg: 'Please answer this question.' },
  ];

  required.forEach(({ id, errId, msg, type }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = el.value.trim();
    if (!val) {
      showError(errId, msg);
      el.classList.add('error');
      isValid = false;
    } else if (type === 'email' && !isValidEmail(val)) {
      showError(errId, 'Please enter a valid email address.');
      el.classList.add('error');
      isValid = false;
    }
  });

  // Checkboxes - at least one service
  const services = document.querySelectorAll('input[name="services_needed"]:checked');
  if (services.length === 0) {
    showError('err_services', 'Please select at least one service.');
    isValid = false;
  }

  // Declaration
  const decl1 = document.getElementById('decl1');
  if (!decl1 || !decl1.checked) {
    showError('err_declaration', 'You must agree to the declaration to submit.');
    isValid = false;
  }

  if (!isValid) {
    // Scroll to first error
    const firstErr = document.querySelector('.gf-error:not(:empty), .error');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return isValid;
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function clearAllErrors() {
  document.querySelectorAll('.gf-error').forEach(el => el.textContent = '');
  document.querySelectorAll('.gf-input.error').forEach(el => el.classList.remove('error'));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function closeModal() {
  document.getElementById('successModal').classList.remove('active');
}

// Remove error on input
document.addEventListener('input', (e) => {
  if (e.target.classList.contains('gf-input')) {
    e.target.classList.remove('error');
  }
});
