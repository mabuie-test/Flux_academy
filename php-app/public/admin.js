const apiBase = '/api';
let authToken = localStorage.getItem('token') || '';

function requireAdmin() {
  if (!authToken) {
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
}

async function rejectInvoice(invoiceId, orderId) {
  if (!invoiceId) return;
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
}

async function uploadFinal(orderId, input) {
  if (!input?.files?.length) return toast('Selecione um ficheiro primeiro');
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
  zone.innerHTML = `Pedidos: ${m.orders} · Faturas: ${m.invoices} · Pago: ${m.paid} · Pendente: ${m.pending}`;
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

if (document.getElementById('admin-orders')) {
  loadOrders();
  loadUsers();
  loadMetrics();
  loadCommissions();
}
