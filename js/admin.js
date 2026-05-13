(() => {
  // Vérification session admin
  const adminSessionRaw = localStorage.getItem('sd_admin_session');
  const adminSession = adminSessionRaw ? JSON.parse(adminSessionRaw) : null;

  if (!adminSession || adminSession.role !== 'admin') {
    window.location.replace('/pages/admin-login.html');
    return;
  }

  // Sélection des éléments
  const adminName         = document.querySelector('[data-admin-name]');
  const logoutButton      = document.querySelector('[data-admin-logout]');
  const adminForm         = document.querySelector('[data-admin-form]');
  const pairForm          = document.querySelector('[data-pair-form]');
  const riddleForm        = document.querySelector('[data-riddle-form]');
  
  const adminFeedback     = document.querySelector('[data-admin-feedback]');
  const pairFeedback      = document.querySelector('[data-pair-feedback]');
  const riddleFeedback    = document.querySelector('[data-riddle-feedback]');

  const participantList   = document.querySelector('[data-participant-list]');
  const pairingList       = document.querySelector('[data-pairing-list]');
  const riddleList        = document.querySelector('[data-riddle-list]');
  const notifList         = document.querySelector('[data-notification-list]');
  const chronoList        = document.querySelector('[data-chrono-list]');

  const countParticipants = document.querySelector('[data-participant-count]');
  const countPairings     = document.querySelector('[data-pairing-count]');
  const countRiddles      = document.querySelector('[data-riddle-count]');
  const countNotifs       = document.querySelector('[data-notification-count]');

  const selectA           = document.querySelector('[data-select-a]');
  const selectB           = document.querySelector('[data-select-b]');
  const riddleSelect      = document.querySelector('[data-riddle-target]');

  if (adminName) adminName.textContent = adminSession.fullName || adminSession.email;

  // Déconnexion
  logoutButton?.addEventListener('click', () => {
    localStorage.removeItem('sd_admin_session');
    window.location.replace('/pages/admin-login.html');
  });

  // Rafraîchissement automatique
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

  // Mise à jour toutes les 5 secondes + chrono toutes les secondes
  setInterval(() => {
    if (window.SDStorage.syncScheduledRiddles()) refreshAll();
    else renderChronos();
  }, 5000);

  setInterval(renderChronos, 1000);
  window.addEventListener('storage', refreshAll);

  // ==================== FORMULAIRES ====================

  adminForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nom       = String(adminForm.elements.nom.value || '').trim();
    const prenom    = String(adminForm.elements.prenom.value || '').trim();
    const email     = window.SDStorage.normalizeEmail(adminForm.elements.email.value);
    const telephone = String(adminForm.elements.telephone.value || '').trim();

    if (!nom || !prenom || !email || !telephone) {
      return fb(adminFeedback, 'Tous les champs sont obligatoires.', 'error');
    }

    if (window.SDStorage.findParticipantByEmail(email)) {
      return fb(adminFeedback, 'Cet email existe déjà.', 'error');
    }

    window.SDStorage.addRegisteredParticipant({
      id: `a-${Date.now().toString(36)}`,
      nom, prenom, email, telephone,
      sexe: 'non renseigné',
      source: 'admin',
      createdAt: new Date().toISOString()
    });

    adminForm.reset();
    fb(adminFeedback, `Compte créé ! Mot de passe : ${window.SDStorage.buildPasswordFromPhone(telephone)}`, 'success');
    refreshAll();
  });

  pairForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const a = String(pairForm.elements.participant_a.value || '').trim();
    const b = String(pairForm.elements.participant_b.value || '').trim();
    const theme = String(pairForm.elements.theme.value || '').trim();

    if (!a || !b || !theme) return fb(pairFeedback, 'Veuillez choisir deux participants et un thème.', 'error');
    if (a === b) return fb(pairFeedback, 'Un binôme doit contenir deux personnes différentes.', 'error');

    try {
      window.SDStorage.createOrUpdatePairing([a, b], theme);
      pairForm.reset();
      fb(pairFeedback, 'Binôme créé et thème envoyé avec succès !', 'success');
      refreshAll();
    } catch (err) {
      fb(pairFeedback, err?.message || 'Erreur lors de la création.', 'error');
    }
  });

  riddleForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const participantId = String(riddleForm.elements.participant_id.value || '').trim();
    const question      = String(riddleForm.elements.question.value || '').trim();
    const answer        = String(riddleForm.elements.answer.value || '').trim();
    const sendAt        = String(riddleForm.elements.send_at.value || '').trim();

    if (!participantId || !question || !answer) {
      return fb(riddleFeedback, 'Tous les champs sont obligatoires.', 'error');
    }

    try {
      window.SDStorage.createRiddle({ participantId, question, answer, sendAt: sendAt || null });
      riddleForm.reset();
      fb(riddleFeedback, sendAt ? 'Énigme programmée avec succès.' : 'Énigme envoyée immédiatement.', 'success');
      refreshAll();
    } catch (err) {
      fb(riddleFeedback, err?.message || 'Erreur.', 'error');
    }
  });

  // ==================== RENDU ====================

  function renderStats() {
    const c = window.SDStorage.getDashboardCounts();
    if (countParticipants) countParticipants.textContent = `${c.participants} candidat${c.participants > 1 ? 's' : ''}`;
    if (countPairings)     countPairings.textContent     = `${c.pairings} binôme${c.pairings > 1 ? 's' : ''}`;
    if (countRiddles)      countRiddles.textContent      = `${c.riddles} énigme${c.riddles > 1 ? 's' : ''}`;
    if (countNotifs)       countNotifs.textContent       = `${c.notifications} notif${c.notifications > 1 ? 's' : ''}`;
  }

  function renderSelectors() {
    const participants = window.SDStorage.getAllParticipants();
    const opts = participants.map(p => 
      `<option value="${esc(p.id)}">${esc(p.prenom)} ${esc(p.nom)}</option>`
    ).join('');

    const empty = '<option value="">— Choisir un candidat —</option>';

    if (selectA) { selectA.innerHTML = empty + opts; }
    if (selectB) { selectB.innerHTML = empty + opts; }
    if (riddleSelect) { riddleSelect.innerHTML = empty + opts; }
  }

  function renderChronos() {
    if (!chronoList) return;
    const participants = window.SDStorage.getAllParticipants();

    if (!participants.length) {
      chronoList.innerHTML = '<tr><td colspan="8" class="admin-empty">Aucun candidat enregistré.</td></tr>';
      return;
    }

    chronoList.innerHTML = participants.map(p => {
      const state = window.SDStorage.completeChronoIfExpired(p.id);
      const riddles = window.SDStorage.getRiddlesForParticipant(p.id);

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

      const dots = [0,1,2].map(slot => {
        const r = riddles[slot];
        if (!r) return '<span class="enigme-dot pending" title="Pas d’énigme"></span>';
        if (r.status === 'solved') return '<span class="enigme-dot done" title="Résolue"></span>';
        if (r.status === 'sent') return '<span class="enigme-dot active" title="En cours"></span>';
        return '<span class="enigme-dot pending" title="Programmée"></span>';
      });

      return `<tr>
        <td><strong>${esc(p.prenom)} ${esc(p.nom)}</strong></td>
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

    participantList.innerHTML = list.length ? list.map(p => {
      const pwd = window.SDStorage.buildPasswordFromPhone(p.telephone) || '—';
      const sourceLabel = p.source === 'admin'
        ? 'Admin'
        : p.source === 'manuel'
          ? 'Base'
          : p.source || 'Local';
      const actions = p.source === 'admin'
        ? `<button class="mini-button" data-participant-edit="${esc(p.id)}">Modifier</button>
           <button class="mini-button danger" data-participant-delete="${esc(p.id)}">Supprimer</button>`
        : '<span class="status-chip pending">Lecture seule</span>';

      return `<tr>
        <td>${esc(p.nom)}</td>
        <td>${esc(p.prenom)}</td>
        <td>${esc(p.email)}</td>
        <td>${esc(p.telephone)}</td>
        <td>${esc(sourceLabel)}</td>
        <td class="admin-password">${esc(pwd)}</td>
        <td>${actions}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="7" class="admin-empty">Aucun profil.</td></tr>';
  }

  function renderPairings() {
    if (!pairingList) return;
    const list = window.SDStorage.getActivePairings();

    pairingList.innerHTML = list.length ? list.map(pair => {
      const a = window.SDStorage.participantFullName(window.SDStorage.findParticipantById(pair.participantIds[0]));
      const b = window.SDStorage.participantFullName(window.SDStorage.findParticipantById(pair.participantIds[1]));
      return `<tr>
        <td>${esc(a)}</td>
        <td>${esc(b)}</td>
        <td>${esc(pair.theme)}</td>
        <td>${formatDate(pair.sentAt || pair.createdAt)}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="4" class="admin-empty">Aucun binôme actif.</td></tr>';
  }

  function renderRiddles() {
    if (!riddleList) return;
    const list = window.SDStorage.getRiddles();

    riddleList.innerHTML = list.length ? list.map(r => {
      const p = window.SDStorage.findParticipantById(r.participantId);
      const last = r.responses?.[0] || null;
      const result = last ? (last.isCorrect ? '✅ Correct' : '❌ Faux') : '—';

      return `<tr>
        <td>${esc(window.SDStorage.participantFullName(p))}</td>
        <td>${esc(r.question)}</td>
        <td><span class="status-chip ${r.status}">${r.status}</span></td>
        <td>${esc(last ? last.text : '—')}</td>
        <td>${result}</td>
        <td>${last ? Math.round(last.durationMs/1000) + 's' : '—'}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="6" class="admin-empty">Aucune énigme.</td></tr>';
  }

  function renderNotifications() {
    if (!notifList) return;
    const list = window.SDStorage.getNotifications({ scope: 'admin' });

    notifList.innerHTML = list.length ? list.map(n => {
      const target = n.participantId 
        ? window.SDStorage.participantFullName(window.SDStorage.findParticipantById(n.participantId))
        : 'Admin';
      return `<tr>
        <td>${esc(n.title)}</td>
        <td>${esc(target)}</td>
        <td>${esc(n.message)}</td>
        <td>${formatDate(n.createdAt)}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="4" class="admin-empty">Aucune notification.</td></tr>';
  }

  // ==================== HELPERS ====================

  function fb(node, msg, state) {
    if (!node) return;
    node.textContent = msg;
    node.dataset.state = state;
    setTimeout(() => { if (node) node.dataset.state = ''; }, 5000);
  }

  function formatDate(v) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v || '') : d.toLocaleString('fr-FR');
  }

  function formatTime(v) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  }

  function esc(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Initialisation
  refreshAll();
})();