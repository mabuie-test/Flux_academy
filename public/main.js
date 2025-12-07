const apiBase = '/api';
let authToken = localStorage.getItem('token') || '';
let currentOrder = null;
let currentQuote = null;
let refreshHandle = null;
const urlParams = new URLSearchParams(window.location.search);
const referralParam = urlParams.get('ref');

const modal = document.getElementById('confirm-overlay');
const modalTitle = document.getElementById('confirm-title');
const modalText = document.getElementById('confirm-text');
const modalOk = document.getElementById('confirm-ok');
const modalCancel = document.getElementById('confirm-cancel');

function showConfirm({ title, text }) {
  return new Promise((resolve) => {
    modalTitle.textContent = title || 'Confirmar';
    modalText.textContent = text || '';
    modalOk.textContent = 'Confirmar';
    modalCancel.textContent = 'Cancelar';
    modal.classList.remove('hidden');

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
  modalTitle.textContent = 'Aviso';
  modalText.textContent = message;
  modalOk.textContent = 'Ok';
  modalCancel.textContent = 'Fechar';
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');
  modalOk.onclick = close;
  modalCancel.onclick = close;
}

const materialsExtra = document.getElementById('materials-extra');
const materialsSelect = document.getElementById('has-materials');
const referralInput = document.querySelector('input[name="referralCode"]');

if (referralInput && referralParam) {
  referralInput.value = referralParam;
}

function toggleMaterials(show) {
  if (!materialsExtra) return;
  materialsExtra.style.display = show ? 'block' : 'none';
  if (!show) {
    materialsExtra.querySelectorAll('input').forEach((el) => {
      el.value = '';
    });
  }
}
if (materialsSelect) {
  materialsSelect.addEventListener('change', (e) => toggleMaterials(e.target.value === 'sim'));
}

function updateNav() {
  document.querySelectorAll('.anon-only').forEach((el) => (el.style.display = authToken ? 'none' : 'inline-flex'));
  document.querySelectorAll('.auth-only').forEach((el) => (el.style.display = authToken ? 'inline-flex' : 'none'));
  document.querySelectorAll('.auth-hide').forEach((el) => (el.style.display = authToken ? 'none' : 'flex'));
  document.querySelectorAll('.auth-show').forEach((el) => (el.style.display = authToken ? 'flex' : 'none'));
  if (authToken && !refreshHandle) {
    refreshHandle = setInterval(() => {
      if (document.hidden) return;
      loadOrders(true);
    }, 8000);
  }
}

function clearSession() {
  authToken = '';
  localStorage.removeItem('token');
  if (refreshHandle) {
    clearInterval(refreshHandle);
    refreshHandle = null;
  }
  showDashboard(false);
  showOrderDetails(false);
  updateNav();
}

function setAuth(token) {
  authToken = token;
  if (token) localStorage.setItem('token', token);
  updateNav();
}

function safeToggle(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? 'flex' : 'none';
}

function showDashboard(show) {
  safeToggle('dashboard', show);
}

function showOrderDetails(show) {
  safeToggle('order-details', show);
}

const logoutBtn = document.getElementById('logout');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    clearSession();
    toast('Sessão terminada. Faça login novamente para continuar.');
  });
}

document.getElementById('order-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  formData.set('pages', Number(formData.get('pages') || 0));
  const res = await fetch(`${apiBase}/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: formData,
  });
  const data = await res.json();
  if (res.ok) {
    toast('Encomenda criada. Fatura pronta para pagamento.');
    e.target.reset();
    toggleMaterials(false);
    currentQuote = null;
    renderQuote();
    setTimeout(() => {
      window.open(`/invoice.html?id=${data.order._id}`, '_blank');
      loadOrders();
    }, 250);
  } else {
    toast(data.message || 'Erro ao criar encomenda');
  }
});

async function simulatePrice() {
  const form = document.getElementById('order-form');
  const raw = Object.fromEntries(new FormData(form).entries());
  if (!authToken) return;
  try {
    const res = await fetch(`${apiBase}/orders/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        pages: Number(raw.pages || 0),
        academicLevel: raw.academicLevel,
        complexity: raw.complexity,
        urgency: raw.urgency,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      currentQuote = data.breakdown;
    } else {
      currentQuote = null;
    }
  } catch (err) {
    currentQuote = null;
  }
  renderQuote();
}

function renderQuote() {
  const zone = document.getElementById('quote-preview');
  if (!zone) return;
  if (!currentQuote) {
    zone.innerHTML = '<p class="muted">Preencha os campos para ver o preço automático.</p>';
    return;
  }
  zone.innerHTML = `
    <p><strong>Total estimado:</strong> ${currentQuote.total}</p>
    <p>Base/página ${currentQuote.basePerPage}, nível x${currentQuote.levelFactor}, complexidade x${currentQuote.complexityFactor}, urgência x${currentQuote.urgencyFactor}</p>
  `;
}

async function loadOrders(silent = false) {
  const res = await fetch(`${apiBase}/orders`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    if (!silent) toast(data.message || 'Erro ao carregar encomendas');
    return;
  }
  const list = document.getElementById('orders-list');
  list.innerHTML = '';
  const invoiceList = document.getElementById('invoice-list');
  if (invoiceList) invoiceList.innerHTML = '';
  const deliveries = document.getElementById('deliveries-list');
  if (deliveries) deliveries.innerHTML = '';
  data.orders.forEach((order) => {
    const invoice = data.invoices.find((i) => i.order === order._id) || {};
    const div = document.createElement('div');
    div.innerHTML = `
      <p><strong>${order.workType}</strong> - ${order.area} <span class="badge">${order.status}</span></p>
      <p>Preço: ${order.priceBreakdown.total} | Prazo pagamento: ${new Date(order.paymentDeadline).toLocaleString()}</p>
      <p>Fatura: #${invoice.invoiceNumber || 'N/A'} (${invoice.status || 'EMITIDA'})</p>
      <p class="muted">Materiais do cliente: ${order.hasMaterials ? 'Sim' : 'Não'}</p>
      <div class="stacked-actions">
        <button data-id="${order._id}" class="primary">Ver detalhes</button>
        <a class="ghost" href="/invoice.html?id=${order._id}" target="_blank" rel="noopener">Abrir fatura</a>
      </div>
    `;
    div.querySelector('button').addEventListener('click', () => viewOrder(order._id));
    list.appendChild(div);

    if (invoiceList && invoice.invoiceNumber) {
      const invEl = document.createElement('div');
      invEl.innerHTML = `
        <p><strong>Fatura #${invoice.invoiceNumber}</strong> - ${invoice.status}</p>
        <p>Total: ${invoice.amount} | Prazo: ${new Date(invoice.dueDate).toLocaleString()}</p>
        <div class="stacked-actions">
          <a class="ghost" href="/invoice.html?id=${order._id}" target="_blank" rel="noopener">Ver fatura</a>
          <button type="button" data-id="${order._id}" class="secondary">Baixar PDF</button>
        </div>
      `;
      invEl.querySelector('button').addEventListener('click', () => {
        downloadInvoicePdf(order._id, invoice.invoiceNumber);
      });
      invoiceList.appendChild(invEl);
    }

    if (deliveries && order.status === 'CONCLUIDA' && invoice.status === 'PAGA' && order.finalFile) {
      const row = document.createElement('div');
      row.classList.add('list-row');
      row.innerHTML = `
        <div>
          <p><strong>${order.workType}</strong> - ${order.area}</p>
          <p class="muted">Fatura #${invoice.invoiceNumber} | Entrega final pronta</p>
        </div>
        <div class="row-actions">
          <a class="primary" href="/uploads/trabalhos/${order.finalFile}" download>Baixar documento</a>
        </div>
      `;
      deliveries.appendChild(row);
    }
  });

  if (currentOrder) {
    const found = data.orders.find((o) => o._id === currentOrder.order._id);
    const inv = data.invoices.find((i) => i.order === currentOrder.order._id);
    if (found && inv) {
      currentOrder = { order: found, invoice: inv };
      renderOrderDetails();
    }
  }

  loadAffiliatePanel();
}

async function loadAffiliatePanel() {
  const panel = document.getElementById('affiliate-panel');
  if (!panel) return;
  const res = await fetch(`${apiBase}/orders/affiliate/summary`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    panel.innerHTML = '<p class="muted">Não foi possível carregar o programa de afiliados.</p>';
    return;
  }
  panel.innerHTML = `
    <div class="affiliate-card">
      <div>
        <p class="muted">Seu código</p>
        <p class="code">${data.referralCode}</p>
      </div>
      <div>
        <p class="muted">Ganhos pendentes</p>
        <p class="highlight">${data.affiliateBalance?.toFixed(2) || '0.00'} MZN</p>
      </div>
      <div>
        <p class="muted">Ganhos totais</p>
        <p class="highlight">${data.affiliateTotalEarned?.toFixed(2) || '0.00'} MZN</p>
      </div>
    </div>
    <p class="muted small">Pedidos pagos: ${data.paidOrders} · Em validação: ${data.pendingOrders}</p>
    <p class="muted">Partilhe: <code>?ref=${data.referralCode}</code> ou insira o código no formulário do pedido.</p>
  `;
}

async function viewOrder(id) {
  const res = await fetch(`${apiBase}/orders/${id}`, { headers: { Authorization: `Bearer ${authToken}` } });
  const data = await res.json();
  if (!res.ok) return toast(data.message || 'Erro ao abrir encomenda');
  currentOrder = data;
  showOrderDetails(true);
  showDashboard(false);
  renderOrderDetails();
}

function renderOrderDetails() {
  const { order, invoice } = currentOrder;
  const orderInfo = document.getElementById('order-info');
  orderInfo.innerHTML = `
    <p><strong>${order.workType}</strong> (${order.area})</p>
    <p>Estado: ${order.status}</p>
    <p>Páginas: ${order.pages} | Nível: ${order.academicLevel} | Complexidade: ${order.complexity} | Urgência: ${order.urgency}</p>
    <p>Entrega desejada: ${order.deliveryDeadline ? new Date(order.deliveryDeadline).toLocaleDateString() : '—'}</p>
    <p>Descrição: ${order.description}</p>
    <p>Materiais fornecidos: ${order.hasMaterials ? 'Sim' : 'Não'}${
    order.hasMaterials && order.materialsUsagePercent ? ` (${order.materialsUsagePercent}% previsto)` : ''
  }</p>
    ${
      order.materialsFiles?.length
        ? `<div class="attachments">${order.materialsFiles
            .map((f) => `<a href="/uploads/materiais/${f}" target="_blank">${f}</a>`)
            .join('')}</div>`
        : ''
    }
  `;
  const invoiceInfo = document.getElementById('invoice-info');
  invoiceInfo.innerHTML = `
    <h4>Fatura #${invoice.invoiceNumber}</h4>
    <p>Valor total: <strong>${invoice.amount}</strong></p>
    <p>Status: ${invoice.status}</p>
    <p>Pagamento via M-Pesa: <strong>Número 851619970</strong> | Titular <strong>Maria António Chicavele</strong></p>
    <p>Data limite: ${new Date(invoice.dueDate).toLocaleString()}</p>
    <p>Base por página ${invoice.priceFactors.basePerPage} | Nível ${invoice.priceFactors.levelFactor} | Complexidade ${invoice.priceFactors.complexityFactor} | Urgência ${invoice.priceFactors.urgencyFactor}</p>
    <div class="stacked-actions">
      <a class="ghost" href="/invoice.html?id=${order._id}">Abrir página da fatura</a>
      <button type="button" id="download-invoice">Baixar PDF</button>
    </div>
  `;

  const invoiceBtn = document.getElementById('download-invoice');
  if (invoiceBtn) {
    invoiceBtn.addEventListener('click', () => {
      downloadInvoicePdf(order._id, invoice.invoiceNumber);
    });
  }

  const downloadZone = document.getElementById('final-download');
  if (order.status === 'CONCLUIDA' && invoice.status === 'PAGA' && order.finalFile) {
    downloadZone.innerHTML = `<a href="/uploads/trabalhos/${order.finalFile}" download>Descarregar trabalho final</a>`;
  } else {
    downloadZone.innerHTML = '<div class="alert">Trabalho final disponível após pagamento validado.</div>';
  }

  renderTimelines(order, invoice);
}

function renderTimelines(order, invoice) {
  const timeline = document.getElementById('status-history');
  if (!timeline) return;
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

const proofForm = document.getElementById('proof-form');
if (proofForm) {
  proofForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentOrder) return;
    const confirm = await showConfirm({
      title: 'Submeter comprovativo?',
      text: 'Confirme o envio do comprovativo para validação do administrador.',
    });
    if (!confirm) return;
    const formData = new FormData(proofForm);
    const res = await fetch(`${apiBase}/orders/${currentOrder.order._id}/upload-proof`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: formData,
    });
    const data = await res.json();
    if (res.ok) {
      toast('Comprovativo submetido. Aguarde validação.');
      currentOrder = data;
      renderOrderDetails();
    } else {
      toast(data.message || 'Erro ao enviar comprovativo');
    }
  });
}

const backBtn = document.getElementById('back-button');
backBtn.addEventListener('click', () => {
  showOrderDetails(false);
  showDashboard(true);
  loadOrders();
});

updateNav();

if (authToken) {
  showDashboard(true);
  loadOrders();
  simulatePrice();
}

['pages', 'academicLevel', 'complexity', 'urgency'].forEach((field) => {
  const el = document.querySelector(`[name="${field}"]`);
  if (el) el.addEventListener('change', simulatePrice);
});

function attachServiceForm(formId, type) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!authToken) {
      toast('Faça login para enviar o pedido.');
      return;
    }
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.type = type;
    const res = await fetch(`${apiBase}/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      toast('Pedido registado. Enviámos confirmação por email.');
      form.reset();
    } else {
      toast(data.message || 'Erro ao submeter pedido');
    }
  });
}

attachServiceForm('tcc-form', 'TCC');
attachServiceForm('special-form', 'PRATICA');

async function downloadInvoicePdf(orderId, invoiceNumber) {
  try {
    const res = await fetch(`${apiBase}/orders/${orderId}/invoice/pdf`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) {
      const data = await res.json();
      return toast(data.message || 'Não foi possível gerar o PDF');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fatura-${invoiceNumber || orderId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    toast('Erro ao baixar PDF da fatura');
  }
}
