import { AppState, Document, FileNode, NodeType, PageContent, CanvasElement } from '../types';

const STORAGE_KEY = 'docuflow_data_v1';

// Initial Empty State
const initialState: AppState = {
  documents: {},
  fileNodes: {},
  pages: {},
};

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const loadState = (): AppState => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return initialState;
    return JSON.parse(serialized);
  } catch (e) {
    console.error("Failed to load state", e);
    return initialState;
  }
};

export const saveState = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state", e);
  }
};

// --- Helper Actions (mimicking DB transactions) ---

export const createDocument = (state: AppState, name: string): { newState: AppState, docId: string } => {
  const docId = generateId();
  const rootId = generateId();
  const pageId = generateId();

  const newDoc: Document = {
    id: docId,
    name,
    rootNodeId: rootId,
    createdAt: Date.now(),
  };

  const rootNode: FileNode = {
    id: rootId,
    type: NodeType.FOLDER,
    name: 'Root',
    parentId: null,
    children: [pageId],
    isOpen: true,
  };

  const initialPage: FileNode = {
    id: pageId,
    type: NodeType.PAGE,
    name: 'Untitled Page',
    parentId: rootId,
    children: [],
  };

  const newPageContent: PageContent = {
    pageId: pageId,
    elements: [],
  };

  const newState = {
    ...state,
    documents: { ...state.documents, [docId]: newDoc },
    fileNodes: {
      ...state.fileNodes,
      [rootId]: rootNode,
      [pageId]: initialPage,
    },
    pages: { ...state.pages, [pageId]: newPageContent },
  };

  return { newState, docId };
};

export const createFileNode = (
  state: AppState, 
  parentId: string, 
  type: NodeType, 
  name: string
): { newState: AppState, nodeId: string } => {
  const nodeId = generateId();
  const newNode: FileNode = {
    id: nodeId,
    type,
    name,
    parentId,
    children: [],
    isOpen: type === NodeType.FOLDER ? true : undefined,
  };

  const parent = state.fileNodes[parentId];
  const updatedParent = {
    ...parent,
    children: [...parent.children, nodeId],
  };

  let newPages = state.pages;
  if (type === NodeType.PAGE) {
    newPages = {
      ...state.pages,
      [nodeId]: { pageId: nodeId, elements: [] }
    };
  }

  const newState = {
    ...state,
    fileNodes: {
      ...state.fileNodes,
      [parentId]: updatedParent,
      [nodeId]: newNode,
    },
    pages: newPages,
  };

  return { newState, nodeId };
};

export const updatePageContent = (
  state: AppState,
  pageId: string,
  elements: CanvasElement[]
): AppState => {
  return {
    ...state,
    pages: {
      ...state.pages,
      [pageId]: { ...state.pages[pageId], elements },
    },
  };
};
