(() => {
  'use strict';

  const STORAGE_KEY = 'matchlens_preferences';
  const NEUTRAL = '沒有特別偏好';
  const DIMENSIONS = [
    {
      key: 'appearance', name: '外型風格', weightName: 'wAppearance',
      description: '選擇最接近你偏好的整體形象；單選，未指定會以中性偏好處理。', type: 'single',
      options: ['清新自然', '成熟穩重', '陽光活潑', '優雅知性', '個性時尚', NEUTRAL]
    },
    {
      key: 'personality', name: '氣質人設', weightName: 'wPersonality',
      description: '依公開形象描述選擇一項；未指定不會當作負向匹配。', type: 'single',
      options: ['溫柔親切', '幽默風趣', '自信獨立', '沉穩內斂', '熱情活潑', NEUTRAL]
    },
    {
      key: 'genres', name: '作品類型', weightName: 'wGenre',
      description: '可複選喜愛題材；選「作品類型不限」即可略過此偏好。', type: 'multiple',
      options: ['喜劇', '愛情', '科幻', '懸疑', '動作', '劇情', '紀錄片', '動畫', '作品類型不限'],
      unrestricted: '作品類型不限'
    },
    {
      key: 'performance', name: '表演風格', weightName: 'wPerformance',
      description: '選擇你偏好的演出方式；若不在意可使用中性選項。', type: 'single',
      options: ['自然寫實', '情感細膩', '幽默誇張', '感染力強', '風格多變', NEUTRAL]
    },
    {
      key: 'experience', name: '資歷區間', weightName: 'wExperience',
      description: '依目前可取得的公開資料標籤比較；不限定時不會扣分。', type: 'single',
      options: ['新生代演員', '發展中演員', '資深演員', '不限資歷']
    },
    {
      key: 'viewing', name: '觀看情境', weightName: 'wViewing',
      description: '分別設定平台、片長和畫質；各小題都可以選擇不限。', type: 'group',
      fields: [
        { key: 'platform', label: '偏好平台', options: ['串流平台', '電影院', '電視', '免費影音平台', '不限平台'] },
        { key: 'duration', label: '偏好片長', options: ['30 分鐘以內', '30～60 分鐘', '60～120 分鐘', '120 分鐘以上', '不限片長'] },
        { key: 'quality', label: '畫質需求', options: ['一般畫質即可', 'Full HD', '4K 高畫質', '沒有特別要求'] }
      ]
    }
  ];

  const form = document.getElementById('surveyForm');
  if (!form) return;

  const panelsRoot = document.getElementById('questionPanels');
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
  if (![panelsRoot, previousButton, nextButton, submitButton, progressTrack, progressFill, stepLabel, progressPercent, weightSummary, weightTotal, message].every(Boolean)) return;

  let panels = [];
  let currentStep = 0;
  let isSubmitting = false;

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function createSearch(panel, titleId) {
    const wrap = make('div', 'option-search');
    const label = make('label', 'field-label', '搜尋選項');
    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'option-search-input';
    input.placeholder = '輸入關鍵字篩選';
    input.setAttribute('aria-label', '搜尋此維度的選項');
    input.setAttribute('aria-controls', titleId);
    label.append(input);
    wrap.append(label);
    panel.append(wrap);
    return input;
  }

  function createChoiceGroup({ panel, dimension, groupKey, title, options, type = 'checkbox', searchInput }) {
    const fieldset = make('fieldset', 'choice-fieldset');
    const legend = make('legend', '', title);
    fieldset.append(legend);
    const grid = make('div', 'choice-grid');
    grid.id = `${dimension.key}-${groupKey}-options`;
    const noMatches = make('p', 'option-empty', '沒有符合的選項。');
    noMatches.hidden = true;

    options.forEach((value, index) => {
      const label = make('label', `choice${value === dimension.unrestricted ? ' choice-unlimited' : ''}`);
      const input = document.createElement('input');
      input.type = type;
      input.name = groupKey;
      input.value = value;
      input.id = `${dimension.key}-${groupKey}-${index}`;
      input.dataset.dimension = dimension.key;
      input.dataset.group = groupKey;
      const text = make('span', '', value);
      label.htmlFor = input.id;
      label.append(input, text);
      grid.append(label);
    });
    fieldset.append(grid, noMatches);
    panel.append(fieldset);

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLocaleLowerCase();
        let visibleCount = 0;
        Array.from(grid.children).forEach(label => {
          const visible = label.textContent.toLocaleLowerCase().includes(query);
          label.hidden = !visible;
          if (visible) visibleCount += 1;
        });
        noMatches.hidden = visibleCount > 0;
      });
    }
    return grid;
  }

  function createPanel(dimension, index) {
    const panel = make('section', 'question-card');
    panel.dataset.step = String(index);
    panel.setAttribute('aria-labelledby', `${dimension.key}Title`);
    panel.hidden = index !== 0;

    const heading = make('div', 'question-heading');
    heading.append(make('span', 'question-number', String(index + 1).padStart(2, '0')));
    const headingCopy = document.createElement('div');
    const title = make('h2', '', dimension.name);
    title.id = `${dimension.key}Title`;
    headingCopy.append(title, make('p', '', dimension.description));
    heading.append(headingCopy);
    panel.append(heading);

    const search = createSearch(panel, `${dimension.key}-choices`);
    if (dimension.type === 'single' || dimension.type === 'multiple') {
      createChoiceGroup({
        panel,
        dimension,
        groupKey: dimension.key,
        title: dimension.type === 'multiple' ? '偏好類型（可複選）' : '選擇一項偏好',
        options: dimension.options,
        type: dimension.type === 'multiple' ? 'checkbox' : 'radio',
        searchInput: search
      });
    } else if (dimension.type === 'group') {
      dimension.fields.forEach(field => {
        const label = make('label', 'field-label sub-field', field.label);
        const select = document.createElement('select');
        select.name = `viewing.${field.key}`;
        select.dataset.dimension = dimension.key;
        select.setAttribute('aria-label', field.label);
        field.options.forEach(value => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          select.append(option);
        });
        label.append(select);
        panel.append(label);
      });
      search.addEventListener('input', () => {
        const query = search.value.trim().toLocaleLowerCase();
        panel.querySelectorAll('select[name^="viewing."] option').forEach(option => {
          option.hidden = Boolean(query) && !option.textContent.toLocaleLowerCase().includes(query);
        });
      });
    }

    const skipRow = make('label', 'skip-control');
    const skip = document.createElement('input');
    skip.type = 'checkbox';
    skip.name = `skip.${dimension.key}`;
    skip.dataset.skipDimension = dimension.key;
    skip.id = `skip-${dimension.key}`;
    skipRow.append(skip, make('span', '', '略過此維度（不把未填偏好視為不符合）'));
    panel.append(skipRow);

    const weightBox = make('div', 'weight-control');
    const weightHead = make('div', 'weight-label');
    const weightId = `weight-${dimension.key}`;
    const weightLabel = make('label', '', '此維度的重要程度');
    weightLabel.htmlFor = weightId;
    const output = make('output', '', '3 / 5');
    output.id = `value-${dimension.key}`;
    output.htmlFor = weightId;
    weightHead.append(weightLabel, output);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = weightId;
    slider.name = dimension.weightName;
    slider.min = '1';
    slider.max = '5';
    slider.step = '1';
    slider.value = '3';
    slider.dataset.weightDimension = dimension.key;
    const hints = make('div', 'range-hints');
    hints.append(make('span', '', '較不重要'), make('span', '', '非常重要'));
    weightBox.append(weightHead, slider, hints);
    panel.append(weightBox);

    skip.addEventListener('change', () => {
      panel.classList.toggle('dimension-skipped', skip.checked);
      panel.querySelectorAll(`[data-dimension="${dimension.key}"]:not([data-skip-dimension])`).forEach(control => {
        control.disabled = skip.checked;
      });
      slider.disabled = skip.checked;
      if (skip.checked) {
        panel.querySelectorAll(`input[name="${dimension.key}"]`).forEach(input => { input.checked = false; });
        if (dimension.key === 'viewing') {
          dimension.fields.forEach(field => {
            const select = panel.querySelector(`[name="viewing.${field.key}"]`);
            if (select) select.selectedIndex = select.options.length - 1;
          });
        }
      }
      renderWeights();
    });
    slider.addEventListener('input', () => {
      output.textContent = `${slider.value} / 5`;
      renderWeights();
    });
    return panel;
  }

  function renderPanels() {
    panelsRoot.replaceChildren();
    panels = DIMENSIONS.map((dimension, index) => createPanel(dimension, index));
    panels.forEach(panel => panelsRoot.append(panel));
  }

  function getNormalizedWeights() {
    const raw = DIMENSIONS.map(dimension => {
      const panel = panels.find(item => item.dataset.step === String(DIMENSIONS.indexOf(dimension)));
      const skipped = panel.querySelector(`[data-skip-dimension="${dimension.key}"]`).checked;
      return skipped ? 0 : Number(panel.querySelector(`[data-weight-dimension="${dimension.key}"]`).value);
    });
    let total = raw.reduce((sum, score) => sum + score, 0);
    if (total === 0) {
      raw.fill(1);
      total = raw.length;
    }
    return raw.map((score, index) => ({
      name: DIMENSIONS[index].name,
      score,
      percentage: score / total * 100
    }));
  }

  function getDisplayWeights() {
    const weights = getNormalizedWeights();
    const eligible = weights.map(item => item.percentage > 0);
    const exactCents = weights.map(item => item.percentage * 100);
    const cents = exactCents.map(Math.floor);
    const targetCents = eligible.some(Boolean) ? 10000 : 10000;
    const remainder = targetCents - cents.reduce((sum, value) => sum + value, 0);
    const priority = exactCents.map((value, index) => ({ index, fraction: value - cents[index], enabled: eligible[index] }))
      .sort((a, b) => Number(b.enabled) - Number(a.enabled) || b.fraction - a.fraction || a.index - b.index);
    for (let i = 0; i < remainder; i += 1) cents[priority[i % priority.length].index] += 1;
    return weights.map((item, index) => ({ ...item, displayPercentage: cents[index] / 100 }));
  }

  function renderWeights() {
    const display = getDisplayWeights();
    weightSummary.replaceChildren();
    display.forEach(item => {
      const row = make('div', 'weight-item');
      const head = make('div', 'weight-item-head');
      const skipped = item.score === 0;
      head.append(make('span', '', `${item.name}${skipped ? '（略過）' : ''}`), make('strong', '', `${item.displayPercentage.toFixed(2)}%`));
      const bar = make('div', 'weight-bar');
      const fill = document.createElement('span');
      fill.style.width = `${item.displayPercentage}%`;
      bar.append(fill);
      row.append(head, bar);
      weightSummary.append(row);
    });
    weightTotal.textContent = `${display.reduce((sum, item) => sum + item.displayPercentage, 0).toFixed(2)}%`;
  }

  function updateStep() {
    panels.forEach((panel, index) => {
      const active = index === currentStep;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });
    const percent = Math.round(((currentStep + 1) / panels.length) * 100);
    progressFill.style.width = `${percent}%`;
    progressTrack.setAttribute('aria-valuenow', String(currentStep + 1));
    stepLabel.textContent = `第 ${currentStep + 1} / ${panels.length} 步`;
    progressPercent.textContent = `${percent}%`;
    previousButton.hidden = currentStep === 0;
    nextButton.hidden = currentStep === panels.length - 1;
    submitButton.hidden = currentStep !== panels.length - 1;
  }

  function validateCurrentStep() {
    const panel = panels[currentStep];
    const skipped = panel.querySelector('[data-skip-dimension]')?.checked;
    if (skipped) return true;
    const dimension = DIMENSIONS[currentStep];
    if (dimension.type === 'single' && !panel.querySelector(`input[name="${dimension.key}"]:checked`)) {
      panel.querySelector(`input[name="${dimension.key}"]`)?.focus();
      return false;
    }
    if (dimension.type === 'multiple' && !panel.querySelector(`input[name="${dimension.key}"]:checked`)) {
      panel.querySelector(`input[name="${dimension.key}"]`)?.focus();
      return false;
    }
    return true;
  }

  function collectPreferences() {
    const values = {};
    const skippedDimensions = [];
    DIMENSIONS.forEach((dimension, index) => {
      const panel = panels[index];
      const skipped = panel.querySelector(`[data-skip-dimension="${dimension.key}"]`).checked;
      if (skipped) skippedDimensions.push(dimension.name);
      if (dimension.type === 'single') {
        values[dimension.key] = skipped
          ? (dimension.key === 'experience' ? '不限資歷' : NEUTRAL)
          : (panel.querySelector(`input[name="${dimension.key}"]:checked`)?.value || (dimension.key === 'experience' ? '不限資歷' : NEUTRAL));
      } else if (dimension.type === 'multiple') {
        const selected = skipped ? [] : Array.from(panel.querySelectorAll(`input[name="${dimension.key}"]:checked`)).map(input => input.value);
        values[dimension.key] = selected.length ? selected : [dimension.unrestricted];
      } else if (dimension.type === 'group') {
        values[dimension.key] = {};
        dimension.fields.forEach(field => {
          const select = panel.querySelector(`[name="viewing.${field.key}"]`);
          values[dimension.key][field.key] = skipped ? field.options[field.options.length - 1] : select.value;
        });
      }
    });
    return {
      ...values,
      weights: getNormalizedWeights(),
      skippedDimensions,
      weightMode: 'normalized',
      savedAt: new Date().toISOString()
    };
  }

  function showMessage(title, detail, isError = false) {
    message.replaceChildren();
    message.classList.toggle('error', isError);
    message.append(make('strong', '', title), make('p', '', detail));
    if (!isError) {
      const link = make('a', '', '查看適配分析結果 →');
      link.href = 'result.html';
      message.append(link);
    }
    message.hidden = false;
    message.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  previousButton.addEventListener('click', () => {
    if (currentStep > 0) {
      currentStep -= 1;
      updateStep();
      panels[currentStep].querySelector('input:not(:disabled), select:not(:disabled)')?.focus({ preventScroll: true });
    }
  });
  nextButton.addEventListener('click', () => {
    if (!validateCurrentStep()) return;
    if (currentStep < panels.length - 1) {
      currentStep += 1;
      updateStep();
      panels[currentStep].querySelector('input:not(:disabled), select:not(:disabled)')?.focus({ preventScroll: true });
      panels[currentStep].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (isSubmitting || currentStep !== panels.length - 1 || !validateCurrentStep()) return;
    isSubmitting = true;
    submitButton.disabled = true;
    message.hidden = true;
    try {
      const preferences = collectPreferences();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      showMessage('偏好資料已儲存。', '答案與權重保存在此瀏覽器；選擇略過的維度會以中性偏好送出，不會因空白答案而直接降低分數。');
    } catch (error) {
      showMessage('無法儲存問卷資料。', '請檢查瀏覽器本機儲存空間或隱私設定後再試。', true);
      isSubmitting = false;
      submitButton.disabled = false;
    }
  });

  renderPanels();
  renderWeights();
  updateStep();
})();
