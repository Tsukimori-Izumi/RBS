import { Store } from './js/core/Store.js';
import { ZoomPanHelper } from './js/components/ZoomPanHelper.js';
import { DetailsPane } from './js/components/DetailsPane.js';
import { Toolbar } from './js/components/Toolbar.js';
import { TreeRenderer } from './js/views/TreeRenderer.js';
import { PertRenderer } from './js/views/PertRenderer.js';
import { KanbanRenderer } from './js/views/KanbanRenderer.js';
import { TableRenderer } from './js/views/TableRenderer.js';

class RBSApp {
    constructor() {
        this.appContainer = document.getElementById('app-container');
        this.treeContainer = document.getElementById('tree-container');
        this.pertAppContainer = document.getElementById('pert-app-container');
        this.pertTreeContainer = document.getElementById('pert-tree-container');
        
        this.activeTabId = 'rbs-tab';
        this.shortcutsHint = document.getElementById('shortcuts-hint');
        
        this.store = new Store();
        
        // Setup Views and Components
        this.detailsPane = new DetailsPane(this.store, () => this.recenterActiveView());
        const openDetailsCb = (id) => this.detailsPane.open(id);
        
        this.treeRenderer = new TreeRenderer(this.store, 'tree-container', openDetailsCb);
        // Pass a reset panning fallback for external dragging actions
        this.pertRenderer = new PertRenderer(this.store, openDetailsCb, () => {
             // Let ZoomPanHelper drop panning state if dragged
             document.body.style.cursor = '';
        });
        this.kanbanRenderer = new KanbanRenderer(this.store, openDetailsCb);
        this.tableRenderer = new TableRenderer(this.store, openDetailsCb);

        this.toolbar = new Toolbar(this.store, {
            resetView: () => this.resetView()
        });
        
        this.setupZoomPan();
        this.setupTabs();
        this.setupGlobalShortcuts();

        // Initial render
        this.store.notify();
        setTimeout(() => this.resetView(), 100);
    }
    
    setupZoomPan() {
        // RBS Tree
        this.treeZoomManager = ZoomPanHelper.setup(this.appContainer, this.treeContainer, (s, x, y) => {
            this.treeContainer.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
        });

        // PERT Chart
        if (this.pertAppContainer && this.pertTreeContainer) {
            this.pertZoomManager = ZoomPanHelper.setup(this.pertAppContainer, this.pertTreeContainer, (s, x, y) => {
                this.pertTreeContainer.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
            });
        }
    }

    resetView() {
        if (this.activeTabId === 'rbs-tab') {
            const rootNode = document.querySelector('.root-node > .node-item');
            if (rootNode) this.centerOnNodes([rootNode], 1);
            else this.treeZoomManager.setScaleAndOrigin(1, 0, 0);
            const { getScale, getOriginX, getOriginY } = this.treeZoomManager;
            this.treeContainer.style.transform = `translate(${getOriginX()}px, ${getOriginY()}px) scale(${getScale()})`;
        } else if (this.activeTabId === 'pert-tab') {
            this.resetPertView();
        }
    }

    recenterActiveView() {
        if (this.activeTabId === 'rbs-tab') this.resetView(); 
        if (this.activeTabId === 'pert-tab') this.resetPertView();
    }

    fitView() {
        if (this.activeTabId === 'rbs-tab') {
            const allNodes = Array.from(this.treeContainer.querySelectorAll('.node-item'));
            if (allNodes.length > 0) this.centerOnNodes(allNodes);
        } else if (this.activeTabId === 'pert-tab') {
            this.resetPertView();
        }
    }

    resetPertView() {
        const allPertNodes = Array.from(this.pertTreeContainer.querySelectorAll('.pert-task-card'));
        if (allPertNodes.length > 0) {
            const containerRect = this.pertAppContainer.getBoundingClientRect();
            
            // Measure raw
            this.pertTreeContainer.style.transform = 'none';

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            allPertNodes.forEach(node => {
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

            let s = Math.min((containerRect.width * 0.8) / width, (containerRect.height * 0.8) / height, 0.9);
            s = Math.max(0.15, s);

            const ox = (containerRect.width / 2) - centerX * s;
            const oy = (containerRect.height / 2) - centerY * s;

            this.pertZoomManager.setScaleAndOrigin(s, ox, oy);
            this.pertTreeContainer.style.transform = `translate(${ox}px, ${oy}px) scale(${s})`;
        }
    }

    centerOnNodes(nodes, targetScale = null) {
        const containerRect = this.appContainer.getBoundingClientRect();
        
        // Reset transform to measure
        this.treeContainer.style.transform = 'none';
        
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

        let s;
        if (targetScale !== null) {
            s = targetScale;
        } else {
            s = Math.min((containerRect.width * 0.8) / width, (containerRect.height * 0.8) / height, 1);
            s = Math.max(0.15, s);
        }

        const ox = (containerRect.width / 2) - centerX * s;
        const oy = (containerRect.height / 2) - centerY * s;

        this.treeZoomManager.setScaleAndOrigin(s, ox, oy);
        this.treeContainer.style.transform = `translate(${ox}px, ${oy}px) scale(${s})`;
    }

    setupTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                this.activeTabId = targetTab;
                
                tabBtns.forEach(b => b.classList.toggle('active', b === btn));
                tabContents.forEach(c => c.classList.toggle('active', c.id === targetTab));
                
                this.updateShortcutsHint(targetTab);
                
                if (targetTab === 'rbs-tab') {
                    setTimeout(() => this.fitView(), 50);
                } else if (targetTab === 'pert-tab') {
                    this.pertRenderer.render(); // Ensure drawing
                    setTimeout(() => this.resetPertView(), 50);
                } else if (targetTab === 'kanban-tab') {
                    this.kanbanRenderer.render();
                } else if (targetTab === 'table-tab') {
                    this.tableRenderer.render();
                }
            });
        });
    }

    updateShortcutsHint(tabId) {
        if (!this.shortcutsHint) return;
        
        let html = '';
        if (tabId === 'rbs-tab') {
            html = `
                <span><strong>Enter</strong>: 兄弟ノード</span>
                <span><strong>Tab</strong>: 子ノード</span>
                <span><strong>Arrows</strong>: 移動</span>
                <span><strong>Backspace</strong>: 削除</span>
                <span><strong>Space</strong>: 全体を表示</span>
                <span class="hotkey-detail">Double Click: 詳細を開く</span>
            `;
        } else if (tabId === 'pert-tab') {
            html = `
                <span><strong>Drag</strong>: 依存関係の追加</span>
                <span><strong>Click Line</strong>: 矢印を選択</span>
                <span><strong>Delete</strong>: 矢印を削除</span>
                <span><strong>Space</strong>: 全体を表示</span>
                <span class="hotkey-detail">Double Click: 詳細を開く</span>
            `;
        } else if (tabId === 'kanban-tab') {
            html = `
                <span><strong>Drag Card</strong>: ステータス移動</span>
                <span class="hotkey-detail">Double Click: 詳細を開く</span>
            `;
        } else if (tabId === 'table-tab') {
            html = `
                <span><strong>Drag Handle</strong>: 並べ替え</span>
                <span class="hotkey-detail">Double Click: 詳細を開く</span>
            `;
        }
        this.shortcutsHint.innerHTML = html;
    }

    setupGlobalShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.shiftKey && e.key.toLowerCase() === 'z') {
                    e.preventDefault(); this.store.redo();
                } else if (e.key.toLowerCase() === 'z') {
                    e.preventDefault(); this.store.undo();
                } else if (e.key.toLowerCase() === 'y') {
                    e.preventDefault(); this.store.redo();
                }
            } else if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                this.fitView();
            } else if (e.key === 'Delete' && this.activeTabId === 'pert-tab') {
                e.preventDefault();
                this.pertRenderer.handleDeleteKey();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => new RBSApp());
