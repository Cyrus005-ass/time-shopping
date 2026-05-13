(() => {
  const form = document.querySelector('[data-login-form]');
  if (!form) return;

  const feedback = document.querySelector('[data-feedback]');
  const emailInput = form.elements.email;
  const passwordInput = form.elements.password;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const email = window.SDStorage.normalizeEmail(emailInput.value);
    const password = String(passwordInput.value || '').trim();

    const participant = window.SDStorage.findParticipantByEmail(email);

    if (!participant) {
      showFeedback('Email introuvable dans la liste des candidats.', 'error');
      return;
    }

    const expectedPassword = window.SDStorage.buildPasswordFromPhone(participant.telephone);

    if (password !== expectedPassword) {
      showFeedback('Mot de passe incorrect.', 'error');
      return;
    }

    // Connexion réussie
    window.SDStorage.setSession({
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