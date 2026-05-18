-- Shopping Date - MySQL schema
-- Import this file into the database already selected in phpMyAdmin.
-- Production database: ezyro_41953495_shopping
-- Local test database suggestion: shopping_date

CREATE TABLE IF NOT EXISTS admin_accounts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO admin_accounts (email, password, full_name) VALUES
  ('admin@shoppingdate.local', 'admin2026', 'Administrateur Principal'),
  ('admin2@shoppingdate.local', 'admin2026a', 'Administrateur 2');

CREATE TABLE IF NOT EXISTS participants (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  telephone VARCHAR(30) NOT NULL DEFAULT '',
  sexe VARCHAR(30) NOT NULL DEFAULT 'non renseigne',
  source VARCHAR(30) NOT NULL DEFAULT 'admin',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chronos (
  participant_id VARCHAR(64) NOT NULL PRIMARY KEY,
  started_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  completed_at DATETIME DEFAULT NULL,
  duration_hours TINYINT NOT NULL DEFAULT 3,
  jocker_used TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_chronos_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS jockers (
  participant_id VARCHAR(64) NOT NULL PRIMARY KEY,
  active TINYINT(1) NOT NULL DEFAULT 1,
  activated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME DEFAULT NULL,
  CONSTRAINT fk_jockers_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pairings (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  participant_id_a VARCHAR(64) NOT NULL,
  participant_id_b VARCHAR(64) NOT NULL,
  theme VARCHAR(500) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at DATETIME DEFAULT NULL,
  CONSTRAINT fk_pairings_participant_a FOREIGN KEY (participant_id_a) REFERENCES participants(id) ON DELETE CASCADE,
  CONSTRAINT fk_pairings_participant_b FOREIGN KEY (participant_id_b) REFERENCES participants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS riddles (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  participant_id VARCHAR(64) NOT NULL,
  slot_index INT NOT NULL DEFAULT 0,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  status ENUM('scheduled', 'sent', 'solved') NOT NULL DEFAULT 'sent',
  send_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME DEFAULT NULL,
  solved_at DATETIME DEFAULT NULL,
  last_response_at DATETIME DEFAULT NULL,
  last_response_is_correct TINYINT(1) DEFAULT NULL,
  last_response_text TEXT DEFAULT NULL,
  CONSTRAINT fk_riddles_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS riddle_responses (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  riddle_id VARCHAR(64) NOT NULL,
  response_text TEXT NOT NULL,
  is_correct TINYINT(1) NOT NULL DEFAULT 0,
  responded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_riddle_responses_riddle FOREIGN KEY (riddle_id) REFERENCES riddles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  scope ENUM('admin', 'participant') NOT NULL DEFAULT 'participant',
  participant_id VARCHAR(64) DEFAULT NULL,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
