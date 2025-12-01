const apiBase = '/api';
let authToken = localStorage.getItem('token') || '';
let currentOrder = null;
let currentQuote = null;

function clearSession() {
  authToken = '';
  localStorage.removeItem('token');
  showDashboard(false);
  showOrderDetails(false);
}

function setAuth(token) {
  authToken = token;
  if (token) localStorage.setItem('token', token);
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
    alert('Sessão terminada. Faça login novamente para continuar.');
  });
}

document.getElementById('order-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = Object.fromEntries(new FormData(e.target).entries());
  raw.pages = Number(raw.pages);
  const res = await fetch(`${apiBase}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: JSON.stringify(raw),
  });
  const data = await res.json();
  if (res.ok) {
    alert('Encomenda criada. Confira a fatura e pague via M-Pesa!');
    loadOrders();
    currentQuote = null;
    renderQuote();
  } else {
    alert(data.message || 'Erro ao criar encomenda');
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

async function loadOrders() {
  const res = await fetch(`${apiBase}/orders`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.message || 'Erro ao carregar encomendas');
    return;
  }
  const list = document.getElementById('orders-list');
  list.innerHTML = '';
  data.orders.forEach((order) => {
    const invoice = data.invoices.find((i) => i.order === order._id) || {};
    const div = document.createElement('div');
    div.innerHTML = `
      <p><strong>${order.workType}</strong> - ${order.area} <span class="badge">${order.status}</span></p>
      <p>Preço: ${order.priceBreakdown.total} | Prazo pagamento: ${new Date(order.paymentDeadline).toLocaleString()}</p>
      <p>Fatura: #${invoice.invoiceNumber || 'N/A'} (${invoice.status || 'EMITIDA'})</p>
      <button data-id="${order._id}">Ver detalhes</button>
    `;
    div.querySelector('button').addEventListener('click', () => viewOrder(order._id));
    list.appendChild(div);
  });
}

async function viewOrder(id) {
  const res = await fetch(`${apiBase}/orders/${id}`, { headers: { Authorization: `Bearer ${authToken}` } });
  const data = await res.json();
  if (!res.ok) return alert(data.message || 'Erro ao abrir encomenda');
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
  `;
  const invoiceInfo = document.getElementById('invoice-info');
  invoiceInfo.innerHTML = `
    <h4>Fatura #${invoice.invoiceNumber}</h4>
    <p>Valor total: <strong>${invoice.amount}</strong></p>
    <p>Status: ${invoice.status}</p>
    <p>Pagamento via M-Pesa: <strong>Número 851619970</strong> | Titular <strong>Maria António Chicavele</strong></p>
    <p>Data limite: ${new Date(invoice.dueDate).toLocaleString()}</p>
    <p>Base por página ${invoice.priceFactors.basePerPage} | Nível ${invoice.priceFactors.levelFactor} | Complexidade ${invoice.priceFactors.complexityFactor} | Urgência ${invoice.priceFactors.urgencyFactor}</p>
  `;

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
    const formData = new FormData(proofForm);
    const res = await fetch(`${apiBase}/orders/${currentOrder.order._id}/upload-proof`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: formData,
    });
    const data = await res.json();
    if (res.ok) {
      alert('Comprovativo submetido. Aguarde validação.');
      currentOrder = data;
      renderOrderDetails();
    } else {
      alert(data.message || 'Erro ao enviar comprovativo');
    }
  });
}

const backBtn = document.getElementById('back-button');
backBtn.addEventListener('click', () => {
  showOrderDetails(false);
  showDashboard(true);
  loadOrders();
});

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
      alert('Faça login para enviar o pedido.');
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
      alert('Pedido registado. Enviámos confirmação por email.');
      form.reset();
    } else {
      alert(data.message || 'Erro ao submeter pedido');
    }
  });
}

attachServiceForm('tcc-form', 'TCC');
attachServiceForm('special-form', 'PRATICA');
