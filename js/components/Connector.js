import { h } from 'https://esm.sh/preact@10.19.2';
import { html } from 'https://esm.sh/htm@3.1.1/preact';

export function Connector({ store, positions, viewMode, selectedEdge, onSelectEdge }) {
    if (viewMode === 'kanban-tab' || viewMode === 'table-tab') return null;

    const data = store.data;
    if (!data || !Array.isArray(data)) return null;
    
    const paths = [];

    const drawTreeLine = (parent, child) => {
        const pPos = positions.get(parent.id);
        const cPos = positions.get(child.id);
        if (!pPos || !cPos || !pPos.visible || !cPos.visible) return;

        const sX = pPos.x + 280;
        const sY = pPos.y + 50;
        const tX = cPos.x;
        const tY = cPos.y + 50;
        const midX = sX + (tX - sX) / 2;

        paths.push(html`<path d="M ${sX} ${sY} H ${midX} V ${tY} H ${tX}" 
                             stroke="#94a3b8" stroke-width="2" fill="none" />`);
    };

    const drawPertLine = (predId, targetNode) => {
        const pPos = positions.get(predId);
        const tPos = positions.get(targetNode.id);
        if (!pPos || !tPos || !pPos.visible || !tPos.visible) return;

        const sX = pPos.x + 280;
        const sY = pPos.y + 50;
        const tX = tPos.x;
        const tY = tPos.y + 50;
        
        const dx = tX - sX;
        const cp = Math.max(Math.min(Math.abs(dx) * 0.4, 200), 100);
        const pathD = `M ${sX} ${sY} C ${sX + cp} ${sY}, ${tX - cp} ${tY}, ${tX} ${tY}`;

        const isSelected = selectedEdge && selectedEdge.sourceId === predId && selectedEdge.targetId === targetNode.id;

        // Hit Area (Transparent thick line for easier clicking)
        paths.push(html`
            <path d="${pathD}" 
                  stroke="transparent" 
                  stroke-width="15" 
                  fill="none" 
                  style="cursor: pointer; pointer-events: auto;"
                  onClick=${(e) => {
                      e.stopPropagation();
                      onSelectEdge({ sourceId: predId, targetId: targetNode.id });
                  }} />
        `);

        // Visible Line
        paths.push(html`
            <path d="${pathD}" 
                  stroke="${isSelected ? '#ef4444' : '#6366f1'}" 
                  stroke-width="${isSelected ? '4' : '2.5'}" 
                  fill="none" 
                  marker-end="url(#arrowhead-${isSelected ? 'selected' : 'normal'})" 
                  style="pointer-events: none;" />
        `);
    };

    const walk = (nodes) => {
        nodes.forEach(p => {
            if (!p) return;
            if (viewMode === 'rbs-tab' && p.children) {
                p.children.forEach(c => drawTreeLine(p, c));
            }
            if (viewMode === 'pert-tab' && p.predecessors) {
                p.predecessors.forEach(predId => drawPertLine(predId, p));
            }
            if (p.children) walk(p.children);
        });
    };
    walk(data);

    return html`
        <svg id="connector-svg" style="position:absolute; top:0; left:0; width:10000px; height:10000px; overflow:visible; pointer-events:none; z-index:1;">
            <defs>
                <marker id="arrowhead-normal" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                </marker>
                <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                </marker>
            </defs>
            <g>${paths}</g>
        </svg>
    `;
}
