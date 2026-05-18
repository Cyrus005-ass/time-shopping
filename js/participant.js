(() => {
  const storage = window.SDStorage;
  if (!storage) {
    window.location.replace('/pages/login.html');
    return;
  }

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
  const soundStatus = document.querySelector('[data-sound-status]');
  const notificationSound = window.SDNotificationSound?.createController({
    statusNode: soundStatus,
    idleMessage: 'Le son des notifications sera actif apres un premier clic sur cette page.'
  });

  let session = null;
  let participant = null;
  let participantId = '';
  let fullName = '';
  let seenRiddleNotificationIds = new Set();
  let riddleNotificationSoundReady = false;
  let currentSnapshot = null;

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

  async function bootstrap() {
    try {
      session = await storage.getSession();
      if (!session || session.role !== 'participant') {
        window.location.replace('/pages/login.html');
        return;
      }

      participantId = String(session.id || '').trim();
      participant = await storage.findParticipantById(participantId).catch(() => null);
      participant = participant || session;
      fullName = storage.participantFullName(participant);

      await refreshAll();
      setInterval(() => {
        if (currentSnapshot) {
          renderChrono(currentSnapshot);
        }
      }, 1000);

      setInterval(() => {
        refreshAll().catch(() => null);
      }, 5000);
    } catch {
      window.location.replace('/pages/login.html');
    }
  }

  async function loadSnapshot() {
    const [chrono, jocker, pairing, riddles, notifications] = await Promise.all([
      storage.completeChronoIfExpired(participantId).catch(() => null),
      storage.getJockerState(participantId).catch(() => null),
      storage.getPairingForParticipant(participantId).catch(() => null),
      storage.getRiddlesForParticipant(participantId).catch(() => []),
      storage.getNotifications({ scope: 'participant', participantId }).catch(() => [])
    ]);

    return { chrono, jocker, pairing, riddles, notifications };
  }

  function syncRiddleNotificationSound(notifications) {
    const ids = notifications
      .filter((notification) => notification.type === 'riddle_sent')
      .slice(0, 50)
      .map((notification) => notification.id);

    const hasNewNotification = riddleNotificationSoundReady
      && ids.some((id) => !seenRiddleNotificationIds.has(id));

    seenRiddleNotificationIds = new Set(ids);
    riddleNotificationSoundReady = true;

    if (hasNewNotification) {
      notificationSound?.play('participant');
    }
  }

  function renderHeader() {
    if (welcomeNode) welcomeNode.textContent = `Bienvenue, ${fullName}`;
    if (metaNode) metaNode.textContent = session.email ? `Compte : ${session.email}` : 'Session participant';
    document.title = `Shopping Date - ${fullName}`;
  }

  function renderJocker(snapshot) {
    const chrono = snapshot.chrono;
    const jocker = snapshot.jocker;

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

  function renderChrono(snapshot) {
    const chrono = snapshot.chrono;
    const jocker = snapshot.jocker;
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

  function renderTheme(snapshot) {
    if (!themeList) return;
    const pairing = snapshot.pairing;

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

  function renderRiddles(snapshot) {
    if (!riddleList) return;
    const riddles = snapshot.riddles.slice(0, 3);

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

  function renderNotifications(snapshot) {
    if (!notificationList) return;
    const notifications = snapshot.notifications.slice(0, 5);

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

  async function refreshAll() {
    await storage.syncScheduledRiddles().catch(() => false);
    const snapshot = await loadSnapshot();
    currentSnapshot = snapshot;
    renderHeader();
    renderTheme(snapshot);
    renderRiddles(snapshot);
    renderNotifications(snapshot);
    syncRiddleNotificationSound(snapshot.notifications);
    renderJocker(snapshot);
    renderChrono(snapshot);
  }

  logoutButton?.addEventListener('click', async () => {
    await storage.clearSession().catch(() => null);
    window.location.replace('/pages/login.html');
  });

  jockerButton?.addEventListener('click', async () => {
    try {
      await storage.activateJocker(participantId);
      await refreshAll();
    } catch (error) {
      setStatus(jockerStatus, error?.message || 'Impossible d’activer le jocker.', 'error');
    }
  });

  chronoButton?.addEventListener('click', async () => {
    try {
      await storage.startParticipantChrono(participantId, defaultDurationHours);
      await refreshAll();
    } catch (error) {
      setStatus(chronoStatus, error?.message || 'Impossible de lancer le chrono.', 'error');
    }
  });

  riddleList?.addEventListener('submit', async (event) => {
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
      const result = await storage.answerRiddle(riddleId, participantId, responseText);
      setStatus(riddleFeedback, result.message, result.isCorrect ? 'success' : 'error');
      await refreshAll();

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

  bootstrap();
})();
