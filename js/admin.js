(() => {
  const storage = window.SDStorage;
  if (!storage) {
    window.location.replace('/pages/admin-login.html');
    return;
  }

  const adminSession = storage.getAdminSession();

  if (!adminSession || adminSession.role !== 'admin') {
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

  if (adminName) adminName.textContent = adminSession.fullName || adminSession.email;

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

  function refreshAll() {
    window.SDStorage.syncScheduledRiddles();
    renderStats();
    renderSelectors();
    renderParticipants();
    renderPairings();
    renderRiddles();
    renderNotifications();
    renderChronos();
  }

  logoutButton?.addEventListener('click', () => {
    storage.clearAdminSession();
    window.location.replace('/pages/admin-login.html');
  });

  adminForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const nom = String(adminForm.elements.nom.value || '').trim();
    const prenom = String(adminForm.elements.prenom.value || '').trim();
    const email = window.SDStorage.normalizeEmail(adminForm.elements.email.value);
    const telephone = String(adminForm.elements.telephone.value || '').trim();

    if (!nom || !prenom || !email || !telephone) {
      return fb(adminFeedback, 'Tous les champs sont obligatoires.', 'error');
    }

    if (window.SDStorage.findParticipantByEmail(email)) {
      return fb(adminFeedback, 'Cet email existe déjà.', 'error');
    }

    window.SDStorage.addRegisteredParticipant({
      id: `a-${Date.now().toString(36)}`,
      nom,
      prenom,
      email,
      telephone,
      sexe: 'non renseigné',
      source: 'admin',
      createdAt: new Date().toISOString()
    });

    adminForm.reset();
    fb(adminFeedback, `Compte créé ! Mot de passe : ${window.SDStorage.buildPasswordFromPhone(telephone)}`, 'success');
    refreshAll();
  });

  pairForm?.addEventListener('submit', (event) => {
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
      window.SDStorage.createOrUpdatePairing([a, b], theme);
      pairForm.reset();
      fb(pairFeedback, 'Binôme créé et thème envoyé avec succès !', 'success');
      refreshAll();
    } catch (error) {
      fb(pairFeedback, error?.message || 'Erreur lors de la création.', 'error');
    }
  });

  riddleForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const participantId = String(riddleForm.elements.participant_id.value || '').trim();
    const question = String(riddleForm.elements.question.value || '').trim();
    const answer = String(riddleForm.elements.answer.value || '').trim();
    const sendAt = String(riddleForm.elements.send_at.value || '').trim();

    if (!participantId || !question || !answer) {
      return fb(riddleFeedback, 'Tous les champs sont obligatoires.', 'error');
    }

    try {
      window.SDStorage.createRiddle({ participantId, question, answer, sendAt: sendAt || null });
      riddleForm.reset();
      fb(riddleFeedback, sendAt ? 'Énigme programmée avec succès.' : 'Énigme envoyée immédiatement.', 'success');
      refreshAll();
    } catch (error) {
      fb(riddleFeedback, error?.message || 'Erreur.', 'error');
    }
  });

  participantList?.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-participant-edit]');
    const deleteButton = event.target.closest('[data-participant-delete]');

    if (editButton) {
      handleParticipantEdit(editButton.dataset.participantEdit);
    }

    if (deleteButton) {
      handleParticipantDelete(deleteButton.dataset.participantDelete);
    }
  });

  function handleParticipantEdit(id) {
    const participant = window.SDStorage.findParticipantById(id);
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
    const nextTelephone = window.prompt('Numéro de téléphone', participant.telephone || '');
    if (nextTelephone === null) return;

    const nom = String(nextNom).trim();
    const prenom = String(nextPrenom).trim();
    const email = window.SDStorage.normalizeEmail(nextEmail);
    const telephone = String(nextTelephone).trim();

    if (!nom || !prenom || !email || !telephone) {
      return fb(participantFeedback, 'Tous les champs doivent être remplis.', 'error');
    }

    const existing = window.SDStorage.findParticipantByEmail(email);
    if (existing && existing.id !== id) {
      return fb(participantFeedback, 'Cet email existe déjà.', 'error');
    }

    window.SDStorage.updateRegisteredParticipant(id, {
      nom,
      prenom,
      email,
      telephone
    });

    fb(participantFeedback, 'Profil mis à jour.', 'success');
    refreshAll();
  }

  function handleParticipantDelete(id) {
    const participant = window.SDStorage.findParticipantById(id);
    if (!participant) {
      return fb(participantFeedback, 'Profil introuvable.', 'error');
    }
    if (participant.source !== 'admin') {
      return fb(participantFeedback, 'Ce profil est en lecture seule.', 'error');
    }

    const confirmed = window.confirm(`Supprimer le profil ${window.SDStorage.participantFullName(participant)} ?`);
    if (!confirmed) return;

    const deleted = window.SDStorage.deleteRegisteredParticipant(id);
    if (!deleted) {
      return fb(participantFeedback, 'Impossible de supprimer ce profil.', 'error');
    }

    fb(participantFeedback, 'Profil supprimé.', 'success');
    refreshAll();
  }

  function renderStats() {
    const counts = window.SDStorage.getDashboardCounts();
    if (countParticipants) countParticipants.textContent = `${counts.participants} candidat${counts.participants > 1 ? 's' : ''}`;
    if (countPairings) countPairings.textContent = `${counts.pairings} binôme${counts.pairings > 1 ? 's' : ''}`;
    if (countRiddles) countRiddles.textContent = `${counts.riddles} énigme${counts.riddles > 1 ? 's' : ''}`;
    if (countNotifs) countNotifs.textContent = `${counts.notifications} notif${counts.notifications > 1 ? 's' : ''}`;
  }

  function renderSelectors() {
    const participants = window.SDStorage.getAllParticipants();
    const options = participants.map((participant) => {
      const label = window.SDStorage.participantFullName(participant) || participant.email || participant.id;
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

  function renderChronos() {
    if (!chronoList) return;
    const participants = window.SDStorage.getAllParticipants();

    if (!participants.length) {
      chronoList.innerHTML = '<tr><td colspan="8" class="admin-empty">Aucun candidat enregistré.</td></tr>';
      return;
    }

    chronoList.innerHTML = participants.map((participant) => {
      const state = window.SDStorage.completeChronoIfExpired(participant.id);
      const riddles = window.SDStorage.getRiddlesForParticipant(participant.id);

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
        const riddle = riddles[slot];
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

  function renderParticipants() {
    if (!participantList) return;
    const list = window.SDStorage.getAllParticipants();

    participantList.innerHTML = list.length ? list.map((participant) => {
      const pwd = window.SDStorage.buildPasswordFromPhone(participant.telephone) || '—';
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

  function renderPairings() {
    if (!pairingList) return;
    const list = window.SDStorage.getActivePairings();

    pairingList.innerHTML = list.length ? list.map((pairing) => {
      const a = window.SDStorage.participantFullName(window.SDStorage.findParticipantById(pairing.participantIds[0]));
      const b = window.SDStorage.participantFullName(window.SDStorage.findParticipantById(pairing.participantIds[1]));
      return `<tr>
        <td>${esc(a)}</td>
        <td>${esc(b)}</td>
        <td>${esc(pairing.theme)}</td>
        <td>${formatDate(pairing.sentAt || pairing.createdAt)}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="4" class="admin-empty">Aucun binôme actif.</td></tr>';
  }

  function renderRiddles() {
    if (!riddleList) return;
    const list = window.SDStorage.getRiddles();

    riddleList.innerHTML = list.length ? list.map((riddle) => {
      const participant = window.SDStorage.findParticipantById(riddle.participantId);
      const last = riddle.responses?.[0] || null;
      const result = last ? (last.isCorrect ? '✅ Correct' : '❌ Faux') : '—';

      return `<tr>
        <td>${esc(window.SDStorage.participantFullName(participant))}</td>
        <td>${esc(riddle.question)}</td>
        <td><span class="status-chip ${riddle.status}">${riddle.status}</span></td>
        <td>${esc(last ? last.text : '—')}</td>
        <td>${result}</td>
        <td>${last ? Math.round(last.durationMs / 1000) + 's' : '—'}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="6" class="admin-empty">Aucune énigme.</td></tr>';
  }

  function renderNotifications() {
    if (!notifList) return;
    const list = window.SDStorage.getNotifications({ scope: 'admin' });

    notifList.innerHTML = list.length ? list.map((notification) => {
      const target = notification.participantId
        ? window.SDStorage.participantFullName(window.SDStorage.findParticipantById(notification.participantId))
        : 'Admin';
      return `<tr>
        <td>${esc(notification.title)}</td>
        <td>${esc(target)}</td>
        <td>${esc(notification.message)}</td>
        <td>${formatDate(notification.createdAt)}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="4" class="admin-empty">Aucune notification.</td></tr>';
  }

  window.addEventListener('storage', refreshAll);

  refreshAll();
  setInterval(() => {
    if (window.SDStorage.syncScheduledRiddles()) refreshAll();
    else renderChronos();
  }, 5000);
  setInterval(renderChronos, 1000);
})();