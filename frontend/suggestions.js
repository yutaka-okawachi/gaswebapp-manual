window.renderTermSuggestions = function(inputId, datalistId, suggestions) {
    const input = document.getElementById(inputId);
    const datalist = document.getElementById(datalistId);
    if (!input || !datalist) return false;
    const useCustomPanel = window.matchMedia('(max-width: 600px)').matches;

    datalist.innerHTML = '';
    (suggestions || []).forEach(entry => {
        const option = document.createElement('option');
        option.value = entry.normalized;
        option.textContent = entry.original || entry.normalized;
        datalist.appendChild(option);
    });

    let panel = document.getElementById(`${datalistId}Panel`);
    if (!panel) {
        panel = document.createElement('div');
        panel.id = `${datalistId}Panel`;
        panel.className = 'term-suggestions-panel';
        datalist.insertAdjacentElement('afterend', panel);
    }

    if (!useCustomPanel) {
        input.setAttribute('list', datalistId);
        panel.hidden = true;
        panel.innerHTML = '';
        panel.style.maxHeight = '';
        panel.style.overflowY = '';
        panel.style.webkitOverflowScrolling = '';
        panel.style.touchAction = '';
        return true;
    }

    input.removeAttribute('list');
    panel.style.maxHeight = '176px';
    panel.style.overflowY = 'auto';
    panel.style.webkitOverflowScrolling = 'touch';
    panel.style.touchAction = 'pan-y';
    panel.innerHTML = '';
    const items = (suggestions || []).slice(0, 20);
    if (!items.length || document.activeElement !== input) {
        panel.hidden = true;
        return true;
    }

    items.forEach(entry => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'term-suggestion-item';
        item.textContent = entry.original || entry.normalized;
        item.addEventListener('mousedown', event => event.preventDefault());
        item.addEventListener('click', () => {
            input.value = entry.normalized;
            panel.hidden = true;
            input.focus();
        });
        panel.appendChild(item);
    });

    panel.hidden = false;
    return true;
};

window.hideTermSuggestions = function(datalistId) {
    const panel = document.getElementById(`${datalistId}Panel`);
    if (panel) panel.hidden = true;
};

// --- Render Functions ---
// NOTE: All Mahler-related functions and mappings are defined in index.html inline script.
// DO NOT duplicate them here to avoid function overriding issues when app.js is loaded after index.html.
// The guarded window.* mappings and render functions are authoritative from index.html.
