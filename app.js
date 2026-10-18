/* Classify the unrounded value so a display-rounding boundary cannot change the result. */
function calculateBMI(height, weight) {
  if (!Number.isFinite(height) || height < 50 || height > 250 ||
      !Number.isFinite(weight) || weight < 10 || weight > 500) return null;
  const bmi = weight / (height / 100) ** 2;
  const category = bmi < 18.5 ? 0 : bmi < 24 ? 1 : bmi < 27 ? 2 : 3;
  return { bmi, category, lower: 18.5 * (height / 100) ** 2, upper: 24 * (height / 100) ** 2 };
}

const form = document.getElementById('bmi-form');
const heightInput = document.getElementById('height');
const weightInput = document.getElementById('weight');
const error = document.getElementById('error');
const panel = document.querySelector('.result-panel');
const messages = [
  ['體重過輕', '多一點了解，多一點照顧。', '目前 BMI 低於成人健康體位區間。'],
  ['健康體位', '剛剛好的平衡。', '目前 BMI 落在成人健康體位區間。'],
  ['體重過重', '從了解自己的步調開始。', '目前 BMI 高於成人健康體位區間，屬於過重。'],
  ['肥胖', '給身體多一點關注。', '目前 BMI 達成人肥胖標準，可諮詢專業人員了解體位。']
];

function update(showError = false) {
  const height = heightInput.valueAsNumber;
  const weight = weightInput.valueAsNumber;
  const result = calculateBMI(height, weight);
  const heightValid = Number.isFinite(height) && height >= 50 && height <= 250;
  const weightValid = Number.isFinite(weight) && weight >= 10 && weight <= 500;
  heightInput.setAttribute('aria-invalid', String(!heightValid));
  weightInput.setAttribute('aria-invalid', String(!weightValid));
  error.textContent = showError && !result ? '請輸入有效的身高（50–250 cm）與體重（10–500 kg）。' : '';
  panel.dataset.state = result ? 'ready' : 'empty';
  if (!result) {
    document.getElementById('bmi-value').textContent = '—';
    document.getElementById('status').textContent = '等待輸入';
    document.getElementById('result-title').textContent = '準備好，認識自己。';
    document.getElementById('result-description').textContent = '輸入有效的身高與體重，即可查看結果。';
    document.getElementById('healthy-range').textContent = '— kg';
    return;
  }
  const { bmi, category, lower, upper } = result;
  document.getElementById('bmi-value').textContent = bmi.toFixed(1);
  document.getElementById('status').textContent = '● ' + messages[category][0];
  document.getElementById('result-title').textContent = messages[category][1];
  document.getElementById('result-description').textContent = messages[category][2];
  // Each colored segment owns a category; the marker follows those segment boundaries.
  const position = bmi < 18.5 ? 25 * bmi / 18.5 : bmi < 24 ? 25 + 25 * (bmi - 18.5) / 5.5 : bmi < 27 ? 50 + 25 * (bmi - 24) / 3 : 75 + 25 * (bmi - 27) / 13;
  document.getElementById('scale-marker').style.left = Math.min(99, Math.max(1, position)) + '%';
  document.getElementById('healthy-range').innerHTML = `${lower.toFixed(1)} – &lt; ${upper.toFixed(1)} <small>kg</small>`;
}
form.addEventListener('submit', event => {
  event.preventDefault();
  update(true);
  if (heightInput.getAttribute('aria-invalid') === 'true') heightInput.focus();
  else if (weightInput.getAttribute('aria-invalid') === 'true') weightInput.focus();
});
for (const input of [heightInput, weightInput]) input.addEventListener('input', () => update(true));
document.getElementById('reset').addEventListener('click', () => {
  heightInput.value = '';
  weightInput.value = '';
  update();
  heightInput.focus();
});
update();
