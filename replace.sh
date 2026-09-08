#!/bin/bash

# Substituições de classes text
find . -type f -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" -o -name "*.css" | while read file; do
  sed -i '' 's/text-apple-blue\b/text-brand/g' "$file"
  sed -i '' 's/text-apple-red\b/text-status-error/g' "$file"
  sed -i '' 's/text-apple-green\b/text-status-success/g' "$file"
  sed -i '' 's/text-apple-orange\b/text-status-warning/g' "$file"
  sed -i '' 's/text-apple-yellow\b/text-warning/g' "$file"
  sed -i '' 's/text-apple-label-light\b/text-heading/g' "$file"
  sed -i '' 's/text-apple-label-dark\b/text-heading/g' "$file"
  sed -i '' 's/text-apple-secondary-light\b/text-body/g' "$file"
  sed -i '' 's/text-apple-secondary-dark\b/text-body/g' "$file"
  sed -i '' 's/text-apple-tertiary-light\b/text-muted/g' "$file"
  sed -i '' 's/text-apple-tertiary-dark\b/text-muted/g' "$file"

  # Fundos
  sed -i '' 's/bg-apple-bg-light\b/bg-page/g' "$file"
  sed -i '' 's/bg-apple-bg-dark\b/bg-page/g' "$file"
  sed -i '' 's/bg-apple-card-light\b/bg-surface/g' "$file"
  sed -i '' 's/bg-apple-card-dark\b/bg-surface/g' "$file"

  # Bordas
  sed -i '' 's/border-apple-border-light\b/border-default/g' "$file"
  sed -i '' 's/border-apple-border-dark\b/border-strong/g' "$file"

  # Hovers
  sed -i '' 's/hover:text-apple-blue\b/hover:text-brand/g' "$file"
  sed -i '' 's/focus:ring-apple-blue\b/focus:ring-brand/g' "$file"
done