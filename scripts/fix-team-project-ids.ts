// scripts/fix-team-project-ids.ts
import mongoose from 'mongoose';
import { connectToDatabase } from '../lib/mongodb';
import { Team } from '../models/Team';

async function fixTeamProjectIds() {
  await connectToDatabase();
  console.log('Conectado ao MongoDB...');

  const teams = await Team.find({}).lean();
  console.log(`Encontrados ${teams.length} times.`);

  let updatedTeams = 0;
  let fixedProjects = 0;

  for (const team of teams) {
    const projectIds = team.projectIds || [];
    let hasChanged = false;
    const newProjectIds = projectIds.map((id: any) => {
      if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
        fixedProjects++;
        hasChanged = true;
        return new mongoose.Types.ObjectId(id);
      }
      return id;
    });

    if (hasChanged) {
      await Team.updateOne(
        { _id: team._id },
        { $set: { projectIds: newProjectIds } }
      );
      updatedTeams++;
    }
  }

  console.log(`✅ ${updatedTeams} times atualizados, ${fixedProjects} IDs convertidos para ObjectId.`);
  await mongoose.disconnect();
}

fixTeamProjectIds().catch(console.error);