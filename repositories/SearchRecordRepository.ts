// repositories/SearchRecordRepository.ts
import { BaseRepository } from './BaseRepository';
import { ISearchRecord, SearchRecord } from '@/models/SearchRecord';

class SearchRecordRepository extends BaseRepository<ISearchRecord> {
  constructor() {
    super(SearchRecord);
  }

  // Exemplo de método específico que você pode adicionar futuramente
  // async findByTenant(tenantId: string): Promise<ISearchRecord[]> {
  //   return this.findByFilter({ tenantId });
  // }
}

// Exporta uma instância única (Singleton pattern)
export default new SearchRecordRepository();