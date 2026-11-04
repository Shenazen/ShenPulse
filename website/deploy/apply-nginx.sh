#!/usr/bin/env bash
# Usage: bash apply-nginx.sh candidate.conf sha256-of-current-config
# Ce script ne redémarre jamais le backend. Retour automatique au fichier
# précédent si la validation ou le rechargement Nginx échoue.
set -euo pipefail
candidate="$(realpath -e "$1")"
expected="$2"
config=/etc/nginx/sites-enabled/shenpulse
case "$candidate" in /var/www/shenpulse/.deploy-staging/*) ;; *) exit 71;; esac
test ! -L "$config"
printf '%s  %s\n' "$expected" "$config" | sha256sum -c -
test -f /var/www/shenpulse/dist/docs/index.html
test -f /var/www/shenpulse/dist/jeux/index.html
test -f /var/www/shenpulse/dist/404.html
backup="/var/www/shenpulse/.public-site-backups/nginx-$(date -u +%Y%m%dT%H%M%SZ).conf"
sudo -n cp -p -- "$config" "$backup"
sudo -n install -m 644 -- "$candidate" "$config"
if ! sudo -n nginx -t; then
  sudo -n cp -p -- "$backup" "$config"
  sudo -n nginx -t
  exit 72
fi
if ! sudo -n systemctl reload nginx; then
  sudo -n cp -p -- "$backup" "$config"
  sudo -n nginx -t && sudo -n systemctl reload nginx
  exit 73
fi
printf 'Nginx rechargé ; sauvegarde : %s\n' "$backup"
sudo -n sha256sum "$config"
