import { h } from 'https://esm.sh/preact@10.19.2';
import { html } from 'https://esm.sh/htm@3.1.1/preact';

export function Toolbar({ store, onResetView, onFitView }) {
    const handleAddRoot = () => {
        store.addNode(null);
        store.pushHistory();
    };

    const handleClearAll = () => {
        if (confirm('すべてのノードを削除して初期化しますか？')) {
            store.data = store.getDefaultData();
            store.pushHistory();
        }
    };

    const handleExportJSON = async () => {
        const jsonString = JSON.stringify(store.data, null, 2);
        
        // Use modern File System Access API if available
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: 'rbs_data.json',
                    types: [{
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(jsonString);
                await writable.close();
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.error('File Picker Error:', err);
            }
        }

        // Fallback for older browsers
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", "rbs_data.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleImportJSON = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = e => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    store.data = JSON.parse(event.target.result);
                    store.pushHistory();
                } catch(err) { alert('JSONの読み込みに失敗しました'); }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    return html`
        <header class="app-header">
            <div class="ribbon">
                <div class="ribbon-group">
                    <button class="ribbon-btn" onClick=${handleAddRoot} title="新しいルート要求を追加">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                        <span>追加</span>
                    </button>
                    <div class="ribbon-label">編集</div>
                </div>

                <div class="ribbon-divider"></div>

                <div class="ribbon-group">
                    <button class="ribbon-btn" onClick=${onFitView} title="全体を表示">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6M8 11h6"/></svg>
                        <span>全体</span>
                    </button>
                    <button class="ribbon-btn" onClick=${onFitView} title="図面を自動的に整列">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 15 6 6m-6-6 6-6m-6 6-6 6m6-6-6-6M9 3v1h1V3H9Zm6 3V5h-1v1h1ZM5 8V7h1v1H5Zm14 0V7h-1v1h1Z"/><circle cx="12" cy="12" r="3"/></svg>
                        <span>自動整形</span>
                    </button>
                    <button class="ribbon-btn" onClick=${onResetView} title="等倍に戻す">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        <span>リセット</span>
                    </button>
                    <div class="ribbon-label">表示</div>
                </div>

                <div class="ribbon-divider"></div>

                <div class="ribbon-group">
                    <button class="ribbon-btn" onClick=${handleImportJSON} title="JSONファイルから読み込み">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>開く</span>
                    </button>
                    <button class="ribbon-btn" onClick=${handleExportJSON} title="JSON形式で保存">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span>保存</span>
                    </button>
                    <button class="ribbon-btn danger" onClick=${handleClearAll} title="データを全消去">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        <span>全消去</span>
                    </button>
                    <div class="ribbon-label">データ</div>
                </div>
            </div>
        </header>
    `;
}
