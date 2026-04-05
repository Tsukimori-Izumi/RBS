export class DetailsPane {
    constructor(store, onRequestCenter) {
        this.store = store;
        this.onRequestCenter = onRequestCenter;
        this.editingNodeId = null;
        this.currentChecklist = [];
        
        this.initDOM();
        this.bindEvents();
    }
    
    initDOM() {
        this.pane = document.getElementById('details-pane');
        this.closeBtn = document.getElementById('close-pane-btn');
        this.saveBtn = document.getElementById('save-detail-btn');
        this.textInput = document.getElementById('detail-text-input');
        this.descInput = document.getElementById('detail-desc-input');
        this.statusInput = document.getElementById('detail-status-input');
        this.optInput = document.getElementById('detail-optimistic-input');
        this.likInput = document.getElementById('detail-likely-input');
        this.pesInput = document.getElementById('detail-pessimistic-input');
        this.checkContainer = document.getElementById('checklist-container');
        this.addCheckBtn = document.getElementById('add-checklist-item-btn');
        this.idBadge = document.getElementById('detail-id-readonly');
    }
    
    bindEvents() {
        this.closeBtn.onclick = () => this.close();
        this.saveBtn.onclick = () => this.saveNodeDetails();
        this.addCheckBtn.onclick = () => this.addChecklistItem();
        
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.pane.classList.contains('open')) {
                this.close();
            }
        });
    }
    
    open(nodeId) {
        const node = this.store.findNodeById(this.store.data, nodeId);
        if (!node) return;
        
        this.editingNodeId = nodeId;
        this.idBadge.value = node.serialId || '';
        this.textInput.value = node.text || '';
        this.descInput.value = node.description || '';
        this.statusInput.value = node.status || '未着手';
        this.optInput.value = node.optimistic || 0;
        this.likInput.value = node.likely || 0;
        this.pesInput.value = node.pessimistic || 0;
        
        this.currentChecklist = JSON.parse(JSON.stringify(node.checklist || []));
        this.renderChecklist();
        
        document.body.classList.add('details-open');
        this.pane.classList.add('open');
        
        setTimeout(() => this.onRequestCenter && this.onRequestCenter(), 410);
    }
    
    close() {
        document.body.classList.remove('details-open');
        this.pane.classList.remove('open');
        this.editingNodeId = null;
        
        setTimeout(() => this.onRequestCenter && this.onRequestCenter(), 410);
    }
    
    renderChecklist() {
        this.checkContainer.innerHTML = '';
        this.currentChecklist.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'checklist-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = item.done;
            checkbox.onchange = (e) => { item.done = e.target.checked; };

            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.value = item.text || '';
            textInput.placeholder = '\u5185\u5bb9\u3092\u5165\u529b...';
            textInput.oninput = (e) => { item.text = e.target.value; };

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-item-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => {
                this.currentChecklist.splice(index, 1);
                this.renderChecklist();
            };

            row.appendChild(checkbox);
            row.appendChild(textInput);
            row.appendChild(removeBtn);
            this.checkContainer.appendChild(row);
        });
    }

    addChecklistItem() {
        if (!this.currentChecklist) this.currentChecklist = [];
        this.currentChecklist.push({ text: '', done: false });
        this.renderChecklist();
    }

    saveNodeDetails() {
        if (!this.editingNodeId) return;
        const node = this.store.findNodeById(this.store.data, this.editingNodeId);
        if (node) {
            node.text = this.textInput.value;
            node.description = this.descInput.value;
            node.status = this.statusInput.value;
            node.optimistic = parseInt(this.optInput.value) || 0;
            node.likely = parseInt(this.likInput.value) || 0;
            node.pessimistic = parseInt(this.pesInput.value) || 0;
            node.checklist = JSON.parse(JSON.stringify(this.currentChecklist));
            
            this.store.pushHistory(); // Triggers re-render across all views
            this.close();
        }
    }
}
