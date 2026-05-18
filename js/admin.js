(() => {
  const storage = window.SDStorage;
  if (!storage) {
    window.location.replace('/pages/admin-login.html');
    return;
  }

  const adminName = document.querySelector('[data-admin-name]');
  const logoutButton = document.querySelector('[data-admin-logout]');
  const adminForm = document.querySelector('[data-admin-form]');
  const pairForm = document.querySelector('[data-pair-form]');
  const riddleForm = document.querySelector('[data-riddle-form]');

  const adminFeedback = document.querySelector('[data-admin-feedback]');
  const pairFeedback = document.querySelector('[data-pair-feedback]');
  const riddleFeedback = document.querySelector('[data-riddle-feedback]');
  const participantFeedback = document.querySelector('[data-participant-feedback]');

  const participantList = document.querySelector('[data-participant-list]');
  const pairingList = document.querySelector('[data-pairing-list]');
  const riddleList = document.querySelector('[data-riddle-list]');
  const notifList = document.querySelector('[data-notification-list]');
  const chronoList = document.querySelector('[data-chrono-list]');

  const countParticipants = document.querySelector('[data-participant-count]');
  const countPairings = document.querySelector('[data-pairing-count]');
  const countRiddles = document.querySelector('[data-riddle-count]');
  const countNotifs = document.querySelector('[data-notification-count]');

  const selectA = document.querySelector('[data-select-a]');
  const selectB = document.querySelector('[data-select-b]');
  const riddleSelect = document.querySelector('[data-riddle-target]');
  const soundStatus = document.querySelector('[data-sound-status]');
  const notificationSound = window.SDNotificationSound?.createController({
    statusNode: soundStatus,
    idleMessage: 'Le son des notifications sera actif apres un premier clic sur cette page.'
  });

  let seenAnswerNotificationIds = new Set();
  let answerNotificationSoundReady = false;
  let currentAdminSession = null;

  function fb(node, msg, state) {
    if (!node) return;
    node.textContent = msg;
    node.dataset.state = state;
    setTimeout(() => {
      if (node) node.dataset.state = '';
    }, 5000);
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value || '—') : date.toLocaleString('fr-FR');
  }

  function formatTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function restoreSelectValue(select, value) {
    if (!select) return;
    const exists = Array.from(select.options).some((option) => option.value === value);
    select.value = exists ? value : '';
  }

  async function bootstrap() {
    try {
      currentAdminSession = await storage.getAdminSession();
      if (!currentAdminSession || currentAdminSession.role !== 'admin') {
        window.location.replace('/pages/admin-login.html');
        return;
      }

      if (adminName) adminName.textContent = currentAdminSession.fullName || currentAdminSession.email;
      await refreshAll();
    } catch {
      window.location.replace('/pages/admin-login.html');
    }
  }

  async function loadSnapshot() {
    const [counts, participants, pairings, riddles, notifications] = await Promise.all([
      storage.getDashboardCounts(),
      storage.getAllParticipants(true),
      storage.getActivePairings(),
      storage.getRiddles(),
      storage.getNotifications({ scope: 'admin' })
    ]);

    const chronos = await Promise.all(participants.map(async (participant) => {
      const [state, participantRiddles] = await Promise.all([
        storage.completeChronoIfExpired(participant.id).catch(() => null),
        storage.getRiddlesForParticipant(participant.id).catch(() => [])
      ]);
      return { participantId: participant.id, state, riddles: participantRiddles };
    }));

    return {
      counts,
      participants,
      pairings,
      riddles,
      notifications,
      chronos
    };
  }

  function syncAnswerNotificationSound(notifications) {
    const ids = notifications
      .filter((notification) => notification.type === 'riddle_answered')
      .slice(0, 50)
      .map((notification) => notification.id);

    const hasNewNotification = answerNotificationSoundReady
      && ids.some((id) => !seenAnswerNotificationIds.has(id));

    seenAnswerNotificationIds = new Set(ids);
    answerNotificationSoundReady = true;

    if (hasNewNotification) {
      notificationSound?.play('admin');
    }
  }

  async function refreshAll() {
    await storage.syncScheduledRiddles().catch(() => false);
    const snapshot = await loadSnapshot();
    renderStats(snapshot.counts);
    renderSelectors(snapshot.participants);
    renderParticipants(snapshot.participants);
    renderPairings(snapshot.pairings, snapshot.participants);
    renderRiddles(snapshot.riddles, snapshot.participants);
    renderNotifications(snapshot.notifications, snapshot.participants);
    syncAnswerNotificationSound(snapshot.notifications);
    renderChronos(snapshot.chronos, snapshot.participants);
  }

  logoutButton?.addEventListener('click', async () => {
    await storage.clearAdminSession().catch(() => null);
    window.location.replace('/pages/admin-login.html');
  });

  adminForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nom = String(adminForm.elements.nom.value || '').trim();
    const prenom = String(adminForm.elements.prenom.value || '').trim();
    const email = storage.normalizeEmail(adminForm.elements.email.value);
    const password = String(adminForm.elements.password.value || '').trim();
    const telephone = String(adminForm.elements.telephone.value || '').trim();

    if (!nom || !prenom || !email || !password || !telephone) {
      return fb(adminFeedback, 'Tous les champs sont obligatoires.', 'error');
    }

    if (password.length < 4) {
      return fb(adminFeedback, 'Le mot de passe doit contenir au moins 4 caractères.', 'error');
    }

    try {
      await storage.addRegisteredParticipant({
        nom,
        prenom,
        email,
        password,
        telephone,
        sexe: 'non renseigné',
        source: 'admin'
      });

      adminForm.reset();
      fb(adminFeedback, `Compte créé ! Identifiants : ${email} / ${password}`, 'success');
      await refreshAll();
    } catch (error) {
      fb(adminFeedback, error?.message || 'Erreur lors de la création du compte.', 'error');
    }
  });

  pairForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const a = String(pairForm.elements.participant_a.value || '').trim();
    const b = String(pairForm.elements.participant_b.value || '').trim();
    const theme = String(pairForm.elements.theme.value || '').trim();

    if (!a || !b || !theme) {
      return fb(pairFeedback, 'Veuillez choisir deux participants et un thème.', 'error');
    }
    if (a === b) {
      return fb(pairFeedback, 'Un binôme doit contenir deux personnes différentes.', 'error');
    }

    try {
      await storage.createOrUpdatePairing([a, b], theme);
      pairForm.reset();
      fb(pairFeedback, 'Binôme créé et thème envoyé avec succès !', 'success');
      await refreshAll();
    } catch (error) {
      fb(pairFeedback, error?.message || 'Erreur lors de la création.', 'error');
    }
  });

  riddleForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const participantId = String(riddleForm.elements.participant_id.value || '').trim();
    const question = String(riddleForm.elements.question.value || '').trim();
    const answer = String(riddleForm.elements.answer.value || '').trim();
    const sendAt = String(riddleForm.elements.send_at.value || '').trim();

    if (!participantId || !question || !answer) {
      return fb(riddleFeedback, 'Tous les champs sont obligatoires.', 'error');
    }

    try {
      await storage.createRiddle({ participantId, question, answer, sendAt: sendAt || null });
      riddleForm.reset();
      fb(riddleFeedback, sendAt ? 'Énigme programmée avec succès.' : 'Énigme envoyée immédiatement.', 'success');
      await refreshAll();
    } catch (error) {
      fb(riddleFeedback, error?.message || 'Erreur.', 'error');
    }
  });

  participantList?.addEventListener('click', async (event) => {
    const editButton = event.target.closest('[data-participant-edit]');
    const deleteButton = event.target.closest('[data-participant-delete]');

    if (editButton) {
      await handleParticipantEdit(editButton.dataset.participantEdit);
    }

    if (deleteButton) {
      await handleParticipantDelete(deleteButton.dataset.participantDelete);
    }
  });

  async function handleParticipantEdit(id) {
    const participant = await storage.findParticipantById(id);
    if (!participant) {
      return fb(participantFeedback, 'Profil introuvable.', 'error');
    }
    if (participant.source !== 'admin') {
      return fb(participantFeedback, 'Ce profil est en lecture seule.', 'error');
    }

    const nextNom = window.prompt('Nom', participant.nom || '');
    if (nextNom === null) return;
    const nextPrenom = window.prompt('Prénom', participant.prenom || '');
    if (nextPrenom === null) return;
    const nextEmail = window.prompt('Email', participant.email || '');
    if (nextEmail === null) return;
    const nextPassword = window.prompt('Mot de passe de connexion', storage.getParticipantLoginPassword(participant) || '');
    if (nextPassword === null) return;
    const nextTelephone = window.prompt('Numéro de téléphone', participant.telephone || '');
    if (nextTelephone === null) return;

    const nom = String(nextNom).trim();
    const prenom = String(nextPrenom).trim();
    const email = storage.normalizeEmail(nextEmail);
    const password = String(nextPassword).trim();
    const telephone = String(nextTelephone).trim();

    if (!nom || !prenom || !email || !password || !telephone) {
      return fb(participantFeedback, 'Tous les champs doivent être remplis.', 'error');
    }

    if (password.length < 4) {
      return fb(participantFeedback, 'Le mot de passe doit contenir au moins 4 caractères.', 'error');
    }

    try {
      await storage.updateRegisteredParticipant(id, {
        nom,
        prenom,
        email,
        password,
        telephone
      });

      fb(participantFeedback, 'Profil mis à jour.', 'success');
      await refreshAll();
    } catch (error) {
      fb(participantFeedback, error?.message || 'Erreur lors de la mise à jour.', 'error');
    }
  }

  async function handleParticipantDelete(id) {
    const participant = await storage.findParticipantById(id);
    if (!participant) {
      return fb(participantFeedback, 'Profil introuvable.', 'error');
    }
    if (participant.source !== 'admin') {
      return fb(participantFeedback, 'Ce profil est en lecture seule.', 'error');
    }

    const confirmed = window.confirm(`Supprimer le profil ${storage.participantFullName(participant)} ?`);
    if (!confirmed) return;

    try {
      const deleted = await storage.deleteRegisteredParticipant(id);
      if (!deleted?.deleted) {
        return fb(participantFeedback, 'Impossible de supprimer ce profil.', 'error');
      }

      fb(participantFeedback, 'Profil supprimé.', 'success');
      await refreshAll();
    } catch (error) {
      fb(participantFeedback, error?.message || 'Impossible de supprimer ce profil.', 'error');
    }
  }

  function renderStats(counts) {
    if (countParticipants) countParticipants.textContent = `${counts.participants} candidat${counts.participants > 1 ? 's' : ''}`;
    if (countPairings) countPairings.textContent = `${counts.pairings} binôme${counts.pairings > 1 ? 's' : ''}`;
    if (countRiddles) countRiddles.textContent = `${counts.riddles} énigme${counts.riddles > 1 ? 's' : ''}`;
    if (countNotifs) countNotifs.textContent = `${counts.notifications} notif${counts.notifications > 1 ? 's' : ''}`;
  }

  function renderSelectors(participants) {
    const options = participants.map((participant) => {
      const label = storage.participantFullName(participant) || participant.email || participant.id;
      return `<option value="${esc(participant.id)}">${esc(label)}</option>`;
    }).join('');
    const empty = '<option value="">— Choisir un candidat —</option>';

    const currentA = selectA?.value || '';
    const currentB = selectB?.value || '';
    const currentRiddle = riddleSelect?.value || '';

    if (selectA) {
      selectA.innerHTML = empty + options;
      restoreSelectValue(selectA, currentA);
    }
    if (selectB) {
      selectB.innerHTML = empty + options;
      restoreSelectValue(selectB, currentB);
    }
    if (riddleSelect) {
      riddleSelect.innerHTML = empty + options;
      restoreSelectValue(riddleSelect, currentRiddle);
    }
  }

  function renderChronos(chronos, participants) {
    if (!chronoList) return;

    if (!participants.length) {
      chronoList.innerHTML = '<tr><td colspan="8" class="admin-empty">Aucun candidat enregistré.</td></tr>';
      return;
    }

    const byParticipant = new Map(chronos.map((entry) => [entry.participantId, entry]));

    chronoList.innerHTML = participants.map((participant) => {
      const entry = byParticipant.get(participant.id) || { state: null, riddles: [] };
      const state = entry.state;
      const riddles = entry.riddles || [];

      let statusBadge = '<span class="chrono-badge idle">En attente</span>';
      let timeCell = '<span class="chrono-cell idle">—</span>';
      let startCell = '—';
      let endCell = '—';

      if (state?.startedAt) {
        const endsAt = new Date(state.endsAt).getTime();
        const remaining = endsAt - Date.now();

        if (remaining <= 0 || state.completedAt) {
          statusBadge = '<span class="chrono-badge done">Terminé</span>';
          timeCell = '<span class="chrono-cell done">00:00:00</span>';
        } else {
          const urgent = remaining < 1800000;
          statusBadge = '<span class="chrono-badge running">En cours</span>';
          timeCell = `<span class="chrono-cell${urgent ? ' urgent' : ''}">${window.SDChrono.formatCountdown(remaining)}</span>`;
        }
        startCell = formatTime(state.startedAt);
        endCell = formatTime(state.endsAt);
      }

      const dots = [0, 1, 2].map((slot) => {
        const riddle = riddles.find((item) => Number(item.slotIndex) === slot) || riddles[slot];
        if (!riddle) return '<span class="enigme-dot pending" title="Pas d’énigme"></span>';
        if (riddle.status === 'solved') return '<span class="enigme-dot done" title="Résolue"></span>';
        if (riddle.status === 'sent') return '<span class="enigme-dot active" title="En cours"></span>';
        return '<span class="enigme-dot pending" title="Programmée"></span>';
      });

      return `<tr>
        <td><strong>${esc(participant.prenom)} ${esc(participant.nom)}</strong></td>
        <td>${statusBadge}</td>
        <td>${timeCell}</td>
        <td>${startCell}</td>
        <td>${endCell}</td>
        <td><div class="enigme-slot">${dots[0]} H+0</div></td>
        <td><div class="enigme-slot">${dots[1]} H+1</div></td>
        <td><div class="enigme-slot">${dots[2]} H+2</div></td>
      </tr>`;
    }).join('');
  }

  function renderParticipants(list) {
    if (!participantList) return;

    participantList.innerHTML = list.length ? list.map((participant) => {
      const pwd = storage.getParticipantLoginPassword(participant) || '—';
      const sourceLabel = participant.source === 'admin'
        ? 'Admin'
        : participant.source === 'manuel'
          ? 'Base'
          : participant.source || 'Local';
      const actions = participant.source === 'admin'
        ? `<button type="button" class="mini-button" data-participant-edit="${esc(participant.id)}">Modifier</button>
           <button type="button" class="mini-button danger" data-participant-delete="${esc(participant.id)}">Supprimer</button>`
        : '<span class="status-chip pending">Lecture seule</span>';

      return `<tr>
        <td>${esc(participant.nom)}</td>
        <td>${esc(participant.prenom)}</td>
        <td>${esc(participant.email)}</td>
        <td>${esc(participant.telephone)}</td>
        <td>${esc(sourceLabel)}</td>
        <td class="admin-password">${esc(pwd)}</td>
        <td>${actions}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="7" class="admin-empty">Aucun profil.</td></tr>';
  }

  function renderPairings(list, participants) {
    if (!pairingList) return;
    const participantsById = new Map(participants.map((participant) => [participant.id, participant]));

    pairingList.innerHTML = list.length ? list.map((pairing) => {
      const participantA = participantsById.get(pairing.participantIds[0]);
      const participantB = participantsById.get(pairing.participantIds[1]);
      const a = pairing.nameA || storage.participantFullName(participantA);
      const b = pairing.nameB || storage.participantFullName(participantB);
      return `<tr>
        <td>${esc(a)}</td>
        <td>${esc(b)}</td>
        <td>${esc(pairing.theme)}</td>
        <td>${formatDate(pairing.sentAt || pairing.createdAt)}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="4" class="admin-empty">Aucun binôme actif.</td></tr>';
  }

  function renderRiddles(list, participants) {
    if (!riddleList) return;
    const participantsById = new Map(participants.map((participant) => [participant.id, participant]));

    riddleList.innerHTML = list.length ? list.map((riddle) => {
      const participant = participantsById.get(riddle.participantId);
      const last = riddle.responses?.[0] || null;
      const result = last ? (last.isCorrect ? '✅ Correct' : '❌ Faux') : '—';

      return `<tr>
        <td>${esc(storage.participantFullName(participant))}</td>
        <td>${esc(riddle.question)}</td>
        <td><span class="status-chip ${riddle.status}">${riddle.status}</span></td>
        <td>${esc(last ? last.text : '—')}</td>
        <td>${result}</td>
        <td>${last ? Math.round(last.durationMs / 1000) + 's' : '—'}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="6" class="admin-empty">Aucune énigme.</td></tr>';
  }

  function renderNotifications(list, participants) {
    if (!notifList) return;
    const participantsById = new Map(participants.map((participant) => [participant.id, participant]));

    notifList.innerHTML = list.length ? list.map((notification) => {
      const participant = participantsById.get(notification.participantId);
      const target = notification.participantId
        ? storage.participantFullName(participant)
        : 'Admin';
      return `<tr>
        <td>${esc(notification.title)}</td>
        <td>${esc(target)}</td>
        <td>${esc(notification.message)}</td>
        <td>${formatDate(notification.createdAt)}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="4" class="admin-empty">Aucune notification.</td></tr>';
  }

  bootstrap();
  setInterval(() => {
    refreshAll().catch(() => null);
  }, 5000);
})();
