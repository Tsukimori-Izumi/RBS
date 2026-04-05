import { h, render } from 'https://esm.sh/preact';
import htm from 'https://esm.sh/htm';

const html = htm.bind(h);

export class PertRenderer {
    constructor(store, onOpenDetails, onResetExternalPanning) {
        this.store = store;
        this.onOpenDetails = onOpenDetails;
        this.onResetExternalPanning = onResetExternalPanning;
        this.container = document.getElementById('pert-tree-container');
        
        this.state = {
            selectedDependency: null
        };
        
        this.container.innerHTML = '';
        
        // Handle click outside edges
        this.container.addEventListener('click', (e) => {
            if (e.target.tagName !== 'path' && this.state.selectedDependency) {
                this.state.selectedDependency = null;
                this.updateAndRender();
            }
        });

        this.store.subscribe(() => this.updateAndRender());
    }

    updateAndRender() {
        if (!this.container) return;
        const vdomArray = this.renderVDOM();
        render(vdomArray, this.container);
    }

    render() {
        this.updateAndRender();
    }

    renderVDOM() {
        const leafNodes = this.store.extractLeafNodes(this.store.data);
        const cardMapCoords = new Map();
        
        const nodeLevels = new Map();
        const calculateLevel = (nodeId, visited = new Set()) => {
            if (nodeLevels.has(nodeId)) return nodeLevels.get(nodeId);
            if (visited.has(nodeId)) return 0;
            visited.add(nodeId);

            const node = this.store.findNodeById(this.store.data, nodeId);
            if (!node || !node.predecessors || node.predecessors.length === 0) {
                nodeLevels.set(nodeId, 0);
                return 0;
            }

            let maxLevel = -1;
            node.predecessors.forEach(pId => {
                maxLevel = Math.max(maxLevel, calculateLevel(pId, visited));
            });
            const lvl = maxLevel + 1;
            nodeLevels.set(nodeId, lvl);
            return lvl;
        };

        leafNodes.forEach(n => calculateLevel(n.id));

        const levels = [];
        leafNodes.forEach(node => {
            const l = nodeLevels.get(node.id) || 0;
            if (!levels[l]) levels[l] = [];
            levels[l].push(node);
        });

        const spacingX = 500;
        const spacingY = 200;
        const offsetX = 100;
        const offsetY = 100;

        levels.forEach((levelNodes, col) => {
            levelNodes.forEach((node, rowInd) => {
                cardMapCoords.set(node.id, {
                    x: offsetX + col * spacingX,
                    y: offsetY + rowInd * spacingY
                });
            });
        });

        const svgVDOM = this.renderArrows(leafNodes, cardMapCoords);
        
        const cardsVDOM = leafNodes.map(node => {
            const coords = cardMapCoords.get(node.id);
            if (!coords) return null;
            return this.renderTaskCard(node, coords.x, coords.y);
        });

        return [svgVDOM, ...cardsVDOM];
    }

    renderTaskCard(node, x, y) {
        const status = node.status || '未着手';
        const ancestors = this.store.getAncestors(node.id) || [];
        const pathStr = ancestors.map(a => a.text).join(' > ');
        
        const cardStyle = `left: ${x}px; top: ${y}px;`;

        return html`
            <div class="pert-task-card"
                 key="${node.id}"
                 data-id="${node.id}"
                 data-status="${status}"
                 style="${cardStyle}"
                 draggable="true"
                 onDblClick=${() => this.onOpenDetails && this.onOpenDetails(node.id)}
                 onMouseDown=${(e) => e.stopPropagation()}
                 onDragStart=${(e) => {
                     e.dataTransfer.setData('source-id', node.id);
                     // Defer setting dragging classes to ensure preview captures native element natively
                     setTimeout(() => e.target.classList.add('dragging'), 0);
                     document.body.style.cursor = 'grabbing';
                     if (this.onResetExternalPanning) this.onResetExternalPanning();
                 }}
                 onDragEnd=${(e) => {
                     e.target.classList.remove('dragging');
                     document.body.style.cursor = '';
                     if (this.onResetExternalPanning) this.onResetExternalPanning();
                 }}
                 onDragOver=${(e) => e.preventDefault()}
                 onDrop=${(e) => {
                     e.preventDefault();
                     const sourceId = e.dataTransfer.getData('source-id');
                     if (sourceId && sourceId !== node.id) {
                         this.store.addPredecessor(sourceId, node.id);
                     }
                 }}>
                 
                <div class="task-handle">
                    <span class="handle-id">${node.serialId || ''}</span>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="8.5" cy="5" r="2.5"/><circle cx="8.5" cy="12" r="2.5"/><circle cx="8.5" cy="19" r="2.5"/>
                        <circle cx="15.5" cy="5" r="2.5"/><circle cx="15.5" cy="12" r="2.5"/><circle cx="15.5" cy="19" r="2.5"/>
                    </svg>
                </div>
                <div class="task-content">
                    <div class="task-context">${pathStr}</div>
                    <div class="task-text">${node.text || '(No description)'}</div>
                    <div class="task-opt" title="楽観時間（日）">${node.optimistic || 0}</div>
                    <div class="task-pes" title="悲観時間（日）">${node.pessimistic || 0}</div>
                </div>
            </div>
        `;
    }

    renderArrows(nodes, cardMapCoords) {
        const linesVDOM = [];
        
        nodes.forEach(node => {
            if (!node.predecessors) return;
            const targetCoords = cardMapCoords.get(node.id);
            if (!targetCoords) return;

            node.predecessors.forEach(predId => {
                const sourceCoords = cardMapCoords.get(predId);
                if (!sourceCoords) return;

                const sX = sourceCoords.x + 280;
                const sY = sourceCoords.y + 60;
                const tX = targetCoords.x;
                const tY = targetCoords.y + 60;

                const dx = tX - sX;
                const cpShift = Math.min(Math.abs(dx) * 0.5, 100);
                
                const isSelected = this.state.selectedDependency && 
                                   this.state.selectedDependency.targetId === node.id && 
                                   this.state.selectedDependency.predId === predId;

                const dStr = `M ${sX} ${sY} C ${sX + cpShift} ${sY}, ${tX - cpShift} ${tY}, ${tX} ${tY}`;

                linesVDOM.push(html`
                    <path class="pert-arrow ${isSelected ? 'selected' : ''}"
                          key="${predId}-${node.id}"
                          d="${dStr}"
                          stroke="#6366f1"
                          stroke-width="2"
                          fill="none"
                          marker-end="url(#arrowhead)"
                          onClick=${(e) => {
                              e.stopPropagation();
                              this.state.selectedDependency = { targetId: node.id, predId };
                              this.updateAndRender();
                          }} />
                `);
            });
        });

        return html`
            <svg id="pert-svg-overlay" key="svg-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; z-index: 0;">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                    </marker>
                </defs>
                <g style="pointer-events: stroke;">
                    ${linesVDOM}
                </g>
            </svg>
        `;
    }

    handleDeleteKey() {
        if (this.state.selectedDependency) {
            this.store.removePredecessor(this.state.selectedDependency.targetId, this.state.selectedDependency.predId);
            this.state.selectedDependency = null;
            // updateAndRender gets triggered because removePredecessor changes the store data which kicks notify()
        }
    }
}
