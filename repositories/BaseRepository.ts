// repositories/BaseRepository.ts
import { Model, Document } from 'mongoose';

// Tipos robustos que funcionam em qualquer versão do Mongoose (v5 ao v8)
export type Filter<T> = Record<keyof T, any> | Record<string, any>;
export type Update<T> = Partial<T> | Record<string, any>;

export class BaseRepository<T extends Document> {
  protected model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  async findAll(filter: Filter<T> = {}): Promise<T[]> {
    return this.model.find(filter).lean().exec() as unknown as T[];
  }

  async findById(id: string): Promise<T | null> {
    return this.model.findById(id).lean().exec() as unknown as T | null;
  }

  async findOne(filter: Filter<T>): Promise<T | null> {
    return this.model.findOne(filter).lean().exec() as unknown as T | null;
  }

  async create(data: Partial<T>): Promise<T> {
    const doc = new this.model(data);
    await doc.save();
    return doc.toObject() as T;
  }

  async update(id: string, data: Update<T>): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true }).lean().exec() as unknown as T | null;
  }

  async delete(id: string): Promise<T | null> {
    return this.model.findByIdAndDelete(id).lean().exec() as unknown as T | null;
  }

  async findByFilter(filter: Filter<T>, options: Record<string, any> = {}): Promise<T[]> {
    return this.model.find(filter, null, options).lean().exec() as unknown as T[];
  }
}