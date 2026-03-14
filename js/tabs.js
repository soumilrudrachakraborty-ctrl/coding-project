function createTabElement(filePath, isUnsaved, displayName) {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.filePath = filePath;
    tab.title = filePath.startsWith("untitled://") ? displayName : filePath.replace(/^root\/?/, '');

    if (pinnedTabs.has(filePath)) {
        tab.classList.add('tab-pinned');
        const pinIcon = document.createElement('span');
        pinIcon.className = 'tab-pin-icon';
        pinIcon.textContent = '📌';
        tab.appendChild(pinIcon);
    }

    const textSpan = document.createElement('span');
    textSpan.className = 'tab-text';
    textSpan.textContent = displayName || filePath.split('/').pop();
    tab.appendChild(textSpan);

    if (isUnsaved) {
        const unsavedSpan = document.createElement('span');
        unsavedSpan.className = 'unsaved-indicator';
        unsavedSpan.textContent = '*';
        textSpan.appendChild(unsavedSpan);
    }

    const closeBtn = document.createElement('span');
    closeBtn.className = 'close-tab';
    closeBtn.textContent = '×';
    closeBtn.title = 'Close Tab';
    closeBtn.onclick = (e) => { e.stopPropagation(); closeTab(filePath); };
    tab.appendChild(closeBtn);

    tab.onclick = () => { if (currentFilePath !== filePath) openFile(filePath); };
    tab.onauxclick = (e) => { if (e.button === 1) { e.preventDefault(); closeTab(filePath); } };
    
    tab.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        showTabContextMenu(filePath, e.pageX, e.pageY);
    };
    
    return tab;
}

function showTabContextMenu(filePath, x, y) {
    closeContextMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';

    // Pin / Unpin
    const pinDiv = document.createElement('div');
    pinDiv.textContent = pinnedTabs.has(filePath) ? 'Unpin Tab' : 'Pin Tab';
    pinDiv.onclick = (e) => {
        e.stopPropagation();
        if (pinnedTabs.has(filePath)) { pinnedTabs.delete(filePath); } else { pinnedTabs.add(filePath); }
        // Force tab element to be recreated so pin icon updates
        const tabData = openTabs.get(filePath);
        if (tabData) tabData.tabElement = null;
        updateTabs();
        closeContextMenu();
    };
    menu.appendChild(pinDiv);

    const sep0 = document.createElement('div');
    sep0.className = 'context-menu-sep';
    menu.appendChild(sep0);

    // Reveal in Tree — only for real (non-untitled) files
    if (!filePath.startsWith('untitled://')) {
        const revealDiv = document.createElement('div');
        revealDiv.textContent = 'Reveal in Tree';
        revealDiv.onclick = (e) => {
            e.stopPropagation();
            // Expand sidebar sections if collapsed
            const explorerBody = document.getElementById('fileExplorerBody');
            const explorerIcon = document.getElementById('fileExplorerIcon');
            if (explorerBody && explorerBody.style.display === 'none') {
                explorerBody.style.display = 'block';
                if (explorerIcon) explorerIcon.textContent = '▼';
            }
            expandToPath(filePath);
            renderFileTree();
            setTimeout(() => {
                const activeLi = document.querySelector(`li[data-path="${CSS.escape(filePath)}"]`);
                if (activeLi) activeLi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
            closeContextMenu();
        };
        menu.appendChild(revealDiv);
    }

    const renameDiv = document.createElement('div');
    renameDiv.textContent = 'Rename';
    renameDiv.onclick = (e) => { e.stopPropagation(); startTabRenaming(filePath); closeContextMenu(); };
    menu.appendChild(renameDiv);

    const saveAllDiv = document.createElement('div');
    saveAllDiv.textContent = 'Save All';
    saveAllDiv.onclick = (e) => { e.stopPropagation(); saveAllFiles(); closeContextMenu(); };
    menu.appendChild(saveAllDiv);
    
    const closeOthersDiv = document.createElement('div');
    closeOthersDiv.textContent = 'Close Others';
    closeOthersDiv.onclick = (e) => { e.stopPropagation(); closeOtherTabs(filePath); closeContextMenu(); };
    menu.appendChild(closeOthersDiv);

    const closeAllDiv = document.createElement('div');
    closeAllDiv.textContent = 'Close All';
    closeAllDiv.onclick = (e) => { e.stopPropagation(); closeAllTabs(); closeContextMenu(); };
    menu.appendChild(closeAllDiv);

    const closeDiv = document.createElement('div');
    closeDiv.textContent = 'Close';
    closeDiv.onclick = (e) => { e.stopPropagation(); closeTab(filePath); closeContextMenu(); };
    menu.appendChild(closeDiv);

    adjustMenuPosition(menu, x, y);
    
    activeContextMenu = menu;
    document.addEventListener('click', handleClickOutsideContextMenu, true);
    document.addEventListener('contextmenu', handleClickOutsideContextMenu, true);
}

async function closeOtherTabs(keepPath) {
    const paths = Array.from(openTabs.keys());
    for (let path of paths) {
        if (path !== keepPath && !pinnedTabs.has(path)) await closeTab(path);
    }
}

async function closeAllTabs() {
    const paths = Array.from(openTabs.keys());
    for (let path of paths) {
        if (!pinnedTabs.has(path)) await closeTab(path);
    }
}

function startTabRenaming(filePath) {
    const tabData = openTabs.get(filePath);
    if (!tabData) return;
    const tabEl = tabData.tabElement;
    const textSpan = tabEl.querySelector('.tab-text');
    const fileData = fileStructure[filePath];
    
    const currentName = fileData?.isUntitled ? fileData.displayName : filePath.split('/').pop();
    
    textSpan.style.display = 'none';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'tab-rename-input';
    
    const closeBtn = tabEl.querySelector('.close-tab');
    tabEl.insertBefore(input, closeBtn);
    
    input.focus();
    input.select();
    
    let isFinishing = false;
    
    const finishRename = (newName) => {
        if (isFinishing) return;
        isFinishing = true;
        
        if (input.parentNode) input.remove();
        textSpan.style.display = '';
        
        newName = newName.trim();
        if (!newName || newName === currentName) return;
        
        if (/[\\/:*?"<>|]/.test(newName)) {
            showNotification("Invalid characters in name.", true);
            return;
        }
        
        if (fileData?.isUntitled) {
            fileData.displayName = newName;
            updateTabs(); 
            if (settings.autoSaveSession) saveSession();
        } else {
            saveRenaming(filePath, newName);
        }
    };
    
    input.addEventListener('blur', () => finishRename(input.value));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); finishRename(input.value);
        } else if (e.key === 'Escape') {
            e.preventDefault(); isFinishing = true; input.remove(); textSpan.style.display = '';
        }
    });
    
    input.addEventListener('click', (e) => e.stopPropagation());
}

function newTab() {
    const untitledId = `untitled://new-${Date.now()}-${untitledTabCounter}`;
    const tabDisplayName = `Untitled ${untitledTabCounter++}`;

    fileStructure[untitledId] = { type: 'file', content: '', savedContent: '', unsaved: false, isUntitled: true, displayName: tabDisplayName };
    currentFilePath = untitledId;

    const newTabElement = createTabElement(untitledId, false, tabDisplayName);
    openTabs.set(untitledId, { tabElement: newTabElement, unsaved: false });

    codeEditor.setValue('');
    codeEditor.setOption('readOnly', false);
    codeEditor.setOption('mode', 'text/plain');
    codeEditor.clearHistory();
    codeEditor.refresh();

    updateTabs();
    updateStatusBar();
    codeEditor.focus();
}

async function closeTab(filePathToClose, forceClose = false) {
    // Pinned tabs are protected — they must be unpinned before closing
    if (pinnedTabs.has(filePathToClose) && !forceClose) {
        showNotification('Unpin the tab before closing it.', false, 2500);
        return;
    }
    const fileData = fileStructure[filePathToClose];
    const tabData = openTabs.get(filePathToClose);
    const tabDisplayName = (fileData?.isUntitled ? fileData.displayName : filePathToClose.split('/').pop()) || "Tab";

    if (!forceClose && fileData?.unsaved) {
        const choice = await showSaveDiscardDialog(tabDisplayName);
        if (choice === 'cancel') {
            return;
        } else if (choice === 'discard') {
            if (fileData) fileData.unsaved = false;
        } else if (choice === 'save') {
            if (fileData?.isUntitled) {
                const saved = await promptForFilenameAndSaveUntitled(filePathToClose);
                if (!saved) {
                    showNotification('Close cancelled — file was not saved.', false, 3000);
                    return;
                }
                return;
            } else {
                saveCurrentFile();
            }
        }
    }

    let nextPath = null;
    if (currentFilePath === filePathToClose && openTabs.size > 1) {
        const keys = Array.from(openTabs.keys());
        const idx = keys.indexOf(filePathToClose);
        nextPath = keys[idx - 1] ?? keys[idx + 1] ?? null;
    }

    if (tabData?.tabElement?.parentNode) tabData.tabElement.remove();
    openTabs.delete(filePathToClose);
    if (fileData?.isUntitled) delete fileStructure[filePathToClose];

    if (currentFilePath === filePathToClose) {
        if (nextPath) {
            openFile(nextPath);
        } else {
            if (isDiffEnabled) toggleDiff();
            currentFilePath = null; codeEditor.setValue('');
            codeEditor.setOption('readOnly', false); codeEditor.setOption('mode', 'text/plain'); codeEditor.clearHistory();
        }
    }
    // Only reset the counter when no tabs remain at all, and only if it has drifted
    // far enough that resetting makes sense (avoids "Untitled 1" reuse mid-session).
    if (openTabs.size === 0) untitledTabCounter = 1;
    // Use debounced render when closing a background tab (no immediate visual change needed);
    // use direct render when the active file changed so the tree updates instantly.
    if (currentFilePath !== filePathToClose) {
        debouncedRenderFileTree();
    } else {
        renderFileTree();
    }
    updateTabs(); updateStatusBar(); if (settings.autoSaveSession) saveSession();
}

function updateTabs() {
    const tabsContainer = document.getElementById('tabs');

    while (tabsContainer.firstChild) { tabsContainer.removeChild(tabsContainer.firstChild); }

    let activeTabElement = null;

    // Render pinned tabs first, then unpinned
    const sortedPaths = [
        ...Array.from(openTabs.keys()).filter(p => pinnedTabs.has(p)),
        ...Array.from(openTabs.keys()).filter(p => !pinnedTabs.has(p)),
    ];

    sortedPaths.forEach((filePath) => {
        const tabData = openTabs.get(filePath);
        let tab = tabData.tabElement;
        if (!tab || !document.body.contains(tab)) {
            const displayName = fileStructure[filePath]?.isUntitled ? fileStructure[filePath].displayName : filePath.split('/').pop();
            tab = createTabElement(filePath, fileStructure[filePath]?.unsaved || false, displayName);
            tabData.tabElement = tab;
        }

        // Sync pinned class in case state changed
        if (pinnedTabs.has(filePath)) { tab.classList.add('tab-pinned'); } else { tab.classList.remove('tab-pinned'); }

        const textSpan = tab.querySelector('.tab-text');
        let indicator = tab.querySelector('.unsaved-indicator');
        const expectedDisplayName = fileStructure[filePath]?.isUntitled ? fileStructure[filePath].displayName : filePath.split('/').pop();
        
        if (textSpan && textSpan.childNodes[0]?.nodeValue !== expectedDisplayName) { textSpan.childNodes[0].nodeValue = expectedDisplayName; }
        tab.title = filePath.startsWith("untitled://") ? expectedDisplayName : filePath.replace(/^root\/?/, '');

        if (filePath === currentFilePath) { tab.classList.add('active'); activeTabElement = tab; }
        else { tab.classList.remove('active'); }

        const isUnsaved = fileStructure[filePath]?.unsaved || (fileStructure[filePath]?.isUntitled && fileStructure[filePath]?.content?.length > 0);
        tabData.unsaved = isUnsaved;

        if (isUnsaved) {
            if (!indicator && textSpan) { indicator = document.createElement('span'); indicator.className = 'unsaved-indicator'; indicator.textContent = '*'; textSpan.appendChild(indicator); }
        } else {
            if (indicator) indicator.remove();
        }
        tabsContainer.appendChild(tab);
    });

    if (activeTabElement) activeTabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    
    highlightActiveFileInTree();
}

function cycleTab(direction) {
    if (openTabs.size < 2) return;
    const keys = Array.from(openTabs.keys());
    const idx = keys.indexOf(currentFilePath);
    const nextIdx = (idx + direction + keys.length) % keys.length;
    openFile(keys[nextIdx]);
}