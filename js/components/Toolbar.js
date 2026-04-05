export class Toolbar {
    constructor(store, appInterface) {
        this.store = store;
        this.appInterface = appInterface; 
        
        this.clearBtn = document.getElementById('clear-btn');
        this.exportBtn = document.getElementById('export-btn');
        this.resetViewBtn = document.getElementById('reset-view-btn');
        this.undoBtn = document.getElementById('undo-btn');
        this.redoBtn = document.getElementById('redo-btn');
        this.exportJsonBtn = document.getElementById('export-json-btn');
        this.exportExcelBtn = document.getElementById('export-excel-btn');
        this.importJsonBtn = document.getElementById('import-json-btn');
        this.jsonInput = document.getElementById('json-input');
        
        this.fontSize = 14;
        this.fontIncreaseBtn = document.getElementById('font-increase-btn');
        this.fontDecreaseBtn = document.getElementById('font-decrease-btn');
        
        this.store.subscribe(() => this.updateUndoRedoBtns());
        this.bindEvents();
    }
    
    bindEvents() {
        this.clearBtn.onclick = () => { 
            if (confirm("\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u3092\u521d\u671f\u5316\u3057\u307e\u3059\u304b\uff1f\u73fe\u5728\u306e\u30c4\u30ea\u30fc\u306f\u3059\u3079\u3066\u6d88\u53bb\u3055\u308c\u307e\u3059\u3002")) { 
                localStorage.removeItem('rbs-data'); 
                this.store.data = this.store.getDefaultData();
                this.store.syncSerials();
                this.store.history = [];
                this.store.historyIndex = -1;
                this.store.pushHistory();
                this.appInterface.resetView();
            } 
        };
        
        this.exportBtn.onclick = async () => this.handleImageExport();
        this.exportExcelBtn.onclick = () => this.handleExcelExport();
        this.resetViewBtn.onclick = () => this.appInterface.resetView();
        
        if (this.fontIncreaseBtn) {
            this.fontIncreaseBtn.onclick = () => {
                this.fontSize = Math.min(24, this.fontSize + 2);
                document.documentElement.style.setProperty('--app-font-size', `${this.fontSize}px`);
                if (this.appInterface && this.appInterface.fitView) this.appInterface.fitView();
            };
        }
        if (this.fontDecreaseBtn) {
            this.fontDecreaseBtn.onclick = () => {
                this.fontSize = Math.max(10, this.fontSize - 2);
                document.documentElement.style.setProperty('--app-font-size', `${this.fontSize}px`);
                if (this.appInterface && this.appInterface.fitView) this.appInterface.fitView();
            };
        }
        
        this.undoBtn.onclick = () => this.store.undo();
        this.redoBtn.onclick = () => this.store.redo();
        
        this.exportJsonBtn.onclick = () => {
            const blob = new Blob([JSON.stringify(this.store.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rbs-data-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };

        this.importJsonBtn.onclick = () => this.jsonInput.click();
        this.jsonInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (re) => {
                try {
                    const imported = JSON.parse(re.target.result);
                    if (Array.isArray(imported)) {
                        this.store.data = imported;
                        this.store.pushHistory();
                        this.appInterface.resetView();
                        alert("\u30a4\u30f3\u30dd\u30fc\u30c8\u304c\u5b8c\u4e86\u3057\u307e\u3057\u305f\u3002");
                    }
                } catch (err) {
                    alert("\u30d5\u30a1\u30a4\u30eb\u306e\u8aad\u307f\u8fbc\u307f\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002");
                }
            };
            reader.readAsText(file);
            e.target.value = null; // reset
        };
    }

    updateUndoRedoBtns() {
        if (this.undoBtn) this.undoBtn.disabled = this.store.historyIndex <= 0;
        if (this.redoBtn) this.redoBtn.disabled = this.store.historyIndex >= this.store.history.length - 1;
    }

    handleExcelExport() {
        if (typeof XLSX === 'undefined') {
            alert("Excel書き出しライブラリが読み込まれていません。");
            return;
        }

        const flattened = [];
        const scan = (nodes, level = 0) => {
            nodes.forEach(node => {
                const checklistStr = (node.checklist || [])
                    .map(item => `${item.done ? '[x]' : '[ ]'} ${item.text}`)
                    .join('\n');

                flattened.push({
                    '階層': level + 1,
                    'ID': node.serialId || '',
                    '名称': node.text || '',
                    'ステータス': node.status || '未着手',
                    '詳細説明': node.description || '',
                    'チェックリスト': checklistStr,
                    '楽観時間': node.optimistic || 0,
                    '堅実時間': node.likely || 0,
                    '悲観時間': node.pessimistic || 0
                });
                if (node.children && node.children.length > 0) {
                    scan(node.children, level + 1);
                }
            });
        };
        scan(this.store.data);

        const ws = XLSX.utils.json_to_sheet(flattened);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Requirements");

        XLSX.writeFile(wb, `rbs-export-${new Date().toISOString().slice(0,10)}.xlsx`);
    }

    async handleImageExport() {
        if (typeof html2canvas === 'undefined') {
            alert("\u753b\u50cf\u51fa\u529b\u30e9\u30a4\u30d6\u30e9\u30ea\u304c\u8aad\u307f\u8fbc\u3081\u3066\u3044\u307e\u305b\u3093\u3002");
            return;
        }

        const btnOriginalHTML = this.exportBtn.innerHTML;
        this.exportBtn.innerHTML = '<span>Compressing...</span>';
        this.exportBtn.disabled = true;

        const treeContainer = document.getElementById('tree-container');
        const originalTransform = treeContainer.style.transform;
        treeContainer.style.transform = 'none';

        try {
            const canvas = await html2canvas(treeContainer, {
                backgroundColor: '#f1f5f9',
                scale: 2,
                useCORS: true,
                logging: false
            });

            const link = document.createElement('a');
            link.download = `rbs-capture-${new Date().toISOString().slice(0,10)}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Image export failed', err);
            alert("\u753b\u50cf\u306e書き出しに失敗しました。");
        } finally {
            treeContainer.style.transform = originalTransform;
            this.exportBtn.innerHTML = btnOriginalHTML;
            this.exportBtn.disabled = false;
        }
    }
}
