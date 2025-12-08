const apiBase = '/api';
let authToken = localStorage.getItem('token') || '';

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
    localStorage.removeItem('token');
    window.location.href = '/login.html';
  };
}

async function loadInvoices() {
  if (!requireAuth()) return;
  const res = await fetch(`${apiBase}/orders`, { headers: { Authorization: `Bearer ${authToken}` } });
  const data = await res.json();
  const list = document.getElementById('invoice-collection');
  if (!list) return;
  list.innerHTML = '';
  if (!res.ok) {
    list.innerHTML = `<p class="muted">${data.message || 'Erro ao carregar faturas'}</p>`;
    return;
  }
  data.orders.forEach((order) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div>
        <strong>${order.invoice_numero || 'Fatura'}</strong>
        <p class="muted">${order.tipo} · ${order.estado} · ${order.invoice_estado || 'EMITIDA'}</p>
      </div>
      <div class="stacked-actions">
        <a class="ghost" href="/invoice.html?id=${order.id}" target="_blank">Abrir</a>
      </div>
    `;
    list.appendChild(item);
  });
}

function stubList(id, text) {
  const target = document.getElementById(id);
  if (target) target.innerHTML = `<p class="muted">${text}</p>`;
}

if (document.getElementById('invoice-collection')) {
  loadInvoices();
  stubList('documents-collection', 'Documentos finais serão listados aqui quando disponíveis.');
  stubList('feedback-collection', 'Feedbacks serão exibidos após a entrega.');
  document.getElementById('refresh-invoices')?.addEventListener('click', loadInvoices);
}
