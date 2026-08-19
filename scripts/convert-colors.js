// scripts/convert-colors.js
const fs = require('fs');
const path = require('path');

// Dicionário de substituição (Hexa Apple -> Nova Classe Tailwind)
const replacements = {
  // Fundos
  'bg-apple-card-light': 'bg-apple-card-light',
  'bg-apple-card-dark': 'bg-apple-card-dark',
  'bg-apple-bg-light': 'bg-apple-bg-light',
  'bg-apple-bg-dark': 'bg-apple-bg-dark',

  // Textos
  'text-apple-label-light': 'text-apple-label-light',
  'text-apple-label-dark': 'text-apple-label-dark',
  'text-apple-tertiary-light': 'text-apple-tertiary-light',
  'text-apple-tertiary-dark': 'text-apple-tertiary-dark',
  'text-apple-secondary-light': 'text-apple-secondary-light',
  'text-apple-secondary-dark': 'text-apple-secondary-dark',

  // Bordas e Anéis
  'border-apple-border-light': 'border-apple-border-light',
  'border-apple-border-dark': 'border-apple-border-dark',
  'border-apple-blue': 'border-apple-blue',
  'ring-apple-blue': 'ring-apple-blue',

  // Cores de Ação (Azul, Verde, Vermelho, etc)
  'text-apple-blue': 'text-apple-blue',
  'bg-apple-blue': 'bg-apple-blue',
  'text-apple-green': 'text-apple-green',
  'bg-apple-green': 'bg-apple-green',
  'text-apple-red': 'text-apple-red',
  'text-apple-orange': 'text-apple-orange',
  'bg-apple-orange': 'bg-apple-orange',
  'text-apple-yellow': 'text-apple-yellow',
};

const extensions = ['.tsx', '.ts', '.jsx', '.js', '.css'];
const ignoredDirs = ['node_modules', '.next', '.git', 'dist'];

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!ignoredDirs.includes(file)) {
        results = results.concat(walkDir(fullPath));
      }
    } else {
      if (extensions.includes(path.extname(file))) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

console.log('🚀 Iniciando substituição das cores Apple...');
const files = walkDir(process.cwd());
let filesChanged = 0;

files.forEach((filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  for (const [oldColor, newClass] of Object.entries(replacements)) {
    // Substitui globalmente os hexadecimais pelas novas classes
    content = content.replaceAll(oldColor, newClass);
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    filesChanged++;
    console.log(`✅ Atualizado: ${filePath}`);
  }
});

console.log(`✨ Substituição concluída. ${filesChanged} arquivo(s) foram modificados.`);
console.log('💡 Dica: Execute "npm run dev" e confira se o visual permaneceu fiel ao Apple.');