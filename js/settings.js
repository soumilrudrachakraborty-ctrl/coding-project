function loadSettings() {
    try {
        const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (savedSettings) settings = { ...defaultSettings, ...JSON.parse(savedSettings) };
    } catch (e) {
        console.error("Failed to load settings:", e);
        settings = { ...defaultSettings };
    }
    applySettings();
}

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error("Failed to save settings:", e);
    }
}

function applySettings() {
    if (codeEditor) {
        codeEditor.setOption('matchBrackets', settings.matchBrackets);
        codeEditor.setOption('autoCloseBrackets', settings.autoCloseBrackets);
        codeEditor.setOption('autoCloseTags', settings.autoCloseTags);
        codeEditor.setOption('theme', settings.theme);
        codeEditor.setOption('lineWrapping', settings.wordWrap);
        codeEditor.setOption('tabSize', settings.tabWidth || 4);
        codeEditor.setOption('indentUnit', settings.tabWidth || 4);
        codeEditor.setOption('foldGutter', settings.foldGutter ?? true);
        codeEditor.refresh();
    }
    
    if (diffView) {
        diffView.editor().setOption('theme', settings.theme);
        diffView.editor().setOption('lineWrapping', settings.wordWrap);
        diffView.leftOriginal().setOption('theme', settings.theme);
        diffView.leftOriginal().setOption('lineWrapping', settings.wordWrap);
    }

    document.getElementById('autoCloseTags').checked = settings.autoCloseTags;
    document.getElementById('matchBrackets').checked = settings.matchBrackets;
    document.getElementById('autoCloseBrackets').checked = settings.autoCloseBrackets;
    document.getElementById('themeSelect').value = settings.theme;
    document.getElementById('wordWrap').checked = settings.wordWrap;
    document.getElementById('autoSaveSession').checked = settings.autoSaveSession;
    document.getElementById('autoSaveOnBlur').checked = settings.autoSaveOnBlur;
    document.getElementById('fileTemplates').checked = settings.fileTemplates ?? true;
    document.getElementById('tabWidthSelect').value = String(settings.tabWidth || 4);

    document.getElementById('sidebar').style.width = settings.sidebarWidth;
    document.getElementById('editorPane').style.flexBasis = settings.editorPaneFlexBasis;
    document.getElementById('previewPane').style.flexBasis = settings.previewPaneFlexBasis;

    if (currentFilePath && !currentFilePath.startsWith('untitled://')) setLanguage(currentFilePath);
    else if(codeEditor) codeEditor.setOption('mode', 'text/plain');

    updateStatusBar();
}

function updateAndSaveSetting(key, value) {
    settings[key] = value; applySettings(); saveSettings();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('autoCloseTags').addEventListener('change', (e) => updateAndSaveSetting('autoCloseTags', e.target.checked));
    document.getElementById('matchBrackets').addEventListener('change', (e) => updateAndSaveSetting('matchBrackets', e.target.checked));
    document.getElementById('autoCloseBrackets').addEventListener('change', (e) => updateAndSaveSetting('autoCloseBrackets', e.target.checked));
    document.getElementById('themeSelect').addEventListener('change', (e) => updateAndSaveSetting('theme', e.target.value));
    document.getElementById('wordWrap').addEventListener('change', (e) => updateAndSaveSetting('wordWrap', e.target.checked));
    document.getElementById('tabWidthSelect').addEventListener('change', (e) => {
        updateAndSaveSetting('tabWidth', parseInt(e.target.value, 10));
    });
    document.getElementById('fileTemplates').addEventListener('change', (e) => {
        updateAndSaveSetting('fileTemplates', e.target.checked);
    });
    document.getElementById('autoSaveOnBlur').addEventListener('change', (e) => {
        updateAndSaveSetting('autoSaveOnBlur', e.target.checked);
        showNotification(e.target.checked ? 'Auto-save on focus loss enabled.' : 'Auto-save on focus loss disabled.', false, 3000);
    });
    document.getElementById('autoSaveSession').addEventListener('change', (e) => {
        updateAndSaveSetting('autoSaveSession', e.target.checked);
        if (!e.target.checked) {
            showNotification("Auto-save/load session disabled.", false, 4000);
        } else {
            showNotification("Auto-save/load session enabled.", false, 3000);
            saveSession();
        }
    });
});

function resetSettings() {
    settings = { ...defaultSettings }; applySettings(); saveSettings(); showNotification('Settings reset to default.');
}

function toggleSettings() {
    const overlay = document.getElementById('settingsOverlay');
    const isOpen = overlay.style.display !== 'none';
    if (isOpen) {
        overlay.style.display = 'none';
        if (codeEditor) setTimeout(() => codeEditor.focus(), 0);
    } else {
        applySettings();
        overlay.style.display = 'flex';
    }
}

function handleSettingsOverlayClick() {
    toggleSettings();
}