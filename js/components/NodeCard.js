import { h } from 'https://esm.sh/preact@10.19.2';
import { useState } from 'https://esm.sh/preact@10.19.2/hooks';
import { html } from 'https://esm.sh/htm@3.1.1/preact';

export function NodeCard({ node, pos, onOpenDetails, store: propStore, viewMode }) {
    if (!node || !pos || !pos.visible) return null;

    const store = (propStore && propStore.addNode) ? propStore : window.store;
    const [isLoading, setIsLoading] = useState(false);

    const style = `
        --pos-x: ${pos.x}px;
        --pos-y: ${pos.y}px;
        transform: translate(${pos.x}px, ${pos.y}px);
        width: 340px;
        min-height: 200px;
        height: max-content;
        display: ${pos.visible ? 'flex' : 'none'};
    `;

    const handleInput = (e) => {
        node.text = e.target.value;
        if (node.isGhost) delete node.isGhost;
        store.saveData();
    };

    const handleBlur = () => {
        store.pushHistory();
    };

    const handleKeyDown = (e) => {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            node.items = node.items || [];
            node.items.push('');
            store.saveData();
            store.notify();
            const newIdx = node.items.length - 1;
            setTimeout(() => {
                const el = document.getElementById(`input-${node.id}-item-${newIdx}`);
                if (el) el.focus();
            }, 50);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const newNode = store.addNode(null, node.id, 'sibling');
            if (newNode) focusNode(newNode.id);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const newNode = store.addNode(node.id);
            if (newNode) {
                store.addPredecessor(newNode.id, node.id); // card-level (no #idx)
                focusNode(newNode.id);
            }
        } else if ((e.key === 'Backspace' || e.key === 'Delete') && e.target.value.trim() === '') {
            e.preventDefault();
            if (confirm('このノードを削除しますか？')) {
                store.deleteNode(node.id);
                store.pushHistory();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const currentEl = document.getElementById(`input-${node.id}`);
            if (currentEl) {
                const rect = currentEl.getBoundingClientRect();
                const allInputs = Array.from(document.querySelectorAll('.card-title-input'));
                let closest = null, minDist = Infinity;
                allInputs.forEach(inp => {
                    const r = inp.getBoundingClientRect();
                    if (r.top < rect.top - 5) {
                        const dist = Math.pow(r.top - rect.top, 2) + Math.pow(r.left - rect.left, 2);
                        if (dist < minDist) { minDist = dist; closest = inp; }
                    }
                });
                if (closest) closest.focus();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (node.items && node.items.length > 0) {
                setTimeout(() => {
                    const el = document.getElementById(`input-${node.id}-item-0`);
                    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
                }, 50);
            } else {
                const currentEl = document.getElementById(`input-${node.id}`);
                if (currentEl) {
                    const rect = currentEl.getBoundingClientRect();
                    const allInputs = Array.from(document.querySelectorAll('.card-title-input'));
                    let closest = null, minDist = Infinity;
                    allInputs.forEach(inp => {
                        const r = inp.getBoundingClientRect();
                        if (r.top > rect.top + 5) {
                            const dist = Math.pow(r.top - rect.top, 2) + Math.pow(r.left - rect.left, 2);
                            if (dist < minDist) { minDist = dist; closest = inp; }
                        }
                    });
                    if (closest) closest.focus();
                }
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const ancestors = store.getAncestors(node.id);
            if (ancestors && ancestors.length > 0) {
                focusNode(ancestors[ancestors.length - 1].id);
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (node.children && node.children.length > 0) {
                focusNode(node.children[0].id);
            }
        }
    };

    const focusNode = (id) => {
        setTimeout(() => {
            const input = document.getElementById(`input-${id}`);
            if (input) {
                input.focus();
                const len = input.value.length;
                input.setSelectionRange(len, len);
            }
        }, 100);
    };

    const handleAIDecomposition = async (e) => {
        e.stopPropagation();
        if (!node.text.trim()) return;

        setIsLoading(true);
        const ancestors = store.getAncestors(node.id) || [];
        const contextStr = ancestors.length > 0 
            ? `（コンテキスト: ${ancestors.map(n => n.text).join(' > ')}）` 
            : '';

        const promptStr = `以下の要素 ${contextStr} の下位要求として、\n「${node.text}」を3つから5つの具体的な下位要求に分解し、Markdownの箇条書き（ハイフン形式）のみで出力してください：\n\n要求：${node.text}`;

        try {
            // Check for Local AI (Window AI)
            const api = window.ai ? window.ai.languageModel : null;
            if (api) {
                const session = await api.create({ expectedOutputLanguage: 'ja' });
                const result = await session.prompt(promptStr);
                store.applyRecommendations(node.id, result);
            } else {
                // Fallback: Copy to clipboard
                await navigator.clipboard.writeText(promptStr);
                alert("分解用プロンプトをコピーしました！Copilotに貼り付けて回答をもらってください。");
            }
        } catch (err) {
            console.error("AI Error:", err);
            // Fallback manual copy
            const t = document.createElement("textarea"); t.value = promptStr; document.body.appendChild(t); t.select();
            document.execCommand('copy'); document.body.removeChild(t);
            alert("プロンプトをコピーしました。");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAIPaste = (e) => {
        e.stopPropagation();
        const t = prompt("Copilot の回答をここに貼り付けてください（箇条書き形式）：");
        if (t) store.applyRecommendations(node.id, t);
    };

    const handleConfirmGhost = (e) => {
        e.stopPropagation();
        delete node.isGhost;
        store.pushHistory();
    };

    const handleDragStart = (e) => {
        e.dataTransfer.setData('source-id', node.id);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => e.target.classList.add('dragging'), 0);
    };

    const handleDrop = (e) => {
        if (viewMode === 'pert-tab') {
            e.preventDefault();
            const sourceInfo = e.dataTransfer.getData('source-id');
            if (sourceInfo && sourceInfo.split('#')[0] !== node.id) {
                store.addPredecessor(node.id, sourceInfo);
                store.pushHistory();
            }
        }
    };

    const [isEntering, setIsEntering] = useState(true);

    // Remove entry animation class after it starts to allow transitions to take over
    useState(() => {
        setTimeout(() => setIsEntering(false), 800);
    }, []);

    const handleDateInput = (e) => {
        node.date = e.target.value;
        store.saveData();
    };

    const handleItemInput = (idx, e) => {
        node.items[idx] = e.target.value;
        store.saveData();
    };

    const addItem = (e) => {
        e.stopPropagation();
        node.items = node.items || [];
        node.items.push('');
        store.saveData();
        store.notify();
    };

    const handleItemKeyDown = (idx, e) => {
        e.stopPropagation();
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            node.items.splice(idx + 1, 0, '');
            store.saveData();
            store.notify();
            setTimeout(() => {
                const el = document.getElementById(`input-${node.id}-item-${idx + 1}`);
                if (el) { el.focus(); }
            }, 50);
        } else if ((e.key === 'Backspace' || e.key === 'Delete') && e.target.value === '') {
            e.preventDefault();
            node.items.splice(idx, 1);
            store.saveData();
            store.notify();
            setTimeout(() => {
                if (idx > 0) {
                    const el = document.getElementById(`input-${node.id}-item-${idx - 1}`);
                    if (el) { el.focus(); }
                } else {
                    focusNode(node.id);
                }
            }, 50);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (idx > 0) {
                const el = document.getElementById(`input-${node.id}-item-${idx - 1}`);
                if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
            } else {
                focusNode(node.id);
                const currentEl = document.getElementById(`input-${node.id}-item-${idx}`);
                if (currentEl) {
                    const rect = currentEl.getBoundingClientRect();
                    const allInputs = Array.from(document.querySelectorAll('.card-title-input'));
                    let closest = null, minDist = Infinity;
                    allInputs.forEach(inp => {
                        const r = inp.getBoundingClientRect();
                        if (r.top < rect.top - 5) {
                            const dist = Math.pow(r.top - rect.top, 2) + Math.pow(r.left - rect.left, 2);
                            if (dist < minDist) { minDist = dist; closest = inp; }
                        }
                    });
                    if (closest) closest.focus();
                }
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (idx < node.items.length - 1) {
                const el = document.getElementById(`input-${node.id}-item-${idx + 1}`);
                if (el) el.focus();
            } else {
                const currentEl = document.getElementById(`input-${node.id}-item-${idx}`);
                if (currentEl) {
                    const rect = currentEl.getBoundingClientRect();
                    const allInputs = Array.from(document.querySelectorAll('.card-title-input'));
                    let closest = null, minDist = Infinity;
                    allInputs.forEach(inp => {
                        const r = inp.getBoundingClientRect();
                        if (r.top > rect.top + 5) {
                            const dist = Math.pow(r.top - rect.top, 2) + Math.pow(r.left - rect.left, 2);
                            if (dist < minDist) { minDist = dist; closest = inp; }
                        }
                    });
                    if (closest) closest.focus();
                }
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const newNode = store.addNode(node.id);
            if (newNode) {
                store.addPredecessor(newNode.id, `${node.id}#${idx}`);
                focusNode(newNode.id);
            }
        }
    };

    return html`
        <div class="node-card ${node.isGhost ? 'ghost' : ''} ${isLoading ? 'loading' : ''} ${isEntering ? 'entering' : ''}" 
             style="${style}"
             draggable="true"
             onDragStart=${handleDragStart}
             onDragEnd=${(e) => e.target.classList.remove('dragging')}
             onDragOver=${(e) => viewMode === 'pert-tab' && e.preventDefault()}
             onDrop=${handleDrop}
             onDblClick=${() => onOpenDetails(node.id)}>
             
            <div class=\"card-id-badge\" data-status=\"${node.status || '未着手'}\">${store.getHierarchicalId(node.id) || node.serialId || ''}</div>
            <button class=\"card-delete-btn\" title=\"削除\" onClick=${(e) => {
                e.stopPropagation();
                if (confirm('このノードを削除しますか？')) {
                    store.deleteNode(node.id);
                    store.pushHistory();
                }
            }}>×</button>
            
            <div class="card-content">
                <div class="card-top-row">
                    <textarea class="card-title-input" 
                           id="input-${node.id}"
                           onInput=${handleInput}
                           onBlur=${handleBlur}
                           onKeyDown=${handleKeyDown}
                           placeholder="タイトル...">${node.text || ''}</textarea>
                    <input type="date" class="card-date-input" value="${node.date || ''}" onInput=${handleDateInput} onBlur=${handleBlur} />
                </div>
                
                <div class="card-middle-row">
                    <div class="card-items-list">
                        ${(node.items || []).map((item, idx) => html`
                            <div class="list-item-row">
                                <span class="list-bullet"
                                    title="ドラッグで結線を引く"
                                    draggable="true" 
                                    onDragStart=${(e) => {
                                        e.stopPropagation();
                                        e.dataTransfer.setData('source-id', `${node.id}#${idx}`);
                                        e.dataTransfer.effectAllowed = 'copyLink';
                                    }}
                                    style="cursor: grab;"
                                >•</span>
                                <input type="text" class="list-item-input" value="${item}" 
                                    id="input-${node.id}-item-${idx}"
                                    onInput=${e => handleItemInput(idx, e)} 
                                    onKeyDown=${e => handleItemKeyDown(idx, e)}
                                    onBlur=${handleBlur}
                                    placeholder="項目..."/>
                            </div>
                        `)}
                    </div>
                    <button class="add-list-item-btn" onClick=${addItem}>+ アイテム追加</button>
                </div>

                <div class="card-bottom-row">
                    <div class="card-status-label" data-status="${node.status || '未着手'}">
                        ${node.status || '未着手'}
                    </div>
                </div>
            </div>

        </div>
    `;
}
