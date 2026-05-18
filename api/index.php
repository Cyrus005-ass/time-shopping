<?php
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

$origin = isset($_SERVER['HTTP_ORIGIN']) ? trim((string) $_SERVER['HTTP_ORIGIN']) : '';
if ($origin !== '') {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    exit;
}

$raw = file_get_contents('php://input');
$body = array();
if ($raw) {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $body = $decoded;
    }
}

$action = trim((string) ($_GET['action'] ?? ''));

try {
    switch ($action) {
        case 'admin_login':
            handle_admin_login($body);
            break;
        case 'admin_logout':
            handle_admin_logout();
            break;
        case 'admin_session':
            handle_admin_session();
            break;

        case 'participant_login':
            handle_participant_login($body);
            break;
        case 'participant_logout':
            handle_participant_logout();
            break;
        case 'participant_session':
            handle_participant_session();
            break;

        case 'get_participants':
            handle_get_participants();
            break;
        case 'create_participant':
            handle_create_participant($body);
            break;
        case 'update_participant':
            handle_update_participant($body);
            break;
        case 'delete_participant':
            handle_delete_participant($body);
            break;

        case 'get_chrono':
            handle_get_chrono($body);
            break;
        case 'start_chrono':
            handle_start_chrono($body);
            break;
        case 'activate_jocker':
            handle_activate_jocker($body);
            break;
        case 'get_jocker':
            handle_get_jocker($body);
            break;
        case 'sync_scheduled':
            handle_sync_scheduled();
            break;

        case 'get_pairings':
            handle_get_pairings($body);
            break;
        case 'create_pairing':
            handle_create_pairing($body);
            break;

        case 'get_riddles':
            handle_get_riddles($body);
            break;
        case 'create_riddle':
            handle_create_riddle($body);
            break;
        case 'answer_riddle':
            handle_answer_riddle($body);
            break;

        case 'get_notifications':
            handle_get_notifications($body);
            break;

        case 'dashboard_counts':
            handle_dashboard_counts();
            break;

        default:
            fail('Action inconnue.', 404);
    }
} catch (Throwable $e) {
    error_log(sprintf('[shopping-date][%s] %s in %s:%d', APP_ENV, $e->getMessage(), $e->getFile(), $e->getLine()));
    fail(APP_DEBUG ? $e->getMessage() : 'Une erreur interne est survenue.', 500);
}

function ok($data = null)
{
    echo json_encode(array(
        'ok' => true,
        'data' => $data,
    ));
    exit;
}

function fail($message, $status = 400)
{
    http_response_code($status);
    echo json_encode(array(
        'ok' => false,
        'error' => $message,
    ));
    exit;
}

function read_active_session($key, $ttl)
{
    if (empty($_SESSION[$key]) || !is_array($_SESSION[$key])) {
        return null;
    }

    $session = $_SESSION[$key];
    $loginAt = isset($session['loginAt']) ? strtotime((string) $session['loginAt']) : false;

    if ($loginAt !== false && (time() - $loginAt) > $ttl) {
        unset($_SESSION[$key]);
        return null;
    }

    return $session;
}

function admin_session_or_null()
{
    return read_active_session('admin', ADMIN_SESSION_TTL);
}

function participant_session_or_null()
{
    return read_active_session('participant', PARTICIPANT_SESSION_TTL);
}

function db_datetime_to_iso($value)
{
    $value = trim((string) $value);
    if ($value === '') {
        return null;
    }

    $dt = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $value, new DateTimeZone('UTC'));
    if ($dt instanceof DateTimeImmutable) {
        return $dt->format('Y-m-d\TH:i:s\Z');
    }

    $timestamp = strtotime($value);
    if ($timestamp === false) {
        return $value;
    }

    return gmdate('Y-m-d\TH:i:s\Z', $timestamp);
}

function require_admin()
{
    $session = admin_session_or_null();
    if (!$session) {
        fail('Non authentifie.', 401);
    }
    return $session;
}

function require_participant()
{
    $session = participant_session_or_null();
    if (!$session) {
        fail('Non authentifie.', 401);
    }
    return $session;
}

function require_participant_access($participantId)
{
    $participantId = trim((string) $participantId);
    if ($participantId === '') {
        fail('participant_id manquant.');
    }

    $adminSession = admin_session_or_null();
    if ($adminSession) {
        return $participantId;
    }

    $participantSession = require_participant();
    if (($participantSession['id'] ?? '') !== $participantId) {
        fail('Acces refuse.', 403);
    }

    return $participantId;
}

function map_participant($row)
{
    if (!$row) {
        return null;
    }

    return array(
        'id' => $row['id'],
        'nom' => $row['nom'],
        'prenom' => $row['prenom'],
        'email' => $row['email'],
        'password' => $row['password'],
        'telephone' => $row['telephone'],
        'sexe' => $row['sexe'],
        'source' => $row['source'],
        'createdAt' => db_datetime_to_iso($row['created_at']),
    );
}

function map_chrono($row)
{
    if (!$row) {
        return null;
    }

    return array(
        'participantId' => $row['participant_id'],
        'startedAt' => db_datetime_to_iso($row['started_at']),
        'endsAt' => db_datetime_to_iso($row['ends_at']),
        'completedAt' => db_datetime_to_iso($row['completed_at']),
        'durationHours' => (int) $row['duration_hours'],
        'jockerUsed' => (bool) $row['jocker_used'],
    );
}

function map_jocker($row)
{
    if (!$row) {
        return null;
    }

    return array(
        'active' => (bool) $row['active'],
        'activatedAt' => db_datetime_to_iso($row['activated_at']),
        'usedAt' => db_datetime_to_iso($row['used_at']),
    );
}

function map_pairing($row)
{
    return array(
        'id' => $row['id'],
        'participantIds' => array($row['participant_id_a'], $row['participant_id_b']),
        'theme' => $row['theme'],
        'active' => (bool) $row['active'],
        'createdAt' => db_datetime_to_iso($row['created_at']),
        'sentAt' => db_datetime_to_iso($row['sent_at']),
        'archivedAt' => db_datetime_to_iso($row['archived_at']),
        'nameA' => trim(((string) ($row['prenom_a'] ?? '')) . ' ' . ((string) ($row['nom_a'] ?? ''))),
        'nameB' => trim(((string) ($row['prenom_b'] ?? '')) . ' ' . ((string) ($row['nom_b'] ?? ''))),
    );
}

function map_notification($row)
{
    return array(
        'id' => $row['id'],
        'scope' => $row['scope'],
        'participantId' => $row['participant_id'],
        'type' => $row['type'],
        'title' => $row['title'],
        'message' => $row['message'],
        'readAt' => db_datetime_to_iso($row['read_at']),
        'createdAt' => db_datetime_to_iso($row['created_at']),
    );
}

function fetch_participant_by_id($participantId)
{
    $stmt = db()->prepare('SELECT * FROM participants WHERE id = ?');
    $stmt->execute(array($participantId));
    return $stmt->fetch() ?: null;
}

function fetch_chrono_row($participantId)
{
    $stmt = db()->prepare('SELECT * FROM chronos WHERE participant_id = ?');
    $stmt->execute(array($participantId));
    return $stmt->fetch() ?: null;
}

function fetch_chrono($participantId)
{
    $row = fetch_chrono_row($participantId);
    if (!$row) {
        return null;
    }

    if (!empty($row['ends_at']) && empty($row['completed_at']) && strtotime($row['ends_at']) <= time()) {
        db()->prepare('UPDATE chronos SET completed_at = NOW() WHERE participant_id = ?')->execute(array($participantId));
        $row['completed_at'] = gmdate('Y-m-d H:i:s');
    }

    return map_chrono($row);
}

function fetch_jocker($participantId)
{
    $stmt = db()->prepare('SELECT * FROM jockers WHERE participant_id = ?');
    $stmt->execute(array($participantId));
    $row = $stmt->fetch() ?: null;
    return map_jocker($row);
}

function add_notification($notification)
{
    db()->prepare(
        'INSERT INTO notifications (id, scope, participant_id, type, title, message, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, NOW())'
    )->execute(array(
        uid('notif'),
        $notification['scope'] ?? 'participant',
        $notification['participant_id'] ?? null,
        $notification['type'] ?? 'info',
        $notification['title'] ?? '',
        $notification['message'] ?? '',
    ));
}

function add_riddle_delivery_notification($riddleId, $participantId)
{
    add_notification(array(
        'scope' => 'participant',
        'participant_id' => $participantId,
        'type' => 'riddle_sent',
        'title' => 'Nouvelle enigme',
        'message' => 'Tu as recu une nouvelle enigme !',
    ));
}

function release_first_pending_riddle($participantId)
{
    $stmt = db()->prepare("SELECT id FROM riddles WHERE participant_id = ? AND status NOT IN ('sent', 'solved') ORDER BY slot_index ASC, created_at ASC LIMIT 1");
    $stmt->execute(array($participantId));
    $row = $stmt->fetch();
    if (!$row) {
        return;
    }

    db()->prepare("UPDATE riddles SET status = 'sent', sent_at = NOW(), send_at = NULL WHERE id = ?")->execute(array($row['id']));
    add_riddle_delivery_notification($row['id'], $participantId);
}

function sync_scheduled_riddles()
{
    $rows = db()->query("SELECT id, participant_id FROM riddles WHERE status = 'scheduled' AND send_at IS NOT NULL AND send_at <= NOW()")->fetchAll();
    if (!$rows) {
        return false;
    }

    foreach ($rows as $row) {
        db()->prepare("UPDATE riddles SET status = 'sent', sent_at = NOW(), send_at = NULL WHERE id = ?")->execute(array($row['id']));
        add_riddle_delivery_notification($row['id'], $row['participant_id']);
    }

    return true;
}

function build_riddles_with_responses($rows)
{
    $grouped = array();

    foreach ($rows as $row) {
        $riddleId = $row['id'];

        if (!isset($grouped[$riddleId])) {
            $grouped[$riddleId] = array(
                'id' => $row['id'],
                'participantId' => $row['participant_id'],
                'slotIndex' => (int) $row['slot_index'],
                'question' => $row['question'],
                'answer' => $row['answer'],
                'status' => $row['status'],
                'sendAt' => db_datetime_to_iso($row['send_at']),
                'createdAt' => db_datetime_to_iso($row['created_at']),
                'sentAt' => db_datetime_to_iso($row['sent_at']),
                'solvedAt' => db_datetime_to_iso($row['solved_at']),
                'lastResponseAt' => db_datetime_to_iso($row['last_response_at']),
                'lastResponseIsCorrect' => $row['last_response_is_correct'] === null ? null : (bool) $row['last_response_is_correct'],
                'lastResponseText' => $row['last_response_text'],
                'responses' => array(),
            );
        }

        if (!empty($row['response_id'])) {
            $grouped[$riddleId]['responses'][] = array(
                'id' => $row['response_id'],
                'text' => $row['response_text'],
                'isCorrect' => (bool) $row['response_is_correct'],
                'respondedAt' => db_datetime_to_iso($row['responded_at']),
                'durationMs' => (int) $row['duration_ms'],
            );
        }
    }

    return array_values($grouped);
}

function handle_admin_login($body)
{
    $email = normalize_email($body['email'] ?? '');
    $password = trim((string) ($body['password'] ?? ''));

    if ($email === '' || $password === '') {
        fail('Champs obligatoires manquants.');
    }

    $stmt = db()->prepare('SELECT * FROM admin_accounts WHERE email = ? LIMIT 1');
    $stmt->execute(array($email));
    $account = $stmt->fetch();

    if (!$account || $account['password'] !== $password) {
        fail('Identifiants administrateur incorrects.', 401);
    }

    session_regenerate_id(true);

    $_SESSION['admin'] = array(
        'role' => 'admin',
        'email' => $account['email'],
        'fullName' => $account['full_name'],
        'loginAt' => now_iso(),
    );

    ok($_SESSION['admin']);
}

function handle_admin_logout()
{
    unset($_SESSION['admin']);
    ok(array('loggedOut' => true));
}

function handle_admin_session()
{
    ok(admin_session_or_null());
}

function handle_participant_login($body)
{
    $email = normalize_email($body['email'] ?? '');
    $password = trim((string) ($body['password'] ?? ''));

    if ($email === '' || $password === '') {
        fail('Champs obligatoires manquants.');
    }

    $stmt = db()->prepare('SELECT * FROM participants WHERE email = ? LIMIT 1');
    $stmt->execute(array($email));
    $participant = $stmt->fetch();

    if (!$participant) {
        fail('Email introuvable dans la liste des candidats. Verifie que le compte a bien ete cree.', 404);
    }

    $expectedPassword = trim((string) ($participant['password'] ?? ''));
    if ($expectedPassword === '') {
        $expectedPassword = build_password_from_phone($participant['telephone'] ?? '');
    }

    if ($expectedPassword === '') {
        fail("Ce compte n'a pas de mot de passe configure. Contacte la production.", 400);
    }

    if ($password !== $expectedPassword) {
        fail('Mot de passe incorrect.', 401);
    }

    session_regenerate_id(true);

    $_SESSION['participant'] = array(
        'role' => 'participant',
        'id' => $participant['id'],
        'email' => $participant['email'],
        'nom' => $participant['nom'],
        'prenom' => $participant['prenom'],
        'sexe' => $participant['sexe'],
        'source' => $participant['source'],
        'fullName' => participant_full_name($participant),
        'loginAt' => now_iso(),
    );

    ok($_SESSION['participant']);
}

function handle_participant_logout()
{
    unset($_SESSION['participant']);
    ok(array('loggedOut' => true));
}

function handle_participant_session()
{
    ok(participant_session_or_null());
}

function handle_get_participants()
{
    require_admin();
    $rows = db()->query('SELECT * FROM participants ORDER BY created_at DESC')->fetchAll();
    ok(array_map('map_participant', $rows));
}

function handle_create_participant($body)
{
    require_admin();

    $nom = trim((string) ($body['nom'] ?? ''));
    $prenom = trim((string) ($body['prenom'] ?? ''));
    $email = normalize_email($body['email'] ?? '');
    $password = trim((string) ($body['password'] ?? ''));
    $telephone = trim((string) ($body['telephone'] ?? ''));

    if ($nom === '' || $prenom === '' || $email === '' || $password === '' || $telephone === '') {
        fail('Tous les champs sont obligatoires.');
    }

    if (strlen($password) < 4) {
        fail('Le mot de passe doit contenir au moins 4 caracteres.');
    }

    $check = db()->prepare('SELECT id FROM participants WHERE email = ? LIMIT 1');
    $check->execute(array($email));
    if ($check->fetch()) {
        fail('Cet email existe deja.');
    }

    $participantId = uid('a');
    db()->prepare('INSERT INTO participants (id, nom, prenom, email, password, telephone, sexe, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())')->execute(array(
        $participantId,
        $nom,
        $prenom,
        $email,
        $password,
        $telephone,
        'non renseigne',
        'admin',
    ));

    ok(map_participant(fetch_participant_by_id($participantId)));
}

function handle_update_participant($body)
{
    require_admin();

    $participantId = trim((string) ($body['id'] ?? ''));
    $nom = trim((string) ($body['nom'] ?? ''));
    $prenom = trim((string) ($body['prenom'] ?? ''));
    $email = normalize_email($body['email'] ?? '');
    $password = trim((string) ($body['password'] ?? ''));
    $telephone = trim((string) ($body['telephone'] ?? ''));

    if ($participantId === '' || $nom === '' || $prenom === '' || $email === '' || $password === '' || $telephone === '') {
        fail('Tous les champs doivent etre remplis.');
    }

    if (strlen($password) < 4) {
        fail('Le mot de passe doit contenir au moins 4 caracteres.');
    }

    $participant = fetch_participant_by_id($participantId);
    if (!$participant) {
        fail('Profil introuvable.', 404);
    }

    if (($participant['source'] ?? '') !== 'admin') {
        fail('Ce profil est en lecture seule.', 403);
    }

    $check = db()->prepare('SELECT id FROM participants WHERE email = ? AND id != ? LIMIT 1');
    $check->execute(array($email, $participantId));
    if ($check->fetch()) {
        fail('Cet email existe deja.');
    }

    db()->prepare('UPDATE participants SET nom = ?, prenom = ?, email = ?, password = ?, telephone = ? WHERE id = ?')->execute(array(
        $nom,
        $prenom,
        $email,
        $password,
        $telephone,
        $participantId,
    ));

    ok(map_participant(fetch_participant_by_id($participantId)));
}

function handle_delete_participant($body)
{
    require_admin();

    $participantId = trim((string) ($body['id'] ?? ''));
    if ($participantId === '') {
        fail('ID manquant.');
    }

    $participant = fetch_participant_by_id($participantId);
    if (!$participant) {
        fail('Profil introuvable.', 404);
    }

    if (($participant['source'] ?? '') !== 'admin') {
        fail('Ce profil est en lecture seule.', 403);
    }

    db()->prepare('DELETE FROM participants WHERE id = ?')->execute(array($participantId));
    ok(array('deleted' => true));
}

function handle_get_chrono($body)
{
    $participantId = trim((string) ($body['participant_id'] ?? $_GET['participant_id'] ?? ''));
    if ($participantId === '') {
        $session = require_participant();
        $participantId = $session['id'];
    }

    require_participant_access($participantId);
    ok(fetch_chrono($participantId));
}

function handle_start_chrono($body)
{
    $participantId = trim((string) ($body['participant_id'] ?? ''));
    require_participant_access($participantId);

    $existing = fetch_chrono($participantId);
    if ($existing && !empty($existing['startedAt']) && !empty($existing['endsAt'])) {
        ok($existing);
    }

    $baseDuration = isset($body['durationHours']) ? max(1, (int) $body['durationHours']) : DEFAULT_CHRONO_HOURS;
    $duration = $baseDuration;
    $jockerUsed = false;

    $jocker = fetch_jocker($participantId);
    if ($jocker && !empty($jocker['active'])) {
        $duration = max(1, $baseDuration - 1);
        $jockerUsed = true;
        db()->prepare('UPDATE jockers SET active = 0, used_at = NOW() WHERE participant_id = ?')->execute(array($participantId));
    }

    $endsAt = gmdate('Y-m-d H:i:s', time() + ($duration * 3600));

    db()->prepare('INSERT INTO chronos (participant_id, started_at, ends_at, completed_at, duration_hours, jocker_used) VALUES (?, NOW(), ?, NULL, ?, ?) ON DUPLICATE KEY UPDATE started_at = NOW(), ends_at = VALUES(ends_at), completed_at = NULL, duration_hours = VALUES(duration_hours), jocker_used = VALUES(jocker_used)')->execute(array(
        $participantId,
        $endsAt,
        $duration,
        $jockerUsed ? 1 : 0,
    ));

    release_first_pending_riddle($participantId);
    ok(fetch_chrono($participantId));
}

function handle_activate_jocker($body)
{
    $participantId = trim((string) ($body['participant_id'] ?? ''));
    require_participant_access($participantId);

    $chrono = fetch_chrono($participantId);
    if ($chrono && !empty($chrono['startedAt'])) {
        fail('Le jocker doit etre active avant de lancer le chrono.');
    }

    $jocker = fetch_jocker($participantId);
    if ($jocker) {
        if (!empty($jocker['active'])) {
            ok($jocker);
        }
        if (!empty($jocker['usedAt'])) {
            fail('Le jocker a deja ete utilise pour ce chrono.');
        }
    }

    db()->prepare('INSERT INTO jockers (participant_id, active, activated_at, used_at) VALUES (?, 1, NOW(), NULL) ON DUPLICATE KEY UPDATE active = 1, activated_at = NOW(), used_at = NULL')->execute(array($participantId));

    add_notification(array(
        'scope' => 'participant',
        'participant_id' => $participantId,
        'type' => 'jocker_activated',
        'title' => 'Jocker active',
        'message' => "Tu peux inviter quelqu'un pour t'aider, mais ton chrono passera a 2h.",
    ));

    ok(fetch_jocker($participantId));
}

function handle_get_jocker($body)
{
    $participantId = trim((string) ($body['participant_id'] ?? $_GET['participant_id'] ?? ''));
    if ($participantId === '') {
        $session = require_participant();
        $participantId = $session['id'];
    }

    require_participant_access($participantId);
    ok(fetch_jocker($participantId));
}

function handle_sync_scheduled()
{
    if (!admin_session_or_null() && !participant_session_or_null()) {
        fail('Non authentifie.', 401);
    }

    ok(array('changed' => sync_scheduled_riddles()));
}

function handle_get_pairings($body)
{
    $participantId = trim((string) ($body['participant_id'] ?? $_GET['participant_id'] ?? ''));

    $sql = "SELECT p.*, a.nom AS nom_a, a.prenom AS prenom_a, b.nom AS nom_b, b.prenom AS prenom_b FROM pairings p LEFT JOIN participants a ON a.id = p.participant_id_a LEFT JOIN participants b ON b.id = p.participant_id_b";
    $params = array();

    if ($participantId !== '') {
        require_participant_access($participantId);
        $sql .= ' WHERE p.active = 1 AND (p.participant_id_a = ? OR p.participant_id_b = ?)';
        $params[] = $participantId;
        $params[] = $participantId;
    } else {
        require_admin();
    }

    $sql .= ' ORDER BY p.created_at DESC';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    ok(array_map('map_pairing', $stmt->fetchAll()));
}

function handle_create_pairing($body)
{
    require_admin();

    $participantIds = array_values(array_unique(array_filter((array) ($body['participantIds'] ?? array()), 'strlen')));
    $theme = trim((string) ($body['theme'] ?? ''));

    if (count($participantIds) !== 2) {
        fail('Deux participants sont requis.');
    }

    if ($theme === '') {
        fail('Le theme est obligatoire.');
    }

    foreach ($participantIds as $participantId) {
        db()->prepare('UPDATE pairings SET active = 0, archived_at = NOW() WHERE active = 1 AND (participant_id_a = ? OR participant_id_b = ?)')->execute(array($participantId, $participantId));
    }

    $pairingId = uid('pair');
    db()->prepare('INSERT INTO pairings (id, participant_id_a, participant_id_b, theme, active, created_at, sent_at, archived_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW(), NULL)')->execute(array(
        $pairingId,
        $participantIds[0],
        $participantIds[1],
        $theme,
    ));

    foreach ($participantIds as $participantId) {
        add_notification(array(
            'scope' => 'participant',
            'participant_id' => $participantId,
            'type' => 'theme_assigned',
            'title' => 'Nouveau theme',
            'message' => 'Votre theme commun est : ' . $theme,
        ));
    }

    $stmt = db()->prepare("SELECT p.*, a.nom AS nom_a, a.prenom AS prenom_a, b.nom AS nom_b, b.prenom AS prenom_b FROM pairings p LEFT JOIN participants a ON a.id = p.participant_id_a LEFT JOIN participants b ON b.id = p.participant_id_b WHERE p.id = ? LIMIT 1");
    $stmt->execute(array($pairingId));
    ok(map_pairing($stmt->fetch()));
}

function handle_get_riddles($body)
{
    $participantId = trim((string) ($body['participant_id'] ?? $_GET['participant_id'] ?? ''));

    if ($participantId !== '') {
        require_participant_access($participantId);
        $stmt = db()->prepare("SELECT r.*, rr.id AS response_id, rr.response_text, rr.is_correct AS response_is_correct, rr.responded_at, rr.duration_ms FROM riddles r LEFT JOIN riddle_responses rr ON rr.riddle_id = r.id WHERE r.participant_id = ? ORDER BY r.slot_index ASC, r.created_at ASC, rr.responded_at DESC");
        $stmt->execute(array($participantId));
    } else {
        require_admin();
        $stmt = db()->query("SELECT r.*, rr.id AS response_id, rr.response_text, rr.is_correct AS response_is_correct, rr.responded_at, rr.duration_ms FROM riddles r LEFT JOIN riddle_responses rr ON rr.riddle_id = r.id ORDER BY r.created_at DESC, rr.responded_at DESC");
    }

    ok(build_riddles_with_responses($stmt->fetchAll()));
}

function handle_create_riddle($body)
{
    require_admin();

    $participantId = trim((string) ($body['participantId'] ?? ''));
    $question = trim((string) ($body['question'] ?? ''));
    $answer = trim((string) ($body['answer'] ?? ''));
    $sendAt = trim((string) ($body['sendAt'] ?? ''));

    if ($participantId === '' || $question === '' || $answer === '') {
        fail('Champs obligatoires manquants.');
    }

    $slotStmt = db()->prepare('SELECT COALESCE(MAX(slot_index), -1) + 1 AS next_slot FROM riddles WHERE participant_id = ?');
    $slotStmt->execute(array($participantId));
    $slotIndex = (int) $slotStmt->fetchColumn();

    $sendTimestamp = $sendAt !== '' ? strtotime($sendAt) : false;
    $isFuture = $sendTimestamp !== false && $sendTimestamp > time();
    $status = $isFuture ? 'scheduled' : 'sent';
    $sendAtValue = $isFuture ? gmdate('Y-m-d H:i:s', $sendTimestamp) : null;
    $sentAtValue = $isFuture ? null : gmdate('Y-m-d H:i:s');

    $riddleId = uid('riddle');
    db()->prepare('INSERT INTO riddles (id, participant_id, slot_index, question, answer, status, send_at, created_at, sent_at, solved_at, last_response_at, last_response_is_correct, last_response_text) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, NULL, NULL, NULL, NULL)')->execute(array(
        $riddleId,
        $participantId,
        $slotIndex,
        $question,
        $answer,
        $status,
        $sendAtValue,
        $sentAtValue,
    ));

    if ($status === 'sent') {
        add_riddle_delivery_notification($riddleId, $participantId);
    }

    $stmt = db()->prepare("SELECT r.*, rr.id AS response_id, rr.response_text, rr.is_correct AS response_is_correct, rr.responded_at, rr.duration_ms FROM riddles r LEFT JOIN riddle_responses rr ON rr.riddle_id = r.id WHERE r.id = ? ORDER BY rr.responded_at DESC");
    $stmt->execute(array($riddleId));
    $riddles = build_riddles_with_responses($stmt->fetchAll());
    ok($riddles ? $riddles[0] : null);
}

function handle_answer_riddle($body)
{
    $riddleId = trim((string) ($body['riddleId'] ?? ''));
    $participantId = trim((string) ($body['participantId'] ?? ''));
    $responseText = trim((string) ($body['responseText'] ?? ''));

    require_participant_access($participantId);

    if ($riddleId === '' || $responseText === '') {
        fail('Donnees manquantes.');
    }

    $stmt = db()->prepare('SELECT * FROM riddles WHERE id = ? AND participant_id = ? LIMIT 1');
    $stmt->execute(array($riddleId, $participantId));
    $riddle = $stmt->fetch();

    if (!$riddle) {
        fail('Enigme introuvable.', 404);
    }

    if (($riddle['status'] ?? '') === 'solved') {
        fail('Cette enigme est deja resolue.');
    }

    if (($riddle['status'] ?? '') === 'scheduled' && !empty($riddle['send_at']) && strtotime($riddle['send_at']) > time()) {
        fail("Cette enigme n'est pas encore disponible.");
    }

    $isCorrect = normalize_text($riddle['answer']) === normalize_text($responseText);
    $referenceTime = $riddle['sent_at'] ?: $riddle['created_at'];
    $durationMs = max(0, (time() - strtotime($referenceTime)) * 1000);

    db()->prepare('INSERT INTO riddle_responses (id, riddle_id, response_text, is_correct, responded_at, duration_ms) VALUES (?, ?, ?, ?, NOW(), ?)')->execute(array(
        uid('attempt'),
        $riddleId,
        $responseText,
        $isCorrect ? 1 : 0,
        $durationMs,
    ));

    db()->prepare('UPDATE riddles SET status = ?, solved_at = ?, last_response_at = NOW(), last_response_is_correct = ?, last_response_text = ? WHERE id = ?')->execute(array(
        $isCorrect ? 'solved' : 'sent',
        $isCorrect ? gmdate('Y-m-d H:i:s') : null,
        $isCorrect ? 1 : 0,
        $responseText,
        $riddleId,
    ));

    $participant = fetch_participant_by_id($participantId);
    $summary = participant_full_name($participant) . ' a repondu : "' . $responseText . '"';

    add_notification(array(
        'scope' => 'admin',
        'participant_id' => $participantId,
        'type' => 'riddle_answered',
        'title' => $isCorrect ? 'Bonne reponse recue' : 'Mauvaise reponse recue',
        'message' => $isCorrect ? ($summary . ' et la reponse est correcte.') : ($summary . ' mais la reponse est incorrecte.'),
    ));

    add_notification(array(
        'scope' => 'participant',
        'participant_id' => $participantId,
        'type' => 'riddle_answered',
        'title' => $isCorrect ? 'Bonne reponse !' : 'Mauvaise reponse',
        'message' => $isCorrect ? 'Ta reponse est correcte. Bravo !' : 'Ta reponse est fausse. Reessaie.',
    ));

    ok(array(
        'isCorrect' => $isCorrect,
        'message' => $isCorrect ? 'Bonne reponse !' : 'Mauvaise reponse. Reessaie.',
    ));
}

function handle_get_notifications($body)
{
    $scope = trim((string) ($body['scope'] ?? $_GET['scope'] ?? ''));
    $participantId = trim((string) ($body['participant_id'] ?? $_GET['participant_id'] ?? ''));

    $sql = 'SELECT * FROM notifications WHERE 1 = 1';
    $params = array();

    if ($scope === 'admin') {
        require_admin();
        $sql .= ' AND scope = ?';
        $params[] = 'admin';
    } elseif ($scope === 'participant') {
        if ($participantId === '') {
            $session = require_participant();
            $participantId = $session['id'];
        }
        require_participant_access($participantId);
        $sql .= ' AND scope = ? AND participant_id = ?';
        $params[] = 'participant';
        $params[] = $participantId;
    } else {
        require_admin();
        if ($participantId !== '') {
            $sql .= ' AND participant_id = ?';
            $params[] = $participantId;
        }
    }

    $sql .= ' ORDER BY created_at DESC LIMIT 200';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    ok(array_map('map_notification', $stmt->fetchAll()));
}

function handle_dashboard_counts()
{
    require_admin();

    $pdo = db();
    ok(array(
        'participants' => (int) $pdo->query('SELECT COUNT(*) FROM participants')->fetchColumn(),
        'pairings' => (int) $pdo->query('SELECT COUNT(*) FROM pairings WHERE active = 1')->fetchColumn(),
        'riddles' => (int) $pdo->query('SELECT COUNT(*) FROM riddles')->fetchColumn(),
        'notifications' => (int) $pdo->query("SELECT COUNT(*) FROM notifications WHERE scope = 'admin'")->fetchColumn(),
    ));
}


