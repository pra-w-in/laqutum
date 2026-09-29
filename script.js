/* ================================================
   LaquTum App Entry Point
   ================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // Init the preview engine (registers internal button listeners)
    if (typeof PreviewApp !== 'undefined') {
        PreviewApp.init();
    }
});
