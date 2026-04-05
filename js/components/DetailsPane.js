import { h } from 'https://esm.sh/preact@10.19.2';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.2/hooks';
import { html } from 'https://esm.sh/htm@3.1.1/preact';

export function DetailsPane({ store, nodeId, onClose, onRequestCenter }) {
    if (!nodeId) return html`<div class="details-pane"></div>`;

    const [node, setNode] = useState(null);

    useEffect(() => {
        const n = store.findNodeById(store.data, nodeId);
        setNode(n ? { ...n } : null);
    }, [nodeId]);

    if (!node) return html`<div class="details-pane open">
        <div class="pane-header">
            <h3>No Node Found</h3>
                            <button class="close-btn" onClick=${onClose}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:20px;height:20px;display:block;"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
        </div>
    </div>`;

    const handleChange = (f, v) => {
        const newNode = { ...node, [f]: v };
        setNode(newNode);
        const originalNode = store.findNodeById(store.data, nodeId);
        if (originalNode) {
            originalNode[f] = v;
            store.saveData();
        }
    };

    const handleAddChild = () => {
        store.addNode(nodeId);
        store.pushHistory();
        onClose();
    };

    const handleDelete = () => {
        if (confirm('このノードを削除しますか？')) {
            store.deleteNode(nodeId);
            store.pushHistory();
            onClose();
        }
    };

    const handleToggleCheck = (index) => {
        const newList = [...(node.checklist || [])];
        newList[index].done = !newList[index].done;
        handleChange('checklist', newList);
    };

    return html`
        <div class="details-pane ${nodeId ? 'open' : ''}">
            <div class="pane-header">
                <h3>詳細編集</h3>
                <button class="close-btn" onClick=${onClose}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            
            <div class="pane-body">
                <div class="form-group">
                    <label>ID</label>
                    <span class="detail-id-badge">${node.serialId}</span>
                </div>

                <div class="form-group">
                    <label>要求の名称</label>
                    <input value="${node.text || ''}" onInput=${e => handleChange('text', e.target.value)} />
                </div>

                <div class="form-group">
                    <label>詳細説明</label>
                    <textarea value="${node.description || ''}" onInput=${e => handleChange('description', e.target.value)}></textarea>
                </div>

                <div class="form-group">
                    <label>ステータス</label>
                    <select value="${node.status || '未着手'}" onChange=${e => handleChange('status', e.target.value)}>
                        <option value="未着手">未着手</option>
                        <option value="実行中">実行中</option>
                        <option value="保留">保留</option>
                        <option value="完了">完了</option>
                    </select>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>オプティミスティック</label>
                        <input type="number" value="${node.optimistic || 0}" onInput=${e => handleChange('optimistic', e.target.value)} />
                    </div>
                    <div class="form-group">
                        <label>モストライクリー</label>
                        <input type="number" value="${node.mostLikely || 0}" onInput=${e => handleChange('mostLikely', e.target.value)} />
                    </div>
                    <div class="form-group">
                        <label>ペシミスティック</label>
                        <input type="number" value="${node.pessimistic || 0}" onInput=${e => handleChange('pessimistic', e.target.value)} />
                    </div>
                </div>

                <div class="pane-actions">
                    <button class="primary-btn" onClick=${handleAddChild}>子ノードを追加</button>
                    <button class="primary-btn danger" style="margin-top:10px" onClick=${handleDelete}>ノードを削除</button>
                </div>
            </div>
        </div>
    `;
}
