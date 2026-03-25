// form.js - MCC-MRF Ultra-Premium Multi-Step Logic

document.addEventListener('DOMContentLoaded', () => {
  let currentStep = 1;
  const totalSteps = 4;

  const form = document.getElementById('incubationForm');
  const steps = document.querySelectorAll('.form-step');
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');
  const submitBtn = document.getElementById('submitBtn');
  const progressBar = id('progressBar');
  const currentStepText = id('currentStepText');
  const navItems = document.querySelectorAll('.nav-item');

  // Utility to get element by ID
  function id(name) { return document.getElementById(name); }

  // Step Navigation Logic
  function updateStep() {
    steps.forEach((step, idx) => {
      step.classList.toggle('active', idx + 1 === currentStep);
      step.classList.toggle('d-none', idx + 1 !== currentStep);
    });

    navItems.forEach((item, idx) => {
      item.classList.toggle('active', idx + 1 === currentStep);
      item.classList.toggle('completed', idx + 1 < currentStep);
    });

    // Buttons visibility
    prevBtn.classList.toggle('d-none', currentStep === 1);
    
    if (currentStep === totalSteps) {
      nextBtn.classList.add('d-none');
      submitBtn.classList.remove('d-none');
    } else {
      nextBtn.classList.remove('d-none');
      submitBtn.classList.add('d-none');
    }

    // Progress
    const progressPercent = (currentStep / totalSteps) * 100;
    progressBar.style.width = `${progressPercent}%`;
    currentStepText.textContent = currentStep;

    // Update Header Breadcrumb Label
    const stepLabels = [
      "Bio & Contact",
      "Startup Vision",
      "Incubation Support",
      "Final Confirmation"
    ];
    id('currentStepLabel').textContent = stepLabels[currentStep - 1];

    // Scroll top
    document.querySelector('.form-container-scroll').scrollTop = 0;
  }

  nextBtn.addEventListener('click', () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        currentStep++;
        updateStep();
      }
    }
  });

  prevBtn.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      updateStep();
    }
  });

  // Sidebar clicking (only for completed or current steps)
  navItems.forEach((item, idx) => {
    item.addEventListener('click', () => {
      const targetStep = idx + 1;
      if (targetStep < currentStep || validateStep(currentStep)) {
        currentStep = targetStep;
        updateStep();
      }
    });
  });

  // File upload display
  const fileInput = id('startup_file');
  const fileName = id('fileName');
  const fileZone = id('fileUploadZone');

  if (fileInput && fileZone) {
    fileZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      fileName.textContent = fileInput.files[0] ? fileInput.files[0].name : 'No file chosen';
    });
  }

  // Clear form
  id('clearBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Clear all fields and restart?')) {
      form.reset();
      fileName.textContent = 'No file chosen';
      currentStep = 1;
      clearAllErrors();
      updateStep();
    }
  });

  // Form final submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep(4)) return;

    submitBtn.classList.add('loading');
    submitBtn.textContent = 'Processing...';

    try {
      const formData = new FormData(form);
      const response = await fetch('/api/apply', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();

      if (result.success) {
        id('successModal').classList.add('active');
        form.reset();
      } else {
        alert(result.message || 'Submission failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error.');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.textContent = 'Finish & Submit';
    }
  });

  function validateStep(stepNum) {
    clearAllErrors();
    let isValid = true;
    
    const stepFields = {
      1: [
        { id: 'applicant_name', msg: 'Name is required' },
        { id: 'email', msg: 'Valid email required', type: 'email' },
        { id: 'whatsapp', msg: 'WhatsApp is required' },
        { id: 'address', msg: 'Address is required' },
        { id: 'professional_status', msg: 'Please select professional status' }
      ],
      2: [
        { id: 'startup_name', msg: 'Startup name is required' },
        { id: 'startup_file', msg: 'Pitchdeck is required' },
        { id: 'plan_to_grow', msg: 'Growth plan is required' }
      ],
      3: [
        { id: 'financial_support', msg: 'Required field' },
        { id: 'incubation_support', msg: 'Required field' },
        { id: 'incubation_duration', msg: 'Required field' },
        { id: 'association_type', msg: 'Required field' },
        { id: 'incubation_help', msg: 'Required field' }
      ],
      4: [
        { id: 'decl1', msg: 'Must accept all declarations', type: 'checkbox' },
        { id: 'decl2', msg: '', type: 'checkbox' },
        { id: 'decl3', msg: '', type: 'checkbox' },
        { id: 'decl4', msg: '', type: 'checkbox' }
      ]
    };

    const currentFields = stepFields[stepNum] || [];
    currentFields.forEach(f => {
      const el = id(f.id);
      if (!el) return;
      
      if (f.type === 'checkbox') {
        if (!el.checked) {
          isValid = false;
          showError('err_declaration', f.msg || 'Please accept all terms.');
        }
      } else {
        const val = el.value.trim();
        if (!val) {
          isValid = false;
          showError(`err_${f.id}`, f.msg);
          el.classList.add('error');
        } else if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          isValid = false;
          showError(`err_${f.id}`, 'Invalid email address');
          el.classList.add('error');
        }
      }
    });

    if (stepNum === 3) {
      const checked = document.querySelectorAll('input[name="services_needed"]:checked');
      if (checked.length === 0) {
        isValid = false;
        showError('err_services', 'Select at least one service');
      }
    }

    return isValid;
  }

  function showError(targetId, msg) {
    const el = id(targetId);
    if (el) el.textContent = msg;
  }

  function clearAllErrors() {
    document.querySelectorAll('.error-msg').forEach(e => e.textContent = '');
    document.querySelectorAll('.premium-input').forEach(e => e.classList.remove('error'));
  }

  // Initial call
  updateStep();
});

function closeModal() {
  document.getElementById('successModal').classList.remove('active');
  window.location.reload();
}
