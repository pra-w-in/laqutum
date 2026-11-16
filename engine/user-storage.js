/* Account-scoped caches. Unowned legacy caches are deliberately not imported. */
const UserStorage = (() => {
    const memory = new Map();
    function key(name, userId) {
        const user = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUserSync() : null;
        return `${name}:${userId || user?.id || 'guest'}`;
    }
    function read(name, fallback) {
        const k = key(name);
        if (memory.has(k)) return memory.get(k);
        try {
            const raw = localStorage.getItem(k);
            if (raw !== null) return JSON.parse(raw);
        } catch (e) { console.warn('Using in-memory progress cache.'); }
        return memory.has(k) ? memory.get(k) : fallback;
    }
    function write(name, value, userId) {
        const k = key(name, userId);
        memory.set(k, value);
        try { localStorage.setItem(k, JSON.stringify(value)); } catch (e) {}
    }
    const queues = new Map();
    function sync(name, value, column, userId) {
        const user = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUserSync() : null;
        const id = userId || user?.id;
        if (!id) return Promise.resolve();
        write(name + ':pending', true, id);
        const k = key(name, id);
        const task = (queues.get(k) || Promise.resolve()).then(async () => {
            if (AuthManager.getCurrentUserSync()?.id !== id) return;
            const { error } = await window.supabaseClient.from('user_progress').update({ [column]: value }).eq('user_id', id);
            if (error) throw error;
            if (queues.get(k) === task) write(name + ':pending', false, id);
        }).catch(error => console.warn('[Progress] Saved on this device; cloud sync will retry on next login.', error));
        queues.set(k, task);
        return task;
    }
    // Hydrate once per signed-in session, not on each profile refresh.
    let hydratedUser = null;
    function hydrate(userId, progress) {
        if (hydratedUser === userId) return;
        hydratedUser = userId;
        for (const [name, column] of [['laqtum_mistake_notebook', 'mistake_notebook'], ['laqtum_route_state', 'route_state']]) {
            if (read(name + ':pending', false)) sync(name, read(name, null), column, userId);
            else if (progress?.[column] != null) write(name, progress[column], userId);
        }
    }
    return { key, read, write, hydrate, sync };
})();
