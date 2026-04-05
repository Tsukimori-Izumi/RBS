export class Store {
    constructor() {
        this.defaultText = "\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u306e\u8981\u4ef6";
        this.nextSerial = 1;
        this.history = [];
        this.historyIndex = -1;
        this.listeners = [];
        
        this.data = this.loadData() || this.getDefaultData();
        this.syncSerials();
        this.pushHistory(); // Initial state
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notify() {
        this.listeners.forEach(cb => cb());
        this.saveData();
    }

    getDefaultData() {
        return [{ id: this.generateId(), serialId: `R-${this.assignSerial()}`, text: this.defaultText, children: [] }];
    }

    generateId() { 
        return 'node-' + Math.random().toString(36).substr(2, 9); 
    }

    assignSerial() { 
        return this.nextSerial++; 
    }

    syncSerials() {
        let max = 0;
        const findMax = (nodes) => nodes.forEach(n => {
            if (n.serialId && typeof n.serialId === 'string') {
                const match = n.serialId.match(/\d+/);
                if (match) {
                    const num = parseInt(match[0]);
                    if (!isNaN(num) && num > max) max = num;
                }
            }
            if (n.children) findMax(n.children);
        });
        
        findMax(this.data);
        this.nextSerial = max + 1;

        const assignMissingAndSanitize = (nodes) => nodes.forEach(n => {
            if (!n.serialId) n.serialId = `R-${this.assignSerial()}`;
            if (!n.status || n.status === 'TODO' || n.status === 'Todo') n.status = '未着手';
            const valid = ['未着手','実行中','保留','完了'];
            if (!valid.includes(n.status)) n.status = '未着手';
            if (n.children) assignMissingAndSanitize(n.children);
        });
        assignMissingAndSanitize(this.data);
    }

    loadData() { 
        try { 
            const saved = localStorage.getItem('rbs-data'); 
            return saved ? JSON.parse(saved) : null; 
        } catch (e) { 
            return null; 
        } 
    }

    saveData() { 
        try { 
            localStorage.setItem('rbs-data', JSON.stringify(this.data)); 
        } catch (e) { 
            console.error('Save failed', e); 
        } 
    }

    pushHistory() {
        const state = JSON.stringify(this.data);
        if (this.historyIndex >= 0 && this.history[this.historyIndex] === state) return;
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        if (this.history.length > 50) this.history.shift();
        else this.historyIndex++;
        this.notify();
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.data = JSON.parse(this.history[this.historyIndex]);
            this.notify();
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.data = JSON.parse(this.history[this.historyIndex]);
            this.notify();
        }
    }

    findNodeById(nodes, id) {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
                const found = this.findNodeById(node.children, id);
                if (found) return found;
            }
        }
        return null;
    }

    getAncestors(targetId, nodes = this.data, path = []) {
        for (const node of nodes) {
            if (node.id === targetId) return path;
            if (node.children) {
                const found = this.getAncestors(targetId, node.children, [...path, node]);
                if (found) return found;
            }
        }
        return null;
    }

    extractLeafNodes(nodes, result = []) {
        nodes.forEach(node => {
            if (!node.children || node.children.length === 0) {
                result.push(node);
            } else {
                this.extractLeafNodes(node.children, result);
            }
        });
        return result;
    }

    addPredecessor(targetId, sourceId) {
        const targetNode = this.findNodeById(this.data, targetId);
        if (targetNode) {
            targetNode.predecessors = targetNode.predecessors || [];
            if (!targetNode.predecessors.includes(sourceId)) {
                targetNode.predecessors.push(sourceId);
                this.pushHistory();
            }
        }
    }

    removePredecessor(targetId, predId) {
        const targetNode = this.findNodeById(this.data, targetId);
        if (targetNode && targetNode.predecessors) {
            targetNode.predecessors = targetNode.predecessors.filter(id => id !== predId);
            this.pushHistory();
        }
    }

    moveNode(sourceId, targetId, side) {
        const findNodeAndParent = (nodes, id) => {
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === id) return { node: nodes[i], arr: nodes, index: i };
                if (nodes[i].children) {
                    const found = findNodeAndParent(nodes[i].children, id);
                    if (found) return found;
                }
            }
            return null;
        };

        const isDescendant = (parent, childId) => {
            if (!parent.children) return false;
            return parent.children.some(c => c.id === childId || isDescendant(c, childId));
        };

        const src = findNodeAndParent(this.data, sourceId);
        const tgt = findNodeAndParent(this.data, targetId);

        if (!src || !tgt || src.node.id === tgt.node.id) return;

        if (isDescendant(src.node, tgt.node.id)) {
            alert("\u4e0a\u4f4d\u8981\u7d20\u3092\u4e0b\u4f4d\u8981\u7d20\u306e\u914d\u4e0b\u306b\u79fb\u52d5\u3059\u308b\u3053\u3068\u306f\u3067\u304d\u307e\u305b\u3093\u3002");
            return;
        }

        src.arr.splice(src.index, 1);
        const newTgt = findNodeAndParent(this.data, targetId);
        const insertIdx = side === 'before' ? newTgt.index : newTgt.index + 1;
        newTgt.arr.splice(insertIdx, 0, src.node);

        this.pushHistory();
    }
}
