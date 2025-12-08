const apiBase = '/api';
let token = localStorage.getItem('adminToken') || '';
let selectedOrder = null;
let dashboardData = null;
let serviceRequests = [];
let filters = { status: 'all', invoice: 'all', search: '' };
let refreshTimer = null;
let userData = null;
let affiliateData = null;
const charts = {};

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

function renderCharts() {
  if (!dashboardData?.timeSeries) return;
  const dates = Object.keys(dashboardData.timeSeries).sort();
  const emitidas = dates.map((d) => dashboardData.timeSeries[d].emitidas);
  const pagas = dates.map((d) => dashboardData.timeSeries[d].pagas);
  const valores = dates.map((d) => dashboardData.timeSeries[d].valor);

  const ctxFaturas = document.getElementById('chart-faturas');
  if (ctxFaturas) {
    charts.faturas?.destroy?.();
    charts.faturas = new Chart(ctxFaturas, {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [
          { label: 'Faturas emitidas', data: emitidas, backgroundColor: '#4f8af5' },
          { label: 'Faturas pagas', data: pagas, backgroundColor: '#23c683' },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    });
  }

  const ctxReceita = document.getElementById('chart-receita');
  if (ctxReceita) {
    charts.receita?.destroy?.();
    charts.receita = new Chart(ctxReceita, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{ label: 'Receita confirmada', data: valores, borderColor: '#1f6feb', backgroundColor: 'rgba(31,111,235,0.2)' }],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    });
  }
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
    loadUsers();
    loadAffiliates();
    if (!refreshTimer) {
      refreshTimer = setInterval(() => {
        if (document.hidden) return;
        loadAdminOrders(true);
        if (selectedOrder) openOrder(selectedOrder.order._id, true);
        loadServices(true);
        loadUsers(true);
        loadAffiliates(true);
      }, 8000);
    }
  } else if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

async function loadAdminOrders(silent = false) {
  const res = await fetch(`${apiBase}/admin/orders`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) {
    if (!silent) toast(data.message || 'Erro ao carregar painel');
    return;
  }
  dashboardData = data;
  renderStats();
  renderOrders();
  renderAudit();
  renderCharts();
}

async function loadServices(silent = false) {
  const res = await fetch(`${apiBase}/admin/services`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) {
    if (!silent) toast(data.message || 'Erro ao carregar pedidos especiais');
    return;
  }
  serviceRequests = data.requests || [];
  renderServices();
}

async function loadUsers(silent = false) {
  const res = await fetch(`${apiBase}/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) {
    if (!silent) toast(data.message || 'Erro ao carregar utilizadores');
    return;
  }
  userData = data;
  renderUsers();
}

async function loadAffiliates(silent = false) {
  const res = await fetch(`${apiBase}/admin/affiliates`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) {
    if (!silent) toast(data.message || 'Erro ao carregar afiliados');
    return;
  }
  affiliateData = data;
  renderAffiliates();
}

async function openOrder(id, silent = false) {
  const res = await fetch(`${apiBase}/admin/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) {
    if (!silent) toast(data.message || 'Erro ao abrir encomenda');
    return;
  }
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
    <p><a class="ghost" target="_blank" rel="noopener" href="/invoice.html?id=${order._id}">Abrir página da fatura</a></p>
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
    <div id="admin-feedback" class="feedback-board"></div>
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
  renderAdminFeedback(order._id);
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

async function renderAdminFeedback(orderId) {
  const holder = document.getElementById('admin-feedback');
  if (!holder) return;
  holder.innerHTML = '<p class="muted">A carregar feedback...</p>';
  const res = await fetch(`${apiBase}/admin/orders/${orderId}/feedback`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) {
    holder.innerHTML = '<p class="muted">Sem feedback enviado ainda.</p>';
    return;
  }
  const feedback = data.feedback;
  if (!feedback) {
    holder.innerHTML = '<p class="muted">Sem feedback enviado ainda.</p>';
    return;
  }

  holder.innerHTML = `
    <h4>Feedback do cliente</h4>
    <p>Classificação: ${feedback.rating || 'N/A'} | Nota obtida: ${feedback.gradeReceived || 'N/A'}</p>
    <p>${feedback.comment || 'Sem comentário'}</p>
    <div class="thread" id="admin-thread"></div>
    <form id="admin-feedback-reply" class="inline-form">
      <input type="text" name="message" placeholder="Responder ao cliente" required />
      <button type="submit">Enviar resposta</button>
    </form>
  `;

  const thread = holder.querySelector('#admin-thread');
  (feedback.replies || []).forEach((r) => {
    const bubble = document.createElement('div');
    bubble.classList.add('bubble', r.from === 'admin' ? 'bubble-admin' : 'bubble-client');
    bubble.innerHTML = `<p>${r.message}</p><span>${new Date(r.createdAt).toLocaleString()}</span>`;
    thread.appendChild(bubble);
  });

  holder.querySelector('#admin-feedback-reply').addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = e.target.message.value;
    const resp = await fetch(`${apiBase}/admin/orders/${orderId}/feedback/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message }),
    });
    const body = await resp.json();
    if (resp.ok) {
      toast('Resposta enviada');
      renderAdminFeedback(orderId);
    } else {
      toast(body.message || 'Erro ao responder');
    }
  });
}

function renderStats() {
  const holder = document.getElementById('admin-stats');
  if (!dashboardData) return;
  const total = dashboardData.orders.length;
  const awaiting = dashboardData.orders.filter((o) => o.status === 'PAGAMENTO_EM_VALIDACAO').length;
  const executing = dashboardData.orders.filter((o) => o.status === 'EM_EXECUCAO').length;
  const finished = dashboardData.orders.filter((o) => o.status === 'CONCLUIDA').length;
  const affiliate = dashboardData.affiliateTotals || {};
  const payoutTotals = dashboardData.payoutTotals || {};
  holder.innerHTML = `
    <div class="pill">Total: ${total}</div>
    <div class="pill">Em validação: ${awaiting}</div>
    <div class="pill">Em execução: ${executing}</div>
    <div class="pill">Concluídas: ${finished}</div>
    <div class="pill">Faturas pagas: ${dashboardData.invoiceStatusCounts?.PAGA || 0}</div>
    <div class="pill">Receita confirmada: ${dashboardData.revenue?.total || 0}</div>
    <div class="pill">Comissões afiliados: ${affiliate.paid?.toFixed?.(2) || 0}</div>
    <div class="pill">Pagamentos afiliados emitidos: ${payoutTotals.paid?.toFixed?.(2) || 0}</div>
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

function renderUsers() {
  if (!userData) return;
  const summary = document.getElementById('user-summary');
  summary.innerHTML = `
    <div class="pill">Clientes: ${userData.summary?.client || 0}</div>
    <div class="pill">Admins: ${userData.summary?.admin || 0}</div>
    <div class="pill">Inativos: ${userData.summary?.inativos || 0}</div>
  `;
  const table = document.getElementById('user-table');
  table.innerHTML = '';
  userData.users.forEach((u) => {
    const row = document.createElement('div');
    row.innerHTML = `
      <p><strong>${u.name}</strong> (${u.email})</p>
      <p>Role: <span class="badge">${u.role}</span> · Estado: ${u.active ? 'Ativo' : 'Inativo'}</p>
      <div class="row-actions">
        <button data-action="role" data-id="${u._id}" data-role="${u.role === 'admin' ? 'client' : 'admin'}">Tornar ${
      u.role === 'admin' ? 'cliente' : 'admin'
    }</button>
        <button data-action="toggle" data-id="${u._id}">${u.active ? 'Desativar' : 'Reativar'}</button>
      </div>
    `;
    table.appendChild(row);
  });

  table.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const payload = {};
      if (action === 'role') payload.role = btn.dataset.role;
      if (action === 'toggle') payload.active = btn.textContent.includes('Reativar');
      const res = await fetch(`${apiBase}/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast('Utilizador atualizado');
        loadUsers(true);
      } else {
        toast(data.message || 'Erro ao atualizar utilizador');
      }
    });
  });
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

function renderAffiliates() {
  if (!affiliateData || !dashboardData) return;
  const cards = document.getElementById('affiliate-totals');
  const totals = dashboardData.affiliateTotals || {};
  const payoutTotals = dashboardData.payoutTotals || {};
  cards.innerHTML = `
    <div class="pill">Comissões acumuladas: ${totals.total?.toFixed?.(2) || 0}</div>
    <div class="pill">Pagas: ${totals.paid?.toFixed?.(2) || 0}</div>
    <div class="pill">Pagamentos emitidos: ${payoutTotals.paid?.toFixed?.(2) || 0}</div>
  `;

  const list = document.getElementById('affiliate-list');
  list.innerHTML = '';
  affiliateData.affiliates.forEach((a) => {
    const div = document.createElement('div');
    div.innerHTML = `
      <p><strong>${a.name}</strong> (${a.email})</p>
      <p>Código: <code>${a.referralCode}</code> · Saldo: ${a.affiliateBalance?.toFixed?.(2) || 0} · Ganhos: ${
      a.affiliateTotalEarned?.toFixed?.(2) || 0
    }</p>
      <p>Estado: ${a.active ? 'Ativo' : 'Inativo'} | Perfil ${a.role}</p>
    `;
    list.appendChild(div);
  });

  const payoutList = document.getElementById('payout-list');
  payoutList.innerHTML = '<p class="muted">Pagamentos registados</p>';
  affiliateData.payouts.forEach((p) => {
    const div = document.createElement('div');
    div.innerHTML = `
      <p><strong>${p.user?.name || p.user?.email || 'Afiliado'}</strong> — ${p.amount} MZN (${p.status})</p>
      <p>${new Date(p.createdAt).toLocaleString()} ${p.note ? `| ${p.note}` : ''}</p>
      ${p.status === 'PENDENTE'
        ? `<div class="row-actions">
            <button data-action="approve" data-id="${p._id}">Marcar como pago</button>
            <button data-action="reject" data-id="${p._id}" class="ghost">Rejeitar</button>
          </div>`
        : ''}
    `;
    payoutList.appendChild(div);
  });

  payoutList.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const status = btn.dataset.action === 'approve' ? 'PAGO' : 'RECUSADO';
      const id = btn.dataset.id;
      const res = await fetch(`${apiBase}/admin/affiliates/payouts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        toast('Pagamento atualizado');
        loadAffiliates(true);
        loadAdminOrders(true);
      } else {
        toast(data.message || 'Erro ao atualizar pagamento');
      }
    });
  });

  const payoutForm = document.getElementById('payout-form');
  if (payoutForm && !payoutForm.dataset.bound) {
    payoutForm.dataset.bound = 'true';
    payoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(payoutForm).entries());
      const res = await fetch(`${apiBase}/admin/affiliates/payouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast('Pagamento registado');
        payoutForm.reset();
        loadAffiliates(true);
      } else {
        toast(data.message || 'Erro ao registar pagamento');
      }
    });
  }
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
        ${invoice.invoiceNumber ? `<a class="ghost" target="_blank" rel="noopener" href="/invoice.html?id=${order._id}">Fatura</a>` : ''}
        ${order.materialsFiles?.length ? `<a class="ghost" target="_blank" rel="noopener" href="/invoice.html?id=${order._id}#materiais">Materiais</a>` : ''}
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
