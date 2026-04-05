export class LayoutEngine {
    static CARD_WIDTH = 280;
    static CARD_HEIGHT = 100;
    static GAP_X = 100;
    static GAP_Y = 60;

    static calculate(store, viewMode) {
        const nodes = store.data;
        const allNodes = [];
        const flatten = (list) => list.forEach(n => {
            if (!n) return;
            allNodes.push(n);
            if (n.children) flatten(n.children);
        });
        flatten(nodes);

        let positions = new Map();

        switch (viewMode) {
            case 'rbs-tab':
                this.layoutRBS(nodes, positions);
                break;
            case 'pert-tab':
                this.layoutPERT(store, allNodes, positions);
                break;
            case 'kanban-tab':
                this.layoutKanban(allNodes, positions);
                break;
            case 'table-tab':
                this.layoutList(allNodes, positions);
                break;
        }

        return positions;
    }

    static layoutRBS(nodes, positions) {
        let currentY = 100;
        const marginLeft = 100;
        const stepX = this.CARD_WIDTH + this.GAP_X;
        const stepY = this.CARD_HEIGHT + this.GAP_Y;

        const walk = (list, level, x) => {
            list.forEach(node => {
                positions.set(node.id, { x: x, y: currentY, visible: true });
                if (node.children && node.children.length > 0) {
                    walk(node.children, level + 1, x + stepX);
                } else {
                    currentY += stepY;
                }
            });
        };
        walk(nodes, 0, marginLeft);
    }

    static layoutPERT(store, allNodes, positions) {
        // Only include leaf nodes for PERT task flow
        const leafNodes = store.extractLeafNodes(store.data);
        if (leafNodes.length === 0) return;

        const nodeLevels = new Map();
        const successorsMap = new Map();
        
        // Build maps
        leafNodes.forEach(n => {
            successorsMap.set(n.id, []);
        });
        leafNodes.forEach(n => {
            if (n.predecessors) {
                n.predecessors.forEach(pId => {
                    if (successorsMap.has(pId)) {
                        successorsMap.get(pId).push(n.id);
                    }
                });
            }
        });

        const calculateLevel = (nodeId, visited = new Set()) => {
            if (nodeLevels.has(nodeId)) return nodeLevels.get(nodeId);
            if (visited.has(nodeId)) return 0;
            visited.add(nodeId);
            
            const node = leafNodes.find(n => n.id === nodeId);
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

        // Group by levels
        let layers = [];
        leafNodes.forEach(node => {
            const l = nodeLevels.get(node.id) || 0;
            if (!layers[l]) layers[l] = [];
            layers[l].push(node.id);
        });

        // Basic Sorting (Barycenter heuristic)
        for (let i = 1; i < layers.length; i++) {
            const prevLayer = layers[i-1];
            const prevPosMap = new Map(prevLayer.map((id, idx) => [id, idx]));
            
            layers[i].sort((aId, bId) => {
                const getBarycenter = (id) => {
                    const node = leafNodes.find(n => n.id === id);
                    const preds = node?.predecessors?.filter(pId => prevPosMap.has(pId)) || [];
                    if (preds.length === 0) return 0;
                    const sum = preds.reduce((acc, pId) => acc + prevPosMap.get(pId), 0);
                    return sum / preds.length;
                };
                return getBarycenter(aId) - getBarycenter(bId);
            });
        }

        const spacingX = this.CARD_WIDTH + 150;
        const spacingY = this.CARD_HEIGHT + 60;
        const offsetX = 200, offsetY = 150;

        layers.forEach((layerIds, col) => {
            layerIds.forEach((id, rowIdx) => {
                positions.set(id, { x: offsetX + col * spacingX, y: offsetY + rowIdx * spacingY, visible: true });
            });
        });

        // Background hiding
        allNodes.forEach(n => {
            if (!positions.has(n.id)) positions.set(n.id, { x: 0, y: 0, visible: false });
        });
    }

    static layoutKanban(allNodes, positions) {
        const leafNodes = allNodes.filter(n => !n.children || n.children.length === 0);
        const statuses = ['未着手', '実行中', '保留', '完了'];
        const colWidth = this.CARD_WIDTH + 40;
        const rowHeight = this.CARD_HEIGHT + 20;
        const offsetX = 50, offsetY = 100;

        statuses.forEach((status, colIdx) => {
            const nodesInStatus = leafNodes.filter(n => (n.status || '未着手') === status);
            nodesInStatus.forEach((node, rowIdx) => {
                positions.set(node.id, { x: offsetX + colIdx * colWidth, y: offsetY + rowIdx * rowHeight, visible: true });
            });
        });

        allNodes.forEach(n => {
            if (!positions.has(n.id)) positions.set(n.id, { x: 0, y: 0, visible: false });
        });
    }

    static layoutList(allNodes, positions) {
        const rowHeight = this.CARD_HEIGHT + 10;
        const offsetX = 50, offsetY = 50;
        allNodes.forEach((node, idx) => {
            positions.set(node.id, { x: offsetX, y: offsetY + idx * rowHeight, visible: true });
        });
    }
}
