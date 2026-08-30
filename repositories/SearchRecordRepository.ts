// repositories/SearchRecordRepository.ts
import { BaseRepository } from './BaseRepository';
import type { ISearchRecord } from '@/models/SearchRecord';
import { SearchRecord }  from '@/models/SearchRecord';

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