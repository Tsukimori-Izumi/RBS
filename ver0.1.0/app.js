import { h, render } from 'https://esm.sh/preact';
import htm from 'https://esm.sh/htm';
import { Store } from './js/core/Store.js';
import { App } from './js/components/App.js';

const html = htm.bind(h);

document.addEventListener('DOMContentLoaded', () => {
    const store = new Store();
    const root = document.getElementById('app-root');
    if (root) {
        render(html`<${App} store=${store} />`, root);
    }
});
