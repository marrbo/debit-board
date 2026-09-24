#!/usr/bin/env bash
# ============================================================
# Migra content/wiki/ da estrutura antiga para a nova.
# Idempotente: pode rodar quantas vezes quiser.
# ============================================================
set -euo pipefail

WIKI_DIR="content/wiki"

if [ ! -d "$WIKI_DIR" ]; then
  echo "✗ Rode da raiz do projeto (content/wiki não encontrado)."
  exit 1
fi

# ---------- Backup ----------
BACKUP="backups/wiki_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP"
cp -R "$WIKI_DIR" "$BACKUP/"
echo "✓ Backup em: $BACKUP"
echo

# ---------- Helpers ----------
move() {
  local src="$WIKI_DIR/$1"
  local dst="$WIKI_DIR/$2"

  if [ ! -e "$src" ]; then
    echo "  · skip  $1  (não existe)"
    return
  fi

  mkdir -p "$(dirname "$dst")"

  if [ -e "$dst" ]; then
    echo "  · skip  $1 → $2  (destino já existe)"
    return
  fi

  mv "$src" "$dst"
  echo "  ✓ $1 → $2"
}

move_dir() {
  local src="$WIKI_DIR/$1"
  local dst="$WIKI_DIR/$2"

  if [ ! -d "$src" ]; then
    echo "  · skip  $1/  (não existe)"
    return
  fi

  mkdir -p "$(dirname "$dst")"

  if [ -e "$dst" ]; then
    echo "  · merge $1/ → $2/"
    # Move conteúdo interno, respeitando o que já existir
    for f in "$src"/*; do
      [ -e "$f" ] || continue
      local base
      base="$(basename "$f")"
      move "$1/$base" "$2/$base"
    done
    rmdir "$src" 2>/dev/null || true
  else
    mv "$src" "$dst"
    echo "  ✓ $1/ → $2/"
  fi
}

# ---------- Cria a árvore destino ----------
mkdir -p \
  "$WIKI_DIR/getting-started" \
  "$WIKI_DIR/user-guide/dbql" \
  "$WIKI_DIR/user-guide/observations" \
  "$WIKI_DIR/user-guide/datatable" \
  "$WIKI_DIR/admin" \
  "$WIKI_DIR/changelog" \
  "$WIKI_DIR/_dev/architecture" \
  "$WIKI_DIR/_dev/dbql-internals" \
  "$WIKI_DIR/_dev/testing" \
  "$WIKI_DIR/_dev/roadmap" \
  "$WIKI_DIR/_dev/adr"

echo "→ getting-started"
move "Getting-Started/Quick-Start.md"  "getting-started/quick-start.md"
# limpa pasta antiga se ficou vazia
rmdir "$WIKI_DIR/Getting-Started" 2>/dev/null || true

echo "→ user-guide/dbql"
move_dir "DBQL" "user-guide/dbql"

echo "→ user-guide/datatable"
move "DataTable/1.Roadmap.md" "user-guide/datatable/1.Roadmap.md"
rmdir "$WIKI_DIR/DataTable" 2>/dev/null || true

echo "→ admin"
move "Admin/setup.md" "admin/setup.md"
rmdir "$WIKI_DIR/Admin" 2>/dev/null || true

echo "→ changelog"
move_dir "Releases" "changelog"

echo "→ _dev/roadmap"
move_dir "Roadmap" "_dev/roadmap"

echo "→ _dev/testing"
move "TestesUnitarios/Setup.md" "_dev/testing/setup.md"
rmdir "$WIKI_DIR/TestesUnitarios" 2>/dev/null || true

echo
echo "✓ Migração concluída."
echo
echo "Estado final:"
find "$WIKI_DIR" -type f -name "*.md" | sort | sed 's|^|  |'