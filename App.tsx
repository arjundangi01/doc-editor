import React, { useState, useEffect } from 'react';
import { loadState, saveState, createDocument, createFileNode, updatePageContent } from './services/store';
import { AppState, Document, NodeType } from './types';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { Layout, Plus, FileText, ArrowLeft, Loader } from 'lucide-react';

import { Moon, Sun } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  
  // New Document Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDocName, setNewDocName] = useState('');

  // Initialization
  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
  }, []);

  // Sync state to storage whenever it changes
  useEffect(() => {
    if (state) {
      saveState(state);
    }
  }, [state]);

  // Dark Mode Effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  if (!state) return (
    <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <Loader className="animate-spin text-blue-500"/>
    </div>
  );

  // Actions
  const handleCreateDoc = () => {
    if (!newDocName.trim()) return;
    const { newState, docId } = createDocument(state, newDocName);
    setState(newState);
    setNewDocName('');
    setIsModalOpen(false);
    
    // Auto open the new doc
    setCurrentDocId(docId);
    // Find the default page (child of root)
    const rootId = newState.documents[docId].rootNodeId;
    const firstPageId = newState.fileNodes[rootId].children[0];
    setActivePageId(firstPageId);
  };

  const handleCreateNode = (parentId: string, type: NodeType, name: string) => {
    const { newState, nodeId } = createFileNode(state, parentId, type, name);
    setState(newState);
    if (type === NodeType.PAGE) {
      setActivePageId(nodeId);
    }
  };

  const handleDeleteNode = (nodeId: string) => {
      // Deep delete logic would go here. For now, simple removal from parent list
      const node = state.fileNodes[nodeId];
      if (!node || !node.parentId) return;
      
      const parent = state.fileNodes[node.parentId];
      const updatedParent = {
          ...parent,
          children: parent.children.filter(id => id !== nodeId)
      };
      
      setState({
          ...state,
          fileNodes: {
              ...state.fileNodes,
              [node.parentId]: updatedParent
          }
      });
      
      if (activePageId === nodeId) setActivePageId(null);
  };

  const handleSavePage = (elements: any[]) => {
    if (!activePageId) return;
    setState(prev => prev ? updatePageContent(prev, activePageId, elements) : null);
  };

  // --- Views ---

  const renderHome = () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center pt-20 transition-colors duration-200">
      <div className="max-w-4xl w-full px-6">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">DocuFlow</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage your documentation with free-style canvas editing.</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-3 rounded-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              <Plus size={20} className="mr-2" /> New Document
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.values(state.documents).map((doc: Document) => (
            <div 
              key={doc.id} 
              onClick={() => {
                setCurrentDocId(doc.id);
                // Open first page
                const root = state.fileNodes[doc.rootNodeId];
                if(root && root.children.length > 0) setActivePageId(root.children[0]);
              }}
              className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md cursor-pointer transition-all hover:border-blue-300 dark:hover:border-blue-500 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                  <FileText size={24} />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{doc.name}</h3>
              <p className="text-xs text-gray-400 mt-2">
                Created {new Date(doc.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
          
          {Object.keys(state.documents).length === 0 && (
            <div className="col-span-full text-center py-20 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
              <p className="text-gray-400 mb-4">No documents found.</p>
              <button onClick={() => setIsModalOpen(true)} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Create your first document</button>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Create New Document</h2>
            <input
              type="text"
              placeholder="Document Name (e.g., Engineering Specs)"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none mb-6"
              value={newDocName}
              onChange={e => setNewDocName(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCreateDoc()}
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateDoc}
                disabled={!newDocName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderWorkspace = () => {
    if (!currentDocId) return null;
    const doc = state.documents[currentDocId];
    
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900">
        {/* Header */}
        <header className="h-12 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 flex-shrink-0 z-30 transition-colors">
          <div className="flex items-center">
            <button 
              onClick={() => { setCurrentDocId(null); setActivePageId(null); }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md mr-3 text-gray-500 dark:text-gray-400"
              title="Back to Home"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 text-white p-1 rounded">
                 <Layout size={16} />
              </div>
              <span className="font-semibold text-gray-700 dark:text-gray-200">{doc.name}</span>
            </div>
          </div>
          <button 
            onClick={toggleTheme}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
             {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            nodes={state.fileNodes}
            rootId={doc.rootNodeId}
            activePageId={activePageId}
            onSelectPage={setActivePageId}
            onCreateNode={handleCreateNode}
            onDeleteNode={handleDeleteNode}
          />
          <main className="flex-1 bg-gray-50 dark:bg-gray-900 relative transition-colors">
            {activePageId ? (
              <Editor
                key={activePageId} // Force remount on page switch
                pageId={activePageId}
                pageName={state.fileNodes[activePageId]?.name || 'Untitled'}
                initialContent={state.pages[activePageId] || { pageId: activePageId, elements: [] }}
                onSave={handleSavePage}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-600 flex-col">
                <Layout size={48} className="mb-4 opacity-20"/>
                <p>Select a page to start editing</p>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  };

  return currentDocId ? renderWorkspace() : renderHome();
};

export default App;