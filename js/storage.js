(() => {
  const API = '/api/index.php';
  let participantsCache = null;
  let participantsCacheAt = 0;
  const PARTICIPANTS_CACHE_TTL = 10000;

  async function call(action, body = null, method = 'POST') {
    const url = new URL(API, window.location.origin);
    url.searchParams.set('action', action);

    const isGet = method === 'GET';
    const options = {
      method,
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    };

    if (!isGet) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body || {});
    }

    const response = await fetch(url.toString(), options);
    const raw = await response.text();
    let payload = null;

    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      throw new Error(`Reponse serveur invalide (${response.status}).`);
    }

    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `Erreur serveur (${response.status}).`);
    }

    return payload.data;
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizePhone(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('229') && digits.length > 10) digits = digits.slice(3);
    return digits;
  }

  function buildPasswordFromPhone(phone) {
    const digits = normalizePhone(phone);
    if (digits.length < 5) return digits;
    return digits.slice(2, 5) + digits.slice(-2);
  }

  function getParticipantLoginPassword(participant) {
    if (!participant) return '';
    const explicit = String(participant.password || '').trim();
    if (explicit) return explicit;
    return buildPasswordFromPhone(participant.telephone);
  }

  function participantFullName(participant) {
    if (!participant) return 'Profil inconnu';
    return `${participant.prenom || ''} ${participant.nom || ''}`.trim();
  }

  async function getAllParticipants(force = false) {
    const now = Date.now();
    if (!force && participantsCache && (now - participantsCacheAt) < PARTICIPANTS_CACHE_TTL) {
      return participantsCache;
    }

    participantsCache = await call('get_participants');
    participantsCacheAt = now;
    return participantsCache;
  }

  function invalidateParticipantsCache() {
    participantsCache = null;
    participantsCacheAt = 0;
  }

  async function findParticipantById(id) {
    const participants = await getAllParticipants();
    return participants.find((participant) => participant.id === id) || null;
  }

  async function findParticipantByEmail(email) {
    const normalized = normalizeEmail(email);
    const participants = await getAllParticipants();
    return participants.find((participant) => normalizeEmail(participant.email) === normalized) || null;
  }

  async function addRegisteredParticipant(participant) {
    const created = await call('create_participant', participant);
    invalidateParticipantsCache();
    return created;
  }

  async function updateRegisteredParticipant(id, fields) {
    const updated = await call('update_participant', { id, ...fields });
    invalidateParticipantsCache();
    return updated;
  }

  async function deleteRegisteredParticipant(id) {
    const result = await call('delete_participant', { id });
    invalidateParticipantsCache();
    return result;
  }

  async function adminLogin(email, password) {
    return call('admin_login', { email, password });
  }

  async function getAdminSession() {
    return call('admin_session', null, 'GET');
  }

  async function setAdminSession() {
    return null;
  }

  async function clearAdminSession() {
    return call('admin_logout', {});
  }

  async function participantLogin(email, password) {
    return call('participant_login', { email, password });
  }

  async function getSession() {
    return call('participant_session', null, 'GET');
  }

  async function setSession() {
    return null;
  }

  async function clearSession() {
    return call('participant_logout', {});
  }

  async function getChronoState(participantId) {
    return call('get_chrono', { participant_id: participantId });
  }

  async function completeChronoIfExpired(participantId) {
    return getChronoState(participantId);
  }

  async function startParticipantChrono(participantId, durationHours = 3) {
    return call('start_chrono', { participant_id: participantId, durationHours });
  }

  async function activateJocker(participantId) {
    return call('activate_jocker', { participant_id: participantId });
  }

  async function getJockerState(participantId) {
    return call('get_jocker', { participant_id: participantId });
  }

  async function getPairings(participantId = '') {
    return call('get_pairings', participantId ? { participant_id: participantId } : {});
  }

  async function getActivePairings() {
    const pairings = await getPairings();
    return pairings.filter((pairing) => pairing.active);
  }

  async function getPairingForParticipant(participantId) {
    const pairings = await getPairings(participantId);
    return pairings.find((pairing) => pairing.active && pairing.participantIds.includes(participantId)) || null;
  }

  async function createOrUpdatePairing(participantIds, theme) {
    return call('create_pairing', { participantIds, theme });
  }

  async function getRiddles() {
    return call('get_riddles', {});
  }

  async function getRiddlesForParticipant(participantId) {
    return call('get_riddles', { participant_id: participantId });
  }

  async function createRiddle(payload) {
    return call('create_riddle', payload);
  }

  async function answerRiddle(riddleId, participantId, responseText) {
    return call('answer_riddle', { riddleId, participantId, responseText });
  }

  async function syncScheduledRiddles() {
    const result = await call('sync_scheduled', {});
    return Boolean(result?.changed);
  }

  async function getNotifications(options = {}) {
    return call('get_notifications', {
      scope: options.scope || '',
      participant_id: options.participantId || ''
    });
  }

  async function addNotification() {
    return null;
  }

  async function getDashboardCounts() {
    return call('dashboard_counts', {});
  }

  window.SDStorage = {
    adminLogin,
    getAdminSession,
    setAdminSession,
    clearAdminSession,

    participantLogin,
    getSession,
    setSession,
    clearSession,

    getAllParticipants,
    addRegisteredParticipant,
    updateRegisteredParticipant,
    deleteRegisteredParticipant,
    findParticipantById,
    findParticipantByEmail,
    normalizeEmail,
    normalizePhone,
    buildPasswordFromPhone,
    getParticipantLoginPassword,
    participantFullName,

    getChronoState,
    startParticipantChrono,
    completeChronoIfExpired,
    activateJocker,
    getJockerState,

    getPairings,
    getActivePairings,
    getPairingForParticipant,
    createOrUpdatePairing,

    getRiddles,
    getRiddlesForParticipant,
    createRiddle,
    answerRiddle,
    syncScheduledRiddles,

    getNotifications,
    addNotification,
    getDashboardCounts,
  };
})();
