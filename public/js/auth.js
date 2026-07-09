function showError(msg) {
  const box = document.getElementById('error-box');
  box.textContent = msg;
  box.style.display = 'block';
}

async function handleLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showError('Enter your email and password.');
    return;
  }

  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    saveSession(data.token, data.user);
    window.location.href = 'dashboard.html';
  } catch (err) {
    showError(err.message);
  }
}

async function handleRegister() {
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!name || !email || !password) {
    showError('All fields are required.');
    return;
  }

  try {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    saveSession(data.token, data.user);
    window.location.href = 'dashboard.html';
  } catch (err) {
    showError(err.message);
  }
}

// If already logged in, skip straight to the dashboard
if (getToken() && (window.location.pathname.endsWith('login.html') || window.location.pathname.endsWith('register.html'))) {
  window.location.href = 'dashboard.html';
}
