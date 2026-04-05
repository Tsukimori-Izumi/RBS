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
        width: 280px;
        height: 100px;
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
        if (e.key === 'Enter') {
            e.preventDefault();
            const newNode = store.addNode(null, node.id, 'sibling');
            if (newNode) focusNode(newNode.id);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const newNode = store.addNode(node.id);
            if (newNode) focusNode(newNode.id);
        } else if ((e.key === 'Backspace' || e.key === 'Delete') && e.target.value.trim() === '') {
            e.preventDefault();
            if (confirm('このノードを削除しますか？')) {
                store.deleteNode(node.id);
                store.pushHistory();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = store.getAdjacentNode(node.id, 'prev');
            if (prev) focusNode(prev.id);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = store.getAdjacentNode(node.id, 'next');
            if (next) focusNode(next.id);
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
            const sourceId = e.dataTransfer.getData('source-id');
            if (sourceId && sourceId !== node.id) {
                store.addPredecessor(sourceId, node.id);
                store.pushHistory();
            }
        }
    };

    const [isEntering, setIsEntering] = useState(true);

    // Remove entry animation class after it starts to allow transitions to take over
    useState(() => {
        setTimeout(() => setIsEntering(false), 800);
    }, []);

    return html`
        <div class="node-card ${node.isGhost ? 'ghost' : ''} ${isLoading ? 'loading' : ''} ${isEntering ? 'entering' : ''}" 
             style="${style}"
             draggable="true"
             onDragStart=${handleDragStart}
             onDragEnd=${(e) => e.target.classList.remove('dragging')}
             onDragOver=${(e) => viewMode === 'pert-tab' && e.preventDefault()}
             onDrop=${handleDrop}
             onDblClick=${() => onOpenDetails(node.id)}>
             
            <div class="card-id-badge" data-status="${node.status || '未着手'}">${node.serialId || ''}</div>
            
            <div class="card-content">
                <textarea class="card-title-input" 
                       id="input-${node.id}"
                       onInput=${handleInput}
                       onBlur=${handleBlur}
                       onKeyDown=${handleKeyDown}
                       placeholder="要求の名称...">${node.text || ''}</textarea>
                
                <div class="card-status-label" data-status="${node.status || '未着手'}">
                    ${node.status || '未着手'}
                </div>
            </div>

            <div class="card-actions">
                <button class="card-mini-btn ai-btn" title="AI分解プロンプト" onClick=${handleAIDecomposition}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </button>
                <button class="card-mini-btn paste-btn" title="回答を貼り付け" onClick=${handleAIPaste}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                </button>
                ${node.isGhost ? html`
                    <button class="card-mini-btn confirm-btn" title="確定" onClick=${handleConfirmGhost}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                ` : html`
                    <button class="card-mini-btn" title="詳細" onClick=${() => onOpenDetails(node.id)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                    </button>
                `}
            </div>
        </div>
    `;
}
