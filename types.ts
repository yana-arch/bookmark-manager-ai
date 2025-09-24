
export interface Bookmark {
  id: string;
  type: 'bookmark';
  title: string;
  url: string;
  addDate?: string;
  icon?: string;
  tags: string[];
}

export interface BookmarkFolder {
  id: string;
  type: 'folder';
  name: string;
  children: BookmarkNode[];
  addDate?: string;
  lastModified?: string;
}

export type BookmarkNode = Bookmark | BookmarkFolder;

export enum ViewMode {
  Tree = 'tree',
  Grid = 'grid',
  List = 'list',
}
