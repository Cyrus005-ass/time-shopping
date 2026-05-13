(() => {
  const session = window.SDStorage?.getSession();

  if (!session || session.role !== 'participant') {
    window.location.replace('/pages/login.html');
    return;
  }

  const participantId = String(session.id || '').trim();
  const participant = window.SDStorage.findParticipantById(participantId) || session;
  const fullName = window.SDStorage.participantFullName(participant);
  const defaultDurationHours = 3;

  const welcomeNode = document.querySelector('[data-session-name]');
  const metaNode = document.querySelector('[data-session-meta]');
  const logoutButton = document.querySelector('[data-logout]');
  const jockerButton = document.querySelector('[data-jocker-launch]');
  const jockerStatus = document.querySelector('[data-jocker-status]');
  const chronoButton = document.querySelector('[data-chrono-launch]');
  const chronoStatus = document.querySelector('[data-chrono-status]');
  const countdownValue = document.querySelector('[data-countdown-value]');
  const countdownCopy = document.querySelector('[data-countdown-copy]');
  const progressBar = document.querySelector('[data-chrono-progress]');
  const themeList = document.querySelector('[data-theme-list]');
  const riddleList = document.querySelector('[data-riddle-list]');
  const riddleFeedback = document.querySelector('[data-riddle-feedback]');
  const notificationList = document.querySelector('[data-notification-list]');

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value || '—') : date.toLocaleString('fr-FR');
  }

  function setStatus(node, message, tone = 'muted') {
    if (!node) return;
    node.textContent = message;
    if (tone) node.dataset.tone = tone;
    else node.removeAttribute('data-tone');
  }

  function getChronoState() {
    return window.SDStorage.completeChronoIfExpired(participantId);
  }

  function getJockerState() {
    return window.SDStorage.getJockerState(participantId);
  }

  function getPairing() {
    return window.SDStorage.getPairingForParticipant(participantId);
  }

  function getRiddles() {
    return window.SDStorage.getRiddlesForParticipant(participantId);
  }

  function getNotifications() {
    return window.SDStorage.getNotifications({ scope: 'participant', participantId });
  }

  function renderHeader() {
    if (welcomeNode) welcomeNode.textContent = `Bienvenue, ${fullName}`;
    if (metaNode) metaNode.textContent = session.email ? `Compte : ${session.email}` : 'Session participant';
    document.title = `Shopping Date - ${fullName}`;
  }

  function renderJocker() {
    const chrono = getChronoState();
    const jocker = getJockerState();

    if (chrono?.startedAt) {
      if (chrono.jockerUsed) {
        setStatus(jockerStatus, 'Jocker déjà utilisé pour ce chrono. Ton temps a bien été réduit de 1h.', 'success');
        if (jockerButton) {
          jockerButton.disabled = true;
          jockerButton.textContent = 'Jocker utilisé';
        }
      } else {
        setStatus(jockerStatus, 'Le jocker devait être activé avant de lancer le chrono.', 'warning');
        if (jockerButton) {
          jockerButton.disabled = true;
          jockerButton.textContent = 'Jocker indisponible';
        }
      }
      return;
    }

    if (jocker?.active) {
      setStatus(jockerStatus, 'Jocker activé. Tu peux inviter quelqu’un pour t’aider, mais ton temps passera à 2h.', 'success');
      if (jockerButton) {
        jockerButton.disabled = true;
        jockerButton.textContent = 'Jocker activé';
      }
      return;
    }

    setStatus(jockerStatus, 'Activer le jocker te permet d’inviter quelqu’un pour t’aider, mais ton temps sera réduit de 1h.', 'muted');
    if (jockerButton) {
      jockerButton.disabled = false;
      jockerButton.textContent = 'Activer le jocker';
    }
  }

  function renderChrono() {
    const chrono = getChronoState();
    const jocker = getJockerState();
    const plannedHours = chrono?.startedAt
      ? Math.max(1, Number(chrono.durationHours) || defaultDurationHours)
      : (jocker?.active ? Math.max(1, defaultDurationHours - 1) : defaultDurationHours);
    const plannedMs = plannedHours * 3600000;

    if (!chrono?.startedAt) {
      if (countdownValue) countdownValue.textContent = window.SDChrono.formatCountdown(plannedMs);
      if (countdownCopy) {
        countdownCopy.textContent = jocker?.active
          ? 'Le jocker est prêt : ton chrono démarrera sur 2h.'
          : 'Appuie sur "Lancer le chrono" pour démarrer.';
      }
      setStatus(chronoStatus, 'Chrono prêt à démarrer.', 'muted');
      if (chronoButton) {
        chronoButton.disabled = false;
        chronoButton.textContent = 'Lancer le chrono';
      }
      if (progressBar) progressBar.style.width = '0%';
      return;
    }

    const startedAtMs = new Date(chrono.startedAt).getTime();
    const endsAtMs = new Date(chrono.endsAt).getTime();
    const totalMs = Math.max(1, endsAtMs - startedAtMs);
    const remainingMs = Math.max(0, endsAtMs - Date.now());
    const elapsedMs = Math.min(totalMs, Math.max(0, Date.now() - startedAtMs));

    if (remainingMs <= 0 || chrono.completedAt) {
      if (countdownValue) countdownValue.textContent = '00:00:00';
      if (countdownCopy) {
        countdownCopy.textContent = chrono.jockerUsed
          ? 'Ton chrono de 2h est terminé.'
          : 'Ton chrono de 3h est terminé.';
      }
      setStatus(
        chronoStatus,
        chrono.completedAt ? `Chrono terminé le ${formatDateTime(chrono.completedAt)}.` : 'Chrono terminé.',
        'warning'
      );
      if (chronoButton) {
        chronoButton.disabled = true;
        chronoButton.textContent = 'Chrono terminé';
      }
      if (progressBar) progressBar.style.width = '100%';
      return;
    }

    if (countdownValue) countdownValue.textContent = window.SDChrono.formatCountdown(remainingMs);
    if (countdownCopy) {
      countdownCopy.textContent = chrono.jockerUsed
        ? 'Jocker appliqué : 2h au total.'
        : 'Chrono standard : 3h au total.';
    }
    setStatus(
      chronoStatus,
      `En cours depuis ${formatDateTime(chrono.startedAt)}${chrono.jockerUsed ? ' avec jocker' : ''}.`,
      'success'
    );
    if (chronoButton) {
      chronoButton.disabled = true;
      chronoButton.textContent = 'Chrono en cours';
    }
    if (progressBar) progressBar.style.width = `${Math.min(100, (elapsedMs / totalMs) * 100)}%`;
  }

  function renderTheme() {
    if (!themeList) return;
    const pairing = getPairing();

    if (!pairing) {
      themeList.innerHTML = '<div class="section-empty">Aucun thème n’a encore été attribué à ton profil.</div>';
      return;
    }

    themeList.innerHTML = `
      <article class="section-card">
        <div class="section-card-head">
          <span class="status-pill sent">Thème actif</span>
          <span class="status-pill pending">Binôme confidentiel</span>
        </div>
        <h3>${escapeHtml(pairing.theme || 'Thème en attente')}</h3>
        <p>Ton binôme est attribué. L'identité de l'autre participant reste masquée sur cet espace.</p>
        <div class="meta">Envoyé le ${formatDateTime(pairing.sentAt || pairing.createdAt)}</div>
      </article>`;
  }

  function renderRiddles() {
    if (!riddleList) return;
    const riddles = getRiddles().slice(0, 3);

    if (!riddles.length) {
      riddleList.innerHTML = '<div class="section-empty">Aucune énigme n’a encore été envoyée pour ton profil.</div>';
      return;
    }

    riddleList.innerHTML = riddles.map((riddle, index) => {
      const lastResponse = riddle.responses?.[0] || null;
      const statusClass = riddle.status === 'solved'
        ? 'solved'
        : riddle.status === 'sent'
          ? 'sent'
          : 'scheduled';
      const statusLabel = riddle.status === 'solved'
        ? 'Résolue'
        : riddle.status === 'sent'
          ? 'En cours'
          : 'Programmée';
      const availabilityLabel = riddle.status === 'scheduled'
        ? `Disponible le ${formatDateTime(riddle.sendAt || riddle.createdAt)}`
        : `Envoyée le ${formatDateTime(riddle.sentAt || riddle.createdAt)}`;
      const responseLabel = lastResponse
        ? `${lastResponse.isCorrect ? 'Bonne' : 'Mauvaise'} réponse le ${formatDateTime(lastResponse.respondedAt)}`
        : 'Aucune réponse envoyée.';
      const answerBlock = riddle.status === 'solved'
        ? `<div class="section-note success">Énigme résolue${lastResponse?.text ? ` avec : ${escapeHtml(lastResponse.text)}` : ''}.</div>`
        : riddle.status === 'sent'
          ? `<form class="riddle-answer-form" data-riddle-answer-form data-riddle-id="${escapeHtml(riddle.id)}">
              <label class="field">
                <span>Ta réponse</span>
                <input type="text" name="response" maxlength="200" autocomplete="off" required placeholder="Écris ta réponse">
              </label>
              <button type="submit" class="auth-button">Envoyer la réponse</button>
            </form>`
          : '<div class="section-note">Cette énigme sera disponible dès son envoi programmé.</div>';

      return `
        <article class="section-card">
          <div class="section-card-head">
            <span class="status-pill ${statusClass}">H+${index}</span>
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </div>
          <h3>${escapeHtml(riddle.question)}</h3>
          <p>${escapeHtml(responseLabel)}</p>
          <div class="meta">${escapeHtml(availabilityLabel)}</div>
          ${answerBlock}
        </article>`;
    }).join('');
  }

  function renderNotifications() {
    if (!notificationList) return;
    const notifications = getNotifications().slice(0, 5);

    if (!notifications.length) {
      notificationList.innerHTML = '<div class="section-empty">Aucune notification pour le moment.</div>';
      return;
    }

    notificationList.innerHTML = notifications.map((notif) => {
      const tone = notif.readAt ? 'sent' : 'pending';
      const label = notif.readAt ? 'Lu' : 'Nouveau';
      return `
        <article class="section-card">
          <div class="section-card-head">
            <span class="status-pill ${tone}">${label}</span>
            <span class="status-pill pending">${formatDateTime(notif.createdAt)}</span>
          </div>
          <h3>${escapeHtml(notif.title || 'Notification')}</h3>
          <p>${escapeHtml(notif.message || '')}</p>
        </article>`;
    }).join('');
  }

  function renderStaticContent() {
    renderHeader();
    renderTheme();
    renderRiddles();
    renderNotifications();
  }

  function renderDynamicContent() {
    renderJocker();
    renderChrono();
  }

  function refreshAll() {
    window.SDStorage.syncScheduledRiddles();
    renderStaticContent();
    renderDynamicContent();
  }

  logoutButton?.addEventListener('click', () => {
    window.SDStorage.clearSession();
    window.location.replace('/pages/login.html');
  });

  jockerButton?.addEventListener('click', () => {
    try {
      window.SDStorage.activateJocker(participantId);
      renderDynamicContent();
    } catch (error) {
      setStatus(jockerStatus, error?.message || 'Impossible d’activer le jocker.', 'error');
    }
  });

  chronoButton?.addEventListener('click', () => {
    try {
      window.SDStorage.startParticipantChrono(participantId, defaultDurationHours);
      renderDynamicContent();
    } catch (error) {
      setStatus(chronoStatus, error?.message || 'Impossible de lancer le chrono.', 'error');
    }
  });

  riddleList?.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-riddle-answer-form]');
    if (!form) return;

    event.preventDefault();
    const riddleId = String(form.dataset.riddleId || '').trim();
    const responseInput = form.elements.response;
    const responseText = String(responseInput?.value || '').trim();

    if (!responseText) {
      setStatus(riddleFeedback, 'Écris une réponse avant de l’envoyer.', 'error');
      responseInput?.focus();
      return;
    }

    try {
      const result = window.SDStorage.answerRiddle(riddleId, participantId, responseText);
      setStatus(riddleFeedback, result.message, result.isCorrect ? 'success' : 'warning');
      renderStaticContent();
      renderDynamicContent();

      if (!result.isCorrect) {
        const reopenedForm = riddleList.querySelector(`[data-riddle-answer-form][data-riddle-id="${riddleId}"]`);
        if (reopenedForm?.elements?.response) {
          reopenedForm.elements.response.value = responseText;
          reopenedForm.elements.response.focus();
        }
      }
    } catch (error) {
      setStatus(riddleFeedback, error?.message || 'Impossible d’envoyer la réponse.', 'error');
    }
  });

  window.addEventListener('storage', refreshAll);

  refreshAll();
  setInterval(() => {
    const changed = window.SDStorage.syncScheduledRiddles();
    if (changed) renderStaticContent();
    renderDynamicContent();
  }, 1000);
})();