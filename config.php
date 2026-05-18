<?php
// Core application configuration with automatic local/production database selection.

function detect_app_env()
{
    $forced = getenv('APP_ENV');
    if (is_string($forced) && $forced !== '') {
        $forced = strtolower(trim($forced));
        if ($forced === 'local' || $forced === 'production') {
            return $forced;
        }
    }

    $host = '';
    if (!empty($_SERVER['HTTP_HOST'])) {
        $host = (string) $_SERVER['HTTP_HOST'];
    } elseif (!empty($_SERVER['SERVER_NAME'])) {
        $host = (string) $_SERVER['SERVER_NAME'];
    }

    $host = strtolower(trim((string) preg_replace('/:\d+$/', '', $host)));

    if ($host === '' && PHP_SAPI === 'cli') {
        return 'local';
    }

    if ($host === 'localhost' || $host === '127.0.0.1' || $host === '::1') {
        return 'local';
    }

    if (strlen($host) > 6 && substr($host, -6) === '.local') {
        return 'local';
    }

    return 'production';
}

function app_db_profiles()
{
    return array(
        'local' => array(
            'host' => '127.0.0.1',
            'name' => 'shopping_date',
            'user' => 'root',
            'pass' => '',
            'charset' => 'utf8mb4',
        ),
        'production' => array(
            'host' => 'sql200.byetcluster.com',
            'name' => 'ezyro_41953495_shopping',
            'user' => 'ezyro_41953495',
            'pass' => '3fc8b033',
            'charset' => 'utf8mb4',
        ),
    );
}

function app_db_config($env = null)
{
    $profiles = app_db_profiles();
    $resolvedEnv = $env ?: detect_app_env();

    if (!isset($profiles[$resolvedEnv])) {
        $resolvedEnv = 'production';
    }

    return $profiles[$resolvedEnv];
}

$appEnv = detect_app_env();
$dbConfig = app_db_config($appEnv);

define('APP_ENV', $appEnv);
define('APP_DEBUG', APP_ENV === 'local');

error_reporting(E_ALL);
ini_set('display_errors', APP_DEBUG ? '1' : '0');
ini_set('log_errors', '1');

define('DB_HOST', $dbConfig['host']);
define('DB_NAME', $dbConfig['name']);
define('DB_USER', $dbConfig['user']);
define('DB_PASS', $dbConfig['pass']);
define('DB_CHARSET', $dbConfig['charset']);

define('ADMIN_SESSION_TTL', 28800);
define('PARTICIPANT_SESSION_TTL', 86400);
define('DEFAULT_CHRONO_HOURS', 3);

if (function_exists('date_default_timezone_set')) {
    date_default_timezone_set('UTC');
}

function db()
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        DB_HOST,
        DB_NAME,
        DB_CHARSET
    );

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, array(
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ));
        $pdo->exec("SET time_zone = '+00:00'");
    } catch (PDOException $e) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array(
            'ok' => false,
            'error' => APP_DEBUG ? $e->getMessage() : 'Connexion base de donnees impossible.',
        ));
        exit;
    }

    return $pdo;
}

function uid($prefix)
{
    return $prefix . '-' . base_convert((string) time(), 10, 36) . '-' . substr(bin2hex(random_bytes(3)), 0, 6);
}

function normalize_email($value)
{
    return strtolower(trim((string) $value));
}

function normalize_phone($value)
{
    $digits = preg_replace('/\D/', '', (string) $value);
    if (substr($digits, 0, 3) === '229' && strlen($digits) > 10) {
        $digits = substr($digits, 3);
    }
    return $digits;
}

function build_password_from_phone($phone)
{
    $digits = normalize_phone($phone);
    if (strlen($digits) < 5) {
        return $digits;
    }
    return substr($digits, 2, 3) . substr($digits, -2);
}

function now_iso()
{
    return gmdate('Y-m-d\\TH:i:s\\Z');
}

function normalize_text($value)
{
    $text = mb_strtolower(trim((string) $value), 'UTF-8');

    if (function_exists('iconv')) {
        $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        if ($converted !== false) {
            $text = $converted;
        }
    }

    return preg_replace('/\s+/', ' ', $text);
}

function participant_full_name($participant)
{
    return trim(((string) ($participant['prenom'] ?? '')) . ' ' . ((string) ($participant['nom'] ?? '')));
}

function session_cookie_is_secure()
{
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        return true;
    }

    return (int) ($_SERVER['SERVER_PORT'] ?? 80) === 443;
}

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params(array(
        'lifetime' => 0,
        'path' => '/',
        'secure' => session_cookie_is_secure(),
        'httponly' => true,
        'samesite' => 'Lax',
    ));
    session_start();
}
