// js/fileTree.js

// Ensure that render.js, treeOps.js, contextMenu.js, and dragDrop.js 
// are loaded in your HTML *before* this file.

document.addEventListener('DOMContentLoaded', () => {
    const treeEl = document.getElementById('fileTree');
    if (!treeEl) return;

    // Background context menu (right-click on empty space)
    treeEl.addEventListener('contextmenu', (e) => {
        if (e.target.closest('li[data-path]')) return;
        e.preventDefault(); e.stopPropagation();
        closeContextMenu();
        showTreeBackgroundMenu(e.pageX, e.pageY);
    });

    // Single container-level drag handlers
    treeEl.addEventListener('dragover', _treeDragoverHandler);
    treeEl.addEventListener('drop', _treeDropHandler);
    treeEl.addEventListener('dragleave', _treeDragleaveHandler);
});