const apiBase = '/api';
let authToken = localStorage.getItem('token') || '';
let statusChart;
let revenueChart;
let servicesChart;
const adminPage = document.body.dataset.page || 'dashboard';

function requireAdmin() {
  if (!authToken) {
    window.location.href = '/login.html';
    return false;
  }
  const role = localStorage.getItem('role');
  if (role !== 'admin') {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

function toast(msg) {
  const box = document.getElementById('admin-feedback');
  if (box) {
    box.textContent = msg;
    box.classList.add('visible');
    setTimeout(() => box.classList.remove('visible'), 2500);
  } else {
    alert(msg);
  }
}

function confirmAction(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-dialog');
    const text = document.getElementById('confirm-text');
    if (!modal || !text) return resolve(confirm(message));
    text.textContent = message;
    modal.classList.remove('hidden');
    const accept = document.getElementById('confirm-accept');
    const cancel = document.getElementById('confirm-cancel');
    const cleanup = (choice) => {
      modal.classList.add('hidden');
      accept.onclick = null;
      cancel.onclick = null;
      resolve(choice);
    };
    accept.onclick = () => cleanup(true);
    cancel.onclick = () => cleanup(false);
  });
}

const logout = document.getElementById('logout');
if (logout) {
  logout.onclick = () => {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
  };
}

async function loadOrders() {
  if (!requireAdmin()) return;
  try {
    const res = await fetch(`${apiBase}/admin/orders`, { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao carregar encomendas');
    const list = document.getElementById('admin-orders');
    if (!list) return;
    list.innerHTML = '';
    data.orders.forEach((order) => {
      const materials = order.materiais_uploads ? JSON.parse(order.materiais_uploads) : [];
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h4>#${order.id} · ${order.tipo}</h4>
        <p>Cliente: ${order.user_name || ''} (${order.user_email || ''})</p>
        <p>Estado: ${order.estado} · Fatura ${order.invoice_numero || '—'} (${order.invoice_estado || 'EMITIDA'})</p>
        <p>Total: ${order.valor_total || '—'}</p>
        <p>Materiais: ${materials.length ? materials.map((m) => `<a href="${m}" target="_blank">${m.split('/').pop()}</a>`).join(', ') : 'Nenhum'}</p>
        ${order.comprovativo ? `<p class="muted">Comprovativo: <a href="${order.comprovativo}" target="_blank">ver ficheiro</a></p>` : '<p class="muted">Comprovativo pendente</p>'}
        <div class="stacked-actions">
          <button class="primary" data-action="approve" data-invoice="${order.invoice_id || ''}" data-number="${order.invoice_numero || ''}" data-email="${order.user_email || ''}" data-order="${order.id}">Marcar pago</button>
          <button class="ghost" data-action="reject" data-invoice="${order.invoice_id || ''}" data-order="${order.id}">Rejeitar</button>
        </div>
        ${order.invoice_estado === 'PAGA' ? `<div class="upload-zone"><label>Entregar documento final</label><input type="file" data-file="${order.id}" /><button class="primary" data-action="final" data-order="${order.id}">Submeter</button></div>` : ''}
      `;
      card.querySelectorAll('button').forEach((btn) => {
        const action = btn.dataset.action;
        if (action === 'approve') btn.onclick = () => approveInvoice(btn.dataset.invoice, btn.dataset.number, btn.dataset.email);
        if (action === 'reject') btn.onclick = () => rejectInvoice(btn.dataset.invoice, btn.dataset.order);
        if (action === 'final') btn.onclick = () => uploadFinal(btn.dataset.order, card.querySelector(`input[data-file="${btn.dataset.order}"]`));
      });
      list.appendChild(card);
    });
  } catch (err) {
    toast(err.message);
  }
}

async function approveInvoice(invoiceId, number, email) {
  if (!invoiceId) return;
  const ok = await confirmAction('Confirmar que o pagamento foi validado?');
  if (!ok) return;
  const form = new FormData();
  form.set('invoice_id', invoiceId);
  form.set('numero', number || '');
  form.set('email_cliente', email || '');
  const res = await fetch(`${apiBase}/admin/invoices/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) return toast(data.message || 'Erro ao validar pagamento');
  toast('Pagamento marcado como pago.');
  loadOrders();
  loadMetrics();
}

async function rejectInvoice(invoiceId, orderId) {
  if (!invoiceId) return;
  const ok = await confirmAction('Deseja marcar o pagamento como rejeitado/pendente?');
  if (!ok) return;
  const form = new FormData();
  form.set('invoice_id', invoiceId);
  form.set('order_id', orderId);
  const res = await fetch(`${apiBase}/admin/invoices/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) return toast(data.message || 'Erro ao rejeitar');
  toast('Pagamento devolvido ao estado pendente.');
  loadOrders();
  loadMetrics();
}

async function uploadFinal(orderId, input) {
  if (!input?.files?.length) return toast('Selecione um ficheiro primeiro');
  const ok = await confirmAction('Entregar este documento ao cliente?');
  if (!ok) return;
  const form = new FormData();
  form.set('order_id', orderId);
  form.append('final', input.files[0]);
  const res = await fetch(`${apiBase}/admin/orders/final-upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) return toast(data.message || 'Erro ao enviar documento');
  toast('Documento final submetido.');
  loadOrders();
}

async function loadUsers() {
  if (!requireAdmin()) return;
  const res = await fetch(`${apiBase}/admin/users`, { headers: { Authorization: `Bearer ${authToken}` } });
  const data = await res.json();
  const list = document.getElementById('admin-users');
  if (!list) return;
  if (!res.ok) {
    list.innerHTML = `<p class="muted">${data.message || 'Erro'}</p>`;
    return;
  }
  list.innerHTML = '';
  data.users.forEach((user) => {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.innerHTML = `
      <div>
        <strong>${user.name}</strong>
        <p class="muted">${user.email} · ${user.role}</p>
      </div>
      <div class="stacked-actions">
        <button class="ghost" data-id="${user.id}" data-active="${user.active ? '1' : '0'}">${user.active ? 'Desativar' : 'Ativar'}</button>
      </div>
    `;
    row.querySelector('button').onclick = () => toggleUser(user.id, !user.active);
    list.appendChild(row);
  });
}

async function toggleUser(userId, active) {
  const form = new FormData();
  form.set('user_id', userId);
  form.set('active', active ? '1' : '0');
  const res = await fetch(`${apiBase}/admin/users/toggle`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: form });
  const data = await res.json();
  if (!res.ok) return toast(data.message || 'Erro a atualizar utilizador');
  toast('Utilizador atualizado');
  loadUsers();
}

async function loadMetrics() {
  const res = await fetch(`${apiBase}/admin/metrics`, { headers: { Authorization: `Bearer ${authToken}` } });
  const data = await res.json();
  const zone = document.getElementById('admin-metrics');
  if (!zone) return;
  if (!res.ok) {
    zone.innerHTML = `<p class="muted">${data.message || 'Erro ao carregar métricas'}</p>`;
    return;
  }
  const m = data.metrics;
  zone.innerHTML = `Pedidos: ${m.orders} · Faturas: ${m.invoices} · Pago: ${m.paid} · Pendente: ${m.pending} · Levantamentos em análise: ${m.payouts_pending}`;
  const affiliateSummary = document.getElementById('admin-affiliate-summary');
  if (affiliateSummary) {
    affiliateSummary.textContent = `Saldo pendente para afiliados: ${m.payouts_pending} MZN`;
  }
  const chartData = (data.status || []).map((s) => ({ label: s.estado, value: s.total }));
  if (window.Chart && document.getElementById('status-chart')) {
    const ctx = document.getElementById('status-chart').getContext('2d');
    if (statusChart) statusChart.destroy();
    statusChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: chartData.map((d) => d.label),
        datasets: [{ data: chartData.map((d) => d.value), backgroundColor: ['#1d4ed8', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444'] }],
      },
      options: { plugins: { legend: { position: 'bottom' } } },
    });
  }
  if (window.Chart && document.getElementById('revenue-chart')) {
    const ctx = document.getElementById('revenue-chart').getContext('2d');
    if (revenueChart) revenueChart.destroy();
    const trend = (data.trend || []).reverse();
    revenueChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: trend.map((t) => t.mes),
        datasets: [{ label: 'Receita mensal (MZN)', data: trend.map((t) => t.total), borderColor: '#1d4ed8', fill: false }],
      },
      options: { plugins: { legend: { display: true } } },
    });
  }
  if (window.Chart && document.getElementById('services-chart')) {
    const ctx = document.getElementById('services-chart').getContext('2d');
    if (servicesChart) servicesChart.destroy();
    servicesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: (data.services || []).map((s) => s.categoria),
        datasets: [{ label: 'Pedidos', data: (data.services || []).map((s) => s.total), backgroundColor: '#0ea5e9' }],
      },
      options: { indexAxis: 'y', plugins: { legend: { display: false } } },
    });
  }
  const leaders = document.getElementById('admin-affiliate-leaders');
  if (leaders) {
    leaders.innerHTML = '';
    (data.affiliates || []).forEach((a) => {
      const row = document.createElement('div');
      row.className = 'list-item';
      row.innerHTML = `<div><strong>${a.referrer_code || '—'}</strong><p class="muted">${a.total} encomendas</p></div><span class="badge">${a.valor} MZN</span>`;
      leaders.appendChild(row);
    });
  }
}

async function loadCommissions() {
  const res = await fetch(`${apiBase}/admin/commissions`, { headers: { Authorization: `Bearer ${authToken}` } });
  const data = await res.json();
  const list = document.getElementById('admin-commissions');
  if (!list) return;
  if (!res.ok) {
    list.innerHTML = `<p class="muted">${data.message || 'Erro'}</p>`;
    return;
  }
  list.innerHTML = '';
  data.commissions.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `<div><strong>Ref: ${c.referrer_code}</strong><p class="muted">Encomenda #${c.order_id} · ${c.amount} MZN</p></div><span class="badge">${c.status}</span>`;
    list.appendChild(item);
  });
}

async function loadPayouts() {
  const res = await fetch(`${apiBase}/admin/payouts`, { headers: { Authorization: `Bearer ${authToken}` } });
  const data = await res.json();
  const list = document.getElementById('admin-payouts');
  if (!list) return;
  if (!res.ok) {
    list.innerHTML = `<p class="muted">${data.message || 'Erro'}</p>`;
    return;
  }
  list.innerHTML = '';
  data.payouts.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div>
        <strong>Pedido #${p.id}</strong>
        <p class="muted">${p.name || p.email} · ${p.valor} MZN · ${p.metodo}</p>
        <p class="muted">M-Pesa: ${p.mpesa_destino || '—'}</p>
      </div>
      <div class="stacked-actions">
        <button class="ghost" data-id="${p.id}" data-status="APROVADO">Aprovar</button>
        <button class="ghost" data-id="${p.id}" data-status="REJEITADO">Rejeitar</button>
      </div>`;
    item.querySelectorAll('button').forEach((btn) => {
      btn.onclick = () => updatePayout(btn.dataset.id, btn.dataset.status);
    });
    list.appendChild(item);
  });
}

async function updatePayout(payoutId, status) {
  const form = new FormData();
  form.set('payout_id', payoutId);
  form.set('status', status);
  form.set('notes', `Atualizado via painel para ${status}`);
  const res = await fetch(`${apiBase}/admin/payouts/update`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: form });
  const data = await res.json();
  if (!res.ok) return toast(data.message || 'Erro ao atualizar pagamento');
  toast('Estado do levantamento atualizado');
  loadPayouts();
  loadCommissions();
}

async function loadAudits() {
  const res = await fetch(`${apiBase}/admin/audits`, { headers: { Authorization: `Bearer ${authToken}` } });
  const data = await res.json();
  const list = document.getElementById('admin-audits');
  if (!list) return;
  if (!res.ok) {
    list.innerHTML = `<p class="muted">${data.message || 'Erro'}</p>`;
    return;
  }
  list.innerHTML = '';
  (data.audits || []).forEach((a) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `<div><strong>${a.action}</strong><p class="muted">${a.email || 'anónimo'} · ${a.meta}</p></div><span class="badge">${a.created_at || ''}</span>`;
    list.appendChild(item);
  });
}

async function loadFeedbackAdmin() {
  const zone = document.getElementById('admin-feedback-list');
  if (!zone) return;
  const res = await fetch(`${apiBase}/admin/feedback`, { headers: { Authorization: `Bearer ${authToken}` } });
  const data = await res.json();
  zone.innerHTML = '';
  if (!res.ok) {
    zone.innerHTML = `<p class="muted">${data.message || 'Não foi possível carregar feedback'}</p>`;
    return;
  }
  (data.feedback || []).forEach((fb) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `<div><strong>Pedido #${fb.order_id}</strong><p class="muted">${fb.rating}/5 · ${fb.grade || '—'}</p><p>${fb.comment || ''}</p></div><span class="badge">${fb.created_at || ''}</span>`;
    zone.appendChild(item);
  });
}

async function loadServices() {
  const res = await fetch(`${apiBase}/admin/services`, { headers: { Authorization: `Bearer ${authToken}` } });
  const data = await res.json();
  const list = document.getElementById('admin-services');
  if (!list) return;
  if (!res.ok) {
    list.innerHTML = `<p class="muted">${data.message || 'Erro ao carregar serviços'}</p>`;
    return;
  }
  list.innerHTML = '';
  data.services.forEach((svc) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.innerHTML = `
      <h4>${svc.categoria}</h4>
      <p class="muted">${svc.contact_name} · ${svc.contact_email} ${svc.contact_phone ? ' · ' + svc.contact_phone : ''}</p>
      <p>${svc.detalhes || ''}</p>
      <p>${svc.norma_preferida ? 'Norma: ' + svc.norma_preferida + ' · ' : ''}${svc.software_preferido ? 'Software: ' + svc.software_preferido : ''}</p>
      ${svc.attachment ? `<p><a href="${svc.attachment}" target="_blank">Ver anexo</a></p>` : ''}
      <div class="inline-group">
        <select data-service="${svc.id}">
          ${['NOVO','EM_ANALISE','RESPONDIDO','CONCLUIDO'].map((s) => `<option value="${s}" ${svc.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <button class="ghost" data-btn="${svc.id}">Atualizar</button>
      </div>
    `;
    item.querySelector('button').onclick = () => updateServiceStatus(svc.id, item.querySelector('select').value);
    list.appendChild(item);
  });
}

async function updateServiceStatus(id, status) {
  const form = new FormData();
  form.set('service_id', id);
  form.set('status', status);
  const res = await fetch(`${apiBase}/admin/services/update`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: form });
  const data = await res.json();
  if (!res.ok) return toast(data.message || 'Erro ao atualizar serviço');
  toast('Serviço atualizado');
  loadServices();
}

async function loadAdminChat() {
  const chatBox = document.getElementById('admin-chat');
  if (!chatBox || !authToken) return;
  const filter = document.getElementById('chat-order')?.value;
  const res = await fetch(`${apiBase}/admin/chat${filter ? `?order_id=${filter}` : ''}`, { headers: { Authorization: `Bearer ${authToken}` } });
  const data = await res.json();
  chatBox.innerHTML = '';
  if (!res.ok) {
    chatBox.innerHTML = `<p class="muted">${data.message || 'Erro ao carregar estação'}</p>`;
    return;
  }
  (data.messages || []).forEach((msg) => {
    const row = document.createElement('div');
    row.className = 'chat-row';
    row.innerHTML = `
      <div>
        <strong>${msg.author || 'Admin'}</strong> ${msg.order_id ? `<span class="badge">#${msg.order_id}</span>` : ''}
        <p class="muted">${msg.created_at || ''}</p>
        <p>${msg.message || ''}</p>
        ${msg.attachment ? `<a href="${msg.attachment}" target="_blank">Ver anexo</a>` : ''}
      </div>
    `;
    chatBox.appendChild(row);
  });
}

async function sendAdminChat() {
  const msgInput = document.getElementById('chat-message');
  const fileInput = document.getElementById('chat-file');
  const orderInput = document.getElementById('chat-order');
  const form = new FormData();
  form.set('message', msgInput?.value || '');
  if (orderInput?.value) form.set('order_id', orderInput.value);
  if (fileInput?.files?.length) form.append('attachment', fileInput.files[0]);
  const res = await fetch(`${apiBase}/admin/chat`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: form });
  const data = await res.json();
  if (!res.ok) return toast(data.message || 'Erro ao enviar nota');
  toast('Nota registada');
  if (msgInput) msgInput.value = '';
  if (fileInput) fileInput.value = '';
  loadAdminChat();
}

const chatSend = document.getElementById('chat-send');
if (chatSend) {
  chatSend.onclick = sendAdminChat;
  document.getElementById('chat-refresh')?.addEventListener('click', loadAdminChat);
}

switch (adminPage) {
  case 'orders':
    loadOrders();
    loadMetrics();
    loadAudits();
    loadFeedbackAdmin();
    setInterval(() => {
      loadOrders();
      loadMetrics();
      loadAudits();
      loadFeedbackAdmin();
    }, 20000);
    break;
  case 'services':
    loadServices();
    setInterval(loadServices, 20000);
    break;
  case 'users':
    loadUsers();
    break;
  case 'metrics':
    loadMetrics();
    loadAudits();
    setInterval(() => {
      loadMetrics();
      loadAudits();
    }, 20000);
    break;
  case 'affiliates':
    loadCommissions();
    loadPayouts();
    loadMetrics();
    setInterval(() => {
      loadCommissions();
      loadPayouts();
    }, 20000);
    break;
  case 'chat':
    loadAdminChat();
    document.getElementById('chat-refresh')?.addEventListener('click', loadAdminChat);
    setInterval(loadAdminChat, 15000);
    break;
  default:
    loadMetrics();
    loadAudits();
}
