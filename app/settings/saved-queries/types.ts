interface SavedQueryItem {
  _id: string;
  name: string;
  queryString: string;
  context: string;
  visibility: 'private' | 'shared' | 'public' | 'temporary';
  createdAt: string;
}