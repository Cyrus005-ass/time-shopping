(() => {
  const form = document.querySelector('[data-login-form]');
  if (!form) return;

  const storage = window.SDStorage;
  if (!storage) return;

  const feedback = document.querySelector('[data-feedback]');
  const emailInput = form.elements.email;
  const passwordInput = form.elements.password;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const email = storage.normalizeEmail(emailInput.value);
    const password = String(passwordInput.value || '').trim();

    const participant = storage.findParticipantByEmail(email);

    if (!participant) {
      showFeedback('Email introuvable dans la liste des candidats. Verifie que le compte a bien ete cree sur ce site.', 'error');
      return;
    }

    const expectedPassword = storage.getParticipantLoginPassword(participant);

    if (!expectedPassword) {
      showFeedback("Ce compte n'a pas de mot de passe configuré. Contacte la production.", 'error');
      return;
    }

    if (password !== expectedPassword) {
      showFeedback('Mot de passe incorrect.', 'error');
      return;
    }

    // Connexion réussie
    storage.setSession({
      role: 'participant',
      id: participant.id,
      email: participant.email,
      nom: participant.nom,
      prenom: participant.prenom,
      sexe: participant.sexe,
      source: participant.source,
      fullName: `${participant.prenom} ${participant.nom}`,
      loginAt: new Date().toISOString()
    });

    window.location.assign('/pages/participant.html');
  });

  function showFeedback(message, type) {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.dataset.state = type;
    setTimeout(() => { feedback.dataset.state = ''; }, 5000);
  }
})();
