// --- Service Worker & Install Logic ---
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('service-worker.js'); }); }
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; document.getElementById('install-container').classList.remove('hidden'); });
document.getElementById('install-btn').addEventListener('click', async () => { if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; document.getElementById('install-container').classList.add('hidden'); } });

// --- Voice Input Logic ---
const micBtn = document.getElementById('mic-btn');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    micBtn.classList.remove('hidden');
    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    micBtn.addEventListener('click', () => micBtn.classList.contains('recording') ? recognition.stop() : recognition.start());
    recognition.onstart = () => micBtn.classList.add('recording', 'bg-red-500', 'hover:bg-red-600');
    recognition.onend = () => micBtn.classList.remove('recording', 'bg-red-500', 'hover:bg-red-600');
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const items = transcript.split(/と|、/).map(item => item.trim()).filter(Boolean);
        memoInput.value += (memoInput.value ? '\n' : '') + items.join('\n');
        updateActiveListData();
    };
    recognition.onerror = (event) => console.error('Speech recognition error:', event.error);
}

// --- Main App Logic ---
const memoView = document.getElementById('memo-view');
const checklistView = document.getElementById('checklist-view');
const memoInput = document.getElementById('memo-input');
const checklistContainer = document.getElementById('checklist-container');
const checklistTitle = document.getElementById('checklist-title');
const switchToChecklistBtn = document.getElementById('switch-to-checklist-btn');
const switchToMemoBtn = document.getElementById('switch-to-memo-btn');
const settingsModal = document.getElementById('settings-modal');
const openSettingsBtn = document.getElementById('open-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const hideCompletedToggle = document.getElementById('hide-completed-toggle');
const clearCheckedBtn = document.getElementById('clear-checked-btn');
const addItemInput = document.getElementById('add-item-input');
const addItemBtn = document.getElementById('add-item-btn');
const tabsContainer = document.getElementById('tabs-container');
const tabsScroll = document.getElementById('tabs-scroll');
const multiListToggle = document.getElementById('multi-list-toggle');
const themeSelect = document.getElementById('theme-select');
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
const clearMemoBtn = document.getElementById('clear-memo-btn');
const copyAllBtn = document.getElementById('copy-all-btn');
const sharePurchasedBtn = document.getElementById('share-purchased-btn');
const actionStatus = document.getElementById('action-status');

let appData = {};

function saveData() {
    localStorage.setItem('shoppingListData', JSON.stringify(appData));
}

function loadData() {
    const savedData = localStorage.getItem('shoppingListData');
    if (savedData) {
        appData = JSON.parse(savedData);
        if (!['system', 'light', 'dark'].includes(appData.settings.theme)) {
            appData.settings.theme = 'system';
            saveData();
        }
        appData.lists.forEach(syncListItems);
        return;
    }
    appData = {
        settings: { multiListEnabled: false, hideCompleted: false, theme: 'system' },
        activeListId: 'default-list-1',
        lists: [{ id: 'default-list-1', name: '買い物リスト', content: '' }]
    };
    const oldMemo = localStorage.getItem('memoText');
    if (oldMemo) {
        appData.lists[0].content = oldMemo;
        localStorage.removeItem('memoText');
    }
    appData.lists.forEach(syncListItems);
    saveData();
}

function applyTheme() {
    const dark = appData.settings.theme === 'dark' ||
        (appData.settings.theme === 'system' && systemTheme.matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

function renderUI() {
    multiListToggle.checked = appData.settings.multiListEnabled;
    hideCompletedToggle.checked = appData.settings.hideCompleted;
    themeSelect.value = appData.settings.theme;
    applyTheme();
    tabsContainer.classList.toggle('hidden', !appData.settings.multiListEnabled);
    if (appData.settings.multiListEnabled) {
        renderTabs();
    }
    loadActiveListData();
}

function renderTabs() {
    tabsScroll.innerHTML = '';
    appData.lists.forEach(list => {
        const group = document.createElement('div');
        group.className = 'tab-item-group flex-shrink-0';
        
        const tab = document.createElement('button');
        tab.className = `tab-item text-sm font-bold py-2 pl-4 rounded-l-full whitespace-nowrap ${list.id === appData.activeListId ? 'active' : ''}`;
        tab.textContent = list.name;
        tab.dataset.listId = list.id;
        tab.addEventListener('click', () => switchList(list.id));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'tab-delete-btn text-sm font-bold py-2 rounded-r-full';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.dataset.listId = list.id;
        deleteBtn.addEventListener('click', () => deleteList(list.id));

        group.appendChild(tab);
        group.appendChild(deleteBtn);
        tabsScroll.appendChild(group);
    });

    const addTabBtn = document.createElement('button');
    addTabBtn.className = 'flex-shrink-0 bg-green-500 hover:bg-green-600 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center';
    addTabBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>';
    addTabBtn.addEventListener('click', addNewList);
    tabsScroll.appendChild(addTabBtn);
}

function loadActiveListData() {
    const activeList = appData.lists.find(l => l.id === appData.activeListId);
    if (activeList) {
        memoInput.value = activeList.content;
        checklistTitle.textContent = activeList.name;
        syncListItems(activeList);
        if (!checklistView.classList.contains('hidden')) {
            generateChecklist(activeList.items);
        }
        actionStatus.textContent = '';
        updateActionButtons();
    }
}

function updateActiveListData() {
    const activeList = appData.lists.find(l => l.id === appData.activeListId);
    if (activeList) {
        activeList.content = memoInput.value;
        syncListItems(activeList);
        saveData();
        updateActionButtons();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderUI();
});

memoInput.addEventListener('input', updateActiveListData);

clearMemoBtn.addEventListener('click', () => {
    if (memoInput.value && confirm('メモの内容をすべて消去しますか？')) {
        memoInput.value = '';
        updateActiveListData();
    }
});

switchToChecklistBtn.addEventListener('click', () => {
    const activeList = appData.lists.find(l => l.id === appData.activeListId);
    const text = activeList.content.trim();
    if (!text) return;
    syncListItems(activeList);
    generateChecklist(activeList.items);
    memoView.classList.add('hidden');
    checklistView.classList.remove('hidden');
});

switchToMemoBtn.addEventListener('click', () => {
    updateMemoFromChecklist();
    checklistView.classList.add('hidden');
    memoView.classList.remove('hidden');
});

function switchList(listId) {
    appData.activeListId = listId;
    saveData();
    renderUI();
    addItemInput.value = '';
}

function addNewList() {
    const listName = prompt('新しいリストの名前を入力してください:', `リスト ${appData.lists.length + 1}`);
    if (listName) {
        const newList = { id: `list-${Date.now()}`, name: listName, content: '' };
        appData.lists.push(newList);
        switchList(newList.id);
    }
}

function deleteList(listId) {
    if (appData.lists.length <= 1) {
        alert('最後のリストは削除できません。');
        return;
    }
    if (confirm('このリストを削除しますか？')) {
        appData.lists = appData.lists.filter(list => list.id !== listId);
        if (appData.activeListId === listId) {
            appData.activeListId = appData.lists[0].id;
        }
        saveData();
        renderUI();
    }
}

function generateChecklist(items) {
    checklistContainer.innerHTML = '';
    items.forEach(item => createChecklistItem(item.text, item.checked));
    applyHideCompletedFilter();
}

function createChecklistItem(itemText, isChecked) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'flex items-center bg-slate-50 dark:bg-slate-700 p-3 rounded-lg transition-all duration-300 checklist-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isChecked;
    checkbox.className = 'h-5 w-5 rounded border-slate-300 text-blue-500 focus:ring-blue-400 dark:bg-slate-600 dark:border-slate-500';
    const label = document.createElement('label');
    checkbox.id = `checklist-item-${checklistContainer.children.length}`;
    label.htmlFor = checkbox.id;
    label.textContent = itemText;
    label.className = 'ml-3 text-slate-700 dark:text-slate-200 flex-grow';
    if (isChecked) {
        label.classList.add('line-through', 'text-slate-400', 'dark:text-slate-500');
        itemDiv.classList.add('completed-item');
    }
    checkbox.addEventListener('change', () => {
        label.classList.toggle('line-through', checkbox.checked);
        label.classList.toggle('text-slate-400', checkbox.checked);
        label.classList.toggle('dark:text-slate-500', checkbox.checked);
        itemDiv.classList.toggle('completed-item', checkbox.checked);
        updateMemoFromChecklist();
        applyHideCompletedFilter();
    });
    itemDiv.appendChild(checkbox);
    itemDiv.appendChild(label);
    checklistContainer.appendChild(itemDiv);
}

function updateMemoFromChecklist() {
    const activeList = getActiveList();
    activeList.items = Array.from(checklistContainer.querySelectorAll('.checklist-item')).map(item => ({
        text: item.querySelector('label').textContent,
        checked: item.querySelector('input').checked
    }));
    activeList.content = activeList.items.map(item => item.text).join('\n');
    memoInput.value = activeList.content;
    saveData();
    updateActionButtons();
}

const addNewItem = () => {
    const newItemText = addItemInput.value.trim();
    if (newItemText) {
        createChecklistItem(newItemText, false);
        addItemInput.value = '';
        updateMemoFromChecklist();
    }
};
addItemBtn.addEventListener('click', addNewItem);
addItemInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addNewItem(); });

openSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.classList.add('hidden'); });

themeSelect.addEventListener('change', () => {
    appData.settings.theme = themeSelect.value;
    saveData();
    applyTheme();
});
systemTheme.addEventListener('change', () => {
    if (appData.settings?.theme === 'system') applyTheme();
});

multiListToggle.addEventListener('change', () => {
    appData.settings.multiListEnabled = multiListToggle.checked;
    saveData();
    renderUI();
});

function applyHideCompletedFilter() {
    const shouldHide = hideCompletedToggle.checked;
    document.querySelectorAll('.completed-item').forEach(item => {
        item.classList.toggle('hidden', shouldHide);
    });
}
hideCompletedToggle.addEventListener('change', () => {
    appData.settings.hideCompleted = hideCompletedToggle.checked;
    saveData();
    applyHideCompletedFilter();
});

clearCheckedBtn.addEventListener('click', () => {
    if (confirm('本当にチェック済みのアイテムをすべて削除しますか？')) {
        const activeList = getActiveList();
        activeList.items = activeList.items.filter(item => !item.checked);
        activeList.content = activeList.items.map(item => item.text).join('\n');
        saveData();
        loadActiveListData();
        settingsModal.classList.add('hidden');
    }
});

function getActiveList() {
    return appData.lists.find(list => list.id === appData.activeListId);
}

// Match repeated lines in order so editing a memo keeps each item's check state.
function syncListItems(list) {
    const previousItems = new Map();
    (list.items || []).forEach(item => {
        if (!previousItems.has(item.text)) previousItems.set(item.text, []);
        previousItems.get(item.text).push(Boolean(item.checked));
    });
    list.items = list.content.split('\n').map(text => text.trim()).filter(Boolean).map(text => ({
        text,
        checked: previousItems.get(text)?.shift() || false
    }));
}

function updateActionButtons() {
    const activeList = getActiveList();
    const purchasedCount = activeList.items.filter(item => item.checked).length;
    copyAllBtn.disabled = !activeList.content.trim();
    sharePurchasedBtn.disabled = purchasedCount === 0;
    const countLabel = document.createElement('span');
    countLabel.className = 'purchase-count';
    countLabel.textContent = `（${purchasedCount}件）`;
    sharePurchasedBtn.replaceChildren(document.createTextNode('購入済みを共有'), countLabel);
}

async function copyText(text) {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch (error) {
            // Older browsers and denied clipboard permissions can use selection copying.
        }
    }
    const previousFocus = document.activeElement;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('aria-label', 'コピーする内容');
    textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    try {
        if (!document.execCommand('copy')) throw new Error('Copy failed');
    } finally {
        textarea.remove();
        previousFocus?.focus({ preventScroll: true });
    }
}

copyAllBtn.addEventListener('click', async () => {
    const text = getActiveList().content;
    if (!text.trim()) return;
    actionStatus.textContent = '';
    try {
        await copyText(text);
        actionStatus.textContent = 'リスト全体をコピーしました。';
    } catch (error) {
        actionStatus.textContent = 'コピーできません。再度お試しください。';
    }
});

sharePurchasedBtn.addEventListener('click', async () => {
    const activeList = getActiveList();
    const purchased = activeList.items.filter(item => item.checked);
    if (!purchased.length) return;
    const title = `${activeList.name}の購入済み`;
    const text = `${title}（${purchased.length}件）\n${purchased.map(item => `・${item.text}`).join('\n')}`;
    actionStatus.textContent = '';
    if (typeof navigator.share === 'function') {
        try {
            await navigator.share({ title, text });
            actionStatus.textContent = '購入済みのリストを共有しました。';
            return;
        } catch (error) {
            if (error.name === 'AbortError') return;
        }
    }
    try {
        await copyText(text);
        actionStatus.textContent = 'コピー済み。共有先に貼り付けてください。';
    } catch (error) {
        actionStatus.textContent = '共有できません。再度お試しください。';
    }
});
