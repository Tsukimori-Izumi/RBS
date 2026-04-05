import { h, render } from 'https://esm.sh/preact';
import htm from 'https://esm.sh/htm';

// Initialize HTM to use Preact's hyperscript function
const html = htm.bind(h);

export class KanbanRenderer {
    constructor(store, onOpenDetails) {
        this.store = store;
        this.onOpenDetails = onOpenDetails;
        this.container = document.querySelector('#kanban-tab');
        this.statuses = ['未着手', '実行中', '保留', '完了'];
        
        this.state = {
            dragOverStatus: null
        };

        // Clear statically rendered board from HTML so Preact takes full control
        this.container.innerHTML = '';

        this.store.subscribe(() => this.updateAndRender());
    }

    updateAndRender() {
        const vdom = this.renderVDOM();
        render(vdom, this.container);
    }
    
    render() {
        this.updateAndRender();
    }

    renderVDOM() {
        const leafNodes = this.store.extractLeafNodes(this.store.data);
        
        return html`
            <div class="kanban-board">
                ${this.statuses.map(status => this.renderColumn(status, leafNodes))}
            </div>
        `;
    }

    renderColumn(status, leafNodes) {
        const filteredNodes = leafNodes.filter(n => (n.status || '未着手') === status);
        const isDragOver = this.state.dragOverStatus === status;

        return html`
            <div class="kanban-column ${isDragOver ? 'drag-over' : ''}" data-status="${status}"
                 onDragOver=${(e) => { 
                     e.preventDefault(); 
                     if (this.state.dragOverStatus !== status) {
                         this.state.dragOverStatus = status; 
                         this.updateAndRender(); 
                     }
                 }}
                 onDragLeave=${() => { 
                     if (this.state.dragOverStatus === status) { 
                         this.state.dragOverStatus = null; 
                         this.updateAndRender(); 
                     } 
                 }}
                 onDrop=${(e) => {
                     e.preventDefault();
                     this.state.dragOverStatus = null;
                     const taskId = e.dataTransfer.getData('task-id');
                     if (taskId) {
                         // State logic explicitly updates data model
                         const node = this.store.findNodeById(this.store.data, taskId);
                         if (node && node.status !== status) {
                             node.status = status;
                             this.store.pushHistory(); // Store triggers subscriber update globally!
                         } else {
                             // If no state change, just remove drag over state
                             this.updateAndRender();
                         }
                     }
                 }}>
                
                <h3>${status} <span class="count">${filteredNodes.length}</span></h3>
                
                <div class="kanban-items">
                    ${filteredNodes.map(node => this.renderTask(node, status))}
                </div>
            </div>
        `;
    }

    renderTask(node, status) {
        const ancestors = this.store.getAncestors(node.id) || [];
        const pathStr = ancestors.map(a => a.text).join(' > ');

        return html`
            <div class="kanban-task" draggable="true" key="${node.id}" data-id="${node.id}" data-status="${status}"
                 onDragStart=${(e) => {
                     e.dataTransfer.setData('task-id', node.id);
                     e.dataTransfer.effectAllowed = 'move';
                     // Add subtle delay to allow drag to initiate before adding styles
                     setTimeout(() => e.target.classList.add('dragging'), 0);
                 }}
                 onDragEnd=${(e) => e.target.classList.remove('dragging')}
                 onDblClick=${() => this.onOpenDetails && this.onOpenDetails(node.id)}>
                 
                 <div class="task-handle">
                     <span class="handle-id">${node.serialId || ''}</span>
                     <svg viewBox="0 0 24 24" fill="currentColor">
                         <circle cx="8.5" cy="5" r="2.5"/><circle cx="8.5" cy="12" r="2.5"/><circle cx="8.5" cy="19" r="2.5"/>
                         <circle cx="15.5" cy="5" r="2.5"/><circle cx="15.5" cy="12" r="2.5"/><circle cx="15.5" cy="19" r="2.5"/>
                     </svg>
                 </div>
                 <div class="task-content">
                     <div class="context">${pathStr}</div>
                     <div class="desc">${node.text || '(No description)'}</div>
                 </div>
            </div>
        `;
    }
}
