/* Shared, accessible feedback and dialog controls. No learning state lives here. */
const AppUI = (() => {
    let activeDialog = null;
    function notify(message) {
        let region = document.getElementById('app-notifications');
        if (!region) {
            region = document.createElement('div');
            region.id = 'app-notifications';
            region.setAttribute('role', 'status');
            region.setAttribute('aria-live', 'polite');
            document.body.appendChild(region);
        }
        const item = document.createElement('div');
        item.className = 'app-toast';
        const text = document.createElement('p');
        text.textContent = String(message);
        const close = document.createElement('button');
        close.type = 'button'; close.textContent = '×';
        close.setAttribute('aria-label', 'Dismiss notification');
        close.onclick = () => item.remove();
        item.append(text, close); region.appendChild(item);
        setTimeout(() => item.remove(), 9000);
    }
    function dialog(title, message, actions = []) {
        if (activeDialog) activeDialog.close();
        const previousFocus = document.activeElement;
        const background = document.getElementById('preview-overlay');
        const wasInert = background?.inert;
        const overlay = document.createElement('div');
        overlay.className = 'app-dialog-overlay';
        const card = document.createElement('section');
        card.className = 'app-dialog';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
        card.setAttribute('aria-labelledby', 'app-dialog-title');
        const heading = document.createElement('h2');
        heading.id = 'app-dialog-title'; heading.textContent = title;
        const body = document.createElement('p'); body.textContent = message;
        const footer = document.createElement('div'); footer.className = 'app-dialog-actions';
        const close = () => {
            overlay.remove();
            document.removeEventListener('keydown', onKey);
            if (background) background.inert = wasInert || false;
            if (previousFocus?.isConnected) previousFocus.focus();
            activeDialog = null;
        };
        for (const action of [...actions, { label: 'Close', secondary: true }]) {
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = action.label;
            button.className = action.secondary ? 'app-button-secondary' : 'app-button-primary';
            button.onclick = () => { close(); action.onClick?.(); };
            footer.appendChild(button);
        }
        function onKey(event) {
            if (event.key === 'Escape') { event.preventDefault(); close(); }
            if (event.key === 'Tab') {
                const buttons = [...card.querySelectorAll('button')];
                const first = buttons[0], last = buttons.at(-1);
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        }
        card.append(heading, body, footer); overlay.appendChild(card);
        overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
        document.body.appendChild(overlay); document.addEventListener('keydown', onKey);
        if (background) background.inert = true;
        footer.lastElementChild.focus();
        activeDialog = { close };
        return activeDialog;
    }
    function formatText(value) {
        return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }
    function attachModal(overlay, card) {
        const background = document.getElementById('preview-overlay');
        const previousFocus = document.activeElement;
        const wasInert = background?.inert;
        if (background) background.inert = true;
        function onKey(event) {
            if (event.key === 'Escape') { event.preventDefault(); overlay.remove(); }
            if (event.key === 'Tab') {
                const buttons = [...card.querySelectorAll('button:not(:disabled), a[href], input, select, textarea')];
                const first = buttons[0], last = buttons.at(-1);
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        }
        const observer = new MutationObserver(() => {
            if (overlay.isConnected) return;
            document.removeEventListener('keydown', onKey);
            observer.disconnect();
            if (background) background.inert = wasInert || false;
            if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
        });
        observer.observe(document.body, { childList: true });
        document.addEventListener('keydown', onKey);
        card.querySelector('button:last-of-type')?.focus({ preventScroll: true });
    }
    return { notify, dialog, formatText, attachModal };
})();
