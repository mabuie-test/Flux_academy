const apiBase = '/api';
let token = localStorage.getItem('token') || '';
let refreshTimer = null;

const modal = document.getElementById('confirm-overlay');
const modalTitle = document.getElementById('confirm-title');
const modalText = document.getElementById('confirm-text');
const modalOk = document.getElementById('confirm-ok');
const modalCancel = document.getElementById('confirm-cancel');

function toast(message) {
  modalTitle.textContent = 'Aviso';
  modalText.textContent = message;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');
  modalOk.onclick = close;
  modalCancel.onclick = close;
}

function updateNav() {
  document.querySelectorAll('.anon-only').forEach((el) => (el.style.display = token ? 'none' : 'inline-flex'));
  document.querySelectorAll('.auth-only').forEach((el) => (el.style.display = token ? 'inline-flex' : 'none'));
  if (!token) window.location.href = '/login.html';
  if (token && !refreshTimer) {
    refreshTimer = setInterval(() => {
      if (document.hidden) return;
      loadCollections(true);
    }, 8000);
  }
}

const logoutBtn = document.getElementById('logout');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    token = '';
    localStorage.removeItem('token');
    if (refreshTimer) clearInterval(refreshTimer);
    window.location.href = '/login.html';
  });
}

async function loadCollections(silent = false) {
  const res = await fetch(`${apiBase}/orders`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) {
    if (!silent) toast(data.message || 'Não foi possível carregar dados');
    return;
  }
  renderInvoices(data.orders, data.invoices);
  renderDocuments(data.orders, data.invoices);
}

function renderInvoices(orders, invoices) {
  const holder = document.getElementById('invoice-collection');
  holder.innerHTML = '';
  invoices.forEach((inv) => {
    const order = orders.find((o) => o._id === inv.order) || {};
    const row = document.createElement('div');
    row.classList.add('list-row');
    row.innerHTML = `
      <div>
        <p><strong>Fatura #${inv.invoiceNumber}</strong> — ${inv.status}</p>
        <p class="muted">${order.workType || 'Pedido'} · Total ${inv.amount} · Prazo ${new Date(inv.dueDate).toLocaleString()}</p>
      </div>
      <div class="row-actions">
        <a class="ghost" target="_blank" rel="noopener" href="/invoice.html?id=${order._id}">Abrir página</a>
        <button data-oid="${order._id}" data-num="${inv.invoiceNumber}">PDF</button>
      </div>
    `;
    row.querySelector('button').addEventListener('click', () => downloadInvoicePdf(order._id, inv.invoiceNumber));
    holder.appendChild(row);
  });
  if (!invoices.length) holder.innerHTML = '<p class="muted">Nenhuma fatura emitida ainda.</p>';
}

function renderDocuments(orders, invoices) {
  const holder = document.getElementById('documents-collection');
  holder.innerHTML = '';
  orders
    .filter((o) => {
      const inv = invoices.find((i) => i.order === o._id);
      return o.status === 'CONCLUIDA' && inv?.status === 'PAGA' && o.finalFile;
    })
    .forEach((o) => {
      const inv = invoices.find((i) => i.order === o._id) || {};
      const row = document.createElement('div');
      row.classList.add('list-row');
      row.innerHTML = `
        <div>
          <p><strong>${o.workType}</strong> — ${o.area}</p>
          <p class="muted">Fatura #${inv.invoiceNumber || 'N/A'} · Entrega final pronta</p>
        </div>
        <div class="row-actions">
          <a class="primary" href="/uploads/trabalhos/${o.finalFile}" download>Baixar documento</a>
        </div>
      `;
      holder.appendChild(row);
    });
  if (!holder.childElementCount) holder.innerHTML = '<p class="muted">Ainda não existem documentos finais disponíveis.</p>';
}

async function downloadInvoicePdf(orderId, invoiceNumber) {
  try {
    const res = await fetch(`${apiBase}/orders/${orderId}/invoice/pdf`, { headers: { Authorization: `Bearer ${token}` } });
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
    toast('Erro ao baixar PDF');
  }
}

updateNav();
loadCollections();

document.getElementById('refresh-invoices').addEventListener('click', () => loadCollections());
document.getElementById('refresh-docs').addEventListener('click', () => loadCollections());
