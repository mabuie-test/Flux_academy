const apiBase = '/api';
let token = localStorage.getItem('adminToken') || '';
let selectedOrder = null;
let dashboardData = null;
let serviceRequests = [];
let filters = { status: 'all', invoice: 'all', search: '' };

const modal = document.getElementById('confirm-overlay');
const modalTitle = document.getElementById('confirm-title');
const modalText = document.getElementById('confirm-text');
const modalOk = document.getElementById('confirm-ok');
const modalCancel = document.getElementById('confirm-cancel');

function showConfirm({ title, text }) {
  return new Promise((resolve) => {
    modalTitle.textContent = title || 'Confirmar ação';
    modalText.textContent = text || '';
    modal.classList.remove('hidden');
    modalOk.textContent = 'Confirmar';
    modalCancel.textContent = 'Cancelar';

    const close = (result) => {
      modal.classList.add('hidden');
      modalOk.removeEventListener('click', okHandler);
      modalCancel.removeEventListener('click', cancelHandler);
      resolve(result);
    };

    const okHandler = () => close(true);
    const cancelHandler = () => close(false);
    modalOk.addEventListener('click', okHandler);
    modalCancel.addEventListener('click', cancelHandler);
  });
}

function toast(message) {
  modalTitle.textContent = 'Informação';
  modalText.textContent = message;
  modalOk.textContent = 'Ok';
  modalCancel.textContent = 'Fechar';
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');
  modalOk.onclick = close;
  modalCancel.onclick = close;
}

const adminLoginForm = document.getElementById('admin-login');
const adminLoginCard = adminLoginForm?.closest('.card');

adminLoginForm.addEventListener('submit', async (e) => {
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
    toggleAdminView(true);
  } else {
    toast('Credenciais inválidas ou não é admin');
  }
});

document.getElementById('admin-logout').addEventListener('click', async () => {
  const confirm = await showConfirm({ title: 'Terminar sessão?', text: 'Esta ação irá fechar o painel.' });
  if (!confirm) return;
  token = '';
  localStorage.removeItem('adminToken');
  toggleAdminView(false);
  toast('Sessão de administrador terminada.');
});

function toggleAdminView(authenticated) {
  const panel = document.getElementById('admin-panel');
  if (panel) panel.style.display = authenticated ? 'flex' : 'none';
  if (adminLoginCard) adminLoginCard.style.display = authenticated ? 'none' : 'block';
  if (authenticated) {
    loadAdminOrders();
    loadServices();
  }
}

async function loadAdminOrders() {
  const res = await fetch(`${apiBase}/admin/orders`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  dashboardData = data;
  renderStats();
  renderOrders();
  renderAudit();
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
  if (!res.ok) return toast(data.message || 'Erro ao abrir encomenda');
  selectedOrder = data;
  renderDetail();
}

function renderDetail() {
  if (!selectedOrder) return;
  const { order, invoice } = selectedOrder;
  const canUploadFinal = invoice.status === 'PAGA' && order.status === 'EM_EXECUCAO';
  const box = document.getElementById('admin-detail');
  box.innerHTML = `
    <p><strong>${order.workType}</strong> - ${order.area}</p>
    <p>Estado: ${order.status}</p>
    <p>Fatura #${invoice.invoiceNumber} (${invoice.status})</p>
    <p>Materiais do cliente: ${order.hasMaterials ? 'Sim' : 'Não'}${
    order.hasMaterials && order.materialsUsagePercent ? ` (${order.materialsUsagePercent}% previsto)` : ''
  }</p>
    ${
      order.materialsFiles?.length
        ? `<div class="attachments"><strong>Materiais do cliente:</strong> ${order.materialsFiles
            .map((f) => `<a href="/uploads/materiais/${f}" target="_blank" download>${f}</a>`)
            .join('')}</div>`
        : ''
    }
    <p>Comprovativo: ${invoice.proofFile ? `<a href="/uploads/comprovativos/${invoice.proofFile}" target="_blank">Ver ficheiro</a>` : 'N/A'}</p>
    ${invoice.rejectionReason ? `<p class="alert">Última rejeição: ${invoice.rejectionReason}</p>` : ''}
    <div class="upload-card" id="final-upload-area">
      ${
        canUploadFinal
          ? `
        <details open>
          <summary>Disponibilizar trabalho final</summary>
          <form id="final-work-form" enctype="multipart/form-data">
            <label>Ficheiro final (.pdf, .docx)</label>
            <input type="file" name="finalWork" required />
            <button type="submit">Submeter ao cliente</button>
          </form>
        </details>
      `
          : '<p class="muted">O upload final só aparece quando a fatura está paga e o pedido em execução.</p>'
      }
    </div>
    <div id="admin-timeline" class="timeline"></div>
    <div class="row-actions">
      <button id="btn-validate">Validar pagamento</button>
      <button id="btn-reject" class="ghost">Rejeitar pagamento</button>
      <button id="btn-expire" class="ghost">Marcar expirada</button>
    </div>
  `;
  document.getElementById('btn-validate').addEventListener('click', () => adminAction('validate-payment'));
  document.getElementById('btn-reject').addEventListener('click', () => adminAction('reject-payment'));
  document.getElementById('btn-expire').addEventListener('click', () => adminAction('expire'));
  renderTimeline(order, invoice);
  bindFinalUpload();
}

async function adminAction(action) {
  if (!selectedOrder) return;
  const confirm = await showConfirm({
    title: 'Confirmar ação',
    text: action === 'reject-payment' ? 'Pretende rejeitar o comprovativo?' : 'Aplicar alteração de estado?',
  });
  if (!confirm) return;
  const body = action === 'reject-payment' ? { reason: prompt('Motivo da rejeição?') || '' } : undefined;
  const res = await fetch(`${apiBase}/admin/orders/${selectedOrder.order._id}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (res.ok) {
    selectedOrder.order = data.order;
    selectedOrder.invoice = data.invoice;
    renderDetail();
    loadAdminOrders();
    toast(data.message || 'Atualizado');
  } else {
    toast(data.message || 'Erro na ação admin');
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
  const finished = dashboardData.orders.filter((o) => o.status === 'CONCLUIDA').length;
  holder.innerHTML = `
    <div class="pill">Total: ${total}</div>
    <div class="pill">Em validação: ${awaiting}</div>
    <div class="pill">Em execução: ${executing}</div>
    <div class="pill">Concluídas: ${finished}</div>
    <div class="pill">Faturas pagas: ${dashboardData.invoiceStatusCounts?.PAGA || 0}</div>
    <div class="pill">Receita confirmada: ${dashboardData.revenue?.total || 0}</div>
  `;

  const mini = document.getElementById('admin-mini-stats');
  if (mini) {
    mini.innerHTML = `
      <p><strong>Logins recentes:</strong> ${dashboardData.auditSummary?.lastLogins || 0}</p>
      <p><strong>IPs únicos:</strong> ${dashboardData.auditSummary?.uniqueIps || 0}</p>
      <p><strong>Uploads:</strong> ${dashboardData.auditSummary?.uploads || 0}</p>
      <p><strong>Total auditorias:</strong> ${dashboardData.auditSummary?.totalAudits || 0}</p>
    `;
  }
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
    toast('Pedido atualizado');
    loadServices();
  } else {
    toast(data.message || 'Erro ao atualizar pedido');
  }
}

function renderOrders() {
  if (!dashboardData) return;
  const container = document.getElementById('admin-orders');
  container.innerHTML = '';
  const orders = dashboardData.orders.filter((order) => {
    const invoice = dashboardData.invoices.find((i) => i.order === order._id) || {};
    const matchesStatus = filters.status === 'all' || order.status === filters.status;
    const matchesInvoice = filters.invoice === 'all' || invoice.status === filters.invoice;
    const search = `${order.user?.name || ''} ${order.user?.email || ''} ${invoice.invoiceNumber || ''}`.toLowerCase();
    const matchesSearch = !filters.search || search.includes(filters.search.toLowerCase());
    return matchesStatus && matchesInvoice && matchesSearch;
  });

  if (!orders.length) {
    container.innerHTML = '<p class="muted">Nenhuma encomenda encontrada com os filtros actuais.</p>';
    return;
  }

  orders.forEach((order) => {
    const invoice = dashboardData.invoices.find((i) => i.order === order._id) || {};
    const div = document.createElement('div');
    div.classList.add('list-row');
    div.innerHTML = `
      <div>
        <p><strong>${order.workType}</strong> - ${order.area} <span class="badge">${order.status}</span></p>
        <p class="muted">Cliente: ${order.user.name} (${order.user.email})</p>
        <p class="muted">Fatura #${invoice.invoiceNumber || 'N/A'} - ${invoice.status || 'N/A'}</p>
        ${order.materialsFiles?.length ? `<p class="small">Materiais do cliente: ${order.materialsFiles.length} ficheiros</p>` : ''}
      </div>
      <div class="row-actions">
        <button data-id="${order._id}" class="ghost">Abrir</button>
      </div>
    `;
    div.querySelector('button').addEventListener('click', () => openOrder(order._id));
    container.appendChild(div);
  });
}

function renderAudit() {
  if (!dashboardData) return;
  const cards = document.getElementById('audit-cards');
  const feed = document.getElementById('audit-feed');
  if (cards) {
    cards.innerHTML = `
      <div class="pill">Validações de pagamento: ${dashboardData.auditSummary?.paymentValidations || 0}</div>
      <div class="pill">Pedidos de reset: ${dashboardData.auditSummary?.resetRequests || 0}</div>
      <div class="pill">Uploads registados: ${dashboardData.auditSummary?.uploads || 0}</div>
      <div class="pill">IPs únicos em destaque: ${dashboardData.auditSummary?.uniqueIps || 0}</div>
    `;
  }

  if (feed) {
    feed.innerHTML = '';
    dashboardData.audits.forEach((a) => {
      const row = document.createElement('div');
      row.classList.add('list-row');
      row.innerHTML = `
        <div>
          <p><strong>${a.action}</strong> - ${a.role || 'N/A'}</p>
          <p class="muted">${a.metadata?.ip || 'IP não registado'} · ${a.metadata?.userAgent || ''}</p>
        </div>
        <div class="muted small">${new Date(a.createdAt).toLocaleString()}</div>
      `;
      feed.appendChild(row);
    });
  }
}

function bindFinalUpload() {
  const finalWorkForm = document.getElementById('final-work-form');
  if (!finalWorkForm || finalWorkForm.dataset.bound) return;
  finalWorkForm.dataset.bound = 'true';
  finalWorkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const confirm = await showConfirm({ title: 'Enviar trabalho final?', text: 'Confirme antes de disponibilizar ao cliente.' });
    if (!confirm) return;
    const formData = new FormData(finalWorkForm);
    const res = await fetch(`${apiBase}/admin/orders/${selectedOrder.order._id}/upload-work`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (res.ok) {
      toast('Trabalho final carregado e notificação enviada ao cliente.');
      selectedOrder.order = data.order;
      renderDetail();
      loadAdminOrders();
    } else {
      toast(data.message || 'Erro ao subir ficheiro');
    }
  });
}

toggleAdminView(Boolean(token));

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
    toast(data.message || (res.ok ? 'Emails enviados' : 'Erro ao enviar emails'));
  });
}

['filter-status', 'filter-invoice', 'filter-search'].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', (e) => {
    if (id === 'filter-status') filters.status = e.target.value;
    if (id === 'filter-invoice') filters.invoice = e.target.value;
    if (id === 'filter-search') filters.search = e.target.value;
    renderOrders();
  });
});
