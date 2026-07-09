requireLogin();

const CATEGORY_COLORS = {
  Groceries:    { fill: '#7F77DD', bg: '#EEEDFE', text: '#3C3489' },
  Transport:    { fill: '#1D9E75', bg: '#E1F5EE', text: '#0F6E56' },
  Entertainment:{ fill: '#D85A30', bg: '#FAECE7', text: '#993C1D' },
  Bills:        { fill: '#378ADD', bg: '#E6F1FB', text: '#185FA5' },
  Health:       { fill: '#D4537E', bg: '#FBEAF0', text: '#993556' },
  Other:        { fill: '#888780', bg: '#F1EFE8', text: '#5F5E5A' }
};

let expenses = [];
let budget = 20000;
let catChart, trendChart, barChart, lineChart;
let addingRecurring = false;

const user = getUser();
if (user) {
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-email').textContent = user.email;
  document.getElementById('user-initial').textContent = user.name.charAt(0).toUpperCase();
  document.getElementById('settings-email').textContent = user.email;
  budget = user.monthlyBudget || 20000;
}

document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
document.getElementById('budget-input').value = budget;

// ---------- Navigation ----------
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => switchView(item.dataset.view));
});
function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  renderAll();
}

function handleLogout() {
  clearSession();
  window.location.href = 'login.html';
}

// ---------- Modal ----------
function openModal(isRecurring = false) {
  addingRecurring = isRecurring;
  document.getElementById('modal-title').textContent = isRecurring ? 'Add recurring expense' : 'Add expense';
  document.getElementById('m-recurring').checked = isRecurring;
  toggleFrequencyField();
  document.getElementById('overlay').classList.add('show');
  document.getElementById('m-desc').focus();
}
function closeModal() {
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('m-desc').value = '';
  document.getElementById('m-amount').value = '';
  document.getElementById('m-recurring').checked = false;
  toggleFrequencyField();
}
function toggleFrequencyField() {
  const checked = document.getElementById('m-recurring').checked;
  document.getElementById('frequency-field').style.display = checked ? 'block' : 'none';
}

async function addExpense() {
  const desc = document.getElementById('m-desc').value.trim();
  const amount = parseFloat(document.getElementById('m-amount').value);
  const category = document.getElementById('m-category').value;
  const isRecurring = document.getElementById('m-recurring').checked;
  const frequency = document.getElementById('m-frequency').value;

  if (!desc || !amount || amount <= 0) {
    showToast('Enter a description and a valid amount');
    return;
  }

  try {
    await apiRequest('/expenses', {
      method: 'POST',
      body: JSON.stringify({ desc, amount, category, isRecurring, frequency })
    });
    closeModal();
    showToast(isRecurring ? 'Recurring expense added' : 'Expense added');
    await loadExpenses();
  } catch (err) {
    showToast(err.message);
  }
}

async function deleteExpense(id) {
  try {
    await apiRequest('/expenses/' + id, { method: 'DELETE' });
    showToast('Expense deleted');
    await loadExpenses();
  } catch (err) {
    showToast(err.message);
  }
}

async function saveBudget() {
  const val = parseFloat(document.getElementById('budget-input').value);
  if (!val || val <= 0) { showToast('Enter a valid budget'); return; }
  try {
    await apiRequest('/expenses/budget', { method: 'PUT', body: JSON.stringify({ monthlyBudget: val }) });
    budget = val;
    const u = getUser();
    u.monthlyBudget = val;
    localStorage.setItem('user', JSON.stringify(u));
    showToast('Budget updated');
    renderAll();
  } catch (err) {
    showToast(err.message);
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function catPillHTML(cat) {
  const c = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other;
  return `<span class="cat-tag" style="background:${c.bg}; color:${c.text}"><span class="dot" style="background:${c.fill}"></span>${cat}</span>`;
}

// ---------- Data loading ----------
async function loadExpenses() {
  try {
    expenses = await apiRequest('/expenses');
    renderAll();
  } catch (err) {
    showToast(err.message);
  }
}

// ---------- Rendering ----------
function renderAll() {
  const oneTime = expenses.filter(e => !e.isRecurring);
  const total = oneTime.reduce((s, e) => s + e.amount, 0);
  const left = budget - total;
  const avg = oneTime.length ? total / oneTime.length : 0;
  const pct = Math.min(100, Math.round((total / budget) * 100));

  document.getElementById('d-total').textContent = fmt(total);
  document.getElementById('d-left').textContent = fmt(left);
  document.getElementById('d-avg').textContent = fmt(avg);
  document.getElementById('d-count').textContent = oneTime.length;
  document.getElementById('sidebar-spent').textContent = fmt(total);
  document.getElementById('sidebar-budget').textContent = fmt(budget);
  document.getElementById('sidebar-budget-fill').style.width = pct + '%';

  renderRecent(oneTime);
  renderTransactions();
  renderRecurring();
  renderCharts(oneTime);
}

function renderRecent(oneTime) {
  const body = document.getElementById('recent-body');
  const empty = document.getElementById('recent-empty');
  const recent = oneTime.slice(0, 5);
  body.innerHTML = '';
  empty.style.display = recent.length ? 'none' : 'block';
  recent.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="desc-cell">${escapeHtml(e.desc)}</td><td>${catPillHTML(e.category)}</td><td class="amount-cell">${fmt(e.amount)}</td>`;
    body.appendChild(tr);
  });
}

function renderTransactions() {
  const search = (document.getElementById('search-input')?.value || '').toLowerCase();
  const filterCat = document.getElementById('filter-category')?.value || '';
  const sortBy = document.getElementById('sort-order')?.value || 'newest';

  let list = expenses.filter(e =>
    !e.isRecurring && e.desc.toLowerCase().includes(search) && (!filterCat || e.category === filterCat)
  );

  if (sortBy === 'newest') list.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (sortBy === 'oldest') list.sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sortBy === 'highest') list.sort((a, b) => b.amount - a.amount);
  if (sortBy === 'lowest') list.sort((a, b) => a.amount - b.amount);

  const body = document.getElementById('all-body');
  const empty = document.getElementById('all-empty');
  body.innerHTML = '';
  empty.style.display = list.length ? 'none' : 'block';

  list.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="desc-cell">${escapeHtml(e.desc)}</td>
      <td>${catPillHTML(e.category)}</td>
      <td style="color:var(--text-secondary)">${new Date(e.date).toLocaleDateString('en-IN')}</td>
      <td class="amount-cell">${fmt(e.amount)}</td>
      <td class="row-actions"><button class="icon-btn" onclick="deleteExpense('${e._id}')" aria-label="Delete">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>
      </button></td>`;
    body.appendChild(tr);
  });
}

function renderRecurring() {
  const list = expenses.filter(e => e.isRecurring);
  const body = document.getElementById('recurring-body');
  const empty = document.getElementById('recurring-empty');
  if (!body) return;
  body.innerHTML = '';
  empty.style.display = list.length ? 'none' : 'block';

  list.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="desc-cell">${escapeHtml(e.desc)}</td>
      <td>${catPillHTML(e.category)}</td>
      <td style="color:var(--text-secondary); text-transform:capitalize;">${e.frequency || ''}</td>
      <td class="amount-cell">${fmt(e.amount)}</td>
      <td class="row-actions"><button class="icon-btn" onclick="deleteExpense('${e._id}')" aria-label="Delete">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>
      </button></td>`;
    body.appendChild(tr);
  });
}

function renderCharts(oneTime) {
  const categories = Object.keys(CATEGORY_COLORS);
  const totals = categories.map(cat => oneTime.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0));
  const colors = categories.map(c => CATEGORY_COLORS[c].fill);

  if (catChart) catChart.destroy();
  catChart = new Chart(document.getElementById('cat-chart'), {
    type: 'doughnut',
    data: { labels: categories, datasets: [{ data: totals, backgroundColor: colors, borderWidth: 0 }] },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }
  });

  const recentForTrend = oneTime.slice(0, 7).reverse();
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(document.getElementById('trend-chart'), {
    type: 'line',
    data: {
      labels: recentForTrend.map((e, i) => 'Tx ' + (i + 1)),
      datasets: [{ data: recentForTrend.map(e => e.amount), borderColor: '#C9A227', backgroundColor: 'rgba(201,162,39,0.12)', fill: true, tension: 0.35 }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  if (document.getElementById('bar-chart')) {
    if (barChart) barChart.destroy();
    barChart = new Chart(document.getElementById('bar-chart'), {
      type: 'bar',
      data: { labels: categories, datasets: [{ data: totals, backgroundColor: colors, borderRadius: 6 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }

  if (document.getElementById('line-chart')) {
    const byDate = {};
    oneTime.forEach(e => {
      const d = new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      byDate[d] = (byDate[d] || 0) + e.amount;
    });
    const labels = Object.keys(byDate).reverse();
    if (lineChart) lineChart.destroy();
    lineChart = new Chart(document.getElementById('line-chart'), {
      type: 'line',
      data: { labels, datasets: [{ data: labels.map(l => byDate[l]), borderColor: '#14213D', backgroundColor: 'rgba(20,33,61,0.06)', fill: true, tension: 0.3 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }
}

// ---------- Exports ----------
function exportCSV() {
  const oneTime = expenses.filter(e => !e.isRecurring);
  if (!oneTime.length) { showToast('No expenses to export'); return; }

  const rows = [['Description', 'Category', 'Date', 'Amount']];
  oneTime.forEach(e => rows.push([e.desc, e.category, new Date(e.date).toLocaleDateString('en-IN'), e.amount]));

  const csvContent = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'expenses.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV downloaded');
}

function exportPDF() {
  const oneTime = expenses.filter(e => !e.isRecurring);
  if (!oneTime.length) { showToast('No expenses to export'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Expensely — Expense report', 14, 18);
  doc.setFontSize(10);
  doc.text('Generated on ' + new Date().toLocaleDateString('en-IN'), 14, 25);

  let y = 38;
  doc.setFontSize(11);
  doc.text('Description', 14, y);
  doc.text('Category', 90, y);
  doc.text('Date', 140, y);
  doc.text('Amount', 175, y);
  y += 6;
  doc.setLineWidth(0.2);
  doc.line(14, y - 4, 196, y - 4);

  doc.setFontSize(10);
  oneTime.forEach(e => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(String(e.desc).slice(0, 34), 14, y);
    doc.text(e.category, 90, y);
    doc.text(new Date(e.date).toLocaleDateString('en-IN'), 140, y);
    doc.text('Rs ' + e.amount.toLocaleString('en-IN'), 175, y);
    y += 7;
  });

  const total = oneTime.reduce((s, e) => s + e.amount, 0);
  y += 4;
  doc.setLineWidth(0.2);
  doc.line(14, y - 4, 196, y - 4);
  doc.setFontSize(11);
  doc.text('Total: Rs ' + total.toLocaleString('en-IN'), 140, y);

  doc.save('expense-report.pdf');
  showToast('PDF downloaded');
}

function fmt(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

loadExpenses();
