import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { PageContent, CanvasElement, ElementType } from '../types';
import { generateId } from '../services/store';
import { 
  Type, MousePointer2, Square, Circle, Pencil, Image as ImageIcon, 
  Code, Maximize2, Minimize2, GripVertical, Heading1, Heading2, 
  List, Terminal, Eraser, Minus
} from 'lucide-react';

interface EditorProps {
  pageId: string;
  initialContent: PageContent;
  onSave: (elements: CanvasElement[]) => void;
  pageName: string;
}

type Tool = 'SELECT' | 'TEXT' | 'RECT' | 'CIRCLE' | 'DRAW' | 'CODE' | 'EXPANDABLE' | 'ERASER';
type InteractionMode = 'IDLE' | 'CREATING' | 'MOVING' | 'BOX_SELECT' | 'ERASING' | 'RESIZING';

// --- Helper Components ---

const useContentSync = (ref: React.RefObject<HTMLDivElement | null>, content: string | undefined) => {
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== (content || '')) {
      el.innerHTML = content || '';
    }
  }, [content, ref]);
};

const SlashMenu = ({ 
  position, 
  onSelect, 
  onClose 
}: { 
  position: { x: number, y: number }; 
  onSelect: (type: string) => void; 
  onClose: () => void; 
}) => {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  const options = [
    { label: 'Heading 1', type: 'h1', icon: <Heading1 size={16}/> },
    { label: 'Heading 2', type: 'h2', icon: <Heading2 size={16}/> },
    { label: 'Bullet List', type: 'ul', icon: <List size={16}/> },
    { label: 'Code Block', type: 'code', icon: <Terminal size={16}/> },
    { label: 'Divider', type: 'divider', icon: <Minus size={16}/> },
    { label: 'Image', type: 'image', icon: <ImageIcon size={16}/> },
  ];

  return (
    <div 
      className="fixed bg-white shadow-xl border border-gray-200 rounded-lg py-2 z-50 w-48 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: position.x, top: position.y }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Add Element</div>
      {options.map(opt => (
        <button
          key={opt.type}
          className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm text-gray-700"
          onClick={() => onSelect(opt.type)}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
};

const ResizeHandles = ({ 
    isSelected, 
    onResizeStart 
}: { 
    isSelected: boolean, 
    onResizeStart: (e: React.PointerEvent, handle: string) => void 
}) => {
    if (!isSelected) return null;
    
    const handleClasses = "absolute w-2.5 h-2.5 bg-white border border-blue-600 rounded-full z-50 pointer-events-auto hover:bg-blue-100";
    const positions = [
        { id: 'nw', cursor: 'nw-resize', style: { top: -5, left: -5 } },
        { id: 'n', cursor: 'n-resize', style: { top: -5, left: '50%', transform: 'translateX(-50%)' } },
        { id: 'ne', cursor: 'ne-resize', style: { top: -5, right: -5 } },
        { id: 'e', cursor: 'e-resize', style: { top: '50%', right: -5, transform: 'translateY(-50%)' } },
        { id: 'se', cursor: 'se-resize', style: { bottom: -5, right: -5 } },
        { id: 's', cursor: 's-resize', style: { bottom: -5, left: '50%', transform: 'translateX(-50%)' } },
        { id: 'sw', cursor: 'sw-resize', style: { bottom: -5, left: -5 } },
        { id: 'w', cursor: 'w-resize', style: { top: '50%', left: -5, transform: 'translateY(-50%)' } },
    ];

    return (
        <>
            <div className="absolute inset-0 border border-blue-500 pointer-events-none rounded-sm" />
            {positions.map(p => (
                <div
                    key={p.id}
                    className={handleClasses}
                    style={{ ...p.style, cursor: p.cursor }}
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        onResizeStart(e, p.id);
                    }}
                />
            ))}
        </>
    );
};

// --- Extracted Element Components ---

interface BaseElementProps {
  el: CanvasElement;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onUpdate: (id: string, updates: Partial<CanvasElement>) => void;
  onDelete: (id: string) => void;
  registerRef?: (id: string, el: HTMLDivElement | null) => void;
  onResizeStart: (e: React.PointerEvent, id: string, handle: string) => void;
}

const TextElement = memo(({ el, isSelected, onPointerDown, onUpdate, registerRef, onKeyUp, onResizeStart }: BaseElementProps & { onKeyUp: (e: React.KeyboardEvent, id: string) => void }) => {
    const localRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (registerRef) registerRef(el.id, containerRef.current);
    }, [el.id, registerRef]);

    useContentSync(localRef, el.content);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
             const selection = window.getSelection();
             if (!selection || !selection.rangeCount) return;
             const anchorNode = selection.anchorNode;
             const element = (anchorNode?.nodeType === 3 ? anchorNode.parentElement : anchorNode) as HTMLElement;
             const parentBlock = element.closest('h1, h2, h3, h4, h5, h6, pre, blockquote');
             if (parentBlock) {
                 e.preventDefault();
                 document.execCommand('insertParagraph');
                 document.execCommand('formatBlock', false, 'p');
             }
        }
    };

    return (
        <div
            ref={containerRef}
            className={`absolute p-2 outline-none rounded transition-shadow pointer-events-auto group ${isSelected ? '' : 'hover:ring-1 hover:ring-gray-300'}`}
            style={{ 
                left: el.x, 
                top: el.y, 
                width: el.width,
                height: el.height,
                maxWidth: el.width ? 'none' : '800px',
                minWidth: '20px',
                cursor: 'text' 
            }}
            onPointerDown={(e) => onPointerDown(e, el.id)}
        >
            <ResizeHandles isSelected={isSelected} onResizeStart={(e, h) => onResizeStart(e, el.id, h)} />
            
            {isSelected && (
                <div className="absolute -top-6 -right-2 bg-white shadow rounded flex gap-1 z-50 cursor-move" data-drag-handle="true">
                    <div className="p-1 text-gray-400 hover:text-gray-600"><GripVertical size={12}/></div>
                </div>
            )}
            <div
                ref={localRef}
                contentEditable
                suppressContentEditableWarning
                className="outline-none text-gray-900 prose prose-sm max-w-none w-full h-full overflow-y-auto
                  prose-p:my-1 prose-headings:my-2 
                  prose-h1:text-3xl prose-h1:font-bold prose-h1:leading-tight
                  prose-h2:text-2xl prose-h2:font-semibold 
                  prose-pre:bg-gray-100 prose-pre:text-gray-800 prose-pre:p-2 prose-pre:rounded
                  prose-ul:list-disc prose-ul:pl-4 
                  prose-img:rounded-md prose-img:my-2
                  prose-hr:my-4
                  min-h-[1.5em] empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                data-placeholder="Type '/' for commands..."
                onBlur={(e) => onUpdate(el.id, { content: e.currentTarget.innerHTML })}
                onInput={(e) => onUpdate(el.id, { content: e.currentTarget.innerHTML })}
                onKeyDown={handleKeyDown}
                onKeyUp={(e) => onKeyUp(e, el.id)}
            />
        </div>
    );
});

const CodeElement = memo(({ el, isSelected, onPointerDown, onUpdate, onDelete, onResizeStart, registerRef }: BaseElementProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (registerRef) registerRef(el.id, containerRef.current); }, [el.id, registerRef]);

    return (
        <div
            ref={containerRef}
            className={`absolute bg-[#1e1e1e] rounded-lg shadow-xl overflow-hidden pointer-events-auto ${isSelected ? '' : 'hover:ring-1 hover:ring-gray-300'}`}
            style={{ left: el.x, top: el.y, width: el.width || 400, height: el.height }}
            onPointerDown={(e) => onPointerDown(e, el.id)}
        >
            <ResizeHandles isSelected={isSelected} onResizeStart={(e, h) => onResizeStart(e, el.id, h)} />
            
            <div 
                className="bg-[#2d2d2d] px-3 py-1 text-xs text-gray-400 flex justify-between items-center select-none cursor-move"
                data-drag-handle="true"
            >
                <span className="flex items-center gap-1"><Terminal size={10}/> Code</span>
            </div>
            <textarea 
                className="w-full h-full bg-transparent p-3 text-gray-200 font-mono text-sm outline-none resize-none"
                style={{ minHeight: '100px' }}
                value={el.content || ''}
                onChange={(e) => onUpdate(el.id, { content: e.target.value })}
                placeholder="// Write code here..."
            />
        </div>
    );
});

const ExpandableElement = memo(({ el, isSelected, onPointerDown, onUpdate, onDelete, onResizeStart, registerRef }: BaseElementProps) => {
    const title = el.content?.split('||')[0] || '';
    const body = el.content?.split('||')[1] || '';
    const bodyRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => { if (registerRef) registerRef(el.id, containerRef.current); }, [el.id, registerRef]);
    useContentSync(bodyRef, body);

    return (
        <div
            ref={containerRef}
            className={`absolute bg-white border border-gray-200 rounded-lg shadow-sm pointer-events-auto flex flex-col ${isSelected ? '' : 'hover:ring-1 hover:ring-gray-300'}`}
            style={{ left: el.x, top: el.y, width: el.width || 300, height: el.height }}
            onPointerDown={(e) => onPointerDown(e, el.id)}
        >
            <ResizeHandles isSelected={isSelected} onResizeStart={(e, h) => onResizeStart(e, el.id, h)} />

            <div 
                className="flex items-center px-3 py-2 bg-gray-50 border-b border-gray-100 cursor-move select-none rounded-t-lg shrink-0"
                data-drag-handle="true"
            >
                <button 
                    onClick={(e) => { e.stopPropagation(); onUpdate(el.id, { isExpanded: !el.isExpanded })}}
                    className="mr-2 text-gray-500 hover:text-blue-600 transition-colors"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {el.isExpanded ? <Minimize2 size={14}/> : <Maximize2 size={14} />}
                </button>
                <input 
                    className="bg-transparent font-medium text-gray-700 outline-none flex-1 text-sm"
                    value={title}
                    onChange={(e) => onUpdate(el.id, { content: `${e.target.value}||${body}` })}
                    placeholder="Section Title"
                />
            </div>
            {el.isExpanded && (
                <div 
                    ref={bodyRef}
                    className="p-3 text-sm text-gray-600 outline-none prose prose-sm max-w-none flex-1 overflow-y-auto"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onUpdate(el.id, { content: `${title}||${e.currentTarget.innerHTML}` })}
                    onInput={(e) => onUpdate(el.id, { content: `${title}||${e.currentTarget.innerHTML}` })}
                />
            )}
        </div>
    );
});

const ImageElement = memo(({ el, isSelected, onPointerDown, onDelete, onResizeStart, registerRef }: BaseElementProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (registerRef) registerRef(el.id, containerRef.current); }, [el.id, registerRef]);

    return (
        <div
            ref={containerRef}
            className={`absolute group pointer-events-auto ${isSelected ? '' : 'hover:ring-1 hover:ring-gray-300'}`}
            style={{ left: el.x, top: el.y, width: el.width || 300, height: el.height || 200 }}
            onPointerDown={(e) => onPointerDown(e, el.id)}
        >
            <ResizeHandles isSelected={isSelected} onResizeStart={(e, h) => onResizeStart(e, el.id, h)} />
            <img 
                src={el.content} 
                alt="User content" 
                className="w-full h-full object-cover rounded shadow-sm pointer-events-none"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Image+Error'; }}
            />
            {isSelected && (
                <div className="absolute -top-6 right-0 bg-white shadow rounded flex gap-1" data-drag-handle="true">
                    <div className="cursor-move p-1 text-gray-400"><GripVertical size={12}/></div>
                </div>
            )}
        </div>
    );
});

// --- Main Editor Component ---

export const Editor: React.FC<EditorProps> = ({ pageId, initialContent, onSave, pageName }) => {
  const [elements, setElements] = useState<CanvasElement[]>(() => initialContent.elements || []);
  const [tool, setTool] = useState<Tool>('SELECT');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [slashMenu, setSlashMenu] = useState<{ x: number, y: number, targetId: string } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  const selectedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  
  const elementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  const interactionRef = useRef<{
    startX: number;
    startY: number;
    currentId: string | null;
    mode: InteractionMode;
    initialPositions: Record<string, {x: number, y: number}>;
    resizeHandle: string;
    initialBounds: { x: number, y: number, width: number, height: number };
  }>({ 
      startX: 0, startY: 0, currentId: null, mode: 'IDLE', initialPositions: {},
      resizeHandle: '', initialBounds: { x: 0, y: 0, width: 0, height: 0 }
  });

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
      elementRefs.current[id] = el;
  }, []);

  // Auto-save
  useEffect(() => {
    const timer = setTimeout(() => onSave(elements), 1000);
    return () => clearTimeout(timer);
  }, [elements, onSave]);

  // Handle Global Keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setTool('SELECT');
            setSelectedIds(new Set());
            setSlashMenu(null);
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
             const active = document.activeElement;
             const isEditing = active instanceof HTMLElement && (
                 active.isContentEditable || 
                 active.tagName === 'INPUT' || 
                 active.tagName === 'TEXTAREA'
             );
             
             if (!isEditing && selectedIdsRef.current.size > 0) {
                 setElements(prev => prev.filter(el => !selectedIdsRef.current.has(el.id)));
                 setSelectedIds(new Set());
             }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Global Pointer Events ---
  useEffect(() => {
      const handleGlobalMove = (e: PointerEvent) => {
          if (interactionRef.current.mode === 'IDLE') return;
          const { startX, startY, mode, initialPositions, resizeHandle, initialBounds, currentId } = interactionRef.current;
          
          if (mode === 'MOVING') {
              e.preventDefault(); 
              const dx = e.clientX - startX;
              const dy = e.clientY - startY;
              
              setElements(prev => prev.map(el => {
                  if (initialPositions[el.id]) {
                       const init = initialPositions[el.id];
                       if (el.type === ElementType.PATH) {
                           return { ...el, x: init.x + dx, y: init.y + dy };
                       }
                       return { ...el, x: init.x + dx, y: init.y + dy };
                  }
                  return el;
              }));
          } else if (mode === 'RESIZING' && currentId) {
              e.preventDefault();
              const dx = e.clientX - startX;
              const dy = e.clientY - startY;
              
              let newX = initialBounds.x;
              let newY = initialBounds.y;
              let newW = initialBounds.width;
              let newH = initialBounds.height;

              if (resizeHandle.includes('e')) newW = Math.max(20, initialBounds.width + dx);
              if (resizeHandle.includes('w')) {
                  const maxDelta = initialBounds.width - 20;
                  const effDx = Math.min(dx, maxDelta);
                  newW = initialBounds.width - effDx;
                  newX = initialBounds.x + effDx;
              }
              if (resizeHandle.includes('s')) newH = Math.max(20, initialBounds.height + dy);
              if (resizeHandle.includes('n')) {
                  const maxDelta = initialBounds.height - 20;
                  const effDy = Math.min(dy, maxDelta);
                  newH = initialBounds.height - effDy;
                  newY = initialBounds.y + effDy;
              }

              setElements(prev => prev.map(el => el.id === currentId ? {
                  ...el, x: newX, y: newY, width: newW, height: newH
              } : el));
          }
      };

      const handleGlobalUp = () => {
          if (interactionRef.current.mode === 'BOX_SELECT') {
              setSelectionBox(null);
          }
          interactionRef.current.mode = 'IDLE';
      };

      window.addEventListener('pointermove', handleGlobalMove);
      window.addEventListener('pointerup', handleGlobalUp);
      
      return () => {
          window.removeEventListener('pointermove', handleGlobalMove);
          window.removeEventListener('pointerup', handleGlobalUp);
      };
  }, []);

  // --- Helpers & Handlers ---
  
  const getMousePos = (e: React.PointerEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const deleteElement = useCallback((id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
    });
  }, []);

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
  }, []);

  const handleResizeStart = useCallback((e: React.PointerEvent, id: string, handle: string) => {
      // Find element and its current DOM rect to ensure smooth resize
      const el = elements.find(x => x.id === id);
      const domEl = elementRefs.current[id];
      
      if (!el) return;
      
      // If width/height are undefined (auto), use current DOM values
      const domRect = domEl ? domEl.getBoundingClientRect() : { width: 0, height: 0 };
      const currentW = el.width || domRect.width;
      const currentH = el.height || domRect.height;
      
      interactionRef.current = {
          mode: 'RESIZING',
          startX: e.clientX,
          startY: e.clientY,
          currentId: id,
          resizeHandle: handle,
          initialBounds: { x: el.x, y: el.y, width: currentW, height: currentH },
          initialPositions: {}
      };
  }, [elements]);

  const handleContainerPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const isBackground = target.id === 'canvas-bg' || target.tagName === 'svg';
    const { x, y } = getMousePos(e);

    if (tool === 'SELECT') {
        if (isBackground) {
            interactionRef.current = { 
                startX: x, startY: y, currentId: null, mode: 'BOX_SELECT', initialPositions: {},
                resizeHandle: '', initialBounds: { x: 0, y: 0, width: 0, height: 0 }
            };
            setSelectionBox({ x, y, width: 0, height: 0 });
            if (!e.shiftKey) setSelectedIds(new Set());
            setSlashMenu(null);
        }
        return;
    }

    if (tool === 'ERASER') {
        interactionRef.current = {
            startX: x, startY: y, currentId: null, mode: 'ERASING', initialPositions: {},
            resizeHandle: '', initialBounds: { x: 0, y: 0, width: 0, height: 0 }
        };
        return;
    }
    
    if (tool === 'TEXT' && target.isContentEditable) return;

    interactionRef.current = { 
      startX: x, startY: y, currentId: generateId(), mode: 'CREATING', initialPositions: {},
      resizeHandle: '', initialBounds: { x: 0, y: 0, width: 0, height: 0 }
    };

    let newEl: CanvasElement;

    if (['TEXT', 'CODE', 'EXPANDABLE'].includes(tool)) {
      if (tool === 'CODE') {
        newEl = { id: interactionRef.current.currentId!, type: ElementType.CODE, x, y, content: '// Code block', width: 300, height: 150 };
      } else if (tool === 'EXPANDABLE') {
        newEl = { id: interactionRef.current.currentId!, type: ElementType.EXPANDABLE, x, y, content: 'Toggle Section', isExpanded: true, width: 300 };
      } else {
        newEl = { id: interactionRef.current.currentId!, type: ElementType.TEXT, x, y, content: '' };
      }
      
      setElements(prev => [...prev, newEl]);
      setTimeout(() => {
        setSelectedIds(new Set([newEl.id]));
        if (tool === 'TEXT' && elementRefs.current[newEl.id]) {
          elementRefs.current[newEl.id]?.focus();
        }
      }, 50);
      return;
    }

    if (tool === 'DRAW') {
      newEl = {
        id: interactionRef.current.currentId!,
        type: ElementType.PATH,
        x: 0, y: 0,
        points: [{ x, y }],
        style: { strokeColor: '#000', strokeWidth: 2 }
      };
    } else {
      newEl = {
        id: interactionRef.current.currentId!,
        type: tool === 'RECT' ? ElementType.RECTANGLE : ElementType.CIRCLE,
        x, y,
        width: 0, height: 0,
        style: { strokeColor: '#000', backgroundColor: 'transparent', strokeWidth: 2 }
      };
    }
    setElements(prev => [...prev, newEl]);
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
      const { startX, startY, currentId, mode } = interactionRef.current;
      const { x, y } = getMousePos(e);

      if (mode === 'CREATING') {
        setElements(prev => prev.map(el => {
            if (el.id !== currentId) return el;
            if (el.type === ElementType.PATH) {
                return { ...el, points: [...(el.points || []), { x, y }] };
            } else {
                const width = x - startX;
                const height = y - startY;
                return {
                    ...el,
                    width: Math.abs(width),
                    height: Math.abs(height),
                    x: width < 0 ? x : startX,
                    y: height < 0 ? y : startY
                };
            }
        }));
      } else if (mode === 'BOX_SELECT') {
          const w = x - startX;
          const h = y - startY;
          setSelectionBox({
              x: w < 0 ? x : startX,
              y: h < 0 ? y : startY,
              width: Math.abs(w),
              height: Math.abs(h)
          });
      } else if (mode === 'ERASING') {
          const hit = elements.find(el => {
              if (el.width && el.height) {
                  return x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height;
              }
              if (el.type === ElementType.PATH && el.points) {
                   const minX = Math.min(...el.points.map(p => p.x)) + el.x;
                   const maxX = Math.max(...el.points.map(p => p.x)) + el.x;
                   const minY = Math.min(...el.points.map(p => p.y)) + el.y;
                   const maxY = Math.max(...el.points.map(p => p.y)) + el.y;
                   return x >= minX && x <= maxX && y >= minY && y <= maxY;
              }
              if (el.type === ElementType.TEXT) {
                  return x >= el.x && x <= el.x + 300 && y >= el.y && y <= el.y + 50; 
              }
              return false;
          });
          if (hit) deleteElement(hit.id);
      }
  };
  
  const handleContainerPointerUp = () => {
      if (interactionRef.current.mode === 'BOX_SELECT' && selectionBox) {
          const sb = selectionBox;
          const hits = elements.filter(el => {
              const elX = el.x; 
              const elY = el.y;
              const elW = el.width || 10;
              const elH = el.height || 10;
              return (elX < sb.x + sb.width && elX + elW > sb.x && elY < sb.y + sb.height && elY + elH > sb.y);
          });
          setSelectedIds(prev => {
              const next = new Set(prev);
              hits.forEach(h => next.add(h.id));
              return next;
          });
          setSelectionBox(null);
      }
      interactionRef.current.mode = 'IDLE';
  };

  const handleElementPointerDown = useCallback((e: React.PointerEvent, id: string) => {
      e.stopPropagation();
      if (tool === 'ERASER') {
          deleteElement(id);
          return;
      }
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const dragHandle = target.closest('[data-drag-handle]');

      if (tool === 'SELECT') {
          if (e.shiftKey) {
              setSelectedIds(prev => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
              });
          } else {
              if (!selectedIdsRef.current.has(id)) {
                  setSelectedIds(new Set([id]));
              }
          }

          if (dragHandle || (!isInput)) {
               const initPos: Record<string, {x:number, y:number}> = {};
               const currentSelection = e.shiftKey ? selectedIdsRef.current : (selectedIdsRef.current.has(id) ? selectedIdsRef.current : new Set([id]));
               elements.forEach(el => {
                   if (currentSelection.has(el.id)) initPos[el.id] = { x: el.x, y: el.y };
               });
               interactionRef.current = {
                   startX: e.clientX,
                   startY: e.clientY,
                   currentId: id,
                   mode: 'MOVING',
                   initialPositions: initPos,
                   resizeHandle: '', initialBounds: { x: 0, y: 0, width: 0, height: 0 }
               };
          }
      }
  }, [tool, elements, deleteElement]);

  // --- Text & Slash Menu Logic ---

  const handleTextKeyUp = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key === '/') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let rect = range.getBoundingClientRect();
        
        if (rect.width === 0 && rect.height === 0) {
           const clientRects = range.getClientRects();
           if (clientRects.length > 0) {
               rect = clientRects[0];
           } else if (elementRefs.current[id]) {
               const elRect = elementRefs.current[id]!.getBoundingClientRect();
               rect = elRect;
           }
        }

        setSlashMenu({
          x: rect.left,
          y: rect.bottom + 5,
          targetId: id
        });
      }
    }
  }, []);

  const handleSlashSelect = (type: string) => {
    if (!slashMenu) return;
    const { targetId } = slashMenu;
    const ref = elementRefs.current[targetId];
    if (ref) {
        ref.focus();
        
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (range.startOffset > 0) {
                const clone = range.cloneRange();
                clone.setStart(range.startContainer, range.startOffset - 1);
                clone.setEnd(range.startContainer, range.startOffset);
                if (clone.toString() === '/') {
                    clone.deleteContents();
                }
            }
        }
        
        switch (type) {
          case 'h1': document.execCommand('formatBlock', false, 'H1'); break;
          case 'h2': document.execCommand('formatBlock', false, 'H2'); break;
          case 'ul': document.execCommand('insertUnorderedList'); break;
          case 'divider': document.execCommand('insertHorizontalRule'); break;
          case 'code': document.execCommand('formatBlock', false, 'PRE'); break;
          case 'image':
             const url = prompt("Enter Image URL:", "https://via.placeholder.com/300");
             if (url) document.execCommand('insertImage', false, url);
             break;
        }
    }
    setSlashMenu(null);
  };

  const renderElement = (el: CanvasElement) => {
    const isSelected = selectedIds.has(el.id);
    const props: BaseElementProps = {
        el, isSelected, onPointerDown: handleElementPointerDown, onUpdate: updateElement, onDelete: deleteElement, registerRef: registerRef, onResizeStart: handleResizeStart
    };

    switch (el.type) {
      case ElementType.TEXT:
        return <TextElement key={el.id} {...props} onKeyUp={handleTextKeyUp} />;
      case ElementType.EXPANDABLE:
        return <ExpandableElement key={el.id} {...props} />;
      case ElementType.CODE:
        return <CodeElement key={el.id} {...props} />;
      case ElementType.IMAGE:
        return <ImageElement key={el.id} {...props} />;
      default: return null;
    }
  };

  const renderSvgElement = (el: CanvasElement) => {
      const isSelected = selectedIds.has(el.id);
      const stroke = isSelected ? '#3b82f6' : (el.style?.strokeColor || '#000');
      const props = {
          key: el.id, stroke, strokeWidth: el.style?.strokeWidth, className: `pointer-events-auto cursor-pointer ${tool === 'ERASER' ? 'hover:opacity-50' : ''}`,
          onPointerDown: (e: React.PointerEvent) => handleElementPointerDown(e, el.id)
      };
      
      if (el.type === ElementType.RECTANGLE) return <rect x={el.x} y={el.y} width={el.width} height={el.height} fill="transparent" {...props} />;
      if (el.type === ElementType.CIRCLE) return <ellipse cx={el.x + (el.width||0)/2} cy={el.y + (el.height||0)/2} rx={(el.width||0)/2} ry={(el.height||0)/2} fill="transparent" {...props} />;
      if (el.type === ElementType.PATH) return <g transform={`translate(${el.x || 0}, ${el.y || 0})`}><path d={el.points?.map((p, i) => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ')} fill="none" strokeLinecap="round" strokeLinejoin="round" {...props} /></g>;
      return null;
  }

  return (
    <div className="flex flex-col h-full bg-white relative">
      {slashMenu && <SlashMenu position={slashMenu} onSelect={handleSlashSelect} onClose={() => setSlashMenu(null)} />}
      
      <div className="h-14 border-b border-gray-200 flex items-center px-4 justify-between bg-white z-40 shadow-sm">
         <div className="flex items-center gap-2">
            <h1 className="font-semibold text-lg text-gray-800 mr-4 max-w-[200px] truncate">{pageName}</h1>
            <div className="h-6 w-px bg-gray-300 mx-2"></div>
            <ToolButton icon={<MousePointer2 size={18} />} active={tool === 'SELECT'} onClick={() => setTool('SELECT')} label="Select (Esc)" />
            <ToolButton icon={<Eraser size={18} />} active={tool === 'ERASER'} onClick={() => setTool('ERASER')} label="Eraser" />
            <div className="h-6 w-px bg-gray-300 mx-2"></div>
            <ToolButton icon={<Type size={18} />} active={tool === 'TEXT'} onClick={() => setTool('TEXT')} label="Text" />
            <ToolButton icon={<Square size={18} />} active={tool === 'RECT'} onClick={() => setTool('RECT')} label="Box" />
            <ToolButton icon={<Circle size={18} />} active={tool === 'CIRCLE'} onClick={() => setTool('CIRCLE')} label="Circle" />
            <ToolButton icon={<Pencil size={18} />} active={tool === 'DRAW'} onClick={() => setTool('DRAW')} label="Draw" />
            <div className="h-6 w-px bg-gray-300 mx-2"></div>
            <ToolButton icon={<Code size={18} />} active={tool === 'CODE'} onClick={() => setTool('CODE')} label="Code" />
            <ToolButton icon={<Maximize2 size={18} />} active={tool === 'EXPANDABLE'} onClick={() => setTool('EXPANDABLE')} label="Section" />
         </div>
         <div className="text-xs text-gray-400">{elements.length} items • {tool} Mode</div>
      </div>

      <div 
        className={`flex-1 overflow-auto relative bg-gray-50 canvas-grid touch-none ${tool === 'ERASER' ? 'cursor-cell' : 'cursor-crosshair'}`}
        onPointerDown={handleContainerPointerDown}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
      >
        <div id="canvas-bg" className="absolute inset-0 min-w-full min-h-[2000px]">
           <svg className="absolute inset-0 w-full h-full z-0 overflow-visible">{elements.map(renderSvgElement)}</svg>
           <div className="absolute inset-0 w-full h-full z-10 pointer-events-none"><div className="w-full h-full">{elements.map(renderElement)}</div></div>
           {selectionBox && <div className="absolute border border-blue-500 bg-blue-500/10 z-50 pointer-events-none" style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height }} />}
        </div>
      </div>
    </div>
  );
};

const ToolButton: React.FC<{ icon: React.ReactNode; active: boolean; onClick: () => void; label: string }> = ({ icon, active, onClick, label }) => (
    <button onClick={onClick} title={label} className={`p-2 rounded flex items-center justify-center transition-all ${active ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>{icon}</button>
);