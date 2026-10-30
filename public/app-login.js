const form = document.getElementById('appLoginForm');
const errorBox = document.getElementById('loginError');
const code = (location.pathname.split('/')[2] || '').toUpperCase();
const button = document.getElementById('appLoginButton');
const label = button.querySelector('.submit-label');
const email = document.getElementById('email');
const password = document.getElementById('password');
const select = document.getElementById('organizationId');
const showError = text => { errorBox.textContent = text; errorBox.hidden = !text; };
const reveal = document.querySelector('[data-password-toggle]');
if (reveal) {
  reveal.addEventListener('click', () => {
    const shown = password.type === 'password';
    password.type = shown ? 'text' : 'password';
    reveal.textContent = shown ? 'Hide' : 'Show';
    reveal.setAttribute('aria-label', shown ? 'Hide password' : 'Show password');
    reveal.setAttribute('aria-pressed', String(shown));
  });
}
async function initialize() {
  showError('');
  button.disabled = true;
  try {
    const response = await fetch(`/api/apps/${encodeURIComponent(code)}/contexts`,{credentials:'same-origin'});
    if (response.status === 401) { location.replace('/login.html'); return; }
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Application is unavailable.');
    if (!data.organizations?.length) throw new Error('Your account is not assigned to this product.');
    const name = data.application.name;
    document.getElementById('appTitle').textContent = `Continue to ${name}`;
    document.getElementById('appName').textContent = name;
    document.title = `${name} access | VSPH Control Center`;
    email.value = data.email;
    email.placeholder = 'Work email';
    select.replaceChildren();
    for (const org of data.organizations) {
      const option = document.createElement('option');
      option.value = org.id;
      option.textContent = `${org.name} (${org.role.replaceAll('_',' ')})`;
      select.append(option);
    }
    select.disabled = false;
    button.disabled = false;
  } catch (e) { showError(e.message || 'Could not load your application access.'); }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled) return;
  showError('');
  button.disabled = true;
  label.textContent = 'Verifying access…';
  try {
    const response = await fetch('/api/auth/app-login',{
      method:'POST', headers:{'Content-Type':'application/json'},credentials:'same-origin',
      body:JSON.stringify({app:code,email:email.value,password:password.value,organizationId:select.value})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to verify access. Check your password.');
    location.assign(data.redirect);
  } catch (e) {
    showError(e.message || 'Cannot connect. Please try again.');
    button.disabled = false;
    label.textContent = 'Enter application';
  }
});
initialize();