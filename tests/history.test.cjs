const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
function setup(initial, failWrite = false) {
  const nodes = new Map();
  function element() {
    return { value: '', valueAsNumber: NaN, dataset: {}, style: {}, children: [], attrs: {}, listeners: {},
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
      addEventListener(k, fn) { this.listeners[k] = fn; }, focus() {},
      append(...items) { this.children.push(...items); }, replaceChildren() { this.children = []; },
      insertRow() { const child = element(); this.append(child); return child; },
      insertCell() { const child = element(); this.append(child); return child; }
    };
  }
  const doc = { getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
    querySelector: () => element(), createElement: element, createElementNS: element };
  let stored = initial;
  const context = vm.createContext({ document: doc, Date, Math, Number, JSON, Set, Object,
    crypto: { randomUUID: () => 'test-new-id' }, window: { addEventListener() {}, confirm: () => true },
    localStorage: { getItem: () => stored ?? null, setItem(k, v) { if (failWrite) throw Error('quota'); stored = v; }, removeItem() { stored = null; } } });
  vm.runInContext(source, context);
  return { run: code => vm.runInContext(code, context), node: id => doc.getElementById(id), stored: () => stored };
}
const record = { id:'test-id', date:'2026-10-18', height:170, weight:65, savedAt:1 };
test('restores saved measurements and renders a chart', () => {
  const app = setup(JSON.stringify([record]));
  assert.equal(app.node('height').value,170);
  assert.equal(app.node('weight').value,65);
  assert.equal(app.node('record-count').textContent,'1 筆紀錄');
  assert.equal(app.node('chart').children[0].attrs.role,'img');
});
test('corrupt storage is preserved and saving is blocked', () => {
  for (const stored of ['broken', '{}', JSON.stringify([{...record,date:'2026-02-30'}]), JSON.stringify([record,record])]) {
    const app = setup(stored);
    assert.equal(app.node('save-record').disabled,true);
    assert.equal(app.stored(),stored);
  }
});
test('failed persistence keeps existing records and reports failure', () => {
  const app = setup(JSON.stringify([record]),true);
  assert.equal(app.run('persist([])'),false);
  assert.equal(app.run('records.length'),1);
  assert.equal(app.node('storage-message').dataset.error,'true');
});
test('clear removes persisted records and resets chart', () => {
  const app = setup(JSON.stringify([record]));
  app.node('clear-records').listeners.click();
  assert.equal(app.stored(),null);
  assert.equal(app.node('record-count').textContent,'0 筆紀錄');
});
test('same-day duplicate is not saved; invalid inputs are rejected', () => {
  const app = setup(JSON.stringify([record]));
  Object.assign(app.node('height'),{valueAsNumber:170});
  Object.assign(app.node('weight'),{valueAsNumber:65});
  app.node('measured-date').value = record.date;
  app.node('save-record').listeners.click();
  assert.equal(app.run('records.length'),1);
  assert.match(app.node('storage-message').textContent,/無須重複/);
  app.node('weight').valueAsNumber=0;
  app.node('save-record').listeners.click();
  assert.equal(app.run('records.length'),1);
  assert.equal(app.node('storage-message').dataset.error,'true');
});
test('chart shows last 30 measurements while table retains all', () => {
  const records = Array.from({length:35},(_,i)=>({...record,id:`record-${i}`,savedAt:i,weight:60+i}));
  const app = setup(JSON.stringify(records));
  assert.equal(app.node('history-body').children.length,35);
  const svg=app.node('chart').children[0];
  assert.equal(svg.children.filter(child=>child.attrs.class==='point').length,30);
});
