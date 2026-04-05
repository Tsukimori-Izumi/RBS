import { h, render } from 'https://esm.sh/preact@10.19.2';
import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { Store as RequirementStore } from './js/core/RequirementStore.js';
import { App } from './js/components/App.js';

window.onerror = (msg, url, line) => {
    alert(`Error: ${msg}\nLine: ${line}`);
};

document.addEventListener('DOMContentLoaded', () => {
    try {
        const store = new RequirementStore();
        window.store = store; // Global fallback insurance
        const root = document.getElementById('app-root');
        if (root) {
            render(html`<${App} store=${store} />`, root);
        }
    } catch (e) {
        alert("Render match error: " + e.message);
    }
});
