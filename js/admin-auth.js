(() => {
  const ADMIN_ACCOUNTS_KEY = 'sd_admin_accounts';
  const ADMIN_SESSION_KEY = 'sd_admin_session';

  const DEFAULT_ADMINS = [
    { email: 'admin@shoppingdate.local', password: 'admin2026', fullName: 'Administrateur Principal' },
    { email: 'admin2@shoppingdate.local', password: 'admin2026a', fullName: 'Administrateur 2' }
  ];

  const form = document.querySelector('[data-admin-login-form]');
  if (!form) return;

  const feedback = document.querySelector('[data-feedback]');

  // Création des comptes admin par défaut
  if (!localStorage.getItem(ADMIN_ACCOUNTS_KEY)) {
    localStorage.setItem(ADMIN_ACCOUNTS_KEY, JSON.stringify(DEFAULT_ADMINS));
  }

  // Redirection si déjà connecté
  if (localStorage.getItem(ADMIN_SESSION_KEY)) {
    window.location.replace('/pages/admin.html');
    return;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const email = String(form.elements.email.value || '').trim().toLowerCase();
    const password = String(form.elements.password.value || '').trim();

    const account = getAdminAccounts().find(acc => 
      acc.email === email && acc.password === password
    );

    if (!account) {
      showFeedback('Identifiants administrateur incorrects.', 'error');
      return;
    }

    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
      role: 'admin',
      email: account.email,
      fullName: account.fullName,
      loginAt: new Date().toISOString()
    }));

    window.location.assign('/pages/admin.html');
  });

  function getAdminAccounts() {
    try {
      const saved = JSON.parse(localStorage.getItem(ADMIN_ACCOUNTS_KEY));
      return Array.isArray(saved) ? saved : DEFAULT_ADMINS;
    } catch {
      return DEFAULT_ADMINS;
    }
  }

  function showFeedback(message, type) {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.dataset.state = type;
  }
})();