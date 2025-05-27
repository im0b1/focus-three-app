// src/app.js - v2.0.0-refactor - Main Application Entry Point

import { appState, subscribeToStateChanges, setState } from './state.js';
import { initializeFirebase, signInWithEmailPassword, signUpWithEmailPassword, signInWithGoogle, signOutUser, loadFirebaseContent, listenToFirestoreChanges, stopFirestoreListeners, syncDataToFirestore } from './services/firebase.js';
import { loadFromLocalStorage, saveToLocalStorage } from './services/localstorage.js';
import { $, displayCurrentDate, getTodayDateString, announceToScreenReader, showUserFeedback, getSectionsArray } from './utils.js';
import { renderTasks, renderAdditionalTasks, renderHistory, updateStatsUI, renderStatsVisuals, applyAppModeUI, applyThemeUI, createAuthModal, updateAuthUI, autoGrowTextarea } from './ui/render.js';
import { domElements } from './ui/domElements.js'; // DOM elements cache

const APP_VERSION_DATA_FORMAT = "1.14.1-content-load-fix-data";
let isInitialFirestoreLoadComplete = false;

// --- Event Handlers ---
function handleAuthButtonClick(type) {
    createAuthModal(type, async (email, password) => {
        if (type === 'login') await signInWithEmailPassword(email, password);
        else await signUpWithEmailPassword(email, password);
    }, async () => {
        await signInWithGoogle();
        if (appState.currentUser) domElements.authModal.remove(); // Close modal on successful Google sign-in
    });
}

function handleAppModeToggle() {
    const newMode = appState.settings.appMode === 'simple' ? 'focus' : 'simple';
    setState(state => {
        state.settings.appMode = newMode;
        if (newMode === 'simple') state.settings.focusTaskCount = 3; // Reset to 3 for simple mode consistency
    });
    showUserFeedback(`${newMode === 'simple' ? '심플' : '집중'} 모드로 변경되었습니다.`, 'info');
}

function handleThemeToggle() {
    const newTheme = appState.settings.theme === 'dark' ? 'light' : 'dark';
    setState(state => {
        state.settings.theme = newTheme;
    });
    showUserFeedback(`테마가 ${newTheme === 'dark' ? '다크' : '라이트'} 모드로 변경되었습니다.`, 'info');
}

function handleTaskCountChange(e) {
    if (appState.settings.appMode === 'simple') return;
    const newCount = parseInt(e.target.value, 10);
    if (appState.settings.focusTaskCount !== newCount) {
        setState(state => {
            state.settings.focusTaskCount = newCount;
        });
        showUserFeedback(`핵심 할 일 개수가 ${newCount}개로 변경되었습니다.`, 'info');
    }
}

function handleCoreTaskChange(index, field, value) {
    setState(state => {
        const task = state.tasks[index];
        if (task) {
            task[field] = value;
            if (field === 'completed') {
                domElements.taskListDivEl.children[index].classList.toggle('completed', value);
                renderTasks(); // Re-render to update all-done message
            }
        }
    });
}

function handleAdditionalTaskInput(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        domElements.addAdditionalTaskBtnEl.click();
    }
}

function handleAddAdditionalTask() {
    if (appState.settings.appMode === 'simple') return;
    const text = domElements.addAdditionalTaskInputEl.value.trim();
    if (text) {
        setState(state => {
            state.additionalTasks.push({ id: Date.now(), text: text, completed: false });
        });
        domElements.addAdditionalTaskInputEl.value = '';
        showUserFeedback(`추가 과제 "${text}"가 추가되었습니다.`, 'success');
        domElements.addAdditionalTaskInputEl.focus();
    }
}

function handleDeleteAdditionalTask(idToDelete) {
    setState(state => {
        const taskToDelete = state.additionalTasks.find(task => task.id === idToDelete);
        state.additionalTasks = state.additionalTasks.filter(task => task.id !== idToDelete);
        if (taskToDelete) {
            showUserFeedback(`추가 과제 "${taskToDelete.text}"가 삭제되었습니다.`, 'info');
        }
    });
}

function handleToggleAdditionalTaskCompletion(idToToggle) {
    setState(state => {
        const task = state.additionalTasks.find(task => task.id === idToToggle);
        if (task) {
            task.completed = !task.completed;
        }
    });
}

function toggleSection(sectionIdToToggle) {
    const sections = getSectionsArray();
    let sectionOpenedName = "";
    sections.forEach(sec => {
        const sectionElement = $(`#${sec.id}`);
        if (!sectionElement || !sec.button) return;

        const isSimpleMode = appState.settings.appMode === 'simple';

        // Visibility based on mode (if it's a section with conditional visibility)
        if (sec.id === 'stats-section') $(domElements.statsVisualsContainerEl).classList.toggle('hidden', isSimpleMode);
        if (sec.id === 'share-section') $(domElements.shareAsImageBtnContainerEl).classList.toggle('hidden', isSimpleMode);
        if (sec.id === 'settings-section') $(domElements.currentSettingsContentDiv).classList.toggle('hidden', isSimpleMode);
        if (sec.id === 'share-section') $(domElements.shareOptionsDivEl).classList.toggle('hidden', isSimpleMode);


        if (sec.id === sectionIdToToggle) {
            const isHidden = sectionElement.classList.toggle('hidden');
            sec.button.textContent = isHidden ? sec.baseText : `${sec.baseText} 닫기`;
            sec.button.setAttribute('aria-expanded', !isHidden);
            sectionElement.setAttribute('aria-hidden', isHidden);
            if (!isHidden) {
                sec.button.classList.add('active');
                sectionOpenedName = sec.baseText;
            } else {
                sec.button.classList.remove('active');
            }
        } else {
            if (!sectionElement.classList.contains('hidden')) {
                sectionElement.classList.add('hidden');
                sec.button.textContent = sec.baseText;
                sec.button.setAttribute('aria-expanded', 'false');
                sectionElement.setAttribute('aria-hidden', 'true');
                sec.button.classList.remove('active');
            }
        }
    });
    if (sectionOpenedName) announceToScreenReader(`${sectionOpenedName} 섹션이 열렸습니다.`);
}

function handleShareIncludeAdditionalChange(e) {
    setState(state => {
        state.settings.shareOptions.includeAdditional = e.target.checked;
    });
}

function handleExportData() {
    const dataToExport = {
        version: APP_VERSION_DATA_FORMAT,
        appSettings: appState.settings,
        tasks: appState.tasks,
        additionalTasks: appState.additionalTasks,
        history: appState.history,
    };
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `오늘셋_백업_${getTodayDateString()}.json`;
    let linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    document.body.appendChild(linkElement);
    linkElement.click();
    linkElement.remove();
    const originalText = domElements.exportDataBtnEl.innerHTML;
    domElements.exportDataBtnEl.innerHTML = '<i class="fas fa-check"></i> 내보내기 완료!';
    announceToScreenReader("로컬 데이터를 성공적으로 내보냈습니다.");
    showUserFeedback("로컬 데이터를 성공적으로 내보냈습니다.", 'success');
    setTimeout(() => { domElements.exportDataBtnEl.innerHTML = originalText; }, 2000);
}

function handleImportData(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (!confirm("현재 로컬 데이터를 덮어쓰고 가져온 데이터로 복원하시겠습니까? (클라우드 데이터와는 별개)")) {
                    domElements.importFileInputEl.value = '';
                    return;
                }
                if (importedData.version !== APP_VERSION_DATA_FORMAT && !confirm(`데이터 형식 버전 불일치. 계속하시겠습니까? (가져온 버전: ${importedData.version || '알 수 없음'}, 현재 버전: ${APP_VERSION_DATA_FORMAT})`)) {
                    domElements.importFileInputEl.value = '';
                    return;
                }

                // Apply imported data to state, ensuring data integrity and structure
                setState(state => {
                    state.settings.appMode = importedData.appSettings?.appMode || 'simple';
                    state.settings.theme = importedData.appSettings?.theme || 'dark';
                    state.settings.focusTaskCount = importedData.appSettings?.focusTaskCount || 3;
                    state.settings.shareOptions = importedData.appSettings?.shareOptions || { includeAdditional: false };
                    if (state.settings.shareOptions.hasOwnProperty('includeMemos')) {
                        delete state.settings.shareOptions.includeMemos;
                    }

                    state.tasks = (importedData.tasks || []).map(t => ({ id: t.id, text: t.text, completed: t.completed }));
                    while (state.tasks.length < 5) { state.tasks.push({ id: Date.now() + state.tasks.length + Math.random(), text: '', completed: false }); }
                    if (state.tasks.length > 5) state.tasks = state.tasks.slice(0, 5);

                    state.additionalTasks = importedData.additionalTasks || [];

                    state.history = (importedData.history || []).map(entry => ({
                        ...entry,
                        tasks: entry.tasks.map(t => ({ id: t.id, text: t.text, completed: t.completed }))
                    }));
                }, { skipSave: true, source: 'import' }); // Imported data will be saved after reload

                if (confirm("로컬 데이터 가져오기 성공. 새로고침하시겠습니까?")) {
                    window.location.reload();
                } else {
                    announceToScreenReader("로컬 데이터 가져오기 성공.");
                    showUserFeedback("로컬 데이터 가져오기 성공!", 'success');
                }
            } catch (err) {
                showUserFeedback("데이터 가져오기 실패: 파일이 유효한 JSON 형식이 아니거나 손상되었습니다.", 'error');
                console.error("Import error:", err);
            } finally {
                domElements.importFileInputEl.value = '';
            }
        };
        reader.readAsText(file);
    }
}

function handleDocumentKeydown(e) {
    if ((e.altKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        if (appState.settings.appMode === 'focus' && domElements.addAdditionalTaskInputEl && !domElements.additionalTasksSectionEl.classList.contains('hidden')) {
            e.preventDefault();
            domElements.addAdditionalTaskInputEl.focus();
        }
    }
    if (e.key === 'Escape') {
        if (domElements.authModal) {
            domElements.authModal.remove();
            return;
        }
        let sectionClosed = false;
        getSectionsArray().forEach(sec => {
            const sectionElement = $(`#${sec.id}`);
            if (sectionElement && !sectionElement.classList.contains('hidden')) {
                toggleSection(sec.id);
                sectionClosed = true;
            }
        });
        if (sectionClosed) announceToScreenReader("열린 섹션이 닫혔습니다.");
        if (document.activeElement === domElements.addAdditionalTaskInputEl) domElements.addAdditionalTaskInputEl.blur();
    }
}

// --- Initialization Logic ---
async function initializeAppStateFromStorage() {
    console.log("Initializing app state from local storage or Firestore...");

    const todayDateStr = getTodayDateString();
    let localData = loadFromLocalStorage();
    let firestoreData = null;

    if (appState.currentUser) {
        try {
            firestoreData = await loadFirebaseContent(appState.currentUser.uid);
            // If Firestore data is present and newer, or local data is empty, prefer Firestore.
            // Simplified check: if Firestore loaded data, we'll process it.
            if (firestoreData) {
                 console.log("Firestore data loaded successfully.");
            }
        } catch (error) {
            console.warn("Failed to load content from Firestore, falling back to local storage:", error);
            showUserFeedback("클라우드 데이터 로드 중 오류 발생. 오프라인 모드로 전환됩니다.", 'error');
        }
    }

    let dataToProcess = firestoreData || localData;
    let currentTasks = dataToProcess.tasks;
    let currentAdditionalTasks = dataToProcess.additionalTasks;
    let currentHistory = dataToProcess.history;

    // Daily reset logic
    const lastProcessedDate = localData.settings.lastDate; // Use local storage's last date for reset trigger
    let shouldResetTasks = (lastProcessedDate !== todayDateStr);

    if (shouldResetTasks) {
        console.log(`Daily reset triggered: Last processed date (${lastProcessedDate}) !== Today (${todayDateStr}).`);
        const historicalFocusModeTaskCount = parseInt(localStorage.getItem('oneulSetFocusTaskCountSettingBeforeReset') || '3', 10);
        const tasksForHistory = currentTasks.slice(0, historicalFocusModeTaskCount);
        const cleanedTasksForHistory = tasksForHistory.map(t => ({
            id: t?.id || Date.now() + Math.random(),
            text: typeof t?.text === 'string' ? t.text : '',
            completed: typeof t?.completed === 'boolean' ? t.completed : false,
        }));
        const allFilled = cleanedTasksForHistory.every(t => t.text.trim() !== "");
        const allCompleted = cleanedTasksForHistory.every(t => t.completed);
        const achieved = allFilled && cleanedTasksForHistory.length === historicalFocusModeTaskCount && allCompleted && historicalFocusModeTaskCount > 0;

        if (lastProcessedDate && !currentHistory.some(entry => entry.date === lastProcessedDate)) {
            currentHistory.unshift({ date: lastProcessedDate, tasks: cleanedTasksForHistory, achieved: achieved });
            if (currentHistory.length > 60) currentHistory.splice(60); // Keep last 60 days
            console.log(`Added previous day's tasks (${lastProcessedDate}) to history.`);
        }

        // Reset tasks for today
        currentTasks = [];
        for (let i = 0; i < 5; i++) {
            currentTasks.push({ id: Date.now() + i + Math.random(), text: '', completed: false });
        }
        currentAdditionalTasks = []; // Clear additional tasks on new day
        localStorage.setItem('oneulSetFocusTaskCountSettingBeforeReset', appState.settings.focusTaskCount.toString());
        announceToScreenReader("새로운 날이 시작되었습니다. 할 일 목록이 초기화되었습니다.");
        showUserFeedback("새로운 날이 시작되었습니다. 할 일 목록이 초기화되었습니다.", 'info');
    }

    // Ensure tasks array length is 5
    while (currentTasks.length < 5) {
        currentTasks.push({ id: Date.now() + currentTasks.length + Math.random(), text: '', completed: false });
    }
    if (currentTasks.length > 5) currentTasks = currentTasks.slice(0, 5);

    setState(state => {
        state.tasks = currentTasks;
        state.additionalTasks = currentAdditionalTasks;
        state.history = currentHistory;
        state.settings.lastDate = todayDateStr; // Mark today as processed
    }, { skipSave: true }); // Don't save yet, will be saved after full init

    console.log("App state loaded/processed.");
}

async function initializeApp() {
    console.log("Initializing app (v2.0.0-refactor)...");

    // Initialize DOM elements cache
    domElements.init();

    // Set initial UI based on local storage
    await initializeAppStateFromStorage(); // This processes daily reset and loads initial data

    // Initial UI render based on the processed state
    applySettingsAndRenderUI(appState.settings, 'local_init');

    // Set up event listeners
    setupEventListeners();

    // Firebase Auth state change listener
    if (window.firebase && window.firebase.auth) {
        window.firebase.auth().onAuthStateChanged(async user => {
            console.log("Auth state changed. Current User:", user ? user.uid : 'No user');
            setState(state => { state.currentUser = user; }, { skipSave: true }); // Update currentUser in state
            updateAuthUI(user); // Update auth specific UI

            if (user) {
                announceToScreenReader(`${user.displayName || user.email}님, 환영합니다.`);
                isInitialFirestoreLoadComplete = false; // Firebase initial load started
                try {
                    // Load and apply settings from Firestore, then start settings listener
                    const firestoreSettings = await firebaseService.loadAppSettingsFromFirestore(user.uid);
                    if (firestoreSettings) {
                        setState(state => { state.settings = { ...state.settings, ...firestoreSettings }; });
                        console.log("Post-login: Firestore settings applied.");
                    } else {
                        console.log("Post-login: No app settings in Firestore, uploading current local settings.");
                        await firebaseService.saveAppSettingsToFirestore(appState.settings);
                    }
                    firebaseService.listenToAppSettingsChanges(user.uid);

                    // Load content data from Firestore (which includes daily reset logic for cloud data)
                    await firebaseService.loadFirebaseContent(user.uid); // This updates appState directly

                    // Start real-time listeners for content data
                    firebaseService.listenToTasksChanges(user.uid);
                    firebaseService.listenToAdditionalTasksChanges(user.uid);
                    firebaseService.listenToHistoryChanges(user.uid);
                    console.log("Post-login: Firestore listeners set up for tasks, additional tasks, and history.");

                    domElements.cloudSyncStatusDivEl.textContent = `로그인 됨. 클라우드 동기화 활성.`;
                } catch (error) {
                    console.error("Error during post-login Firebase operations:", error);
                    domElements.cloudSyncStatusDivEl.textContent = `클라우드 데이터 처리 오류.`;
                    showUserFeedback("클라우드 데이터 처리 중 오류 발생. 오프라인 모드로 전환됩니다.", 'error');
                    await initializeAppStateFromStorage(); // Fallback to local and re-render
                } finally {
                    isInitialFirestoreLoadComplete = true; // Firebase initial load completed
                }
            } else { // User logged out
                console.log("Auth state changed: User logged out.");
                stopFirestoreListeners(); // Stop all Firestore listeners
                setState(state => { state.currentUser = null; }, { skipSave: true }); // Clear currentUser in state
                isInitialFirestoreLoadComplete = false;
                await initializeAppStateFromStorage(); // Reload local state
                domElements.cloudSyncStatusDivEl.textContent = '로그인하여 데이터를 클라우드에 동기화하세요.';
                announceToScreenReader("로그아웃 되었습니다.");
                showUserFeedback("로그아웃 되었습니다.", 'info');
            }
        });
    } else {
        console.warn("initializeApp: Firebase Auth is not available. Running local-only.");
        updateAuthUI(null);
        domElements.cloudSyncStatusDivEl.textContent = '클라우드 서비스 사용 불가.';
        showUserFeedback("Firebase Auth 서비스 사용 불가. 로컬 모드로 실행됩니다.", 'warning');
    }
    console.log("App initialization sequence ended.");
}

function setupEventListeners() {
    // Auth
    domElements.loginBtnEl.addEventListener('click', () => handleAuthButtonClick('login'));
    domElements.signupBtnEl.addEventListener('click', () => handleAuthButtonClick('signup'));
    domElements.logoutBtnEl.addEventListener('click', signOutUser);

    // Network status
    window.addEventListener('online', () => { updateAuthUI(appState.currentUser); showUserFeedback("온라인 상태로 전환되었습니다.", 'info'); });
    window.addEventListener('offline', () => { updateAuthUI(appState.currentUser); showUserFeedback("오프라인 상태로 전환되었습니다.", 'warning'); });

    // Header controls
    domElements.appModeToggleEl.addEventListener('click', handleAppModeToggle);
    domElements.themeToggleButtonEl.addEventListener('click', handleThemeToggle);
    domElements.taskCountSelectorEl.addEventListener('change', handleTaskCountChange);

    // Core tasks (delegated listeners for changes)
    domElements.taskListDivEl.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox' && e.target.id.startsWith('task-checkbox-')) {
            const id = e.target.id.replace('task-checkbox-', '');
            const index = appState.tasks.findIndex(t => t.id == id);
            if (index !== -1) handleCoreTaskChange(index, 'completed', e.target.checked);
        }
    });
    domElements.taskListDivEl.addEventListener('input', (e) => {
        if (e.target.tagName === 'TEXTAREA' && e.target.parentElement.classList.contains('task-item-content')) {
            autoGrowTextarea(e.target);
            const id = e.target.closest('.task-item').querySelector('input[type="checkbox"]').id.replace('task-checkbox-', '');
            const index = appState.tasks.findIndex(t => t.id == id);
            if (index !== -1) handleCoreTaskChange(index, 'text', e.target.value);
        }
    });
    domElements.taskListDivEl.addEventListener('blur', (e) => {
        if (e.target.tagName === 'TEXTAREA' && e.target.parentElement.classList.contains('task-item-content')) {
            // State is already updated on input, this is just for saving
            if (appState.currentUser) syncDataToFirestore();
            else saveToLocalStorage();
        }
    }, true); // Use capture phase for blur event

    // Additional tasks
    domElements.addAdditionalTaskBtnEl.addEventListener('click', handleAddAdditionalTask);
    domElements.addAdditionalTaskInputEl.addEventListener('keypress', handleAdditionalTaskInput);
    domElements.additionalTaskListDivEl.addEventListener('click', (e) => {
        if (e.target.closest('.delete-additional-task-btn')) {
            const btn = e.target.closest('.delete-additional-task-btn');
            const id = btn.closest('.additional-task-item').querySelector('input[type="checkbox"]').id.replace('additional-task-checkbox-', '');
            handleDeleteAdditionalTask(id);
        } else if (e.target.type === 'checkbox' && e.target.id.startsWith('additional-task-checkbox-')) {
            const id = e.target.id.replace('additional-task-checkbox-', '');
            handleToggleAdditionalTaskCompletion(id);
        }
    });

    // Footer toggles
    getSectionsArray().forEach(sec => {
        if (sec.button) sec.button.addEventListener('click', () => toggleSection(sec.id));
    });

    // Share options
    domElements.shareIncludeAdditionalCheckboxEl.addEventListener('change', handleShareIncludeAdditionalChange);
    domElements.copyLinkBtnEl.addEventListener('click', () => {
        const shareUrl = window.location.href;
        navigator.clipboard.writeText(shareUrl).then(() => {
            const o = domElements.copyLinkBtnEl.innerHTML;
            domElements.copyLinkBtnEl.innerHTML = '<i class="fas fa-check"></i> 복사 완료!';
            domElements.copyLinkBtnEl.classList.add('copy-success');
            domElements.copyLinkBtnEl.disabled = true;
            setTimeout(() => { domElements.copyLinkBtnEl.innerHTML = o; domElements.copyLinkBtnEl.classList.remove('copy-success'); domElements.copyLinkBtnEl.disabled = false; }, 1500);
            announceToScreenReader("링크가 복사되었습니다.");
            showUserFeedback("링크가 복사되었습니다.", 'success');
        }).catch(err => {
            console.error('링크 복사 실패:', err);
            showUserFeedback('링크 복사에 실패했습니다.', 'error');
        });
    });
    domElements.shareTwitterBtnEl.addEventListener('click', (e) => {
        e.preventDefault();
        const shareUrl = window.location.href;
        const hashtags = "#오늘할일 #집중력 #오늘셋팁";
        const shareText = `오늘 할 일, 딱 ${appState.settings.focusTaskCount}개만 골라서 집중 완료! 🎯 (오늘셋 🤫) ${shareUrl} ${hashtags}`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
    });
    setupShareAsImageListener(); // Defined in render.js

    // Data management
    domElements.exportDataBtnEl.addEventListener('click', handleExportData);
    domElements.importDataBtnEl.addEventListener('click', () => domElements.importFileInputEl.click());
    domElements.importFileInputEl.addEventListener('change', handleImportData);

    // Global keydown listener
    document.addEventListener('keydown', handleDocumentKeydown);

    // Initial check for all done message
    renderTasks();
}

// Function to apply settings from state and render UI
function applySettingsAndRenderUI(settings, source = 'local') {
    applyThemeUI(settings.theme, source);
    applyAppModeUI(settings.appMode, source);
    if(domElements.taskCountSelectorEl) domElements.taskCountSelectorEl.value = settings.focusTaskCount;
    if(domElements.shareIncludeAdditionalCheckboxEl) domElements.shareIncludeAdditionalCheckboxEl.checked = settings.shareOptions.includeAdditional;

    // Render all content based on current state
    renderTasks();
    renderAdditionalTasks();
    renderHistory();
    updateStatsUI();
    renderStatsVisuals(); // Will check app mode internally
}

// Subscribe UI to state changes
subscribeToStateChanges(newState => {
    console.log("App State Changed. Re-rendering UI where necessary.", newState);
    // Note: Some UI updates are done proactively in event handlers (e.g., task completion toggle)
    // This is for ensuring consistency across all UI components and handling remote updates.

    // Apply settings changes (theme, mode, task count, share options)
    applySettingsAndRenderUI(newState.settings, 'state_change');

    // Re-render core task list (will also re-evaluate all-done message)
    renderTasks();

    // Re-render additional task list
    renderAdditionalTasks();

    // Re-render history list
    renderHistory();

    // Update stats text
    updateStatsUI();

    // Update stats visuals (chart, streak, most achieved day)
    renderStatsVisuals();

    // Update current date
    displayCurrentDate();

    // Sync to cloud if user is logged in and not an initial Firestore load or import
    // (Initial load and import handled by their respective functions)
    if (newState.currentUser && isInitialFirestoreLoadComplete) {
        syncDataToFirestore();
    } else if (newState.currentUser && !navigator.onLine) {
        showUserFeedback("오프라인: 데이터는 네트워크 연결 시 동기화됩니다.", 'info');
    } else if (!newState.currentUser) {
        // Save to local storage if no user logged in
        saveToLocalStorage();
    }
});


// Start the application
document.addEventListener('DOMContentLoaded', initializeApp);

// Re-export for easier access in browser console if needed for debugging
window.appState = appState;

