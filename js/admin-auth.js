(() => {
  const form = document.querySelector('[data-admin-login-form]');
  if (!form) return;

  const storage = window.SDStorage;
  const feedback = document.querySelector('[data-feedback]');
  if (!storage) return;

  function showFeedback(message, type) {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.dataset.state = type;
  }

  async function bootstrap() {
    try {
      const adminSession = await storage.getAdminSession();
      if (adminSession && adminSession.role === 'admin') {
        window.location.replace('/pages/admin.html');
      }
    } catch (error) {
      showFeedback(error?.message || 'Impossible de vérifier la session admin.', 'error');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = storage.normalizeEmail(form.elements.email.value);
    const password = String(form.elements.password.value || '').trim();

    if (!email || !password) {
      showFeedback('Tous les champs sont obligatoires.', 'error');
      return;
    }

    try {
      await storage.adminLogin(email, password);
      window.location.assign('/pages/admin.html');
    } catch (error) {
      showFeedback(error?.message || 'Identifiants administrateur incorrects.', 'error');
    }
  });

  bootstrap();
})();
