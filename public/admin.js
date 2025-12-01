const apiBase = '/api';
let token = localStorage.getItem('adminToken') || '';
let selectedOrder = null;
let dashboardData = null;
let serviceRequests = [];

document.getElementById('admin-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  const res = await fetch(`${apiBase}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.token && data.user.role === 'admin') {
    token = data.token;
    localStorage.setItem('adminToken', token);
    document.getElementById('admin-panel').style.display = 'flex';
    loadAdminOrders();
  } else {
    alert('Credenciais inválidas ou não é admin');
  }
});

document.getElementById('admin-logout').addEventListener('click', () => {
  token = '';
  localStorage.removeItem('adminToken');
  document.getElementById('admin-panel').style.display = 'none';
  alert('Sessão de administrador terminada.');
});

async function loadAdminOrders() {
  const res = await fetch(`${apiBase}/admin/orders`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  dashboardData = data;
  const container = document.getElementById('admin-orders');
  container.innerHTML = '';
  renderStats();
  data.orders.forEach((order) => {
    const invoice = data.invoices.find((i) => i.order === order._id) || {};
    const div = document.createElement('div');
    div.innerHTML = `
      <p><strong>${order.workType}</strong> - ${order.area} <span class="badge">${order.status}</span></p>
      <p>Cliente: ${order.user.name} (${order.user.email})</p>
      <p>Fatura #${invoice.invoiceNumber || 'N/A'} - ${invoice.status || 'N/A'}</p>
      <button data-id="${order._id}">Abrir</button>
    `;
    div.querySelector('button').addEventListener('click', () => openOrder(order._id));
    container.appendChild(div);
  });
}

async function loadServices() {
  const res = await fetch(`${apiBase}/admin/services`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (res.ok) {
    serviceRequests = data.requests || [];
    renderServices();
  }
}

async function openOrder(id) {
  const res = await fetch(`${apiBase}/admin/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) return alert(data.message || 'Erro ao abrir encomenda');
  selectedOrder = data;
  renderDetail();
}

function renderDetail() {
  if (!selectedOrder) return;
  const { order, invoice } = selectedOrder;
  const box = document.getElementById('admin-detail');
  box.innerHTML = `
    <p><strong>${order.workType}</strong> - ${order.area}</p>
    <p>Estado: ${order.status}</p>
    <p>Fatura #${invoice.invoiceNumber} (${invoice.status})</p>
    <p>Comprovativo: ${invoice.proofFile ? `<a href="/uploads/comprovativos/${invoice.proofFile}" target="_blank">Ver ficheiro</a>` : 'N/A'}</p>
    ${invoice.rejectionReason ? `<p class="alert">Última rejeição: ${invoice.rejectionReason}</p>` : ''}
    <div id="admin-timeline" class="timeline"></div>
    <button id="btn-validate">Validar pagamento</button>
    <button id="btn-reject">Rejeitar pagamento</button>
    <button id="btn-expire">Marcar expirada</button>
  `;
  document.getElementById('btn-validate').addEventListener('click', () => adminAction('validate-payment'));
  document.getElementById('btn-reject').addEventListener('click', () => adminAction('reject-payment'));
  document.getElementById('btn-expire').addEventListener('click', () => adminAction('expire'));
  renderTimeline(order, invoice);
}

async function adminAction(action) {
  const res = await fetch(`${apiBase}/admin/orders/${selectedOrder.order._id}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: action === 'reject-payment' ? JSON.stringify({ reason: prompt('Motivo da rejeição?') || '' }) : undefined,
  });
  const data = await res.json();
  if (res.ok) {
    selectedOrder.order = data.order;
    selectedOrder.invoice = data.invoice;
    renderDetail();
    loadAdminOrders();
  } else {
    alert(data.message || 'Erro na ação admin');
  }
}

function renderTimeline(order, invoice) {
  const timeline = document.getElementById('admin-timeline');
  const combined = [...(order.statusHistory || []), ...(invoice.statusHistory || [])].sort(
    (a, b) => new Date(a.changedAt) - new Date(b.changedAt)
  );
  timeline.innerHTML = combined
    .map(
      (h) => `
      <div class="timeline-item">
        <div class="dot"></div>
        <div>
          <p class="label">${h.status}</p>
          <p class="small">${new Date(h.changedAt).toLocaleString()}</p>
          <p class="muted">${h.note || ''}</p>
        </div>
      </div>
    `
    )
    .join('');
}

function renderStats() {
  const holder = document.getElementById('admin-stats');
  if (!dashboardData) return;
  const total = dashboardData.orders.length;
  const awaiting = dashboardData.orders.filter((o) => o.status === 'PAGAMENTO_EM_VALIDACAO').length;
  const executing = dashboardData.orders.filter((o) => o.status === 'EM_EXECUCAO').length;
  holder.innerHTML = `
    <div class="pill">Total: ${total}</div>
    <div class="pill">Em validação: ${awaiting}</div>
    <div class="pill">Em execução: ${executing}</div>
    <div class="pill">Faturas pagas: ${dashboardData.invoices.filter((i) => i.status === 'PAGA').length}</div>
    <div class="pill">Receita confirmada: ${dashboardData.invoices
      .filter((i) => i.status === 'PAGA')
      .reduce((sum, i) => sum + (i.amount || 0), 0)}</div>
  `;
}

function renderServices() {
  const zone = document.getElementById('admin-services');
  if (!zone) return;
  zone.innerHTML = '';
  serviceRequests.forEach((r) => {
    const div = document.createElement('div');
    div.innerHTML = `
      <p><strong>${r.type}</strong> - ${r.contactName} (${r.contactEmail}) <span class="badge">${r.status}</span></p>
      <p>${r.details}</p>
      <label>Valor fatura</label><input type="number" data-field="amount" value="${r.invoiceAmount || ''}" />
      <label>Nota</label><input data-field="note" value="${r.invoiceNote || ''}" />
      <select data-field="status">
        <option value="RECEBIDO" ${r.status === 'RECEBIDO' ? 'selected' : ''}>Recebido</option>
        <option value="EM_ANALISE" ${r.status === 'EM_ANALISE' ? 'selected' : ''}>Em análise</option>
        <option value="FATURA_ENVIADA" ${r.status === 'FATURA_ENVIADA' ? 'selected' : ''}>Fatura enviada</option>
        <option value="FECHADO" ${r.status === 'FECHADO' ? 'selected' : ''}>Fechado</option>
      </select>
      <button data-id="${r._id}">Atualizar</button>
    `;
    div.querySelector('button').addEventListener('click', () => updateService(div, r._id));
    zone.appendChild(div);
  });
}

async function updateService(container, id) {
  const status = container.querySelector('[data-field="status"]').value;
  const invoiceAmount = Number(container.querySelector('[data-field="amount"]').value || 0);
  const invoiceNote = container.querySelector('[data-field="note"]').value;
  const res = await fetch(`${apiBase}/admin/services/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, invoiceAmount, invoiceNote }),
  });
  const data = await res.json();
  if (res.ok) {
    alert('Pedido atualizado');
    loadServices();
  } else {
    alert(data.message || 'Erro ao atualizar pedido');
  }
}

const finalWorkForm = document.getElementById('final-work-form');
finalWorkForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedOrder) return;
  const formData = new FormData(finalWorkForm);
  const res = await fetch(`${apiBase}/admin/orders/${selectedOrder.order._id}/upload-work`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (res.ok) {
    alert('Trabalho final carregado!');
    selectedOrder.order = data.order;
    renderDetail();
    loadAdminOrders();
  } else {
    alert(data.message || 'Erro ao subir ficheiro');
  }
});

if (token) {
  document.getElementById('admin-panel').style.display = 'flex';
  loadAdminOrders();
  loadServices();
}

const broadcastForm = document.getElementById('broadcast-form');
if (broadcastForm) {
  broadcastForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(broadcastForm).entries());
    const res = await fetch(`${apiBase}/admin/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    alert(data.message || (res.ok ? 'Emails enviados' : 'Erro ao enviar emails'));
  });
}
