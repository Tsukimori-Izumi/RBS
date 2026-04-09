import { h } from 'https://esm.sh/preact@10.19.2';
import { html } from 'https://esm.sh/htm@3.1.1/preact';

export function Connector({ store, positions, viewMode, selectedEdge, onSelectEdge }) {
    if (viewMode === 'kanban-tab' || viewMode === 'table-tab') return null;

    const data = store.data;
    if (!data || !Array.isArray(data)) return null;
    
    const paths = [];

    // Card layout constants
    const CARD_WIDTH = 340;
    const CARD_BADGE_W = 36;
    const CARD_CONTENT_START = CARD_BADGE_W; // content starts after badge
    const CARD_ITEM_OFFSET_Y = 85; // approx Y where items start within card
    const CARD_ITEM_HEIGHT = 26;  // approx height per list item row

    const getItemPos = (pos, itemIdxStr, isCardLevel = false) => {
        const sX = pos.x + CARD_CONTENT_START + 20; // inside card, content area
        let sY = pos.y + 50; // card-level: title height
        if (!isCardLevel && itemIdxStr !== undefined) {
            const itemIdx = parseInt(itemIdxStr, 10);
            sY = pos.y + CARD_ITEM_OFFSET_Y + (itemIdx * CARD_ITEM_HEIGHT) + (CARD_ITEM_HEIGHT / 2);
        }
        return { sX, sY };
    };

    const drawTreeLine = (parent, child, sibIdx = 0, totalSibs = 1) => {
        const pPos = positions.get(parent.id);
        const cPos = positions.get(child.id);
        if (!pPos || !cPos || !pPos.visible || !cPos.visible) return;

        let itemIdxStr = undefined;
        let isCardLevel = true;
        if (child.predecessors) {
            const itemPred = child.predecessors.find(pr => pr.startsWith(`${parent.id}#`));
            if (itemPred) {
                itemIdxStr = itemPred.split('#')[1];
                isCardLevel = false;
            }
        }

        const { sX, sY } = getItemPos(pPos, itemIdxStr, isCardLevel);
        const tX = cPos.x + CARD_CONTENT_START;
        const tY = cPos.y + 50;

        // Lower list items get SMALLER midX (shift left) to avoid crossing.
        // Top item (sibIdx=0) gets the farthest-right vertical, bottom gets leftmost.
        const V_STEP = 20;
        const offset = (totalSibs - 1 - sibIdx) * V_STEP;
        const midX = sX + (tX - sX) / 2 + offset;

        const stroke      = isCardLevel ? '#6366f1' : '#94a3b8';
        const strokeWidth = isCardLevel ? '3'       : '1.5';
        const markerEnd   = isCardLevel ? 'arrowhead-card' : 'arrowhead-tree';

        paths.push(html`<path d="M ${sX} ${sY} H ${midX} V ${tY} H ${tX}"
                             stroke="${stroke}" stroke-width="${strokeWidth}" fill="none"
                             marker-end="url(#${markerEnd})" />`);
    };

    const drawPertLine = (predStr, targetNode) => {
        const [predIdStr, itemIdxStr] = predStr.split('#');
        const pPos = positions.get(predIdStr);
        const tPos = positions.get(targetNode.id);
        if (!pPos || !tPos || !pPos.visible || !tPos.visible) return;

        const { sX, sY } = getItemPos(pPos, itemIdxStr);
        const tX = tPos.x + CARD_BADGE_W;
        const tY = tPos.y + 50;
        
        const dx = tX - sX;
        const cp = Math.max(Math.min(Math.abs(dx) * 0.4, 200), 100);
        const pathD = `M ${sX} ${sY} C ${sX + cp} ${sY}, ${tX - cp} ${tY}, ${tX} ${tY}`;

        const isSelected = selectedEdge && selectedEdge.sourceId === predStr && selectedEdge.targetId === targetNode.id;

        // Hit Area (Transparent thick line for easier clicking)
        paths.push(html`
            <path d="${pathD}" 
                  stroke="transparent" 
                  stroke-width="15" 
                  fill="none" 
                  style="cursor: pointer; pointer-events: auto;"
                  onClick=${(e) => {
                      e.stopPropagation();
                      onSelectEdge({ sourceId: predStr, targetId: targetNode.id });
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

    // Sort helper: card-level = -1 (before items), item-level = N, none = Infinity
    const getConnItemIdx = (child, parentId) => {
        if (!child.predecessors) return -1; // no pred = treat as card-level, sort first
        const itemPred = child.predecessors.find(p => p.startsWith(`${parentId}#`));
        if (itemPred) {
            const idx = parseInt(itemPred.split('#')[1], 10);
            return isNaN(idx) ? Infinity : idx;
        }
        if (child.predecessors.includes(parentId)) return -1; // explicit card-level
        return Infinity;
    };

    const walk = (nodes) => {
        nodes.forEach(p => {
            if (!p) return;
            if (viewMode === 'rbs-tab' && p.children) {
                const sorted = [...p.children].sort(
                    (a, b) => getConnItemIdx(a, p.id) - getConnItemIdx(b, p.id)
                );
                sorted.forEach((c, idx) => drawTreeLine(p, c, idx, sorted.length));
            }
            if (viewMode === 'pert-tab' && p.predecessors) {
                p.predecessors.forEach(predStr => drawPertLine(predStr, p));
            }
            if (p.children) walk(p.children);
        });
    };
    walk(data);

    return html`
        <svg id="connector-svg" style="position:absolute; top:0; left:0; width:10000px; height:10000px; overflow:visible; pointer-events:none; z-index:60;">
            <defs>
                <marker id="arrowhead-normal" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                </marker>
                <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                </marker>
                <marker id="arrowhead-tree" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                </marker>
                <marker id="arrowhead-card" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                </marker>
            </defs>
            <g>${paths}</g>
        </svg>
    `;
}
