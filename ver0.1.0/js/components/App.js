import { h } from 'https://esm.sh/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';
import htm from 'https://esm.sh/htm';

import { Toolbar } from './Toolbar.js';
import { DetailsPane } from './DetailsPane.js';
import { ZoomPanHelper } from './ZoomPanHelper.js';
import { TreeRenderer } from '../views/TreeRenderer.js';
import { PertRenderer } from '../views/PertRenderer.js';
import { KanbanRenderer } from '../views/KanbanRenderer.js';
import { TableRenderer } from '../views/TableRenderer.js';

const html = htm.bind(h);

export function App({ store }) {
    const [activeTab, setActiveTab] = useState('rbs-tab');
    const [detailsNodeId, setDetailsNodeId] = useState(null);
    const [, setTick] = useState(0); // Force re-render on store changes

    const treeContainerRef = useRef(null);
    const pertContainerRef = useRef(null);
    const treeAppRef = useRef(null);
    const pertAppRef = useRef(null);

    const treeZoomManager = useRef(null);
    const pertZoomManager = useRef(null);

    const treeRenderer = useRef(null);
    const pertRenderer = useRef(null);
    const kanbanRenderer = useRef(null);
    const tableRenderer = useRef(null);

    useEffect(() => {
        // Subscribe to store updates
        store.subscribe(() => setTick(t => t + 1));

        // Global keyboard setup
        const handleKeyDown = (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); store.redo(); }
                else if (e.key.toLowerCase() === 'z') { e.preventDefault(); store.undo(); }
                else if (e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo(); }
            } else if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                handleFitView();
            } else if (e.key === 'Delete' && activeTab === 'pert-tab') {
                e.preventDefault();
                if (pertRenderer.current) pertRenderer.current.handleDeleteKey();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab]);

    useEffect(() => {
        // Initialize Zoom helpers once DOM nodes are ready
        if (treeAppRef.current && treeContainerRef.current) {
            treeZoomManager.current = ZoomPanHelper.setup(treeAppRef.current, treeContainerRef.current, (s, x, y) => {
                treeContainerRef.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
            });
        }
        if (pertAppRef.current && pertContainerRef.current) {
            pertZoomManager.current = ZoomPanHelper.setup(pertAppRef.current, pertContainerRef.current, (s, x, y) => {
                pertContainerRef.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
            });
        }
    }, []);

    const openDetails = (id) => setDetailsNodeId(id);

    const handleResetView = () => {
        if (activeTab === 'rbs-tab') {
            const rootNode = treeContainerRef.current?.querySelector('.root-node > .node-item');
            if (rootNode) centerOnNodes(treeAppRef.current, treeContainerRef.current, treeZoomManager.current, [rootNode], 1);
            else treeZoomManager.current?.setScaleAndOrigin(1, 0, 0);
        } else if (activeTab === 'pert-tab') {
            resetPertView();
        }
    };

    const handleFitView = () => {
        if (activeTab === 'rbs-tab') {
            const allNodes = Array.from(treeContainerRef.current?.querySelectorAll('.node-item') || []);
            if (allNodes.length > 0) centerOnNodes(treeAppRef.current, treeContainerRef.current, treeZoomManager.current, allNodes);
        } else if (activeTab === 'pert-tab') {
            resetPertView();
        }
    };

    const resetPertView = () => {
        const nodes = Array.from(pertContainerRef.current?.querySelectorAll('.pert-task-card') || []);
        if (nodes.length > 0) centerOnNodes(pertAppRef.current, pertContainerRef.current, pertZoomManager.current, nodes, null, 0.9);
    };

    const centerOnNodes = (app, container, zoomManager, nodes, targetScale = null, maxScale = 1) => {
        if (!app || !container || !zoomManager) return;
        const containerRect = app.getBoundingClientRect();
        container.style.transform = 'none';
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(node => {
            const r = node.getBoundingClientRect();
            minX = Math.min(minX, r.left);
            minY = Math.min(minY, r.top);
            maxX = Math.max(maxX, r.right);
            maxY = Math.max(maxY, r.bottom);
        });

        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = minX + width / 2 - containerRect.left;
        const centerY = minY + height / 2 - containerRect.top;

        let s = targetScale !== null ? targetScale : Math.min((containerRect.width * 0.8) / width, (containerRect.height * 0.8) / height, maxScale);
        s = Math.max(0.15, s);

        const ox = (containerRect.width / 2) - centerX * s;
        const oy = (containerRect.height / 2) - centerY * s;

        zoomManager.setScaleAndOrigin(s, ox, oy);
        container.style.transform = `translate(${ox}px, ${oy}px) scale(${s})`;
    };

    // Ensure renderers are instantiated (manual compat with current renderer classes)
    useEffect(() => {
        if (!treeRenderer.current) treeRenderer.current = new TreeRenderer(store, 'tree-container', openDetails);
        if (!pertRenderer.current) pertRenderer.current = new PertRenderer(store, openDetails, () => { document.body.style.cursor = ''; });
        if (!kanbanRenderer.current) kanbanRenderer.current = new KanbanRenderer(store, openDetails);
        if (!tableRenderer.current) tableRenderer.current = new TableRenderer(store, openDetails);
        
        // Initial draw
        handleResetView();
    }, []);

    // Side effect to trigger renderer's render() manually if needed (though they subscribe to store)
    useEffect(() => {
        if (activeTab === 'kanban-tab' && kanbanRenderer.current) kanbanRenderer.current.render();
        if (activeTab === 'table-tab' && tableRenderer.current) tableRenderer.current.render();
        if (activeTab === 'pert-tab' && pertRenderer.current) pertRenderer.current.render();
        if (activeTab === 'rbs-tab' && treeRenderer.current) treeRenderer.current.render();
    }, [activeTab]);

    return html`
        <div class="app-root-wrapper">
            <${Toolbar} store=${store} onResetView=${handleResetView} onFitView=${handleFitView} />
            
            <nav class="app-tabs">
                <button class="tab-btn ${activeTab === 'rbs-tab' ? 'active' : ''}" onClick=${() => setActiveTab('rbs-tab')}>要求分解図</button>
                <button class="tab-btn ${activeTab === 'pert-tab' ? 'active' : ''}" onClick=${() => setActiveTab('pert-tab')}>依存解析図</button>
                <button class="tab-btn ${activeTab === 'kanban-tab' ? 'active' : ''}" onClick=${() => setActiveTab('kanban-tab')}>ステータス</button>
                <button class="tab-btn ${activeTab === 'table-tab' ? 'active' : ''}" onClick=${() => setActiveTab('table-tab')}>一覧表</button>
            </nav>

            <main id="app-container">
                <div id="rbs-tab" class="tab-content ${activeTab === 'rbs-tab' ? 'active' : ''}" ref=${treeAppRef}>
                    <div id="tree-container" ref=${treeContainerRef}></div>
                </div>
                
                <div id="pert-tab" class="tab-content ${activeTab === 'pert-tab' ? 'active' : ''}" ref=${pertAppRef}>
                    <div id="pert-app-container">
                        <div id="pert-tree-container" ref=${pertContainerRef}>
                            <svg id="pert-svg-overlay"></svg>
                        </div>
                    </div>
                </div>

                <div id="kanban-tab" class="tab-content ${activeTab === 'kanban-tab' ? 'active' : ''}">
                    <!-- Managed by KanbanRenderer -->
                </div>

                <div id="table-tab" class="tab-content ${activeTab === 'table-tab' ? 'active' : ''}">
                    <div class="table-view">
                        <table id="requirements-table">
                            <thead>
                                <tr>
                                    <th style="width: 34px;"></th>
                                    <th style="width: 80px;">ID</th>
                                    <th>要求項目名称</th>
                                    <th style="width: 140px;">ステータス</th>
                                    <th>詳細説明</th>
                                    <th>チェックリスト</th>
                                </tr>
                            </thead>
                            <tbody id="table-body"></tbody>
                        </table>
                    </div>
                </div>
            </main>

            <footer class="app-footer">
                <div id="shortcuts-hint" class="shortcuts-hint">
                    ${activeTab === 'rbs-tab' ? html`
                        <span><strong>Enter</strong>: 兄弟ノード</span>
                        <span><strong>Tab</strong>: 子ノード</span>
                        <span><strong>Arrows</strong>: 移動</span>
                        <span><strong>Backspace</strong>: 削除</span>
                        <span><strong>Space</strong>: 全体を表示</span>
                        <span class="hotkey-detail">Double Click: 詳細を開く</span>
                    ` : activeTab === 'pert-tab' ? html`
                        <span><strong>Drag</strong>: 依存関係の追加</span>
                        <span><strong>Click Line</strong>: 矢印を選択</span>
                        <span><strong>Delete</strong>: 矢印を削除</span>
                        <span><strong>Space</strong>: 全体を表示</span>
                        <span class="hotkey-detail">Double Click: 詳細を開く</span>
                    ` : activeTab === 'kanban-tab' ? html`
                        <span><strong>Drag Card</strong>: ステータス移動</span>
                        <span class="hotkey-detail">Double Click: 詳細を開く</span>
                    ` : html`
                        <span><strong>Drag Handle</strong>: 並べ替え</span>
                        <span class="hotkey-detail">Double Click: 詳細を開く</span>
                    `}
                </div>
            </footer>

            <${DetailsPane} 
                store=${store} 
                nodeId=${detailsNodeId} 
                onClose=${() => setDetailsNodeId(null)} 
                onRequestCenter=${handleResetView} />
        </div>
    `;
}
