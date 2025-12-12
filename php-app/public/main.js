const apiBase = '/api';
let authToken = localStorage.getItem('token') || '';

function syncNav() {
  document.querySelectorAll('.anon-only').forEach((el) => (el.style.display = authToken ? 'none' : 'inline-flex'));
  document.querySelectorAll('.auth-only').forEach((el) => (el.style.display = authToken ? 'inline-flex' : 'none'));
}

function captureReferralAttribution() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    localStorage.setItem('referral_ref', ref);
    const banner = document.getElementById('referral-banner');
    if (banner) {
      banner.textContent = `Ligação de indicação aplicada: ${ref}`;
      banner.classList.add('pill');
    }
  }
}

captureReferralAttribution();

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

function showToast(text) {
  const zone = document.getElementById('feedback');
  if (zone) {
    zone.textContent = text;
    zone.classList.add('visible');
    setTimeout(() => zone.classList.remove('visible'), 2500);
  } else {
    alert(text);
  }
}

function requireAuth() {
  if (!authToken) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

const logout = document.getElementById('logout');
if (logout) {
  logout.onclick = () => {
    authToken = '';
    localStorage.removeItem('token');
    syncNav();
    window.location.href = '/login.html';
  };
}

const orderForm = document.getElementById('order-form');
const materialsToggle = document.getElementById('has-materials');
if (materialsToggle) {
  materialsToggle.onchange = () => {
    const box = document.getElementById('materials-extra');
    if (box) box.style.display = materialsToggle.value === 'sim' ? 'block' : 'none';
  };
  materialsToggle.onchange();
}
if (orderForm) {
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireAuth()) return;
    const ok = await confirmAction('Confirmar envio desta encomenda?');
    if (!ok) return;
    const raw = new FormData(orderForm);
    const payload = new FormData();
    payload.set('tipo', raw.get('workType'));
    payload.set('area', raw.get('area'));
    payload.set('nivel', raw.get('academicLevel'));
    payload.set('paginas', raw.get('pages'));
    payload.set('norma', raw.get('formatting'));
    payload.set('complexidade', raw.get('complexity'));
    payload.set('urgencia', raw.get('urgency'));
    payload.set('descricao', raw.get('description'));
    payload.set('prazo_entrega', raw.get('deliveryDeadline'));
    if (raw.get('referralCode')) {
      payload.set('referral_code', raw.get('referralCode'));
    }
    if (raw.get('hasMaterials') === 'sim') {
      payload.set('materiais_info', 'Materiais fornecidos pelo cliente');
      if (raw.get('materialsUsagePercent')) {
        payload.set('materiais_percentual', raw.get('materialsUsagePercent'));
      }
      const materialsField = document.getElementById('materialsFiles');
      if (materialsField?.files?.length) {
        Array.from(materialsField.files).forEach((file) => payload.append('materiais_uploads[]', file));
      }
    }
    try {
      const res = await fetch(`${apiBase}/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: payload,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao criar encomenda');
      orderForm.reset();
      showToast('Encomenda criada e fatura emitida.');
      setTimeout(() => {
        window.location.href = `/invoice.html?id=${data.order_id}`;
      }, 300);
    } catch (err) {
      showToast(err.message);
    }
  });
}

const quoteBtn = document.getElementById('simulate-quote');
if (quoteBtn) {
  quoteBtn.addEventListener('click', async () => {
    if (!requireAuth()) return;
    const raw = new FormData(orderForm);
    const body = {
      paginas: Number(raw.get('pages') || 0),
      nivel: raw.get('academicLevel'),
      complexidade: raw.get('complexity'),
      urgencia: raw.get('urgency'),
    };
    try {
      const res = await fetch(`${apiBase}/orders/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Não foi possível calcular');
      const zone = document.getElementById('quote-preview');
      if (zone) {
        zone.innerHTML = `<p><strong>Total estimado:</strong> ${data.total}</p><p>Base ${data.base} × ${body.paginas} páginas · nível x${data.levelFactor} · complexidade x${data.complexityFactor} · urgência x${data.urgencyFactor}</p>`;
      }
    } catch (err) {
      showToast(err.message);
    }
  });
}

async function loadOrders() {
  if (!requireAuth()) return;
  try {
    const res = await fetch(`${apiBase}/orders`, { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao carregar encomendas');
    const list = document.getElementById('orders-list');
    if (!list) return;
    list.innerHTML = '';
    data.orders.forEach((order) => {
      const item = document.createElement('div');
      item.className = 'card';
      item.innerHTML = `
        <h4>${order.tipo} · ${order.area}</h4>
        <p>Estado: <strong>${order.estado}</strong></p>
        <p>Fatura: ${order.invoice_numero || '—'} (${order.invoice_estado || 'EMITIDA'})</p>
        <p>Total: ${order.valor_total || '—'}</p>
        ${order.final_file ? `<p class="success">Trabalho final disponível: <a href="${order.final_file}" target="_blank">baixar</a></p>` : ''}
        <div class="stacked-actions">
          <a class="primary" href="/invoice.html?id=${order.id}" target="_blank">Ver fatura</a>
        </div>
      `;
      list.appendChild(item);
    });
  } catch (err) {
    showToast(err.message);
  }
}

if (document.getElementById('orders-list')) {
  loadOrders();
  setInterval(loadOrders, 20000);
}

async function loadNotifications() {
  if (!requireAuth()) return;
  try {
    const res = await fetch(`${apiBase}/notifications`, { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao carregar alertas');
    const list = document.getElementById('notifications-list');
    if (!list) return;
    list.innerHTML = '';
    (data.notifications || []).forEach((n) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      const meta = n.meta || {};
      const hint = meta.invoice_id ? `Fatura #${meta.invoice_id}` : meta.order_id ? `Encomenda #${meta.order_id}` : '';
      item.innerHTML = `<div><strong>${n.action}</strong><p class="muted">${hint}</p></div><span class="badge">${n.created_at || ''}</span>`;
      list.appendChild(item);
    });
  } catch (err) {
    console.error(err);
  }
}

if (document.getElementById('notifications-list')) {
  loadNotifications();
  setInterval(loadNotifications, 20000);
}

async function loadAffiliate() {
  if (!requireAuth()) return;
    try {
      const res = await fetch(`${apiBase}/affiliates/summary`, { headers: { Authorization: `Bearer ${authToken}` } });
      const data = await res.json();
      const box = document.getElementById('affiliate-panel');
      if (!box) return;
      if (!res.ok) throw new Error(data.message || 'Erro no programa de afiliados');
      const shareLink = data.code ? `${window.location.origin}/register.html?ref=${data.code}` : '';
      const commissions = data.commissions || [];
      const payouts = data.payouts || [];
    box.innerHTML = `
      <div class="pill">O seu código: <strong>${data.code || '—'}</strong></div>
        <div class="share-row">
          <input id="share-link" value="${shareLink}" ${shareLink ? '' : 'placeholder="Sem código disponível"'} readonly />
          <button class="ghost" id="copy-share" ${shareLink ? '' : 'disabled'}>Copiar link</button>
        </div>
        <div class="grid metrics">
          <div><p class="muted">Aguardando validação</p><h4>${data.totals.pending} MZN</h4></div>
          <div><p class="muted">Liberado</p><h4>${data.totals.approved} MZN</h4></div>
          <div><p class="muted">Pago</p><h4>${data.totals.paid} MZN</h4></div>
        </div>
      <button class="primary" id="request-payout">Pedir levantamento</button>
      <h4>Comissões recentes</h4>
      <div class="list">${commissions.map((c) => `<div class="list-item"><div>#${c.order_id} · ${c.amount} MZN</div><span class="badge">${c.status}</span></div>`).join('') || '<p class="muted">Sem comissões ainda</p>'}</div>
      <h4>Levantamentos</h4>
      <div class="list">${payouts.map((p) => `<div class="list-item"><div>Pedido #${p.id} · ${p.valor} MZN</div><span class="badge">${p.status}</span></div>`).join('') || '<p class="muted">Nenhum pedido</p>'}</div>
    `;
    const payoutBtn = document.getElementById('request-payout');
    if (payoutBtn) payoutBtn.onclick = () => requestPayout();
    const copyBtn = document.getElementById('copy-share');
    if (copyBtn && shareLink) {
      copyBtn.onclick = async () => {
        await navigator.clipboard.writeText(shareLink);
        showToast('Link de afiliado copiado.');
      };
    }
  } catch (err) {
    showToast(err.message);
  }
}

async function requestPayout() {
  if (!requireAuth()) return;
  try {
    const res = await fetch(`${apiBase}/affiliates/request-payout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ notes: 'Levantamento solicitado via painel' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Não foi possível registar o pedido');
    showToast('Pedido de levantamento enviado.');
    loadAffiliate();
  } catch (err) {
    showToast(err.message);
  }
}

if (document.getElementById('affiliate-panel')) {
  loadAffiliate();
}

const serviceForm = document.getElementById('service-form');
if (serviceForm) {
  serviceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireAuth()) return;
    const ok = await confirmAction('Submeter este pedido especializado?');
    if (!ok) return;
    const raw = new FormData(serviceForm);
    const payload = new FormData();
    ['categoria', 'contact_name', 'contact_email', 'contact_phone', 'detalhes', 'norma_preferida', 'software_preferido'].forEach((f) => {
      if (raw.get(f)) payload.set(f, raw.get(f));
    });
    if (serviceForm.querySelector('input[name="attachment"]')?.files?.length) {
      payload.append('attachment', serviceForm.querySelector('input[name="attachment"]').files[0]);
    }
    try {
      const res = await fetch(`${apiBase}/services`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: payload });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao registar serviço');
      showToast('Pedido especializado enviado.');
      serviceForm.reset();
      loadMyServices();
    } catch (err) {
      showToast(err.message);
    }
  });
}

['tcc-form', 'special-form'].forEach((id) => {
  const form = document.getElementById(id);
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireAuth()) return;
    const ok = await confirmAction('Confirmar envio do pedido?');
    if (!ok) return;
    const raw = new FormData(form);
    const payload = new FormData();
    const categoria = id === 'tcc-form' ? 'Acompanhamento TCC' : 'Trabalho prático especial';
    payload.set('categoria', categoria);
    payload.set('contact_name', raw.get('contactName'));
    payload.set('contact_email', raw.get('contactEmail'));
    if (raw.get('contactPhone')) payload.set('contact_phone', raw.get('contactPhone'));
    if (raw.get('details')) payload.set('detalhes', raw.get('details'));
    if (raw.get('goals')) payload.set('norma_preferida', raw.get('goals'));
    try {
      const res = await fetch(`${apiBase}/services`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: payload });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao enviar pedido');
      showToast('Pedido submetido com sucesso.');
      form.reset();
      loadMyServices();
    } catch (err) {
      showToast(err.message);
    }
  });
});

async function loadMyServices() {
  const container = document.getElementById('service-list');
  if (!container) return;
  if (!authToken) {
    container.innerHTML = '<p class="muted">Inicie sessão para acompanhar os pedidos.</p>';
    return;
  }
  try {
    const res = await fetch(`${apiBase}/services`, { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao carregar serviços');
    if (!data.services || !data.services.length) {
      container.innerHTML = '<p class="muted">Ainda sem pedidos especializados.</p>';
      return;
    }
    container.innerHTML = '';
    data.services.forEach((svc) => {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `
        <div>
          <strong>${svc.categoria}</strong>
          <p class="muted">${svc.detalhes || ''}</p>
          ${svc.attachment ? `<a href="${svc.attachment}" target="_blank">Ver anexo</a>` : ''}
        </div>
        <div class="badge">${svc.status}</div>
      `;
      container.appendChild(row);
    });
  } catch (err) {
    container.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

if (document.getElementById('service-list')) {
  loadMyServices();
  setInterval(loadMyServices, 20000);
}

document.querySelectorAll('[data-service-type]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const type = btn.getAttribute('data-service-type');
    const select = document.getElementById('service-type');
    if (select) select.value = type;
    document.getElementById('service-card')?.scrollIntoView({ behavior: 'smooth' });
  });
});

syncNav();
