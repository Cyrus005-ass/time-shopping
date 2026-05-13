(() => {
  const PREFIX = 'sd_';
  const SESSION_KEY = `${PREFIX}session`;
  const PARTICIPANTS_KEY = `${PREFIX}participants`;
  const PAIRINGS_KEY = `${PREFIX}pairings`;
  const RIDDLES_KEY = `${PREFIX}riddles`;
  const NOTIFICATIONS_KEY = `${PREFIX}notifications`;
  const CHRONO_PREFIX = `${PREFIX}chrono_`;
  const JOCKER_PREFIX = `${PREFIX}jocker_`;

  /* ── UTILS ──────────────────────────────────────────────── */
  function readJson(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function readList(key) {
    const v = readJson(key);
    return Array.isArray(v) ? v : [];
  }

  function nowIso() { return new Date().toISOString(); }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizePhone(value) {
    let d = String(value || '').replace(/\D/g, '');
    if (d.startsWith('229') && d.length > 10) d = d.slice(3);
    return d;
  }

  function buildPasswordFromPhone(phone) {
    const d = normalizePhone(phone);
    if (d.length < 5) return d;
    return d.slice(2, 5) + d.slice(-2);
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function participantFullName(p) {
    if (!p) return 'Profil inconnu';
    return `${p.prenom || ''} ${p.nom || ''}`.trim();
  }

  /* ── CHRONO & JOCKER ───────────────────────────────────── */
  function chronoKey(participantId) { return `${CHRONO_PREFIX}${participantId}`; }
  function jockerKey(participantId) { return `${JOCKER_PREFIX}${participantId}`; }

  function getChronoState(participantId) { return readJson(chronoKey(participantId)); }
  function getJockerState(participantId) { return readJson(jockerKey(participantId)); }

  function setChronoState(participantId, state) {
    writeJson(chronoKey(participantId), state);
    return state;
  }

  function setJockerState(participantId, state) {
    writeJson(jockerKey(participantId), state);
    return state;
  }

  function startParticipantChrono(participantId, durationHours = 3) {
    const existing = getChronoState(participantId);
    if (existing?.startedAt && existing?.endsAt) return existing;

    const jocker = getJockerState(participantId);
    const effectiveDuration = jocker?.active ? Math.max(1, durationHours - 1) : durationHours;

    const startedAt = nowIso();
    const endsAt = new Date(Date.now() + effectiveDuration * 3600000).toISOString();

    if (jocker?.active) {
      setJockerState(participantId, { 
        active: false, 
        activatedAt: jocker.activatedAt, 
        usedAt: nowIso() 
      });
    }

    return setChronoState(participantId, {
      participantId,
      startedAt,
      endsAt,
      completedAt: null,
      durationHours: effectiveDuration,
      jockerUsed: Boolean(jocker?.active)
    });
  }

  function activateJocker(participantId) {
    const chrono = completeChronoIfExpired(participantId);
    if (chrono?.startedAt) {
      throw new Error('Le jocker doit être activé avant de lancer le chrono.');
    }

    const existing = getJockerState(participantId);
    if (existing?.active) return existing;
    if (existing?.usedAt) {
      throw new Error('Le jocker a déjà été utilisé pour ce chrono.');
    }

    const state = { active: true, activatedAt: nowIso(), usedAt: null };
    setJockerState(participantId, state);

    addNotification({
      scope: 'participant',
      participantId,
      type: 'jocker_activated',
      title: 'Jocker activé',
      message: 'Tu peux inviter quelqu’un pour t’aider, mais ton chrono passera à 2h.'
    });

    return state;
  }

  function completeChronoIfExpired(participantId) {
    const state = getChronoState(participantId);
    if (!state?.endsAt) return state;

    if (new Date(state.endsAt).getTime() > Date.now()) return state;

    if (!state.completedAt) {
      state.completedAt = nowIso();
      setChronoState(participantId, state);
    }
    return state;
  }

  /* ── PARTICIPANTS ───────────────────────────────────────── */
  function getBaseParticipants() {
    return Array.isArray(window.SD_PARTICIPANTS) ? window.SD_PARTICIPANTS : [];
  }

  function getRegisteredParticipants() { return readList(PARTICIPANTS_KEY); }
  function saveRegisteredParticipants(list) { writeJson(PARTICIPANTS_KEY, list); }

  function getAllParticipants() {
    return [...getBaseParticipants(), ...getRegisteredParticipants()];
  }

  function findParticipantById(id) {
    return getAllParticipants().find(p => p.id === id) || null;
  }

  function findParticipantByEmail(email) {
    const t = normalizeEmail(email);
    return getAllParticipants().find(p => normalizeEmail(p.email) === t) || null;
  }

  function addRegisteredParticipant(p) {
    const list = getRegisteredParticipants();
    list.unshift(p);
    saveRegisteredParticipants(list);
    return p;
  }

  function updateRegisteredParticipant(id, fields) {
    const list = getRegisteredParticipants();
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...fields };
    saveRegisteredParticipants(list);
    return list[idx];
  }

  function deleteRegisteredParticipant(id) {
    const list = getRegisteredParticipants().filter(p => p.id !== id);
    saveRegisteredParticipants(list);
    return true;
  }

  /* ── PAIRINGS ───────────────────────────────────────────── */
  function getPairings() { return readList(PAIRINGS_KEY); }
  function savePairings(list) { writeJson(PAIRINGS_KEY, list); }

  function getPairingForParticipant(pid) {
    return getPairings().find(p => p.active && p.participantIds.includes(pid)) || null;
  }

  function createOrUpdatePairing(participantIds, theme) {
    const ids = Array.from(new Set((participantIds || []).filter(Boolean))).slice(0, 2);
    if (ids.length !== 2) throw new Error('Deux participants sont requis.');

    const pairings = getPairings();
    const ts = nowIso();

    // Désactiver anciens binômes
    pairings.forEach(p => {
      if (p.active && p.participantIds.some(id => ids.includes(id))) {
        p.active = false;
        p.archivedAt = ts;
      }
    });

    const pairing = {
      id: uid('pair'),
      participantIds: ids,
      theme: String(theme || '').trim(),
      active: true,
      createdAt: ts,
      sentAt: ts
    };

    pairings.unshift(pairing);
    savePairings(pairings);

    // Notifications
    ids.forEach(id => {
      addNotification({
        scope: 'participant',
        participantId: id,
        type: 'theme_assigned',
        title: 'Nouveau thème',
        message: `Votre thème commun est : ${pairing.theme}`
      });
    });

    return pairing;
  }

  /* ── RIDDLES ────────────────────────────────────────────── */
  function getRiddles() { return readList(RIDDLES_KEY); }
  function saveRiddles(list) { writeJson(RIDDLES_KEY, list); }

  function getRiddlesForParticipant(pid) {
    return getRiddles().filter(r => r.participantId === pid);
  }

  function createRiddle(payload) {
    const { participantId, question, answer, sendAt } = payload || {};
    if (!participantId || !question || !answer) throw new Error('Champs obligatoires manquants.');

    const sentTime = sendAt && new Date(sendAt).getTime() > Date.now() ? null : nowIso();

    const riddle = {
      id: uid('riddle'),
      participantId,
      question: String(question).trim(),
      answer: String(answer).trim(),
      sendAt: sentTime ? null : sendAt,
      status: sentTime ? 'sent' : 'scheduled',
      createdAt: nowIso(),
      sentAt: sentTime,
      solvedAt: null,
      responses: []
    };

    const list = getRiddles();
    list.unshift(riddle);
    saveRiddles(list);

    if (riddle.status === 'sent') {
      addRiddleDeliveryNotifications(riddle);
    }

    return riddle;
  }

  function addRiddleDeliveryNotifications(riddle) {
    const p = findParticipantById(riddle.participantId);
    addNotification({
      scope: 'participant',
      participantId: riddle.participantId,
      type: 'riddle_sent',
      title: 'Nouvelle énigme',
      message: 'Tu as reçu une nouvelle énigme !'
    });
  }

  function syncScheduledRiddles() {
    const now = Date.now();
    const list = getRiddles();
    let changed = false;

    list.forEach(r => {
      if (r.status === 'scheduled' && r.sendAt && new Date(r.sendAt).getTime() <= now) {
        r.status = 'sent';
        r.sentAt = nowIso();
        changed = true;
        addRiddleDeliveryNotifications(r);
      }
    });

    if (changed) saveRiddles(list);
    return changed;
  }

  function answerRiddle(riddleId, participantId, responseText) {
    const list = getRiddles();
    const riddle = list.find(r => r.id === riddleId && r.participantId === participantId);
    if (!riddle) throw new Error('Énigme introuvable.');

    const respondedAt = nowIso();
    const isCorrect = normalizeText(riddle.answer) === normalizeText(responseText);
    const durationMs = Math.max(0, new Date(respondedAt).getTime() - new Date(riddle.sentAt || riddle.createdAt).getTime());

    const attempt = {
      id: uid('attempt'),
      text: String(responseText).trim(),
      isCorrect,
      respondedAt,
      durationMs
    };

    riddle.responses = riddle.responses || [];
    riddle.responses.unshift(attempt);
    riddle.lastResponseAt = respondedAt;
    riddle.lastResponseIsCorrect = isCorrect;

    if (isCorrect) {
      riddle.status = 'solved';
      riddle.solvedAt = respondedAt;
    }

    saveRiddles(list);
    return { isCorrect, message: isCorrect ? 'Bonne réponse !' : 'Réponse incorrecte.' };
  }

  /* ── NOTIFICATIONS ─────────────────────────────────────── */
  function getNotifications(options = {}) {
    const { scope, participantId } = options;
    return readList(NOTIFICATIONS_KEY).filter(n => {
      if (scope && n.scope !== scope) return false;
      if (participantId && n.participantId !== participantId) return false;
      return true;
    });
  }

  function addNotification(notif) {
    const list = readList(NOTIFICATIONS_KEY);
    const entry = { id: uid('notif'), createdAt: nowIso(), readAt: null, ...notif };
    list.unshift(entry);
    writeJson(NOTIFICATIONS_KEY, list);
    return entry;
  }

  /* ── STATS ─────────────────────────────────────────────── */
  function getDashboardCounts() {
    return {
      participants: getAllParticipants().length,
      pairings: getPairings().filter(p => p.active).length,
      riddles: getRiddles().length,
      notifications: getNotifications({ scope: 'admin' }).length
    };
  }

  /* ── API PUBLIQUE ──────────────────────────────────────── */
  window.SDStorage = {
    getSession: () => readJson(SESSION_KEY),
    setSession: (s) => writeJson(SESSION_KEY, s),
    clearSession: () => localStorage.removeItem(SESSION_KEY),

    getAllParticipants,
    addRegisteredParticipant,
    updateRegisteredParticipant,
    deleteRegisteredParticipant,
    findParticipantById,
    findParticipantByEmail,
    normalizeEmail,
    normalizePhone,
    buildPasswordFromPhone,
    participantFullName,

    getChronoState,
    startParticipantChrono,
    completeChronoIfExpired,
    activateJocker,
    getJockerState,

    getPairings,
    getActivePairings: () => getPairings().filter(p => p.active),
    getPairingForParticipant,
    createOrUpdatePairing,

    getRiddles,
    getRiddlesForParticipant,
    createRiddle,
    answerRiddle,
    syncScheduledRiddles,

    getNotifications,
    addNotification,
    getDashboardCounts
  };
})();