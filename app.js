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

const STORAGE_KEY = 'well-balanced.bmi.v1';
const dateInput = document.getElementById('measured-date');
const storageMessage = document.getElementById('storage-message');
const saveButton = document.getElementById('save-record');
let records = [];
let storageBlocked = false;
const today = new Date();
dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= '1900-01-01' && value <= '9999-12-31' &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function validateRecords(value) {
  if (!Array.isArray(value) || value.length > 500) throw new Error('Invalid records');
  const ids = new Set();
  return value.map(record => {
    if (!record || typeof record.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(record.id) ||
        ids.has(record.id) || !validDate(record.date) || !Number.isFinite(record.savedAt) ||
        !calculateBMI(record.height, record.weight)) throw new Error('Invalid record');
    ids.add(record.id);
    return { id: record.id, date: record.date, savedAt: record.savedAt, height: record.height, weight: record.weight };
  });
}
function notify(message, isError = false) {
  storageMessage.textContent = message;
  storageMessage.dataset.error = String(isError);
}
function loadRecords() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    records = stored === null ? [] : validateRecords(JSON.parse(stored));
    storageBlocked = false;
  } catch {
    records = [];
    storageBlocked = true;
    notify('無法讀取紀錄：瀏覽器可能禁止儲存，或紀錄格式已損壞。原有資料未被覆寫；可按「清空全部紀錄」重設。', true);
  }
  saveButton.disabled = storageBlocked;
}
function persist(nextRecords) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
    records = nextRecords;
    renderHistory();
    return true;
  } catch {
    notify('儲存失敗，可能是瀏覽器禁止儲存或空間不足。此次變更未套用，請勿關閉頁面前誤以為已儲存。', true);
    return false;
  }
}
function sortedRecords() {
  return [...records].sort((a, b) => a.date.localeCompare(b.date) || a.savedAt - b.savedAt || a.id.localeCompare(b.id));
}
function renderHistory() {
  document.getElementById('record-count').textContent = `${records.length} 筆紀錄`;
  document.getElementById('clear-records').disabled = !records.length && !storageBlocked;
  const body = document.getElementById('history-body');
  body.replaceChildren();
  for (const record of sortedRecords().reverse()) {
    const result = calculateBMI(record.height, record.weight);
    const row = document.createElement('tr');
    for (const value of [record.date, record.height, record.weight, result.bmi.toFixed(1), messages[result.category][0]]) {
      const cell = document.createElement('td');
      cell.textContent = String(value);
      row.append(cell);
    }
    const action = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'delete-record';
    button.textContent = '刪除';
    button.setAttribute('aria-label', `刪除 ${record.date}，${record.weight} 公斤的紀錄`);
    button.addEventListener('click', () => {
      if (persist(records.filter(item => item.id !== record.id))) notify('已刪除此筆紀錄。');
    });
    action.append(button);
    row.append(action);
    body.append(row);
  }
  if (!records.length) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 6;
    cell.className = 'empty-row';
    cell.textContent = '還沒有紀錄，儲存第一筆測量吧。';
  }
  renderChart();
}
function svgElement(name, attributes, text) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}
function renderChart() {
  const container = document.getElementById('chart');
  container.replaceChildren();
  const items = sortedRecords().slice(-30);
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'chart-empty';
    empty.textContent = '儲存第一筆紀錄後，這裡會顯示你的 BMI 趨勢。';
    container.append(empty);
    return;
  }
  const values = items.map(item => calculateBMI(item.height, item.weight).bmi);
  const min = Math.floor(Math.min(18.5, ...values) - 2);
  const max = Math.ceil(Math.max(24, ...values) + 2);
  const x = index => items.length === 1 ? 340 : 55 + index * 565 / (items.length - 1);
  const y = value => 205 - (value - min) / (max - min) * 175;
  const svg = svgElement('svg', { viewBox: '0 0 660 255', role: 'img', 'aria-labelledby': 'trend-title trend-description' });
  svg.append(svgElement('title', { id: 'trend-title' }, '最近 30 筆 BMI 趨勢圖'));
  svg.append(svgElement('desc', { id: 'trend-description' }, `${items.length} 筆測量，BMI 由 ${values[0].toFixed(1)} 至 ${values.at(-1).toFixed(1)}。完整紀錄列於下方表格。`));
  svg.append(svgElement('rect', { x: 55, y: y(24), width: 565, height: y(18.5) - y(24), fill: '#e1ecd9' }));
  for (const value of [min, 18.5, 24, max]) {
    svg.append(svgElement('line', { x1: 55, x2: 620, y1: y(value), y2: y(value), stroke: '#d8e0d0', 'stroke-dasharray': '4 4' }));
    svg.append(svgElement('text', { x: 45, y: y(value) + 4, 'text-anchor': 'end' }, value));
  }
  svg.append(svgElement('polyline', { points: values.map((value, index) => `${x(index)},${y(value)}`).join(' '), fill: 'none', stroke: '#245747', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
  items.forEach((item, index) => {
    const point = svgElement('circle', { cx: x(index), cy: y(values[index]), r: 5, class: 'point', tabindex: 0, 'aria-label': `${item.date}，BMI ${values[index].toFixed(1)}` });
    point.append(svgElement('title', {}, `${item.date}｜${item.weight} kg｜BMI ${values[index].toFixed(1)}`));
    svg.append(point);
  });
  const labelIndices = items.length === 1 ? [0] : [...new Set([0, Math.floor((items.length - 1) / 2), items.length - 1])];
  for (const index of labelIndices) svg.append(svgElement('text', { x: x(index), y: 233, 'text-anchor': 'middle' }, items[index].date));
  container.append(svg);
}
saveButton.addEventListener('click', () => {
  if (storageBlocked) return;
  update(true);
  const height = heightInput.valueAsNumber;
  const weight = weightInput.valueAsNumber;
  if (!calculateBMI(height, weight)) { notify('請先輸入有效的身高與體重。', true); return; }
  if (!validDate(dateInput.value)) { notify('請輸入有效的測量日期（1900 年至 9999 年）。', true); dateInput.focus(); return; }
  if (records.length >= 500) { notify('已達 500 筆儲存上限，請先刪除不需要的紀錄。', true); return; }
  if (records.some(item => item.date === dateInput.value && item.height === height && item.weight === weight)) {
    notify('這個日期已有相同的身高與體重，無須重複儲存。'); return;
  }
  const record = { id: crypto.randomUUID(), date: dateInput.value, savedAt: Date.now(), height, weight };
  if (persist([...records, record])) notify('已儲存本次紀錄，下次開啟時會帶入最近儲存的數據。');
});
document.getElementById('clear-records').addEventListener('click', () => {
  if (!window.confirm('確定清空此瀏覽器中的全部 BMI 紀錄？此操作無法復原。')) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    records = [];
    storageBlocked = false;
    saveButton.disabled = false;
    renderHistory();
    notify('已清空全部紀錄。');
  } catch { notify('清空失敗，瀏覽器目前不允許存取儲存空間。', true); }
});
// Other tabs can change the same storage. Refresh before allowing further mutations.
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  loadRecords();
  renderHistory();
  if (!storageBlocked) notify('紀錄已與另一個分頁同步。');
});
loadRecords();
if (records.length) {
  const latest = [...records].sort((a, b) => b.savedAt - a.savedAt)[0];
  heightInput.value = latest.height;
  weightInput.value = latest.weight;
  update();
}
renderHistory();
