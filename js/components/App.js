import { h } from 'https://esm.sh/preact@10.19.2';
import { useState, useEffect, useRef, useMemo } from 'https://esm.sh/preact@10.19.2/hooks';
import { html } from 'https://esm.sh/htm@3.1.1/preact';

import { Toolbar } from './Toolbar.js';
import { DetailsPane } from './DetailsPane.js';
import { ZoomPanHelper } from './ZoomPanHelper.js';
import { NodeCard } from './NodeCard.js';
import { Connector } from './Connector.js';
import { LayoutEngine } from '../core/LayoutEngine.js';

export function App({ store }) {
    const [viewMode, setViewMode] = useState('rbs-tab');
    const [detailsNodeId, setDetailsNodeId] = useState(null);
    const [selectedEdge, setSelectedEdge] = useState(null); // { sourceId, targetId }
    const [tick, setTick] = useState(0);

    const viewportRef = useRef(null);
    const canvasRef = useRef(null);
    const zoomManager = useRef(null);

    // Flatten data for easy rendering
    const allNodes = useMemo(() => {
        const list = [];
        if (!store.data || !Array.isArray(store.data)) return list;
        const flatten = (nodes) => nodes.forEach(n => {
            if (!n) return;
            list.push(n);
            if (n.children && Array.isArray(n.children)) flatten(n.children);
        });
        flatten(store.data);
        return list;
    }, [store.data, tick]);

    // Calculate positions based on viewMode
    const positions = useMemo(() => {
        try {
            return LayoutEngine.calculate(store, viewMode);
        } catch (e) {
            console.error("Layout calculation failed", e);
            return new Map();
        }
    }, [store.data, viewMode, tick]);

    useEffect(() => {
        store.subscribe(() => setTick(t => t + 1));
        
        if (viewportRef.current && canvasRef.current) {
            zoomManager.current = ZoomPanHelper.setup(viewportRef.current, canvasRef.current, (s, x, y) => {
                if (canvasRef.current) {
                    canvasRef.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
                }
            });
        }

        const handleKeyDown = (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); store.redo(); }
                else if (e.key.toLowerCase() === 'z') { e.preventDefault(); store.undo(); }
            } else if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                handleFitView();
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEdge) {
                // Remove edge when Delete is pressed and an edge is selected
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    store.removePredecessor(selectedEdge.targetId, selectedEdge.sourceId);
                    setSelectedEdge(null);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedEdge, viewMode]); // Watch for selection and mode changes

    const handleResetView = () => {
        zoomManager.current?.setScaleAndOrigin(1, 0, 0);
        if (canvasRef.current) canvasRef.current.style.transform = `translate(0px, 0px) scale(1)`;
    };

    const handleFitView = () => {
        const visibleNodes = allNodes.filter(n => positions.get(n.id)?.visible);
        if (visibleNodes.length === 0) return;

        const containerRect = viewportRef.current.getBoundingClientRect();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        visibleNodes.forEach(node => {
            const p = positions.get(node.id);
            if (!p) return;
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x + 280);
            maxY = Math.max(maxY, p.y + 100);
        });

        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = minX + width / 2;
        const centerY = minY + height / 2;

        let s = Math.min((containerRect.width * 0.8) / width, (containerRect.height * 0.8) / height, 1);
        s = Math.max(0.15, s);

        const ox = (containerRect.width / 2) - centerX * s;
        const oy = (containerRect.height / 2) - centerY * s;

        zoomManager.current?.setScaleAndOrigin(s, ox, oy);
        if (canvasRef.current) canvasRef.current.style.transform = `translate(${ox}px, ${oy}px) scale(${s})`;
    };

    return html`
        <div class="app-root-wrapper">
            <${Toolbar} store=${store} onResetView=${handleResetView} onFitView=${handleFitView} />
            
            <nav class="app-tabs">
                <button class="tab-btn ${viewMode === 'rbs-tab' ? 'active' : ''}" onClick=${() => setViewMode('rbs-tab')}>RBS (Tree)</button>
                <button class="tab-btn ${viewMode === 'pert-tab' ? 'active' : ''}" onClick=${() => setViewMode('pert-tab')}>PERT (Graph)</button>
                <button class="tab-btn ${viewMode === 'kanban-tab' ? 'active' : ''}" onClick=${() => setViewMode('kanban-tab')}>KANBAN</button>
                <button class="tab-btn ${viewMode === 'table-tab' ? 'active' : ''}" onClick=${() => setViewMode('table-tab')}>LIST (Table)</button>
            </nav>

            <main id="app-container" ref=${viewportRef} onMouseDown=${() => setSelectedEdge(null)}>
                <div id="unified-canvas" ref=${canvasRef} class="view-mode-${viewMode}">
                    <!-- Background Layers (e.g. Kanban columns) -->
                    ${viewMode === 'kanban-tab' && html`
                        <div class="kanban-background-layer">
                            ${['未着手', '実行中', '保留', '完了'].map((status, i) => html`
                                <div class="kanban-bg-column" 
                                     style="left: ${50 + i * 400}px"
                                     onDragOver=${(e) => { e.preventDefault(); }}
                                     onDragEnter=${(e) => e.currentTarget.classList.add('drag-over')}
                                     onDragLeave=${(e) => e.currentTarget.classList.remove('drag-over')}
                                     onDrop=${(e) => {
                                         e.preventDefault();
                                         e.stopPropagation();
                                         e.currentTarget.classList.remove('drag-over');
                                         const sourceId = e.dataTransfer.getData('source-id');
                                         if (sourceId) {
                                             const node = store.findNodeById(store.data, sourceId);
                                             if (node && node.status !== status) {
                                                 node.status = status;
                                                 store.pushHistory();
                                             }
                                         }
                                     }}>
                                    <div class="kanban-bg-header" data-status="${status}">${status}</div>
                                </div>
                            `)}
                        </div>
                    `}

                    <${Connector} store=${store} 
                                   positions=${positions} 
                                   viewMode=${viewMode} 
                                   selectedEdge=${selectedEdge}
                                   onSelectEdge=${(edge) => setSelectedEdge(edge)} />
                    
                    ${allNodes.map(node => html`
                        <${NodeCard} key=${node.id} 
                                     node=${node} 
                                     pos=${positions.get(node.id)} 
                                     onOpenDetails=${(id) => setDetailsNodeId(id)}
                                     store=${store}
                                     viewMode=${viewMode} />
                    `)}
                </div>
            </main>

            <footer class="app-footer">
                <div class="shortcuts-hint">
                    <span>${viewMode.toUpperCase()} モード</span>
                    <span><strong>Space</strong>: 全体を表示</span>
                    <span class="hotkey-detail">Double Click: 詳細を開く</span>
                </div>
            </footer>

            <${DetailsPane} 
                store=${store} 
                nodeId=${detailsNodeId} 
                onClose=${() => setDetailsNodeId(null)} 
                onRequestCenter=${handleFitView} />
        </div>
    `;
}
