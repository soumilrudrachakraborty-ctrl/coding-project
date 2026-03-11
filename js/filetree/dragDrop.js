// js/filetree/dragDrop.js

let _dragInsertLine = null;
let _dragIntent = null;

function treeDragCleanup() {
    if (_dragInsertLine) { _dragInsertLine.remove(); _dragInsertLine = null; }
    _dragIntent = null;
}

function _getOrCreateInsertLine() {
    if (!_dragInsertLine) {
        _dragInsertLine = document.createElement('div');
        _dragInsertLine.className = 'drag-insert-line';
        document.body.appendChild(_dragInsertLine);
    }
    return _dragInsertLine;
}

function _visibleLabels() {
    return Array.from(document.querySelectorAll('#fileTree li[data-path] > .label'))
        .filter(el => el.offsetParent !== null);
}

function _computeIntent(clientY, clientX) {
    if (!dragSrcPath) return null;
    const labels = _visibleLabels();
    if (!labels.length) return null;

    let best = null, bestDist = Infinity;
    for (const label of labels) {
        const rect = label.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(clientY - mid);
        if (dist < bestDist) { bestDist = dist; best = label; }
    }
    if (!best) return null;

    const targetPath = best.closest('li[data-path]').dataset.path;
    if (targetPath === dragSrcPath || targetPath.startsWith(dragSrcPath + '/')) return null;

    const rect = best.getBoundingClientRect();
    const relY = (clientY - rect.top) / rect.height;
    const targetEntry = fileStructure[targetPath];

    let relation;
    if (targetEntry && targetEntry.type === 'folder' && relY > 0.25 && relY < 0.75) {
        relation = 'into';
    } else if (relY < 0.5) {
        relation = 'before';
    } else {
        relation = 'after';
    }

    if (targetPath === 'root' && relation !== 'into') relation = 'into';

    return { targetPath, relation, labelRect: rect };
}

function _updateInsertLine(intent) {
    const line = _getOrCreateInsertLine();
    if (!intent) { line.style.display = 'none'; return; }
    const { targetPath, relation, labelRect } = intent;

    if (relation === 'into') {
        line.style.display = 'none';
        document.querySelectorAll('#fileTree .drag-folder-target').forEach(el => el.classList.remove('drag-folder-target'));
        const targetLi = document.querySelector(`#fileTree li[data-path="${CSS.escape(targetPath)}"]`);
        if (targetLi) targetLi.querySelector('.label').classList.add('drag-folder-target');
        return;
    }

    document.querySelectorAll('#fileTree .drag-folder-target').forEach(el => el.classList.remove('drag-folder-target'));

    const y = relation === 'before' ? labelRect.top : labelRect.bottom;
    const treeEl = document.getElementById('fileTree');
    const treeRect = treeEl.getBoundingClientRect();
    const indentLeft = labelRect.left - treeRect.left;

    line.style.display = 'block';
    line.style.position = 'fixed';
    line.style.left = (labelRect.left) + 'px';
    line.style.top = (y - 1) + 'px';
    line.style.width = (labelRect.width) + 'px';
}

function _treeDragoverHandler(e) {
    if (!dragSrcPath) return; // Let external files pass through
    e.preventDefault();
    e.stopPropagation();      // Claim internal file drags
    e.dataTransfer.dropEffect = 'move';
    _dragIntent = _computeIntent(e.clientY, e.clientX);
    _updateInsertLine(_dragIntent);
}

function _treeDropHandler(e) {
    // 1. If it's an external OS file, do nothing here and let your other script handle it!
    if (!dragSrcPath) return; 

    // 2. It IS an internal drag. Stop the "0 items" script from seeing this!
    e.preventDefault();
    e.stopPropagation();
    
    // 3. If dropped in an invalid spot, just clean up.
    if (!_dragIntent) { 
        treeDragCleanup(); 
        dragSrcPath = null; 
        return; 
    }
    
    // 4. Successful internal drop! Move the file.
    const { targetPath, relation } = _dragIntent;
    treeDragCleanup();
    treeCommitMove(dragSrcPath, targetPath, relation);
    dragSrcPath = null;
}

function _treeDragleaveHandler(e) {
    const treeEl = document.getElementById('fileTree');
    if (!treeEl.contains(e.relatedTarget)) { treeDragCleanup(); }
}

function treeCommitMove(srcPath, targetPath, relation) {
    const srcName = srcPath.split('/').pop();
    const srcParentPath = srcPath.substring(0, srcPath.lastIndexOf('/'));
    let destFolderPath, insertBeforeName;

    if (relation === 'into') {
        const targetEntry = fileStructure[targetPath];
        if (!targetEntry || targetEntry.type !== 'folder') {
            destFolderPath = targetPath.substring(0, targetPath.lastIndexOf('/'));
            insertBeforeName = null;
        } else {
            destFolderPath = targetPath;
            insertBeforeName = null;
        }
    } else {
        const targetEntry = fileStructure[targetPath];
        if (targetEntry && targetEntry.type === 'folder' && targetPath !== 'root') {
            destFolderPath = targetPath.substring(0, targetPath.lastIndexOf('/')) || 'root';
        } else {
            destFolderPath = targetPath.substring(0, targetPath.lastIndexOf('/')) || 'root';
        }
        const targetName = targetPath.split('/').pop();
        const destParentChildren = fileStructure[destFolderPath]?.children || [];
        const targetIdx = destParentChildren.indexOf(targetName);
        if (relation === 'before') {
            insertBeforeName = targetName;
        } else {
            insertBeforeName = targetIdx + 1 < destParentChildren.length ? destParentChildren[targetIdx + 1] : null;
        }
    }

    if (!destFolderPath || !fileStructure[destFolderPath]) return;
    if (destFolderPath.startsWith(srcPath + '/') || destFolderPath === srcPath) return;

    const isSameFolder = destFolderPath === srcParentPath;

    if (isSameFolder) {
        const children = fileStructure[destFolderPath].children;
        const fromIdx = children.indexOf(srcName);
        if (fromIdx === -1) return;
        children.splice(fromIdx, 1);
        if (insertBeforeName && children.includes(insertBeforeName)) {
            children.splice(children.indexOf(insertBeforeName), 0, srcName);
        } else {
            children.push(srcName);
        }
        renderFileTree(); updateTabs();
        if (settings.autoSaveSession) saveSession();
        return;
    }

    const newPath = `${destFolderPath}/${srcName}`;
    if (fileStructure[newPath]) { showNotification(`"${srcName}" already exists in destination.`, true); return; }

    const entryData = fileStructure[srcPath];
    delete fileStructure[srcPath];
    fileStructure[newPath] = entryData;

    const srcParent = fileStructure[srcParentPath];
    if (srcParent?.children) srcParent.children = srcParent.children.filter(c => c !== srcName);

    const destParent = fileStructure[destFolderPath];
    if (destParent) {
        if (!destParent.children) destParent.children = [];
        if (insertBeforeName && destParent.children.includes(insertBeforeName)) {
            destParent.children.splice(destParent.children.indexOf(insertBeforeName), 0, srcName);
        } else {
            destParent.children.push(srcName);
        }
    }

    if (entryData.type === 'folder') {
        function remapChildren(oldBase, newBase) {
            const e = fileStructure[newBase];
            if (!e?.children) return;
            e.children.slice().forEach(childName => {
                const oldChild = `${oldBase}/${childName}`;
                const newChild = `${newBase}/${childName}`;
                if (fileStructure[oldChild]) {
                    fileStructure[newChild] = fileStructure[oldChild];
                    delete fileStructure[oldChild];
                    if (fileStructure[newChild].type === 'folder') remapChildren(oldChild, newChild);
                }
            });
        }
        remapChildren(srcPath, newPath);
    }

    openTabs.forEach((tabData, tabPath) => {
        let updatedPath = null;
        if (tabPath === srcPath) updatedPath = newPath;
        else if (tabPath.startsWith(srcPath + '/')) updatedPath = newPath + tabPath.slice(srcPath.length);
        if (updatedPath) {
            openTabs.delete(tabPath);
            tabData.tabElement.dataset.filePath = updatedPath;
            tabData.tabElement.title = updatedPath.replace(/^root\/?/, '');
            const textSpan = tabData.tabElement.querySelector('.tab-text');
            if (textSpan && textSpan.childNodes[0]) textSpan.childNodes[0].nodeValue = updatedPath.split('/').pop();
            openTabs.set(updatedPath, tabData);
            if (currentFilePath === tabPath) {
                currentFilePath = updatedPath;
                if (!updatedPath.startsWith('untitled://')) setLanguage(updatedPath);
            }
        }
    });

    recentFiles = recentFiles.map(r => {
        if (r.path === srcPath || r.path.startsWith(srcPath + '/')) {
            const np = newPath + r.path.slice(srcPath.length);
            return { ...r, path: np, displayPath: np.replace(/^root\/?/, '') };
        }
        return r;
    });
    renderRecentFiles();

    renderFileTree(); updateTabs(); updateStatusBar();
    showNotification(`Moved "${srcName}" to ${destFolderPath.replace(/^root\/?/, '') || '/'}.`);
    if (settings.autoSaveSession) saveSession();
}