// scripts/clear-data.ts
import { connectToDatabase } from '../lib/mongodb';
import { Observation } from '../models/Issue';
import { Project } from '../models/Project';
import { Team } from '../models/Team';

async function clearData() {
  console.log('🚀 Conectando ao MongoDB...');
  await connectToDatabase();

  console.log('🧹 Limpando coleções...');

  // 1. Observations
  const observationsCount = await Observation.countDocuments();
  await Observation.deleteMany({});
  console.log(`✅ ${observationsCount} observations removidas.`);

  // 2. Projects (Repositories)
  const projectsCount = await Project.countDocuments();
  await Project.deleteMany({});
  console.log(`✅ ${projectsCount} projetos/repositórios removidos.`);

  // 3. Teams (incluindo o Global)
  const teamsCount = await Team.countDocuments();
  await Team.deleteMany({});
  console.log(`✅ ${teamsCount} times removidos.`);

  console.log('🎉 Limpeza concluída com sucesso!');
  process.exit(0);
}

clearData().catch((error) => {
  console.error('❌ Erro durante a limpeza:', error);
  process.exit(1);
});