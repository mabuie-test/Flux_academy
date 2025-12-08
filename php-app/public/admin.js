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
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        <h4>#${order.id} · ${order.tipo}</h4>
        <p>Cliente: ${order.user_name || ''} (${order.user_email || ''})</p>
        <p>Estado: ${order.estado} · Fatura ${order.invoice_numero || '—'} (${order.invoice_estado || 'EMITIDA'})</p>
        <p>Total: ${order.valor_total || '—'}</p>
        <div class="stacked-actions">
          <button class="primary" data-invoice="${order.invoice_id || ''}" data-number="${order.invoice_numero || ''}" data-email="${order.user_email || ''}">Marcar pagamento como pago</button>
        </div>
      `;
      const btn = el.querySelector('button');
      btn.disabled = !order.invoice_id;
      btn.onclick = () => approveInvoice(btn.dataset.invoice, btn.dataset.number, btn.dataset.email);
      list.appendChild(el);
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
  try {
    const res = await fetch(`${apiBase}/admin/invoices/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao validar pagamento');
    toast('Pagamento marcado como pago.');
    loadOrders();
  } catch (err) {
    toast(err.message);
  }
}

if (document.getElementById('admin-orders')) {
  loadOrders();
}
