// scripts/db-tools.ts
import { restoreDatabase } from '../lib/mongodb';
import { dumpDatabase } from './db-services';

async function run() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === '--dump') {
    const outputDir = args[1] || './dumps';
    try {
      await dumpDatabase(outputDir);
      process.exit(0);
    } catch (err) {
      console.error('Dump failed:', err);
      process.exit(1);
    }
  } else if (command === '--restore') {
    const filePath = args[1];
    if (!filePath) {
      console.error('Please provide the file path to restore.');
      process.exit(1);
    }
    try {
      await restoreDatabase(filePath);
      process.exit(0);
    } catch (err) {
      console.error('Restore failed:', err);
      process.exit(1);
    }
  } else {
    console.log(`
Usage:
  npx ts-node scripts/db-tools.ts --dump [outputDir]   # Dump all collections to JSON
  npx ts-node scripts/db-tools.ts --restore <file>     # Restore from JSON file
    `);
  }
}

run();
