import { h } from 'https://esm.sh/preact';
import htm from 'https://esm.sh/htm';

const html = htm.bind(h);

export function Toolbar({ store, onResetView, onFitView }) {
    const historyIndex = store.historyIndex;
    const historyLength = store.history.length;
    
    const handleClear = () => {
        if (confirm("プロジェクトを初期化しますか？現在のツリーはすべて消去されます。")) {
            localStorage.removeItem('rbs-data');
            store.data = store.getDefaultData();
            store.syncSerials();
            store.history = [];
            store.historyIndex = -1;
            store.pushHistory();
            if (onResetView) onResetView();
        }
    };

    const handleImportJson = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => {
            try {
                const imported = JSON.parse(re.target.result);
                if (Array.isArray(imported)) {
                    store.data = imported;
                    store.pushHistory();
                    if (onResetView) onResetView();
                    alert("インポートが完了しました。");
                }
            } catch (err) {
                alert("ファイルの読み込みに失敗しました。");
            }
        };
        reader.readAsText(file);
        e.target.value = null;
    };

    const handleExportJson = () => {
        const blob = new Blob([JSON.stringify(store.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rbs-data-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportExcel = () => {
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
                if (node.children) scan(node.children, level + 1);
            });
        };
        scan(store.data);
        const ws = XLSX.utils.json_to_sheet(flattened);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Requirements");
        XLSX.writeFile(wb, `rbs-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleImageExport = async () => {
        const btn = document.getElementById('export-btn');
        if (typeof html2canvas === 'undefined' || !btn) return;
        
        btn.disabled = true;
        const originalText = btn.innerText;
        btn.innerText = 'Compressing...';

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
            link.download = `rbs-capture-${new Date().toISOString().slice(0, 10)}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            alert("画像の書き出しに失敗しました。");
        } finally {
            treeContainer.style.transform = originalTransform;
            btn.innerText = originalText;
            btn.disabled = false;
        }
    };

    const changeFontSize = (delta) => {
        const current = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--app-font-size')) || 14;
        const next = Math.max(10, Math.min(24, current + delta));
        document.documentElement.style.setProperty('--app-font-size', `${next}px`);
        if (onFitView) onFitView();
    };

    return html`
        <header class="app-header">
            <div class="ribbon">
                <div class="ribbon-group">
                    <button class="ribbon-btn" title="元に戻す" onClick=${() => store.undo()} disabled=${historyIndex <= 0}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                        <span>Undo</span>
                    </button>
                    <button class="ribbon-btn" title="やり直す" onClick=${() => store.redo()} disabled=${historyIndex >= historyLength - 1}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
                        <span>Redo</span>
                    </button>
                    <div class="ribbon-label">編集</div>
                </div>

                <div class="ribbon-divider"></div>

                <div class="ribbon-group">
                    <button class="ribbon-btn" title="文字を大きく" onClick=${() => changeFontSize(2)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                        <span>拡大</span>
                    </button>
                    <button class="ribbon-btn" title="文字を小さく" onClick=${() => changeFontSize(-2)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6"/><path d="M7 11v6"/><path d="M14 14h6"/></svg>
                        <span>縮小</span>
                    </button>
                    <button class="ribbon-btn" title="ビューをリセット" onClick=${() => onResetView && onResetView()}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><polyline points="8 11 11 8 14 11"/><polyline points="8 11 11 14 14 11"/></svg>
                        <span>Reset View</span>
                    </button>
                    <div class="ribbon-label">表示</div>
                </div>

                <div class="ribbon-divider"></div>

                <div class="ribbon-group">
                    <button class="ribbon-btn" title="JSONインポート" onClick=${() => document.getElementById('json-input').click()}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>Import</span>
                    </button>
                    <button class="ribbon-btn" title="JSONエクスポート" onClick=${handleExportJson}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span>JSON</span>
                    </button>
                    <button class="ribbon-btn" title="Excelエクスポート" onClick=${handleExportExcel}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        <span>Excel</span>
                    </button>
                    <button id="export-btn" class="ribbon-btn" title="画像を書き出し" onClick=${handleImageExport}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        <span>Capture</span>
                    </button>
                    <div class="ribbon-label">データ</div>
                </div>

                <div class="ribbon-divider"></div>

                <div class="ribbon-group">
                    <button class="ribbon-btn danger" title="プロジェクト初期化" onClick=${handleClear}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        <span>初期化</span>
                    </button>
                    <div class="ribbon-label">プロジェクト</div>
                </div>
                
                <input type="file" id="json-input" accept=".json" style="display:none" onChange=${handleImportJson}/>
            </div>
        </header>
    `;
}
