const form = document.getElementById('loginForm');
const reveal = document.querySelector('[data-password-toggle]');
if (reveal) {
  const target = document.getElementById(reveal.dataset.passwordToggle);
  reveal.addEventListener('click', () => {
    const shown = target.type === 'password';
    target.type = shown ? 'text' : 'password';
    reveal.querySelector('[data-icon="show"]').hidden = shown;
    reveal.querySelector('[data-icon="hide"]').hidden = !shown;
    reveal.setAttribute('aria-label', shown ? 'Hide password' : 'Show password');
    reveal.setAttribute('aria-pressed', String(shown));
  });
}
if (form) {
  const message = document.getElementById('message');
  const button = document.getElementById('loginButton');
  const label = button.querySelector('.submit-label');
  const showError = text => { message.textContent = text; message.hidden = !text; };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled) return;
    showError('');
    button.disabled = true;
    label.textContent = 'Signing in…';
    try {
      const response = await fetch('/api/auth/login', {
        method:'POST', headers:{'Content-Type':'application/json'},
        credentials:'same-origin',
        body:JSON.stringify({
          email:document.getElementById('email').value.trim(),
          password:document.getElementById('password').value
        })
      });
      const data = await response.json();
      if (!response.ok) { showError(data.message || 'Unable to sign in. Check your email and password.'); return; }
      window.location.assign('/dashboard.html');
    } catch {
      showError('Cannot connect to VSPH. Check your connection and try again.');
    } finally {
      button.disabled = false;
      label.textContent = 'Sign in';
    }
  });
}