// lib/db-services.ts
import { connectToDatabase } from '@/lib/mongodb';
import fs from 'fs/promises';
import path from 'path';

/**
 * Estrutura de dados do dump: 
 * Chave é o nome da coleção, valor é o array de documentos daquela coleção.
 */
type DatabaseDump = Record<string, unknown[]>;

/**
 * Exporta todas as coleções do banco de dados atual para um arquivo JSON.
 * Útil para backups manuais ou migração de ambiente.
 * 
 * @param outputDir - Diretório onde o arquivo será salvo (padrão: './dumps')
 * @param fileName - Nome opcional do arquivo. Se não fornecido, gera um com timestamp.
 * @returns Caminho completo do arquivo gerado.
 */
export async function dumpDatabase(
  outputDir: string = './dumps',
  fileName?: string
): Promise<string> {
  try {
    // 1. Conexão com o banco
    const conn = await connectToDatabase();
    const db = conn.db;

    if (!db) {
      throw new Error('Instância do banco de dados não disponível.');
    }

    // 2. Listar todas as coleções
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    const dumpData: DatabaseDump = {};

    console.log(`🚀 Iniciando dump de ${collectionNames.length} coleções...`);

    for (const name of collectionNames) {
      // Ignora coleções internas do MongoDB (sistema)
      if (name.startsWith('system.')) continue;

      // Busca todos os documentos da coleção
      const collection = db.collection(name);
      const documents = await collection.find({}).toArray();
      
      dumpData[name] = documents;
      console.log(` ✅ Coleção [${name}] exportada: ${documents.length} documentos.`);
    }

    // 3. Gerenciamento de Arquivos
    await fs.mkdir(outputDir, { recursive: true });

    if (!fileName) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      fileName = `dump-${timestamp}.json`;
    }

    const filePath = path.join(outputDir, fileName);

    // 4. Escrita do arquivo (utilizando null, 2 para deixar o JSON legível)
    await fs.writeFile(filePath, JSON.stringify(dumpData, null, 2), 'utf-8');

    console.log(`\n✨ Dump concluído com sucesso!`);
    console.log(`📁 Arquivo salvo em: ${filePath}`);
    
    return filePath;
  } catch (error) {
    console.error('❌ Erro crítico durante o dumpDatabase:', error);
    throw error;
  }
}

/**
 * Restaura dados a partir de um dump JSON.
 * ATENÇÃO: Esta operação limpa as coleções existentes antes de inserir os dados do dump.
 * 
 * @param filePath - Caminho para o arquivo JSON de dump.
 */
export async function restoreDatabase(filePath: string): Promise<void> {
  try {
    // 1. Conexão
    const conn = await connectToDatabase();
    const db = conn.db;

    if (!db) {
      throw new Error('Instância do banco de dados não disponível.');
    }

    // 2. Leitura do arquivo
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const dumpData: DatabaseDump = JSON.parse(fileContent);

    console.log(`🚀 Iniciando restauração a partir de: ${filePath}`);

    for (const [collectionName, documents] of Object.entries(dumpData)) {
      if (!documents || documents.length === 0) {
        console.log(` ⚠️ Coleção [${collectionName}] vazia. Pulando...`);
        continue;
      }

      const collection = db.collection(collectionName);

      // 3. Limpeza e Inserção
      // Removemos os dados atuais para evitar duplicatas de ID
      await collection.deleteMany({});
      await collection.insertMany(documents as any[]);
      
      console.log(` ✅ Coleção [${collectionName}] restaurada: ${documents.length} documentos.`);
    }

    console.log(`\n✨ Restauração concluída com sucesso!`);
  } catch (error) {
    console.error('❌ Erro crítico durante o restoreDatabase:', error);
    throw error;
  }
}
