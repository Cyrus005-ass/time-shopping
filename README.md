# Shopping Date - Saison 1

Application web de gestion du jeu avec connexion admin/candidat, chrono, enigmes, binomes et notifications, desormais basee sur PHP + MySQL.

## Stack
- Front HTML / CSS / JS
- API JSON en PHP
- Sessions PHP cote serveur
- Base MySQL partagee en production
- Base MySQL locale pour les tests

## Structure
- `/pages/` : interfaces admin et candidat
- `/js/` : logique front reliée a l'API PHP
- `/api/` : endpoints JSON
- `/database/schema.sql` : schema MySQL a importer
- `config.php` : configuration et selection auto local/production

## Base de donnees
`config.php` gere 2 connexions automatiquement :
- `local` : `127.0.0.1` / base `shopping_date` / user `root` / mot de passe vide
- `production` : `sql200.ezyro.com` / base `ezyro_41953495_shopping`

Selection automatique :
- `localhost`, `127.0.0.1`, `::1` ou execution CLI => mode `local`
- tout autre domaine => mode `production`

Si ton hebergement permet les variables d'environnement, tu peux aussi forcer le mode avec `APP_ENV=local` ou `APP_ENV=production`.

## Installation locale
1. Cree une base MySQL locale nommee `shopping_date`.
2. Importe `database/schema.sql`.
3. Place le projet dans un serveur PHP local.
4. Ouvre le site via `http://localhost/...`.

## Installation en production
1. Selectionne la base `ezyro_41953495_shopping` dans phpMyAdmin.
2. Importe `database/schema.sql`.
3. Deploie les fichiers sur l'hebergement PHP.
4. Ouvre le lien distant et l'application utilisera automatiquement la connexion de production.

## Identifiants admin par defaut
- `admin@shoppingdate.local` / `admin2026`
- `admin2@shoppingdate.local` / `admin2026a`
