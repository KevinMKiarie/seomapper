import { PageResult } from '../types.js';

export interface AIProvider {
  enrich(pages: PageResult[]): Promise<PageResult[]>;
}
