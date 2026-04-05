import { h } from 'https://esm.sh/preact';
import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import htm from 'https://esm.sh/htm';

const html = htm.bind(h);

export function DetailsPane({ store, nodeId, onClose, onRequestCenter }) {
    const [node, setNode] = useState(null);
    const [localData, setLocalData] = useState({});
    const [checklist, setChecklist] = useState([]);

    useEffect(() => {
        if (!nodeId) {
            setNode(null);
            return;
        }
        const found = store.findNodeById(store.data, nodeId);
        if (found) {
            setNode(found);
            setLocalData({
                text: found.text || '',
                description: found.description || '',
                status: found.status || '未着手',
                optimistic: found.optimistic || 0,
                likely: found.likely || 0,
                pessimistic: found.pessimistic || 0
            });
            setChecklist(JSON.parse(JSON.stringify(found.checklist || [])));
            
            document.body.classList.add('details-open');
            setTimeout(() => onRequestCenter && onRequestCenter(), 410);
        }
    }, [nodeId, store]);

    const handleClose = () => {
        document.body.classList.remove('details-open');
        onClose();
    };

    const handleSave = () => {
        if (!node) return;
        Object.assign(node, localData);
        node.checklist = JSON.parse(JSON.stringify(checklist));
        store.pushHistory();
        handleClose();
    };

    const updateChecklistItem = (index, field, value) => {
        const next = [...checklist];
        next[index][field] = value;
        setChecklist(next);
    };

    const addChecklistItem = () => {
        setChecklist([...checklist, { text: '', done: false }]);
    };

    const removeChecklistItem = (index) => {
        setChecklist(checklist.filter((_, i) => i !== index));
    };

    if (!nodeId) return null;

    return html`
        <aside id="details-pane" class="details-pane ${nodeId ? 'open' : ''}">
            <div class="pane-header">
                <h3>要求詳細設定</h3>
                <button class="close-btn" onClick=${handleClose}>&times;</button>
            </div>
            <div class="pane-body">
                <div class="form-group">
                    <label>管理ID (Serial ID)</label>
                    <input type="text" class="detail-id-badge" value="${node?.serialId || ''}" readonly />
                </div>
                <div class="form-group">
                    <label>名称 (Title)</label>
                    <input type="text" value="${localData.text}" 
                           onInput=${(e) => setLocalData({...localData, text: e.target.value})} 
                           placeholder="例: 要件A" />
                </div>
                <div class="form-group">
                    <label>詳細説明 (Description)</label>
                    <textarea value="${localData.description}" 
                              onInput=${(e) => setLocalData({...localData, description: e.target.value})} 
                              placeholder="詳細な説明を入力..."></textarea>
                </div>
                <div class="form-group">
                    <label>ステータス (Status)</label>
                    <select value="${localData.status}" onInput=${(e) => setLocalData({...localData, status: e.target.value})}>
                        <option value="未着手">未着手</option>
                        <option value="実行中">実行中</option>
                        <option value="保留">保留</option>
                        <option value="完了">完了</option>
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>楽観時間 (日)</label>
                        <input type="number" value="${localData.optimistic}" onInput=${(e) => setLocalData({...localData, optimistic: parseInt(e.target.value) || 0})} />
                    </div>
                    <div class="form-group">
                        <label>堅実時間 (日)</label>
                        <input type="number" value="${localData.likely}" onInput=${(e) => setLocalData({...localData, likely: parseInt(e.target.value) || 0})} />
                    </div>
                    <div class="form-group">
                        <label>悲観時間 (日)</label>
                        <input type="number" value="${localData.pessimistic}" onInput=${(e) => setLocalData({...localData, pessimistic: parseInt(e.target.value) || 0})} />
                    </div>
                </div>
                <div class="checklist-section">
                    <div class="section-header">
                        <label>チェックリスト (Checklist)</label>
                        <button class="icon-btn-small" onClick=${addChecklistItem}>+</button>
                    </div>
                    <div id="checklist-container">
                        ${checklist.map((item, index) => html`
                            <div class="checklist-item" key=${index}>
                                <input type="checkbox" checked=${item.done} onChange=${(e) => updateChecklistItem(index, 'done', e.target.checked)} />
                                <input type="text" value=${item.text} onInput=${(e) => updateChecklistItem(index, 'text', e.target.value)} placeholder="内容を入力..." />
                                <button class="remove-item-btn" onClick=${() => removeChecklistItem(index)}>&times;</button>
                            </div>
                        `)}
                    </div>
                </div>
                <div class="pane-actions">
                    <button class="primary-btn" onClick=${handleSave}>変更を更新</button>
                </div>
            </div>
        </aside>
    `;
}
