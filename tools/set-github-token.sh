#!/bin/bash
# Сохраняет GitHub PAT в macOS Keychain для git push.
# Токен вводится скрыто и не попадает в историю команд.
set -euo pipefail
cd "$(dirname "$0")/.."

git config --local credential.helper osxkeychain

read -s -r -p "GitHub token (github_pat_...): " TOKEN
echo
if [ -z "${TOKEN:-}" ]; then
  echo "Пустой токен — отменяю."
  exit 1
fi

printf "protocol=https\nhost=github.com\nusername=sadman12304-max\npassword=%s\n\n" "$TOKEN" \
  | git credential-osxkeychain store
unset TOKEN

echo "Готово: токен сохранён в Keychain. Можно писать агенту «пушь»."
