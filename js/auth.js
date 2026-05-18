(() => {
  const form = document.querySelector('[data-login-form]');
  if (!form) return;

  const storage = window.SDStorage;
  if (!storage) return;

  const feedback = document.querySelector('[data-feedback]');
  const emailInput = form.elements.email;
  const passwordInput = form.elements.password;

  function showFeedback(message, type) {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.dataset.state = type;
    setTimeout(() => { feedback.dataset.state = ''; }, 5000);
  }

  async function bootstrap() {
    try {
      const session = await storage.getSession();
      if (session && session.role === 'participant') {
        window.location.replace('/pages/participant.html');
      }
    } catch {
      // no-op: an anonymous user is allowed here
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = storage.normalizeEmail(emailInput.value);
    const password = String(passwordInput.value || '').trim();

    if (!email || !password) {
      showFeedback('Tous les champs sont obligatoires.', 'error');
      return;
    }

    try {
      await storage.participantLogin(email, password);
      window.location.assign('/pages/participant.html');
    } catch (error) {
      showFeedback(error?.message || 'Connexion impossible.', 'error');
    }
  });

  bootstrap();
})();
