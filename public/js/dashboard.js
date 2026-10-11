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
let friends = [];
let groups = [];
let currentGroupId = null;

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

/* ================= Navigation ================= */
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => switchView(item.dataset.view));
});

function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));

  if (view === 'friends') loadFriends();
  if (view === 'groups') { backToGroups(); loadGroups(); }
  if (view === 'balances') loadBalances();
  if (view === 'dashboard' || view === 'transactions' || view === 'recurring' || view === 'analytics') renderAll();
}

function handleLogout() {
  clearSession();
  window.location.href = 'login.html';
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}
function fmt(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function catPillHTML(cat) {
  const c = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other;
  return `<span class="cat-tag" style="background:${c.bg}; color:${c.text}"><span class="dot" style="background:${c.fill}"></span>${cat}</span>`;
}

/* ================= Personal expense modal ================= */
function openModal(isRecurring = false) {
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
  document.getElementById('frequency-field').style.display = document.getElementById('m-recurring').checked ? 'block' : 'none';
}

async function addExpense() {
  const desc = document.getElementById('m-desc').value.trim();
  const amount = parseFloat(document.getElementById('m-amount').value);
  const category = document.getElementById('m-category').value;
  const isRecurring = document.getElementById('m-recurring').checked;
  const frequency = document.getElementById('m-frequency').value;

  if (!desc || !amount || amount <= 0) { showToast('Enter a description and a valid amount'); return; }

  try {
    await apiRequest('/expenses', { method: 'POST', body: JSON.stringify({ desc, amount, category, isRecurring, frequency }) });
    closeModal();
    showToast(isRecurring ? 'Recurring expense added' : 'Expense added');
    await loadExpenses();
  } catch (err) { showToast(err.message); }
}

async function deleteExpense(id) {
  try {
    await apiRequest('/expenses/' + id, { method: 'DELETE' });
    showToast('Expense deleted');
    await loadExpenses();
  } catch (err) { showToast(err.message); }
}

async function saveBudget() {
  const val = parseFloat(document.getElementById('budget-input').value);
  if (!val || val <= 0) { showToast('Enter a valid budget'); return; }
  try {
    await apiRequest('/expenses/budget', { method: 'PUT', body: JSON.stringify({ monthlyBudget: val }) });
    budget = val;
    const u = getUser(); u.monthlyBudget = val; localStorage.setItem('user', JSON.stringify(u));
    showToast('Budget updated');
    renderAll();
  } catch (err) { showToast(err.message); }
}

async function loadExpenses() {
  try { expenses = await apiRequest('/expenses'); renderAll(); }
  catch (err) { showToast(err.message); }
}

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

  let list = expenses.filter(e => !e.isRecurring && e.desc.toLowerCase().includes(search) && (!filterCat || e.category === filterCat));
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
      <td class="row-actions"><button class="icon-btn" onclick="deleteExpense('${e._id}')">✕</button></td>`;
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
      <td class="row-actions"><button class="icon-btn" onclick="deleteExpense('${e._id}')">✕</button></td>`;
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
    data: { labels: recentForTrend.map((e, i) => 'Tx ' + (i + 1)), datasets: [{ data: recentForTrend.map(e => e.amount), borderColor: '#C9A227', backgroundColor: 'rgba(201,162,39,0.12)', fill: true, tension: 0.35 }] },
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

function exportCSV() {
  const oneTime = expenses.filter(e => !e.isRecurring);
  if (!oneTime.length) { showToast('No expenses to export'); return; }
  const rows = [['Description', 'Category', 'Date', 'Amount']];
  oneTime.forEach(e => rows.push([e.desc, e.category, new Date(e.date).toLocaleDateString('en-IN'), e.amount]));
  const csvContent = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'expenses.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('CSV downloaded');
}

function exportPDF() {
  const oneTime = expenses.filter(e => !e.isRecurring);
  if (!oneTime.length) { showToast('No expenses to export'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16); doc.text('Expensely — Expense report', 14, 18);
  doc.setFontSize(10); doc.text('Generated on ' + new Date().toLocaleDateString('en-IN'), 14, 25);
  let y = 38;
  doc.setFontSize(11);
  doc.text('Description', 14, y); doc.text('Category', 90, y); doc.text('Date', 140, y); doc.text('Amount', 175, y);
  y += 6; doc.line(14, y - 4, 196, y - 4);
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
  y += 4; doc.line(14, y - 4, 196, y - 4);
  doc.setFontSize(11); doc.text('Total: Rs ' + total.toLocaleString('en-IN'), 140, y);
  doc.save('expense-report.pdf');
  showToast('PDF downloaded');
}

/* ================= Friends ================= */
async function loadFriends() {
  try {
    friends = await apiRequest('/friends');
    renderFriends();
  } catch (err) { showToast(err.message); }
}

function renderFriends() {
  const list = document.getElementById('friends-list');
  const empty = document.getElementById('friends-empty');
  list.innerHTML = '';
  empty.style.display = friends.length ? 'none' : 'block';

  friends.forEach(f => {
    const row = document.createElement('div');
    row.className = 'friend-row';
    row.innerHTML = `
      <div class="friend-info">
        <div class="friend-avatar">${f.name.charAt(0).toUpperCase()}</div>
        <div>
          <div class="friend-name">${escapeHtml(f.name)}</div>
          <div class="friend-email">${escapeHtml(f.email)}</div>
        </div>
      </div>
      <button class="icon-btn" onclick="removeFriend('${f._id}')">Remove</button>`;
    list.appendChild(row);
  });
}

function openAddFriendModal() { document.getElementById('friend-overlay').classList.add('show'); document.getElementById('friend-email').focus(); }
function closeFriendModal() { document.getElementById('friend-overlay').classList.remove('show'); document.getElementById('friend-email').value = ''; }

async function addFriend() {
  const email = document.getElementById('friend-email').value.trim();
  if (!email) { showToast('Enter an email'); return; }
  try {
    await apiRequest('/friends/add', { method: 'POST', body: JSON.stringify({ email }) });
    closeFriendModal();
    showToast('Friend added');
    await loadFriends();
  } catch (err) { showToast(err.message); }
}

async function removeFriend(id) {
  try {
    await apiRequest('/friends/' + id, { method: 'DELETE' });
    showToast('Friend removed');
    await loadFriends();
  } catch (err) { showToast(err.message); }
}

/* ================= Groups ================= */
async function loadGroups() {
  try {
    groups = await apiRequest('/groups');
    renderGroups();
  } catch (err) { showToast(err.message); }
}

function renderGroups() {
  const grid = document.getElementById('groups-grid');
  const empty = document.getElementById('groups-empty');
  grid.innerHTML = '';
  empty.style.display = groups.length ? 'none' : 'block';

  groups.forEach(g => {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.onclick = () => openGroupDetail(g._id);
    const pills = g.members.map(m => `<span class="member-pill">${escapeHtml(m.name.split(' ')[0])}</span>`).join('');
    card.innerHTML = `
      <div class="group-card-icon">👥</div>
      <h3>${escapeHtml(g.name)}</h3>
      <div class="meta">${g.members.length} member${g.members.length !== 1 ? 's' : ''}</div>
      <div class="member-pills">${pills}</div>`;
    grid.appendChild(card);
  });
}

function openCreateGroupModal() {
  const checklist = document.getElementById('group-friend-checklist');
  if (!friends.length) {
    checklist.innerHTML = '<p style="font-size:13px; color:var(--text-secondary);">Add some friends first before creating a group.</p>';
  } else {
    checklist.innerHTML = friends.map(f => `
      <div class="checkbox-row">
        <input type="checkbox" value="${f._id}" id="gf-${f._id}">
        <label for="gf-${f._id}">${escapeHtml(f.name)} (${escapeHtml(f.email)})</label>
      </div>`).join('');
  }
  document.getElementById('group-overlay').classList.add('show');
}
function closeGroupModal() {
  document.getElementById('group-overlay').classList.remove('show');
  document.getElementById('group-name').value = '';
}

async function createGroup() {
  const name = document.getElementById('group-name').value.trim();
  const memberIds = friends.filter(f => document.getElementById('gf-' + f._id)?.checked).map(f => f._id);
  if (!name) { showToast('Enter a group name'); return; }
  if (!memberIds.length) { showToast('Select at least one friend'); return; }

  try {
    await apiRequest('/groups', { method: 'POST', body: JSON.stringify({ name, memberIds }) });
    closeGroupModal();
    showToast('Group created');
    await loadGroups();
  } catch (err) { showToast(err.message); }
}

async function openGroupDetail(groupId) {
  currentGroupId = groupId;
  try {
    const { group, expenses: groupExpenses } = await apiRequest('/groups/' + groupId);
    document.getElementById('groups-list-view').style.display = 'none';
    document.getElementById('group-detail-view').style.display = 'block';
    document.getElementById('gd-name').textContent = group.name;
    document.getElementById('gd-members').textContent = group.members.map(m => m.name).join(', ');
    renderGroupExpenses(groupExpenses, group);
  } catch (err) { showToast(err.message); }
}

function backToGroups() {
  currentGroupId = null;
  document.getElementById('groups-list-view').style.display = 'block';
  document.getElementById('group-detail-view').style.display = 'none';
}

function renderGroupExpenses(list, group) {
  const container = document.getElementById('gd-expenses-list');
  const empty = document.getElementById('gd-expenses-empty');
  container.innerHTML = '';
  empty.style.display = list.length ? 'none' : 'block';

  list.forEach(e => {
    const splitDetail = e.splits.map(s => `${s.user.name.split(' ')[0]}: ${fmt(s.amount)}`).join(' · ');
    const entry = document.createElement('div');
    entry.className = 'expense-entry';
    entry.innerHTML = `
      <div>
        <div class="desc-cell">${escapeHtml(e.desc)}</div>
        <div class="paid-by">Paid by ${escapeHtml(e.paidBy.name)}</div>
        <div class="split-detail">${splitDetail}</div>
      </div>
      <div style="text-align:right;">
        <div class="amount-cell">${fmt(e.amount)}</div>
        <button class="icon-btn" onclick="deleteGroupExpense('${e._id}')">✕</button>
      </div>`;
    container.appendChild(entry);
  });
}

async function deleteGroupExpense(id) {
  try {
    await apiRequest('/group-expenses/' + id, { method: 'DELETE' });
    showToast('Expense removed');
    openGroupDetail(currentGroupId);
  } catch (err) { showToast(err.message); }
}

function openAddGroupExpenseModal() {
  const group = groups.find(g => g._id === currentGroupId);
  if (!group) return;

  const paidBySelect = document.getElementById('ge-paidby');
  paidBySelect.innerHTML = group.members.map(m => `<option value="${m._id}">${escapeHtml(m.name)}</option>`).join('');

  document.getElementById('ge-split-type').value = 'equal';
  buildSplitList(group.members, 'equal');

  document.getElementById('group-expense-overlay').classList.add('show');
}

function closeGroupExpenseModal() {
  document.getElementById('group-expense-overlay').classList.remove('show');
  document.getElementById('ge-desc').value = '';
  document.getElementById('ge-amount').value = '';
}

function buildSplitList(members, splitType) {
  const container = document.getElementById('ge-split-list');
  if (splitType === 'equal') {
    container.innerHTML = members.map(m => `
      <div class="split-row">
        <input type="checkbox" class="split-participant" value="${m._id}" checked>
        <span class="split-name">${escapeHtml(m.name)}</span>
      </div>`).join('');
  } else {
    container.innerHTML = members.map(m => `
      <div class="split-row">
        <span class="split-name">${escapeHtml(m.name)}</span>
        <input type="number" class="split-amount" data-user="${m._id}" placeholder="0">
      </div>`).join('');
  }
}

function toggleSplitType() {
  const group = groups.find(g => g._id === currentGroupId);
  if (!group) return;
  buildSplitList(group.members, document.getElementById('ge-split-type').value);
}

function refreshSplitInputs() {
  // placeholder hook if we want live remainder display later; currently a no-op
}

async function addGroupExpense() {
  const desc = document.getElementById('ge-desc').value.trim();
  const amount = parseFloat(document.getElementById('ge-amount').value);
  const paidBy = document.getElementById('ge-paidby').value;
  const splitType = document.getElementById('ge-split-type').value;

  if (!desc || !amount || amount <= 0) { showToast('Enter a description and valid amount'); return; }

  const payload = { groupId: currentGroupId, desc, amount, paidBy, splitType };

  if (splitType === 'equal') {
    const participantIds = Array.from(document.querySelectorAll('.split-participant:checked')).map(el => el.value);
    if (!participantIds.length) { showToast('Select at least one person to split with'); return; }
    payload.participantIds = participantIds;
  } else {
    const splits = Array.from(document.querySelectorAll('.split-amount'))
      .map(el => ({ user: el.dataset.user, amount: parseFloat(el.value) || 0 }))
      .filter(s => s.amount > 0);
    if (!splits.length) { showToast('Enter at least one split amount'); return; }
    payload.splits = splits;
  }

  try {
    await apiRequest('/group-expenses', { method: 'POST', body: JSON.stringify(payload) });
    closeGroupExpenseModal();
    showToast('Expense added');
    openGroupDetail(currentGroupId);
  } catch (err) { showToast(err.message); }
}

/* ================= Balances ================= */
async function loadBalances() {
  try {
    const data = await apiRequest('/balances');
    renderBalances(data);
    const history = await apiRequest('/balances/history');
    renderSettlementHistory(history);
  } catch (err) { showToast(err.message); }
}

function renderBalances(data) {
  document.getElementById('bal-owed-to-you').textContent = fmt(data.summary.youAreOwed);
  document.getElementById('bal-you-owe').textContent = fmt(data.summary.youOwe);

  const list = document.getElementById('balances-list');
  const empty = document.getElementById('balances-empty');
  list.innerHTML = '';
  empty.style.display = data.balances.length ? 'none' : 'block';

  data.balances.forEach(b => {
    const owedToYou = b.netBalance > 0;
    const row = document.createElement('div');
    row.className = 'balance-row';
    row.innerHTML = `
      <div class="balance-info">
        <div class="friend-avatar">${b.name.charAt(0).toUpperCase()}</div>
        <div>
          <div class="friend-name">${escapeHtml(b.name)}</div>
          <div class="balance-sub">${owedToYou ? 'owes you' : 'you owe'}</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:14px;">
        <div class="balance-amount ${owedToYou ? 'owed-to-you' : 'you-owe'}">${fmt(Math.abs(b.netBalance))}</div>
        ${!owedToYou ? `<button class="btn-outline" onclick="openSettleModalFor('${b.friendId}', ${Math.abs(b.netBalance)})">Settle up</button>` : ''}
      </div>`;
    list.appendChild(row);
  });
}

function renderSettlementHistory(history) {
  const list = document.getElementById('settlements-list');
  const empty = document.getElementById('settlements-empty');
  list.innerHTML = '';
  empty.style.display = history.length ? 'none' : 'block';

  history.slice(0, 15).forEach(s => {
    const iPaid = s.fromUser._id === getUser().id;
    const row = document.createElement('div');
    row.className = 'balance-row';
    row.innerHTML = `
      <div class="balance-info">
        <div>
          <div class="friend-name">${iPaid ? 'You paid ' + escapeHtml(s.toUser.name) : escapeHtml(s.fromUser.name) + ' paid you'}</div>
          <div class="balance-sub">${new Date(s.date).toLocaleDateString('en-IN')}${s.note ? ' · ' + escapeHtml(s.note) : ''}</div>
        </div>
      </div>
      <div class="balance-amount">${fmt(s.amount)}</div>`;
    list.appendChild(row);
  });
}

function openSettleModalFor(friendId, amount) {
  const select = document.getElementById('settle-friend');
  select.innerHTML = friends.length
    ? friends.map(f => `<option value="${f._id}">${escapeHtml(f.name)}</option>`).join('')
    : '<option value="">No friends yet</option>';
  if (friendId) select.value = friendId;
  if (amount) document.getElementById('settle-amount').value = amount;
  document.getElementById('settle-overlay').classList.add('show');
}
function closeSettleModal() {
  document.getElementById('settle-overlay').classList.remove('show');
  document.getElementById('settle-amount').value = '';
  document.getElementById('settle-note').value = '';
}

async function recordSettlement() {
  const toUserId = document.getElementById('settle-friend').value;
  const amount = parseFloat(document.getElementById('settle-amount').value);
  const note = document.getElementById('settle-note').value.trim();

  if (!toUserId || !amount || amount <= 0) { showToast('Select a friend and enter a valid amount'); return; }

  try {
    await apiRequest('/balances/settle', { method: 'POST', body: JSON.stringify({ toUserId, amount, note }) });
    closeSettleModal();
    showToast('Payment recorded');
    await loadBalances();
  } catch (err) { showToast(err.message); }
}

/* ================= Init ================= */
async function initDashboard() {
  await loadExpenses();
  try { friends = await apiRequest('/friends'); } catch (e) { /* ignore on first load */ }
}
initDashboard();
