export enum NodeType {
  FOLDER = 'FOLDER',
  PAGE = 'PAGE'
}

export interface FileNode {
  id: string;
  type: NodeType;
  name: string;
  parentId: string | null;
  children: string[]; // IDs of children
  isOpen?: boolean; // For UI toggle state
}

export interface Document {
  id: string;
  name: string;
  rootNodeId: string;
  createdAt: number;
}

// Editor / Canvas Types

export enum ElementType {
  TEXT = 'TEXT',
  RECTANGLE = 'RECTANGLE',
  CIRCLE = 'CIRCLE',
  PATH = 'PATH', // Free draw
  IMAGE = 'IMAGE',
  CODE = 'CODE',
  EXPANDABLE = 'EXPANDABLE'
}

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: string; // For text, code, or image URL
  points?: { x: number; y: number }[]; // For paths
  style?: {
    strokeColor?: string;
    backgroundColor?: string;
    strokeWidth?: number;
    fontSize?: number;
  };
  isExpanded?: boolean; // For expandable elements
}

export interface PageContent {
  pageId: string;
  elements: CanvasElement[];
}

// Store State
export interface AppState {
  documents: Record<string, Document>;
  fileNodes: Record<string, FileNode>;
  pages: Record<string, PageContent>;
}
