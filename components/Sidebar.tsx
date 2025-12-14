import React, { useState } from 'react';
import { FileNode, NodeType } from '../types';
import { File, Folder, FolderOpen, Plus, ChevronRight, ChevronDown, Trash2, FilePlus, FolderPlus } from 'lucide-react';

interface SidebarProps {
  nodes: Record<string, FileNode>;
  rootId: string;
  activePageId: string | null;
  onSelectPage: (id: string) => void;
  onCreateNode: (parentId: string, type: NodeType, name: string) => void;
  onDeleteNode: (nodeId: string) => void; // Simplified for demo
}

const TreeNode: React.FC<{
  nodeId: string;
  nodes: Record<string, FileNode>;
  level: number;
  activePageId: string | null;
  onSelectPage: (id: string) => void;
  onCreateNode: (parentId: string, type: NodeType, name: string) => void;
  onDeleteNode: (id: string) => void;
}> = ({ nodeId, nodes, level, activePageId, onSelectPage, onCreateNode, onDeleteNode }) => {
  const node = nodes[nodeId];
  const [isOpen, setIsOpen] = useState(node.isOpen ?? false);
  const [isHovered, setIsHovered] = useState(false);

  if (!node) return null;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === NodeType.FOLDER) {
      setIsOpen(!isOpen);
    } else {
      onSelectPage(node.id);
    }
  };

  const handleAddFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCreateNode(node.id, NodeType.PAGE, "New Page");
    setIsOpen(true);
  };

  const handleAddFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCreateNode(node.id, NodeType.FOLDER, "New Folder");
    setIsOpen(true);
  };

  const isActive = activePageId === node.id;

  return (
    <div className="select-none">
      <div
        className={`flex items-center group py-1 px-2 cursor-pointer text-sm transition-colors ${
          isActive ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-700'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className="mr-1 text-gray-400">
          {node.type === NodeType.FOLDER ? (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
             <div className="w-[14px]" /> // Spacer
          )}
        </span>
        
        <span className="mr-2">
          {node.type === NodeType.FOLDER ? (
            isOpen ? <FolderOpen size={16} className="text-blue-500" /> : <Folder size={16} className="text-blue-500" />
          ) : (
            <File size={16} className="text-gray-500" />
          )}
        </span>

        <span className="flex-1 truncate">{node.name}</span>

        {/* Quick Actions on Hover */}
        {isHovered && (
          <div className="flex items-center gap-1">
             {node.type === NodeType.FOLDER && (
               <>
                 <button onClick={handleAddFile} title="New Page" className="p-1 hover:bg-gray-200 rounded">
                   <FilePlus size={12} />
                 </button>
                 <button onClick={handleAddFolder} title="New Folder" className="p-1 hover:bg-gray-200 rounded">
                   <FolderPlus size={12} />
                 </button>
               </>
             )}
             {node.parentId && ( // Cannot delete root
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }} 
                  className="p-1 hover:bg-red-100 text-red-500 rounded"
                >
                  <Trash2 size={12} />
                </button>
             )}
          </div>
        )}
      </div>

      {node.type === NodeType.FOLDER && isOpen && (
        <div>
          {node.children.map((childId) => (
            <TreeNode
              key={childId}
              nodeId={childId}
              nodes={nodes}
              level={level + 1}
              activePageId={activePageId}
              onSelectPage={onSelectPage}
              onCreateNode={onCreateNode}
              onDeleteNode={onDeleteNode}
            />
          ))}
          {node.children.length === 0 && (
             <div className="text-xs text-gray-400 py-1 pl-8 italic">Empty folder</div>
          )}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ nodes, rootId, activePageId, onSelectPage, onCreateNode, onDeleteNode }) => {
  return (
    <div className="w-64 flex flex-col h-full bg-gray-50 border-r border-gray-200">
      <div className="p-4 border-b border-gray-200 font-semibold text-gray-700 flex items-center justify-between">
        <span>Explorer</span>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <TreeNode
          nodeId={rootId}
          nodes={nodes}
          level={0}
          activePageId={activePageId}
          onSelectPage={onSelectPage}
          onCreateNode={onCreateNode}
          onDeleteNode={onDeleteNode}
        />
      </div>
    </div>
  );
};
