(() => {
  const PREFIX = 'sd_';
  const SESSION_KEY = `${PREFIX}session`;
  const PARTICIPANTS_KEY = `${PREFIX}participants`;
  const PAIRINGS_KEY = `${PREFIX}pairings`;
  const RIDDLES_KEY = `${PREFIX}riddles`;
  const NOTIFICATIONS_KEY = `${PREFIX}notifications`;
  const CHRONO_PREFIX = `${PREFIX}chrono_`;
  const JOCKER_PREFIX = `${PREFIX}jocker_`;

  const ADMIN_ACCOUNTS_KEY = `${PREFIX}admin_accounts`;
  const ADMIN_SESSION_KEY = `${PREFIX}admin_session`;

  const DEFAULT_ADMIN_ACCOUNTS = [
    { email: 'admin@shoppingdate.local', password: 'admin2026', fullName: 'Administrateur Principal' },
    { email: 'admin2@shoppingdate.local', password: 'admin2026a', fullName: 'Administrateur 2' }
  ];

  let localStorageBroken = false;
  let sessionStorageBroken = false;

  function readWindowNameStore() {
    if (typeof window.name !== 'string' || !window.name.trim()) return {};
    try {
      const parsed = JSON.parse(window.name);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeWindowNameStore(store) {
    try {
      window.name = JSON.stringify(store);
      return true;
    } catch {
      return false;
    }
  }

  function readRaw(key) {
    if (!localStorageBroken) {
      try {
        const value = localStorage.getItem(key);
        if (value !== null) return value;
      } catch {
        localStorageBroken = true;
      }
    }

    if (!sessionStorageBroken) {
      try {
        const value = sessionStorage.getItem(key);
        if (value !== null) return value;
      } catch {
        sessionStorageBroken = true;
      }
    }

    const windowNameStore = readWindowNameStore();
    return Object.prototype.hasOwnProperty.call(windowNameStore, key)
      ? windowNameStore[key]
      : null;
  }

  function writeRaw(key, value) {
    let wrote = false;

    if (!localStorageBroken) {
      try {
        localStorage.setItem(key, value);
        wrote = true;
      } catch {
        localStorageBroken = true;
      }
    }

    if (!sessionStorageBroken) {
      try {
        sessionStorage.setItem(key, value);
        wrote = true;
      } catch {
        sessionStorageBroken = true;
      }
    }

    const windowNameStore = readWindowNameStore();
    windowNameStore[key] = value;
    wrote = writeWindowNameStore(windowNameStore) || wrote;

    if (!wrote) {
      throw new Error('Stockage navigateur indisponible.');
    }
  }

  function removeRaw(key) {
    if (!localStorageBroken) {
      try {
        localStorage.removeItem(key);
      } catch {
        localStorageBroken = true;
      }
    }

    if (!sessionStorageBroken) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        sessionStorageBroken = true;
      }
    }

    const windowNameStore = readWindowNameStore();
    if (Object.prototype.hasOwnProperty.call(windowNameStore, key)) {
      delete windowNameStore[key];
      writeWindowNameStore(windowNameStore);
    }
  }

  /* ── UTILS ──────────────────────────────────────────────── */
  function readJson(key) {
    const raw = readRaw(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeJson(key, value) {
    writeRaw(key, JSON.stringify(value));
  }

  function removeJson(key) {
    removeRaw(key);
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

    const state = setChronoState(participantId, {
      participantId,
      startedAt,
      endsAt,
      completedAt: null,
      durationHours: effectiveDuration,
      jockerUsed: Boolean(jocker?.active)
    });

    releaseFirstPendingRiddle(participantId, startedAt);
    return state;
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

  function cleanupParticipantArtifacts(participantId) {
    const pairings = getPairings().filter((pair) => !pair.participantIds.includes(participantId));
    savePairings(pairings);

    const riddles = getRiddles().filter((riddle) => riddle.participantId !== participantId);
    saveRiddles(riddles);

    const notifications = getNotifications().filter((notif) => notif.participantId !== participantId);
    writeJson(NOTIFICATIONS_KEY, notifications);

    removeRaw(chronoKey(participantId));
    removeRaw(jockerKey(participantId));
  }

  function deleteRegisteredParticipant(id) {
    const list = getRegisteredParticipants();
    const next = list.filter((p) => p.id !== id);
    if (next.length === list.length) return false;
    saveRegisteredParticipants(next);
    cleanupParticipantArtifacts(id);
    return true;
  }
  /* ── PAIRINGS ───────────────────────────────────────────── */
  function getPairings() { return readList(PAIRINGS_KEY); }
  function getAdminAccounts() {
    const saved = readList(ADMIN_ACCOUNTS_KEY);
    if (saved.length) return saved;
    writeJson(ADMIN_ACCOUNTS_KEY, DEFAULT_ADMIN_ACCOUNTS);
    return [...DEFAULT_ADMIN_ACCOUNTS];
  }

  function saveAdminAccounts(list) {
    writeJson(ADMIN_ACCOUNTS_KEY, list);
    return list;
  }

  function getAdminSession() {
    return readJson(ADMIN_SESSION_KEY);
  }

  function setAdminSession(session) {
    writeJson(ADMIN_SESSION_KEY, session);
    return session;
  }

  function clearAdminSession() {
    removeRaw(ADMIN_SESSION_KEY);
  }

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

  function sortRiddlesForTimeline(list) {
    return [...list].sort((a, b) => {
      const aSlot = Number.isFinite(Number(a.slotIndex)) ? Number(a.slotIndex) : null;
      const bSlot = Number.isFinite(Number(b.slotIndex)) ? Number(b.slotIndex) : null;

      if (aSlot !== null || bSlot !== null) {
        if (aSlot === null) return 1;
        if (bSlot === null) return -1;
        if (aSlot !== bSlot) return aSlot - bSlot;
      }

      const aTime = new Date(a.createdAt || a.sentAt || 0).getTime();
      const bTime = new Date(b.createdAt || b.sentAt || 0).getTime();
      if (aTime !== bTime) return aTime - bTime;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
  }

  function getRiddlesForParticipant(pid) {
    return sortRiddlesForTimeline(getRiddles().filter(r => r.participantId === pid));
  }

  function releaseFirstPendingRiddle(participantId, releasedAt = nowIso()) {
    const list = getRiddles();
    const ordered = sortRiddlesForTimeline(list.filter((riddle) => riddle.participantId === participantId));
    const target = ordered[0];

    if (!target || target.status === 'sent' || target.status === 'solved') return null;

    const index = list.findIndex((riddle) => riddle.id === target.id);
    if (index === -1) return null;

    const updated = {
      ...list[index],
      status: 'sent',
      sentAt: releasedAt,
      sendAt: null
    };

    list[index] = updated;
    saveRiddles(list);
    addRiddleDeliveryNotifications(updated);
    return updated;
  }

  function createRiddle(payload) {
    const { participantId, question, answer, sendAt } = payload || {};
    if (!participantId || !question || !answer) throw new Error('Champs obligatoires manquants.');
    const slotIndex = getRiddles()
      .filter((riddle) => riddle.participantId === participantId)
      .reduce((max, riddle) => {
        const value = Number(riddle.slotIndex);
        return Number.isFinite(value) ? Math.max(max, value) : max;
      }, -1) + 1;

    const sentTime = sendAt && new Date(sendAt).getTime() > Date.now() ? null : nowIso();

    const riddle = {
      slotIndex,
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
    const riddle = list.find((r) => r.id === riddleId && r.participantId === participantId);
    if (!riddle) throw new Error('Énigme introuvable.');
    if (riddle.status === 'solved') throw new Error('Cette énigme est déjà résolue.');
    if (riddle.status === 'scheduled' && riddle.sendAt && new Date(riddle.sendAt).getTime() > Date.now()) {
      throw new Error("Cette énigme n'est pas encore disponible.");
    }

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
    riddle.lastResponseText = attempt.text;

    if (isCorrect) {
      riddle.status = 'solved';
      riddle.solvedAt = respondedAt;
    } else if (riddle.status !== 'sent') {
      riddle.status = 'sent';
    }

    saveRiddles(list);

    const participant = findParticipantById(participantId);
    const participantName = participantFullName(participant);
    const summary = `${participantName} a répondu : "${attempt.text || 'Réponse vide'}"`;
    const participantMessage = isCorrect
      ? 'Ta réponse est correcte. Bravo !'
      : 'Ta réponse est fausse. Réessaie.';

    addNotification({
      scope: 'admin',
      participantId,
      type: 'riddle_answered',
      title: isCorrect ? 'Bonne réponse reçue' : 'Mauvaise réponse reçue',
      message: isCorrect ? `${summary} et la réponse est correcte.` : `${summary} mais la réponse est incorrecte.`
    });

    addNotification({
      scope: 'participant',
      participantId,
      type: 'riddle_answered',
      title: isCorrect ? 'Bonne réponse !' : 'Mauvaise réponse',
      message: participantMessage
    });

    return { isCorrect, message: isCorrect ? 'Bonne réponse !' : 'Mauvaise réponse. Réessaie.' };
  }

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
    clearSession: () => removeRaw(SESSION_KEY),

    getAdminAccounts,
    saveAdminAccounts,
    getAdminSession,
    setAdminSession,
    clearAdminSession,

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
