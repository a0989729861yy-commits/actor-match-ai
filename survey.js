(() => {
  'use strict';

  const STORAGE_KEY = 'matchlens_preferences';
  const dimensions = [
    { name: '外型風格', weightName: 'wAppearance', outputId: 'valueAppearance' },
    { name: '氣質人設', weightName: 'wPersonality', outputId: 'valuePersonality' },
    { name: '作品類型', weightName: 'wGenre', outputId: 'valueGenre' },
    { name: '表演風格', weightName: 'wPerformance', outputId: 'valuePerformance' },
    { name: '資歷區間', weightName: 'wExperience', outputId: 'valueExperience' },
    { name: '觀看情境', weightName: 'wViewing', outputId: 'valueViewing' }
  ];

  const form = document.getElementById('surveyForm');
  if (!form) return;

  const panels = Array.from(form.querySelectorAll('.question-card'));
  const previousButton = document.getElementById('previousButton');
  const nextButton = document.getElementById('nextButton');
  const submitButton = document.getElementById('submitButton');
  const progressTrack = document.getElementById('progressTrack');
  const progressFill = document.getElementById('progressFill');
  const stepLabel = document.getElementById('stepLabel');
  const progressPercent = document.getElementById('progressPercent');
  const weightSummary = document.getElementById('weightSummary');
  const weightTotal = document.getElementById('weightTotal');
  const message = document.getElementById('formMessage');
  const genreUnlimited = document.getElementById('genreUnlimited');
  const genreInputs = Array.from(form.querySelectorAll('input[name="genre"]'));
  let currentStep = 0;

  function getRawWeights() {
    const scores = dimensions.map(({ weightName }) => Number(form.elements[weightName].value));
    const sum = scores.reduce((total, score) => total + score, 0);
    return scores.map((score, index) => ({
      name: dimensions[index].name,
      score,
      percentage: score / sum * 100
    }));
  }

  // Allocate exact display hundredths with largest remainder; calculation/storage keeps raw precision.
  function getDisplayWeights() {
    const weights = getRawWeights();
    const exactHundredths = weights.map(item => item.percentage * 100);
    const hundredths = exactHundredths.map(Math.floor);
    const remainder = 10000 - hundredths.reduce((total, value) => total + value, 0);
    const sorted = exactHundredths
      .map((value, index) => ({ index, fraction: value - hundredths[index] }))
      .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

    for (let index = 0; index < remainder; index += 1) {
      hundredths[sorted[index].index] += 1;
    }
    return weights.map((item, index) => ({ ...item, displayPercentage: hundredths[index] / 100 }));
  }

  function renderWeights() {
    const displayWeights = getDisplayWeights();
    weightSummary.replaceChildren();

    displayWeights.forEach(item => {
      const wrapper = document.createElement('div');
      wrapper.className = 'weight-item';
      const heading = document.createElement('div');
      heading.className = 'weight-item-head';
      const name = document.createElement('span');
      name.textContent = item.name;
      const percentage = document.createElement('strong');
      percentage.textContent = `${item.displayPercentage.toFixed(2)}%`;
      heading.append(name, percentage);
      const bar = document.createElement('div');
      bar.className = 'weight-bar';
      const fill = document.createElement('span');
      fill.style.width = `${item.displayPercentage}%`;
      bar.append(fill);
      wrapper.append(heading, bar);
      weightSummary.append(wrapper);
    });

    const displayTotal = displayWeights.reduce((total, item) => total + item.displayPercentage, 0);
    weightTotal.textContent = `${displayTotal.toFixed(2)}%`;

    dimensions.forEach(({ weightName, outputId }) => {
      document.getElementById(outputId).textContent = `${form.elements[weightName].value} / 5`;
    });
  }

  function updateStep() {
    panels.forEach((panel, index) => {
      const isActive = index === currentStep;
      panel.hidden = !isActive;
      panel.classList.toggle('active', isActive);
    });
    const completedPercent = Math.round(((currentStep + 1) / panels.length) * 100);
    progressFill.style.width = `${completedPercent}%`;
    progressTrack.setAttribute('aria-valuenow', String(currentStep + 1));
    stepLabel.textContent = `第 ${currentStep + 1} / ${panels.length} 步`;
    progressPercent.textContent = `${completedPercent}%`;
    previousButton.hidden = currentStep === 0;
    nextButton.hidden = currentStep === panels.length - 1;
    submitButton.hidden = currentStep !== panels.length - 1;
  }

  function validateCurrentStep() {
    const panel = panels[currentStep];
    const requiredSelects = Array.from(panel.querySelectorAll('select[required]'));
    for (const select of requiredSelects) {
      if (!select.value) {
        select.focus();
        select.setCustomValidity('請完成此必填題目。');
        select.reportValidity();
        select.setCustomValidity('');
        return false;
      }
    }

    if (panel.querySelector('input[name="genre"]')) {
      const selected = genreInputs.some(input => input.checked);
      const error = document.getElementById('genreError');
      error.hidden = selected;
      if (!selected) {
        genreInputs[0].focus();
        return false;
      }
    }
    return true;
  }

  function setGenreExclusivity(changedInput) {
    if (changedInput === genreUnlimited && genreUnlimited.checked) {
      genreInputs.forEach(input => { if (input !== genreUnlimited) input.checked = false; });
    } else if (changedInput !== genreUnlimited && changedInput.checked) {
      genreUnlimited.checked = false;
    }
    document.getElementById('genreError').hidden = genreInputs.some(input => input.checked);
  }

  genreInputs.forEach(input => input.addEventListener('change', () => setGenreExclusivity(input)));
  form.addEventListener('input', renderWeights);

  previousButton.addEventListener('click', () => {
    if (currentStep > 0) {
      currentStep -= 1;
      updateStep();
      panels[currentStep].querySelector('select, input')?.focus({ preventScroll: true });
    }
  });

  nextButton.addEventListener('click', () => {
    if (!validateCurrentStep()) return;
    if (currentStep < panels.length - 1) {
      currentStep += 1;
      updateStep();
      panels[currentStep].querySelector('select, input')?.focus({ preventScroll: true });
    }
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    message.hidden = true;
    message.classList.remove('error');
    if (currentStep !== panels.length - 1 || !validateCurrentStep()) return;

    const invalidRequired = Array.from(form.querySelectorAll('select[required]')).find(select => !select.value);
    if (invalidRequired) {
      const panelIndex = panels.indexOf(invalidRequired.closest('.question-card'));
      if (panelIndex >= 0) {
        currentStep = panelIndex;
        updateStep();
        invalidRequired.focus();
      }
      return;
    }

    const preferences = {
      appearance: form.elements.appearance.value,
      personality: form.elements.personality.value,
      genres: genreInputs.filter(input => input.checked).map(input => input.value),
      performance: form.elements.performance.value,
      experience: form.elements.experience.value,
      viewing: {
        platform: form.elements.platform.value,
        duration: form.elements.duration.value,
        quality: form.elements.quality.value
      },
      weights: getRawWeights(),
      savedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      message.classList.remove('error');
      message.textContent = '';
      const success = document.createElement('strong');
      success.textContent = '偏好資料已成功儲存。';
      const detail = document.createElement('p');
      detail.textContent = '答案與原始重要度已保存在此瀏覽器。';
      const resultLink = document.createElement('a');
      resultLink.href = 'result.html';
      resultLink.textContent = '查看推薦結果 →';
      message.append(success, detail, resultLink);
      message.hidden = false;
      message.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      message.classList.add('error');
      message.textContent = '無法儲存問卷資料。請檢查瀏覽器本機儲存空間或隱私設定後再試。';
      message.hidden = false;
    }
  });

  renderWeights();
  updateStep();
})();
