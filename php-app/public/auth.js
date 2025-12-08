const apiBase = '/api';
let authToken = localStorage.getItem('token') || '';

function captureReferral() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('ref');
  if (code) {
    localStorage.setItem('referral_ref', code);
  }
}

captureReferral();

function toggleNav() {
  document.querySelectorAll('.anon-only').forEach((el) => (el.style.display = authToken ? 'none' : 'inline-flex'));
  document.querySelectorAll('.auth-only').forEach((el) => (el.style.display = authToken ? 'inline-flex' : 'none'));
  const logout = document.getElementById('logout');
  if (logout) {
    logout.onclick = () => {
      authToken = '';
      localStorage.removeItem('token');
      toggleNav();
    };
  }
}

function renderReferralTag() {
  const tag = document.getElementById('referral-indicator');
  if (!tag) return;
  const code = localStorage.getItem('referral_ref');
  if (code) {
    tag.textContent = `Indicação aplicada: ${code}`;
    tag.classList.remove('hidden');
  }
}

function handleLogin(token) {
  if (token) {
    authToken = token;
    localStorage.setItem('token', token);
    toggleNav();
    window.location.href = '/';
  }
}

const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(signupForm).entries());
    const ref = localStorage.getItem('referral_ref');
    if (ref) payload.referred_by = ref;
    const res = await fetch(`${apiBase}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      handleLogin(data.token);
    } else {
      alert(data.message || 'Erro no registo');
    }
  });
}

const signinForm = document.getElementById('signin-form');
if (signinForm) {
  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(signinForm).entries());
    const res = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      handleLogin(data.token);
    } else {
      alert(data.message || 'Erro no login');
    }
  });
}

toggleNav();
renderReferralTag();

if (authToken && window.location.pathname !== '/') {
  window.location.href = '/';
}
