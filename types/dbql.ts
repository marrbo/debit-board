// @/types/dbql.ts

export interface MongoFilter {
  [key: string]: unknown;
  $and?: MongoFilter[];
  $or?: MongoFilter[];
  $nor?: MongoFilter[];
  $not?: MongoFilter;
}

export type DBQLTerm = {
  key: string;
  value: string;
  isNot: boolean;
};