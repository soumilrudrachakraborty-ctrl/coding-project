// js/filetree/render.js

function createTreeNode(path) {
    const entry = fileStructure[path];
    if (!entry) { return null; }
    const li = document.createElement('li'); li.className = entry.type; li.dataset.path = path;
    const label = document.createElement('div'); label.className = 'label';
    const icon = document.createElement('span'); icon.className = 'icon';
    const text = document.createElement('span');
    
    if (path === 'root') { 
        text.textContent = fileStructure.root.displayName || 'root'; 
        text.title = '/'; 
        li.classList.add('root-node'); 
    } else { 
        text.textContent = path.split('/').pop(); 
        text.title = path.replace(/^root\/?/, ''); 
    }
    
    label.appendChild(icon); label.appendChild(text); li.appendChild(label);
    
    if (path === currentFilePath) li.classList.add('active-tree-node');

    if (entry.type === 'folder') {
        icon.textContent = entry.expanded ? '▼' : '▶'; 
        li.classList.add(entry.expanded ? 'expanded' : 'collapsed'); 
        if (path === currentWorkingDirectory) li.classList.add('cwd-selected');
        
        label.onclick = async (e) => { 
            e.stopPropagation(); 
            currentWorkingDirectory = path; 
            toggleFolder(path); 
            updateStatusBar(); 
        };
        
        const ul = document.createElement('ul'); li.appendChild(ul);
        if (entry.expanded) {
            if (entry.children.length > 0) { 
                entry.children.forEach(child => { 
                    const childPath = `${path}/${child}`, childNode = createTreeNode(childPath); 
                    if (childNode) ul.appendChild(childNode); 
                }); 
            } else { 
                const emptyMsg = document.createElement('li'); 
                emptyMsg.textContent = '(empty)'; 
                if (path === 'root') emptyMsg.textContent = fileStructure.root.handle ? '(Empty Directory)' : '(Empty Project)'; 
                emptyMsg.style.cssText = 'padding-left: 5px; font-style: italic; color: #888; list-style-type: none;'; 
                ul.appendChild(emptyMsg); 
            }
        }
    } else {
        icon.textContent = getFileIcon(path.split('/').pop());
        if (openTabs.has(path)) li.classList.add('open-file');
        label.onclick = (e) => { e.stopPropagation(); openFile(path); };
        label.ondblclick = (e) => { e.stopPropagation(); startRenaming(path); };
    }
    li.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); closeContextMenu(); showContextMenu(path, e.pageX, e.pageY); };

    // --- BUG FIX APPLIED HERE ---
    if (path !== 'root') {
        li.draggable = true;
        li.addEventListener('dragstart', (e) => {
            e.stopPropagation(); // <-- Prevents the parent folder from stealing the drag event
            dragSrcPath = path;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', path);
            requestAnimationFrame(() => li.classList.add('drag-source'));
        });
        li.addEventListener('dragend', (e) => {
            e.stopPropagation(); // <-- Prevents bubbling on drag end
            dragSrcPath = null;
            li.classList.remove('drag-source');
            treeDragCleanup();
        });
    }

    return li;
}

function renderFileTree() {
    const fileTreeContainer = document.getElementById('fileTree');
    const scrollState = fileTreeContainer.scrollTop;
    fileTreeContainer.innerHTML = '';
    const rootUl = document.createElement('ul');
    if (!fileStructure.root) fileStructure.root = { type: 'folder', children: [], expanded: true, displayName: 'root' };
    const rootNode = createTreeNode('root');
    if (rootNode) rootUl.appendChild(rootNode); else rootUl.innerHTML = '<li style="color: #888; font-style: italic;">Error: Root missing.</li>';
    fileTreeContainer.appendChild(rootUl);
    fileTreeContainer.scrollTop = scrollState;
}

function highlightActiveFileInTree() {
    if (!currentFilePath) {
        document.querySelectorAll('.file-tree li.active-tree-node').forEach(li => li.classList.remove('active-tree-node'));
        return;
    }

    const needsRender = expandToPath(currentFilePath);
    if (needsRender) {
        renderFileTree();
    } else {
        document.querySelectorAll('.file-tree li.active-tree-node').forEach(li => li.classList.remove('active-tree-node'));
    }

    const activeLi = document.querySelector(`li[data-path="${CSS.escape(currentFilePath)}"]`);
    if (activeLi) {
        activeLi.classList.add('active-tree-node');
        activeLi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function createTreeInput(type, placeholder, onSave, onCancel, parentElementToAppendTo) {
    const li = document.createElement('li');
    li.className = type;
    const label = document.createElement('div');
    label.className = 'label';
    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    iconSpan.textContent = type === 'folder' ? '▶' : getFileIcon(placeholder || 'file.txt');
    label.appendChild(iconSpan);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tree-input';
    input.placeholder = placeholder;
    label.appendChild(input);
    li.appendChild(label);

    parentElementToAppendTo.appendChild(li);

    const cleanup = () => {
        if (li.parentNode) li.remove();
        input.removeEventListener('blur', handleBlur);
        input.removeEventListener('keydown', handleKeydown);
    };
    const handleBlur = () => { setTimeout(() => { if (document.body.contains(input)) { onSave(input.value.trim()); cleanup(); } }, 100); };
    const handleKeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); onSave(input.value.trim()); cleanup(); } else if (e.key === 'Escape') { e.preventDefault(); onCancel(); cleanup(); } };

    input.addEventListener('blur', handleBlur);
    input.addEventListener('keydown', handleKeydown);

    input.focus(); input.select();
    return { inputElement: input, listItem: li };
}