const apiBase = '/api';

function handleLogin(token) {
  if (token) {
    localStorage.setItem('token', token);
    alert('Autenticado! Pode continuar a usar o painel.');
  }
}

const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(signupForm).entries());
    const res = await fetch(`${apiBase}/auth/signup`, {
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
    const res = await fetch(`${apiBase}/auth/signin`, {
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

const forgotForm = document.getElementById('forgot-form');
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(forgotForm).entries());
    const res = await fetch(`${apiBase}/auth/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    alert(data.message || (res.ok ? 'Token enviado' : 'Erro ao enviar token'));
  });
}

const resetForm = document.getElementById('reset-form');
if (resetForm) {
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(resetForm).entries());
    const res = await fetch(`${apiBase}/auth/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    alert(data.message || (res.ok ? 'Senha atualizada' : 'Erro ao atualizar senha'));
  });
}
