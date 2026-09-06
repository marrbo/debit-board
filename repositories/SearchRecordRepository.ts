// repositories/SearchRecordRepository.ts
import { BaseRepository } from './BaseRepository';
import type { ISearchRecord } from '@/models/SearchRecord';
import { SearchRecord }  from '@/models/SearchRecord';

class SearchRecordRepository extends BaseRepository<ISearchRecord> {
  constructor() {
    super(SearchRecord);
  }
}

// Exporta uma instância única (Singleton pattern)
const searchRecordRepository = new SearchRecordRepository();

export default searchRecordRepository;