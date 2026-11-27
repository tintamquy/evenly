const I18N = {
  vi: {
    subtitle: 'Chia tiền nhóm không cần tài khoản hay giới hạn. Mọi dữ liệu nằm gọn trong đường link.',
    tripLabel: 'Tên nhóm / chuyến đi',
    tripPlaceholder: 'Đà Lạt, Tiền nhà, Ăn trưa...',
    peopleLabel: 'Thành viên',
    personPlaceholder: 'Nhập tên...',
    addBtn: 'Thêm',
    addExpenseTitle: 'Thêm khoản chi',
    descPlaceholder: 'Nội dung (VD: Tiền phòng, Ăn tối)',
    amountPlaceholder: 'Số tiền',
    saveExpenseBtn: 'Lưu',
    splitAmong: 'Chia đều cho:',
    expensesTitle: 'Các khoản đã chi',
    settleTitle: 'Cần thanh toán',
    copySummary: 'Chép tóm tắt',
    copyLink: 'Sao chép link chia sẻ',
    resetBtn: 'Làm mới',
    paidBy: 'trả',
    forPeople: 'chia',
    owes: 'chuyển cho',
    allSettled: 'Mọi người đã cân bằng, không ai nợ ai.',
    needTwoPeople: 'Thêm ít nhất 2 người để bắt đầu chia tiền.',
    noExpenses: 'Chưa có khoản chi nào.',
    totalLabel: 'Tổng:',
    copiedLink: 'Đã sao chép link. Gửi link này cho nhóm để cùng xem.',
    copiedSummary: 'Đã sao chép bảng tóm tắt để dán vào tin nhắn.',
    confirmReset: 'Xóa toàn bộ dữ liệu hiện tại để tạo nhóm mới?'
  },
  en: {
    subtitle: 'Split group bills without accounts or limits. Everything lives in the link.',
    tripLabel: 'Group or trip',
    tripPlaceholder: 'Da Lat trip, Roommates, Lunch...',
    peopleLabel: 'People',
    personPlaceholder: 'Add name...',
    addBtn: 'Add',
    addExpenseTitle: 'Add an expense',
    descPlaceholder: 'What was it for?',
    amountPlaceholder: 'Amount',
    saveExpenseBtn: 'Add',
    splitAmong: 'Split equally among:',
    expensesTitle: 'Expenses',
    settleTitle: 'Who owes whom',
    copySummary: 'Copy summary',
    copyLink: 'Copy shareable link',
    resetBtn: 'Start fresh',
    paidBy: 'paid',
    forPeople: 'split',
    owes: 'pays',
    allSettled: 'All settled up. Nobody owes anything.',
    needTwoPeople: 'Add at least 2 people to split expenses.',
    noExpenses: 'No expenses yet.',
    totalLabel: 'Total:',
    copiedLink: 'Link copied. Share it with your group.',
    copiedSummary: 'Summary copied to clipboard.',
    confirmReset: 'Clear all current data and start fresh?'
  }
};

let state = {
  lang: 'vi',
  currency: 'VND',
  group: '',
  people: ['An', 'Bình', 'Chi'],
  expenses: []
};

function encodeState(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(hash) {
  try {
    const b64 = hash.replace(/^#/, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!b64) return null;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (parsed && Array.isArray(parsed.people) && Array.isArray(parsed.expenses)) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function syncUrl() {
  const encoded = encodeState(state);
  history.replaceState(null, '', '#' + encoded);
}

function formatMoney(amount) {
  if (state.currency === 'VND' || state.currency === 'JPY') {
    const rounded = Math.round(amount);
    const sym = state.currency === 'VND' ? '₫' : '¥';
    return `${rounded.toLocaleString('en-US')} ${sym}`;
  }
  const sym = state.currency === 'USD' ? '$' : '€';
  return `${sym}${amount.toFixed(2)}`;
}

function computeSettlements() {
  const balances = {};
  state.people.forEach((p) => { balances[p] = 0; });

  state.expenses.forEach((exp) => {
    const validSplit = exp.splitWith.filter((p) => p in balances);
    if (!validSplit.length || !(exp.payer in balances)) return;
    const share = exp.amount / validSplit.length;
    balances[exp.payer] += exp.amount;
    validSplit.forEach((p) => { balances[p] -= share; });
  });

  const debtors = [];
  const creditors = [];
  Object.entries(balances).forEach(([name, bal]) => {
    if (bal < -0.01) debtors.push({ name, amount: -bal });
    else if (bal > 0.01) creditors.push({ name, amount: bal });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const pay = Math.min(d.amount, c.amount);
    if (pay > 0.01) {
      transfers.push({ from: d.name, to: c.name, amount: pay });
    }
    d.amount -= pay;
    c.amount -= pay;
    if (d.amount < 0.01) i += 1;
    if (c.amount < 0.01) j += 1;
  }
  return transfers;
}

function showStatus(msg) {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  clearTimeout(showStatus.t);
  showStatus.t = setTimeout(() => { el.textContent = ''; }, 3000);
}

function render() {
  const t = I18N[state.lang];
  document.documentElement.lang = state.lang;
  document.getElementById('lang-btn').textContent = state.lang === 'vi' ? 'EN' : 'VI';
  document.getElementById('currency-select').value = state.currency;
  document.getElementById('group-name').value = state.group;
  document.getElementById('group-name').placeholder = t.tripPlaceholder;
  document.getElementById('person-input').placeholder = t.personPlaceholder;
  document.getElementById('exp-desc').placeholder = t.descPlaceholder;
  document.getElementById('exp-amount').placeholder = t.amountPlaceholder;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });

  // People chips
  const peopleList = document.getElementById('people-list');
  peopleList.innerHTML = '';
  state.people.forEach((name) => {
    const chip = document.createElement('span');
    chip.className = 'person-chip';
    chip.textContent = name;
    if (state.people.length > 1) {
      const btn = document.createElement('button');
      btn.className = 'chip-remove';
      btn.type = 'button';
      btn.textContent = '×';
      btn.setAttribute('aria-label', `Remove ${name}`);
      btn.addEventListener('click', () => {
        state.people = state.people.filter((p) => p !== name);
        syncUrl();
        render();
      });
      chip.appendChild(btn);
    }
    peopleList.appendChild(chip);
  });

  // Payer select & split checkboxes
  const payerSelect = document.getElementById('exp-payer');
  const prevPayer = payerSelect.value;
  payerSelect.innerHTML = state.people
    .map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`)
    .join('');
  if (state.people.includes(prevPayer)) payerSelect.value = prevPayer;

  const splitBox = document.getElementById('split-checkboxes');
  splitBox.innerHTML = state.people
    .map((p) => `<label class="check-label"><input type="checkbox" value="${escapeHtml(p)}" checked /> ${escapeHtml(p)}</label>`)
    .join('');

  // Expenses list
  const expList = document.getElementById('expenses-list');
  const total = state.expenses.reduce((s, e) => s + e.amount, 0);
  document.getElementById('total-spent').textContent = state.expenses.length
    ? `${t.totalLabel} ${formatMoney(total)}`
    : '';

  if (!state.expenses.length) {
    expList.innerHTML = `<p class="empty-state">${t.noExpenses}</p>`;
  } else {
    expList.innerHTML = '';
    state.expenses.slice().reverse().forEach((exp, revIdx) => {
      const idx = state.expenses.length - 1 - revIdx;
      const row = document.createElement('div');
      row.className = 'list-item';
      row.innerHTML = `
        <div>
          <div class="item-main">${escapeHtml(exp.desc)}</div>
          <div class="item-sub">${escapeHtml(exp.payer)} ${t.paidBy} · ${t.forPeople} ${exp.splitWith.length}</div>
        </div>
        <div class="item-right">
          <span class="mono">${formatMoney(exp.amount)}</span>
          <button class="btn-text danger-text" type="button" aria-label="Delete">×</button>
        </div>
      `;
      row.querySelector('button').addEventListener('click', () => {
        state.expenses.splice(idx, 1);
        syncUrl();
        render();
      });
      expList.appendChild(row);
    });
  }

  // Settlements
  const settleList = document.getElementById('settlements-list');
  if (state.people.length < 2) {
    settleList.innerHTML = `<p class="empty-state">${t.needTwoPeople}</p>`;
  } else {
    const transfers = computeSettlements();
    if (!transfers.length) {
      settleList.innerHTML = `<p class="empty-state">${t.allSettled}</p>`;
    } else {
      settleList.innerHTML = transfers
        .map((tr) => `
          <div class="list-item">
            <div class="item-main">${escapeHtml(tr.from)} <span class="muted-small">${t.owes}</span> ${escapeHtml(tr.to)}</div>
            <div class="item-right mono"><strong>${formatMoney(tr.amount)}</strong></div>
          </div>
        `)
        .join('');
    }
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Event listeners
document.getElementById('lang-btn').addEventListener('click', () => {
  state.lang = state.lang === 'vi' ? 'en' : 'vi';
  syncUrl();
  render();
});

document.getElementById('currency-select').addEventListener('change', (e) => {
  state.currency = e.target.value;
  syncUrl();
  render();
});

document.getElementById('group-name').addEventListener('input', (e) => {
  state.group = e.target.value;
  syncUrl();
});

document.getElementById('add-person-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('person-input');
  const name = input.value.trim();
  if (name && !state.people.includes(name)) {
    state.people.push(name);
    syncUrl();
    render();
  }
  input.value = '';
});

document.getElementById('expense-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const desc = document.getElementById('exp-desc').value.trim();
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const payer = document.getElementById('exp-payer').value;
  const splitWith = Array.from(document.querySelectorAll('#split-checkboxes input:checked')).map((c) => c.value);

  if (!desc || !(amount > 0) || !payer || !splitWith.length) return;
  state.expenses.push({ desc, amount, payer, splitWith });
  document.getElementById('exp-desc').value = '';
  document.getElementById('exp-amount').value = '';
  syncUrl();
  render();
});

document.getElementById('copy-link-btn').addEventListener('click', async () => {
  syncUrl();
  await navigator.clipboard.writeText(window.location.href);
  showStatus(I18N[state.lang].copiedLink);
});

document.getElementById('copy-summary-btn').addEventListener('click', async () => {
  const t = I18N[state.lang];
  const transfers = computeSettlements();
  const total = state.expenses.reduce((s, e) => s + e.amount, 0);
  const title = state.group.trim() || 'Evenly';
  const lines = [`${title} (${t.totalLabel} ${formatMoney(total)})`];
  if (!transfers.length) {
    lines.push(t.allSettled);
  } else {
    transfers.forEach((tr) => {
      lines.push(`- ${tr.from} -> ${tr.to}: ${formatMoney(tr.amount)}`);
    });
  }
  await navigator.clipboard.writeText(lines.join('\n'));
  showStatus(t.copiedSummary);
});

document.getElementById('reset-btn').addEventListener('click', () => {
  if (!window.confirm(I18N[state.lang].confirmReset)) return;
  state.group = '';
  state.expenses = [];
  syncUrl();
  render();
});

// Init from URL hash
const fromHash = decodeState(window.location.hash);
if (fromHash) {
  state = { ...state, ...fromHash };
}
render();
