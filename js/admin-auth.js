(() => {
  const form = document.querySelector('[data-admin-login-form]');
  if (!form) return;

  const storage = window.SDStorage;
  const feedback = document.querySelector('[data-feedback]');

  if (!storage) return;
  storage.getAdminAccounts();

  const adminSession = storage.getAdminSession();
  if (adminSession && adminSession.role === 'admin') {
    window.location.replace('/pages/admin.html');
    return;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const email = storage.normalizeEmail(form.elements.email.value);
    const password = String(form.elements.password.value || '').trim();

    const account = storage.getAdminAccounts().find((acc) =>
      acc.email === email && acc.password === password
    );

    if (!account) {
      showFeedback('Identifiants administrateur incorrects.', 'error');
      return;
    }

    storage.setAdminSession({
      role: 'admin',
      email: account.email,
      fullName: account.fullName,
      loginAt: new Date().toISOString()
    });

    window.location.assign('/pages/admin.html');
  });

  function showFeedback(message, type) {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.dataset.state = type;
  }
})();
