/**
 * RBS Tool - Store.js (ver 0.2.1)
 * Manages the hierarchical data, history, and CRUD operations.
 */
export class Store {
    constructor() {
        this.defaultText = "\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u306e\u8981\u4ef6";
        this.nextSerial = 1;
        this.history = [];
        this.historyIndex = -1;
        this.listeners = [];
        
        this.data = this.loadData() || this.getDefaultData();
        this.syncSerials();
        this.pushHistory();

        // Explicitly bind methods to avoid context issues
        this.addNode = this.addNode.bind(this);
        this.deleteNode = this.deleteNode.bind(this);
        this.findNodeById = this.findNodeById.bind(this);
        this.findNodeAndParent = this.findNodeAndParent.bind(this);
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
            if (!n.status) n.status = '未着手';
            if (n.children) assignMissingAndSanitize(n.children);
        });
        assignMissingAndSanitize(this.data);
    }

    loadData() { 
        try { 
            const saved = localStorage.getItem('rbs-data'); 
            return saved ? JSON.parse(saved) : null; 
        } catch (e) { return null; } 
    }

    saveData() { 
        try { 
            localStorage.setItem('rbs-data', JSON.stringify(this.data)); 
        } catch (e) { console.error('Save failed', e); } 
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

    findNodeAndParent(nodes, id) {
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id === id) return { node: nodes[i], arr: nodes, index: i };
            if (nodes[i].children) {
                const found = this.findNodeAndParent(nodes[i].children, id);
                if (found) return found;
            }
        }
        return null;
    }

    addNode(parentId, referenceId = null, mode = 'child') {
        const newNode = {
            id: this.generateId(),
            serialId: `R-${this.assignSerial()}`,
            text: '',
            children: [],
            status: '未着手'
        };

        if (!parentId && !referenceId) {
            this.data.push(newNode);
        } else if (mode === 'sibling' && referenceId) {
            const res = this.findNodeAndParent(this.data, referenceId);
            if (res) {
                res.arr.splice(res.index + 1, 0, newNode);
            }
        } else if (parentId) {
            const parent = this.findNodeById(this.data, parentId);
            if (parent) {
                if (!parent.children) parent.children = [];
                parent.children.push(newNode);
            }
        }
        
        this.pushHistory();
        return newNode;
    }

    deleteNode(id) {
        const res = this.findNodeAndParent(this.data, id);
        if (res) {
            if (res.arr === this.data && this.data.length === 1) {
                alert("最後のルートノードは削除できません。");
                return false;
            }
            res.arr.splice(res.index, 1);
            this.pushHistory();
            return true;
        }
        return false;
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

    getNodesFlat(nodes = this.data, list = []) {
        nodes.forEach(n => {
            list.push(n);
            if (n.children) this.getNodesFlat(n.children, list);
        });
        return list;
    }

    getAdjacentNode(id, direction) {
        const flat = this.getNodesFlat();
        const idx = flat.findIndex(n => n.id === id);
        if (idx === -1) return null;
        if (direction === 'next' && idx < flat.length - 1) return flat[idx + 1];
        if (direction === 'prev' && idx > 0) return flat[idx - 1];
        return null;
    }

    applyRecommendations(parentId, text) {
        const lines = text.split('\n')
            .map(l => l.replace(/^[-*]\s*/, '').trim())
            .filter(l => l);
        
        if (lines.length === 0) return;

        const parent = this.findNodeById(this.data, parentId);
        if (parent) {
            parent.children = parent.children || [];
            lines.forEach(line => {
                parent.children.push({
                    id: this.generateId(),
                    serialId: `R-${this.assignSerial()}`,
                    text: line,
                    children: [],
                    status: '未着手',
                    isGhost: true
                });
            });
            this.pushHistory();
        }
    }
}
