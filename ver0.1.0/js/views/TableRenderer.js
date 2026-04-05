import { h, render } from 'https://esm.sh/preact';
import htm from 'https://esm.sh/htm';

const html = htm.bind(h);

export class TableRenderer {
    constructor(store, onOpenDetails) {
        this.store = store;
        this.onOpenDetails = onOpenDetails;
        this.tableBody = document.getElementById('table-body');
        
        this.state = {
            draggedId: null,
            dragOverId: null,
            dragSide: null // 'top' or 'bottom'
        };

        this.tableBody.innerHTML = '';
        this.store.subscribe(() => this.updateAndRender());
    }

    updateAndRender() {
        if (!this.tableBody) return;
        const vdom = this.renderVDOM();
        render(vdom, this.tableBody);
    }
    
    render() {
        this.updateAndRender();
    }

    renderVDOM() {
        const allNodes = [];
        const flatScan = (nodes) => nodes.forEach(n => {
            allNodes.push(n);
            if (n.children) flatScan(n.children);
        });
        flatScan(this.store.data);

        // Provide array of TRs
        return html`${allNodes.map(node => this.renderRow(node))}`;
    }

    renderRow(node) {
        const status = node.status || '未着手';
        const sCol = {
            '未着手': '#94a3b8', '実行中': '#6366f1', '保留': '#f59e0b', '完了': '#22c55e'
        }[status] || '#94a3b8';

        const isDragging = this.state.draggedId === node.id;
        const isDragOver = this.state.dragOverId === node.id;
        const dragClass = isDragging ? 'dragging' : (isDragOver ? (this.state.dragSide === 'top' ? 'drag-over-top' : 'drag-over-bottom') : '');

        // Safely parse description newlines into <br> tags via VDOM
        const descLines = node.description ? node.description.split('\n') : [];
        const descVDOM = descLines.length > 0
            ? descLines.map((line, i) => html`${line}${i < descLines.length - 1 ? html`<br/>` : ''}`)
            : html`<span style="color:#cbd5e1;font-size:12px;">(未設定)</span>`;

        return html`
            <tr class="${dragClass}"
                key="${node.id}"
                data-id="${node.id}"
                data-status="${status}"
                draggable="true"
                onDragStart=${(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', node.id);
                    // Defer setting dragging state so browser can capture the ghost image before CSS changes
                    setTimeout(() => {
                        this.state.draggedId = node.id;
                        this.updateAndRender();
                    }, 0);
                }}
                onDragEnd=${() => {
                    this.state.draggedId = null;
                    this.state.dragOverId = null;
                    this.state.dragSide = null;
                    this.updateAndRender();
                }}
                onDragOver=${(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (this.state.draggedId === node.id) return;

                    const tr = e.currentTarget;
                    const rect = tr.getBoundingClientRect();
                    const mid = rect.top + rect.height / 2;
                    const side = e.clientY < mid ? 'top' : 'bottom';

                    if (this.state.dragOverId !== node.id || this.state.dragSide !== side) {
                        this.state.dragOverId = node.id;
                        this.state.dragSide = side;
                        this.updateAndRender();
                    }
                }}
                onDragLeave=${(e) => {
                    // Ignore leaving to children components
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                        if (this.state.dragOverId === node.id) {
                            this.state.dragOverId = null;
                            this.state.dragSide = null;
                            this.updateAndRender();
                        }
                    }
                }}
                onDrop=${(e) => {
                    e.preventDefault();
                    const sourceId = e.dataTransfer.getData('text/plain');
                    const targetId = node.id;
                    const side = this.state.dragSide === 'top' ? 'before' : 'after';

                    this.state.draggedId = null;
                    this.state.dragOverId = null;
                    this.state.dragSide = null;

                    if (sourceId && sourceId !== targetId) {
                        this.store.moveNode(sourceId, targetId, side);
                    } else {
                        this.updateAndRender();
                    }
                }}
                onDblClick=${() => this.onOpenDetails && this.onOpenDetails(node.id)}>
                
                <td class="td-handle">
                    <div class="table-handle-content">
                        <span>${node.serialId || ''}</span>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="8.5" cy="5" r="2.5"/><circle cx="8.5" cy="12" r="2.5"/><circle cx="8.5" cy="19" r="2.5"/>
                            <circle cx="15.5" cy="5" r="2.5"/><circle cx="15.5" cy="12" r="2.5"/><circle cx="15.5" cy="19" r="2.5"/>
                        </svg>
                    </div>
                </td>
                <td class="td-id">${node.serialId || ''}</td>
                <td class="td-text">${node.text || '(未入力)'}</td>
                <td class="td-status">
                    <span class="status-cell" style="background: ${sCol}22; color: ${sCol}; border: 1px solid ${sCol}44">
                        ${status}
                    </span>
                </td>
                <td class="td-desc">${descVDOM}</td>
                <td class="td-checklist">${this.generateChecklistVDOM(node.checklist)}</td>
            </tr>
        `;
    }

    generateChecklistVDOM(checklist) {
        if (!checklist || checklist.length === 0) {
            return html`<span style="color:#cbd5e1;font-size:12px;">(なし)</span>`;
        }
        
        return html`
            <div style="display:flex;flex-direction:column;gap:4px;font-size:12px;">
                ${checklist.map(item => {
                    const color = item.done ? 'var(--text-muted)' : 'var(--text)';
                    const decoration = item.done ? 'line-through' : 'none';
                    return html`
                        <div style="display:flex;align-items:flex-start;gap:6px;color:${color};text-decoration:${decoration}">
                            ${item.done 
                                ? html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="20 6 9 17 4 12"></polyline></svg>`
                                : html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"></circle></svg>`
                            }
                            <span>${item.text}</span>
                        </div>
                    `;
                })}
            </div>
        `;
    }
}
