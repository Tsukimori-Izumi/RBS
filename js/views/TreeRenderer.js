import { h, render } from 'https://esm.sh/preact';
import htm from 'https://esm.sh/htm';

const html = htm.bind(h);

export class TreeRenderer {
    constructor(store, containerId, onOpenDetails) {
        this.store = store;
        this.container = document.getElementById(containerId);
        this.onOpenDetails = onOpenDetails;
        
        this.container.innerHTML = '';
        this.store.subscribe(() => this.updateAndRender());
    }

    updateAndRender() {
        if (!this.container) return;
        render(this.renderVDOM(), this.container);
    }

    render() {
        this.updateAndRender();
    }

    renderVDOM() {
        return html`
            <div class="tree-root" style="padding-bottom: 50vh;">
                ${this.renderTreeNodes(this.store.data, this.store.data, 0, null)}
            </div>
        `;
    }

    renderTreeNodes(nodes, parentArray, level, parentNode) {
        if (!nodes) return null;
        return nodes.map((node, index) => {
            const status = node.status || '未着手';
            let itemClass = 'node-item';
            if (node.isGhost) itemClass += ' ghost';
            if (node.isLoading) itemClass += ' loading';
            if (node.children && node.children.length > 0) itemClass += ' has-children';
            
            return html`
                <div class="node-wrapper ${level === 0 ? 'root-node' : ''}" key="${node.id}">
                    <div class="${itemClass}" data-id="${node.id}" data-status="${status}" 
                         onDblClick=${() => this.onOpenDetails && this.onOpenDetails(node.id)}>
                         
                        <div class="node-handle">
                            <span class="handle-id">${node.serialId || ''}</span>
                            <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8.5" cy="5" r="2.5"/><circle cx="8.5" cy="12" r="2.5"/><circle cx="8.5" cy="19" r="2.5"/><circle cx="15.5" cy="5" r="2.5"/><circle cx="15.5" cy="12" r="2.5"/><circle cx="15.5" cy="19" r="2.5"/></svg>
                        </div>
                        
                        <div class="node-input-wrapper" data-value="${node.text || ''}">
                            <input class="node-input"
                                   id="input-${node.id}"
                                   value="${node.text || ''}"
                                   placeholder="${level === 0 ? '要件名を入力...' : '詳細を入力...'}"
                                   onInput=${(e) => {
                                       node.text = e.target.value;
                                       e.target.parentElement.dataset.value = e.target.value;
                                       if (node.isGhost) {
                                           delete node.isGhost;
                                           this.store.pushHistory(); // Triggers VDOM recalculation globally
                                       } else {
                                           this.store.saveData(); // Save without full sync re-render to avoid cursor jump
                                       }
                                   }}
                                   onBlur=${() => this.store.pushHistory()}
                                   onKeyDown=${(e) => this.handleKeyDown(e, node, parentArray, index, level, parentNode)} />
                        </div>
                        
                        <div class="node-actions">
                            <button class="ai-btn" title="AI (Prompt Copy)" onClick=${(e) => { e.stopPropagation(); this.handleAIDecomposition(node); }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                            <button class="paste-btn" title="Paste AI Result" onClick=${(e) => { e.stopPropagation(); this.handleAIPaste(node); }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="5" rx="1" ry="1" fill="currentColor"></rect></svg>
                            </button>
                            ${node.isGhost ? html`
                                <button class="confirm-btn" title="Confirm Proposal" onClick=${(e) => { 
                                    e.stopPropagation(); 
                                    delete node.isGhost; 
                                    this.store.pushHistory(); 
                                }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </button>
                            ` : null}
                        </div>
                    </div>
                    
                    ${(node.children && node.children.length > 0) ? html`
                        <div class="node-group">
                            ${this.renderTreeNodes(node.children, node.children, level + 1, node)}
                        </div>
                    ` : null}
                </div>
            `;
        });
    }

    handleKeyDown(e, node, parentArray, index, level, parentNode) {
        if (e.isComposing || e.keyCode === 229) return;
        
        if (e.key === 'Enter') { 
            e.preventDefault(); 
            this.addSibling(parentArray, index); 
        }
        else if (e.key === 'Tab') { 
            e.preventDefault(); 
            this.addChild(node); 
        }
        else if ((e.key === 'Backspace' || e.key === 'Delete') && e.target.value.trim() === '') { 
            e.preventDefault(); 
            this.handleDeletion(parentArray, index, parentNode);
        }
        else if (e.key === 'ArrowUp') { 
            e.preventDefault(); 
            if (index > 0) this.focusNode(parentArray[index - 1].id); 
        }
        else if (e.key === 'ArrowDown') { 
            e.preventDefault(); 
            if (index < parentArray.length - 1) this.focusNode(parentArray[index + 1].id); 
        }
        else if (e.key === 'ArrowLeft') { 
            e.preventDefault(); 
            if (parentNode) this.focusNode(parentNode.id); 
        }
        else if (e.key === 'ArrowRight') { 
            e.preventDefault(); 
            if (node.children && node.children.length > 0) this.focusNode(node.children[0].id); 
        }
    }

    handleDeletion(arr, idx, parentNode) {
        if (!parentNode && arr.length === 1) {
            alert("\u6700\u5f8c\u306e\u30eb\u30fc\u30c8\u30ce\u30fc\u30c9\u306f\u524a\u9664\u3067\u304d\u307e\u305b\u3093\u3002");
            return;
        }

        arr.splice(idx, 1);
        this.store.pushHistory();

        if (arr.length > 0) {
            const focusIdx = Math.max(0, idx - 1);
            this.focusNode(arr[focusIdx].id);
        } else if (parentNode) {
            this.focusNode(parentNode.id);
        }
    }

    addSibling(parentArray, index) { 
        const n = { id: this.store.generateId(), serialId: `R-${this.store.assignSerial()}`, text: '', children: [] }; 
        parentArray.splice(index + 1, 0, n); 
        this.store.pushHistory(); 
        this.focusNode(n.id); 
    }
    
    addChild(node) { 
        const n = { id: this.store.generateId(), serialId: `R-${this.store.assignSerial()}`, text: '', children: [] }; 
        (node.children = node.children || []).push(n); 
        this.store.pushHistory(); 
        this.focusNode(n.id); 
    }
    
    focusNode(id) { 
        // Allow Preact to render first before focusing
        setTimeout(() => { 
            const it = document.getElementById(`input-${id}`); 
            if (it) {
                it.focus(); 
                // Set cursor to end
                const len = it.value.length;
                it.setSelectionRange(len, len);
            }
        }, 30); 
    }

    async handleAIDecomposition(node) {
        if (!node.text.trim()) return;
        node.isLoading = true; 
        this.updateAndRender();

        const ancestors = this.store.getAncestors(node.id) || [];
        const contextNodes = ancestors.slice(-3);
        const contextStr = contextNodes.length > 0 
            ? `\uff08\u30b3\u30f3\u30c6\u30ad\u30b9\u30c8: ${contextNodes.map(n => n.text).join(' > ')}\uff09` 
            : '';

        try {
            const api = window.ai ? window.ai.languageModel : null;
            if (!api) throw new Error("Local AI API not available");
            const session = await api.create({ expectedOutputLanguage: 'ja' });
            const result = await session.prompt(`\u4e0a\u4f4d\u8981\u7d20 ${contextStr} \u306e\u5b50\u8981\u7d20\u3067\u3042\u308b\u300c${node.text}\u300d\u30923\u3064\u304b\u30895\u3064\u306e\u5177\u4f53\u7684\u306a\u4e0b\u4f4d\u8981\u6c42\u306b\u5206\u89e3\u3057\u3001Markdown\u306e\u7b87\u6761\u66f8\u304d\uff08\u30cf\u30a4\u30d5\u30f3\u5f62\u5f0f\uff09\u306e\u307f\u3067\u51fa\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002`);
            this.applyRecommendations(node, result);
        } catch (e) {
            const promptStr = `\u4ee5\u4e0b\u306e\u8981\u7d20 ${contextStr} \u306e\u4e0b\u4f4d\u8981\u6c42\u3068\u3057\u3066\u3001\n\u300c${node.text}\u300d\u30923\u3064\u304b\u30895\u3064\u306e\u5177\u4f53\u7684\u306a\u4e0b\u4f4d\u8981\u6c42\u306b\u5206\u89e3\u3057\u3001Markdown\u306e\u7b87\u6761\u66f8\u304d\uff08\u30cf\u30a4\u30d5\u30f3\u5f62\u5f0f\uff09\u3067\u51fa\u529b\u3057\u3066\u304f\u3060\u3055\u3044\uff1a\n\n\u8981\u6c42\uff1a${node.text}`;
            this.copyToClipboard(promptStr);
        } finally { 
            delete node.isLoading; 
            this.updateAndRender(); 
        }
    }

    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                alert("\u30d7\u30ed\u30f3\u30d7\u30c8\u3092\u30b3\u30d4\u30fc\u3057\u307e\u3057\u305f\uff01Copilot\u306b\u8cbc\u308a\u4ed8\u3051\u3066\u304f\u3060\u3055\u3044\u3002");
            }).catch(err => {
                this.fallbackCopy(text);
            });
        } else {
            this.fallbackCopy(text);
        }
    }

    fallbackCopy(text) {
        const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); alert("\u30d7\u30ed\u30f3\u30d7\u30c8\u3092\u30b3\u30d4\u30fc\u3057\u307e\u3057\u305f\uff01"); }
        catch (e) { window.prompt("\u30d7\u30ed\u30f3\u30d7\u30c8\u3092\u30b3\u30d4\u30fc\uff08Ctrl+C\uff09\u3057\u3066\u304f\u3060\u3055\u3044\uff1a", text); }
        document.body.removeChild(t);
    }

    handleAIPaste(node) {
        const t = prompt("Copilot \u306e\u56de\u7b54\u3092\u3053\u3053\u306b\u8cbc\u308a\u4ed8\u3051\u3066\u304f\u3060\u3055\u3044\uff1a");
        if (t) this.applyRecommendations(node, t);
    }

    applyRecommendations(parentNode, text) {
        const lines = text.split('\n').map(l => l.replace(/^[-*]\s*/, '').trim()).filter(l => l);
        if (!parentNode.children) parentNode.children = [];
        lines.forEach(line => parentNode.children.push({ id: this.store.generateId(), serialId: `R-${this.store.assignSerial()}`, text: line, children: [], isGhost: true }));
        this.store.pushHistory();
    }
}
