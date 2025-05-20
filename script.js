// script.js - v1.13.7-ref-error-fix
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed (v1.13.7)");

    // --- Firebase Configuration ---
    const firebaseConfig = {
        apiKey: "AIzaSyB54BtURvHN9YmC3HVGaClOo32zO44deu4",
        authDomain: "todayset-82fcc.firebaseapp.com",
        projectId: "todayset-82fcc",
        storageBucket: "todayset-82fcc.appspot.com",
        messagingSenderId: "432546292770",
        appId: "1:432546292770:web:ea8231f64c6f54792ad67b",
        measurementId: "G-Z4WPD221Y6"
    };

    // --- Firebase SDK 초기화 ---
    let firebaseApp, firebaseAuth, firestoreDB;
    try {
        if (typeof firebase !== 'undefined' && firebase.initializeApp) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
            if (firebase.auth) firebaseAuth = firebase.auth();
            if (firebase.firestore) {
                firestoreDB = firebase.firestore();
                if (firestoreDB) firestoreDB.enablePersistence({ synchronizeTabs: true }).catch(err => console.warn("Firestore persistence error:", err.code));
            }
            console.log("Firebase SDK initialized:", { app: !!firebaseApp, auth: !!firebaseAuth, db: !!firestoreDB });
        } else console.error("Firebase SDK (firebase object) not loaded.");
    } catch (error) { console.error("CRITICAL: Error during Firebase initialization:", error); }

    // --- 전역 변수 (DOM 요소는 필요시 함수 내에서 가져옴) ---
    let MAX_TASKS_CURRENT_MODE = 3;
    let tasks = [];
    let additionalTasks = [];
    let history = [];
    let achievementChart = null;
    let currentAppMode = 'simple';
    let currentTheme = 'dark';
    let focusModeTaskCountSetting = 3;
    let shareOptions = { includeAdditional: false, includeMemos: false };
    let currentUser = null;
    let userSettingsUnsubscribe = null;

    const APP_VERSION_DATA_FORMAT = "1.13.7-ref-error-fix-data";

    // --- 유틸리티 함수 ---
    function announceToScreenReader(message) {
        const liveRegionEl = document.getElementById('live-region');
        if (liveRegionEl) {
            liveRegionEl.textContent = message;
            setTimeout(() => { if (liveRegionEl) liveRegionEl.textContent = ''; }, 3000);
        }
    }

    // --- PWA: 서비스 워커 등록 ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('SW registered.', reg))
                .catch(err => console.error('SW reg failed:', err));
        });
    }

    // --- Firestore Data Functions ---
    function getUserSettingsRef(userId) {
        return (firestoreDB && userId) ? firestoreDB.collection('users').doc(userId) : null;
    }

    async function initializeUserSettingsInFirestore(userId) {
        const userSettingsRef = getUserSettingsRef(userId);
        if (!userSettingsRef) return;
        try {
            const docSnap = await userSettingsRef.get();
            if (!docSnap.exists || !docSnap.data()?.appSettings) {
                const initialSettings = {
                    appMode: 'simple', theme: 'dark', focusTaskCount: 3,
                    shareOptions: { includeAdditional: false, includeMemos: false },
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                };
                await userSettingsRef.set({ appSettings: initialSettings }, { merge: true });
                console.log("Firestore: Initial appSettings created for", userId);
            }
        } catch (error) { console.error("Error initializing appSettings in Firestore for " + userId + ":", error); }
    }

    async function loadAppSettingsFromFirestore(userId) {
        const userSettingsRef = getUserSettingsRef(userId);
        if (!userSettingsRef) return Promise.reject("User settings ref not available.");
        try {
            const docSnap = await userSettingsRef.get();
            if (docSnap.exists && docSnap.data()?.appSettings) {
                return docSnap.data().appSettings;
            }
            console.log("Firestore: No appSettings for user, initializing.");
            await initializeUserSettingsInFirestore(userId);
            const newDocSnap = await userSettingsRef.get();
            return (newDocSnap.exists && newDocSnap.data()?.appSettings) ? newDocSnap.data().appSettings : null;
        } catch (error) {
            console.error("Error loading appSettings from Firestore for " + userId + ":", error);
            announceToScreenReader("클라우드 설정 로드 실패.");
            return Promise.reject(error);
        }
    }

    function applySettingsToLocalAndUI(settings, source = 'local') {
        if (!settings) { console.warn("applySettingsToLocalAndUI: settings object is null or undefined."); return; }
        console.log("Applying settings to local and UI from source:", source, settings);

        currentAppMode = settings.appMode || currentAppMode;
        currentTheme = settings.theme || currentTheme;
        focusModeTaskCountSetting = settings.focusTaskCount || focusModeTaskCountSetting;
        shareOptions = settings.shareOptions || shareOptions;

        if (source !== 'firestore') {
            localStorage.setItem('oneulSetMode', currentAppMode);
            localStorage.setItem('oneulSetTheme', currentTheme);
            localStorage.setItem('oneulSetFocusTaskCountSetting', focusModeTaskCountSetting.toString());
            localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
        }

        applyThemeUI(currentTheme, true, source);
        applyAppModeUI(currentAppMode, true, source);

        const taskCountSelectorEl = document.getElementById('task-count-selector');
        if(taskCountSelectorEl) taskCountSelectorEl.value = focusModeTaskCountSetting;
        const shareIncludeAdditionalCheckboxEl = document.getElementById('share-include-additional');
        if(shareIncludeAdditionalCheckboxEl) shareIncludeAdditionalCheckboxEl.checked = shareOptions.includeAdditional;
        const shareIncludeMemosCheckboxEl = document.getElementById('share-include-memos');
        if(shareIncludeMemosCheckboxEl) shareIncludeMemosCheckboxEl.checked = shareOptions.includeMemos;
    }

    async function saveAppSettingsToFirestore() {
        if (!currentUser || !firestoreDB) return;
        const userSettingsRef = getUserSettingsRef(currentUser.uid);
        if (!userSettingsRef) return;
        const settingsToSave = {
            appMode: currentAppMode, theme: currentTheme,
            focusTaskCount: focusModeTaskCountSetting, shareOptions: shareOptions,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await userSettingsRef.set({ appSettings: settingsToSave }, { merge: true });
            console.log("Firestore: App settings saved for user", currentUser.uid);
        } catch (error) { console.error("Error saving app settings to Firestore for " + currentUser.uid + ":", error); }
    }

    function listenToAppSettingsChanges(userId) {
        if (userSettingsUnsubscribe) userSettingsUnsubscribe();
        const userSettingsRef = getUserSettingsRef(userId);
        if (!userSettingsRef) return;
        console.log("Setting up Firestore listener for appSettings:", userId);
        userSettingsUnsubscribe = userSettingsRef.onSnapshot(doc => {
            if (doc.exists && doc.data()?.appSettings) {
                const remoteSettings = doc.data().appSettings;
                const localThemeForCompare = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
                let changed = remoteSettings.appMode !== currentAppMode ||
                              remoteSettings.theme !== localThemeForCompare ||
                              remoteSettings.focusTaskCount !== focusModeTaskCountSetting ||
                              JSON.stringify(remoteSettings.shareOptions) !== JSON.stringify(shareOptions);
                if (changed) {
                    console.log("Firestore: AppSettings changed by remote, updating local state and UI.");
                    applySettingsToLocalAndUI(remoteSettings, 'firestore');
                    announceToScreenReader("클라우드 설정이 업데이트되었습니다.");
                }
            }
        }, error => console.error("Error in appSettings listener for " + userId + ":", error));
    }

    // --- Firebase Authentication Functions ---
    async function signUpWithEmailPassword(email, password) {
        if (!firebaseAuth) return;
        try {
            const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
            await initializeUserSettingsInFirestore(userCredential.user.uid);
            announceToScreenReader(`회원가입 성공: ${userCredential.user.email}`);
        } catch (error) { console.error("Error signing up:", error); alert(`회원가입 실패: ${error.message}`); }
    }
    async function signInWithEmailPassword(email, password) {
        if (!firebaseAuth) return;
        try {
            await firebaseAuth.signInWithEmailAndPassword(email, password);
        } catch (error) { console.error("Error signing in:", error); alert(`로그인 실패: ${error.message}`); }
    }
    async function signInWithGoogle() {
        if (!firebaseAuth) return;
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            const result = await firebaseAuth.signInWithPopup(provider);
            if (result.additionalUserInfo && result.additionalUserInfo.isNewUser) {
                await initializeUserSettingsInFirestore(result.user.uid);
            }
        } catch (error) { console.error("Error signing in with Google:", error); alert(`Google 로그인 실패: ${error.message}`); }
    }
    async function signOutUser() {
        if (!firebaseAuth) return;
        try {
            if (userSettingsUnsubscribe) userSettingsUnsubscribe(); userSettingsUnsubscribe = null;
            await firebaseAuth.signOut();
        } catch (error) { console.error("Error signing out:", error); alert(`로그아웃 실패: ${error.message}`); }
    }

    // --- Auth UI 업데이트 함수 ---
    function updateAuthUI(user) {
        currentUser = user;
        const authStatusContainerEl = document.getElementById('auth-status');
        const loginBtnEl = document.getElementById('login-btn');
        const signupBtnEl = document.getElementById('signup-btn');
        const userEmailSpanEl = document.getElementById('user-email');
        const logoutBtnEl = document.getElementById('logout-btn');
        const cloudSyncStatusDivEl = document.getElementById('cloud-sync-status');

        if (!authStatusContainerEl || !loginBtnEl || !signupBtnEl || !userEmailSpanEl || !logoutBtnEl || !cloudSyncStatusDivEl) {
            console.error("Auth UI elements missing. Cannot update Auth UI.");
            return;
        }
        const isLoggedIn = !!user;
        loginBtnEl.classList.toggle('hidden', isLoggedIn);
        signupBtnEl.classList.toggle('hidden', isLoggedIn);
        userEmailSpanEl.textContent = isLoggedIn ? (user.displayName || user.email || '사용자') : '';
        userEmailSpanEl.classList.toggle('hidden', !isLoggedIn);
        logoutBtnEl.classList.toggle('hidden', !isLoggedIn);
        cloudSyncStatusDivEl.textContent = isLoggedIn ? `로그인 됨 (${userEmailSpanEl.textContent}).` : '로그인하여 데이터를 클라우드에 동기화하세요.';
        authContainerEl.classList.toggle('logged-in', isLoggedIn);
        console.log("Auth UI updated. User:", user ? user.uid : 'null');
    }

    // --- 모달/팝업 관련 함수 ---
    function createAuthModal(type) {
        const existingModal = document.getElementById('auth-modal');
        if (existingModal) existingModal.remove();
        const modal = document.createElement('div'); modal.id = 'auth-modal'; modal.className = 'auth-modal';
        const modalContent = document.createElement('div'); modalContent.className = 'auth-modal-content';
        const closeBtn = document.createElement('span'); closeBtn.className = 'auth-modal-close'; closeBtn.innerHTML = '×';
        closeBtn.onclick = () => modal.remove();
        const title = document.createElement('h2'); title.textContent = type === 'login' ? '로그인' : '계정 만들기';
        const emailLabel = document.createElement('label'); emailLabel.htmlFor = 'auth-email'; emailLabel.textContent = '이메일';
        const emailInput = document.createElement('input'); emailInput.type = 'email'; emailInput.id = 'auth-email'; emailInput.required = true;
        const passwordLabel = document.createElement('label'); passwordLabel.htmlFor = 'auth-password'; passwordLabel.textContent = '비밀번호';
        const passwordInput = document.createElement('input'); passwordInput.type = 'password'; passwordInput.id = 'auth-password'; passwordInput.required = true;
        if (type === 'signup') passwordInput.minLength = 6;
        const submitBtn = document.createElement('button'); submitBtn.type = 'submit'; submitBtn.textContent = title.textContent;
        const googleBtn = document.createElement('button'); googleBtn.type = 'button'; googleBtn.id = 'google-signin-btn';
        googleBtn.innerHTML = '<i class="fab fa-google"></i> Google 계정으로 ' + (type === 'login' ? '로그인' : '시작하기');
        googleBtn.onclick = async () => {
            await signInWithGoogle();
            if (firebaseAuth && firebaseAuth.currentUser) modal.remove();
        };
        const form = document.createElement('form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const emailVal = emailInput.value; const passwordVal = passwordInput.value;
            if (type === 'login') await signInWithEmailPassword(emailVal, passwordVal);
            else await signUpWithEmailPassword(emailVal, passwordVal);
            if (firebaseAuth && firebaseAuth.currentUser) modal.remove();
        };
        form.appendChild(emailLabel); form.appendChild(emailInput); form.appendChild(passwordLabel); form.appendChild(passwordInput); form.appendChild(submitBtn);
        modalContent.appendChild(closeBtn); modalContent.appendChild(title); modalContent.appendChild(form);
        modalContent.appendChild(document.createElement('hr')); modalContent.appendChild(googleBtn);
        modal.appendChild(modalContent); document.body.appendChild(modal); emailInput.focus();
    }

    // --- Auth UI 이벤트 리스너 (initializeApp에서 호출) ---
    function setupAuthEventListeners() {
        const loginBtnEl = document.getElementById('login-btn');
        if (loginBtnEl) loginBtnEl.addEventListener('click', () => createAuthModal('login'));
        const signupBtnEl = document.getElementById('signup-btn');
        if (signupBtnEl) signupBtnEl.addEventListener('click', () => createAuthModal('signup'));
        const logoutBtnEl = document.getElementById('logout-btn');
        if (logoutBtnEl) logoutBtnEl.addEventListener('click', signOutUser);
    }

    // --- UI 업데이트 함수 (데이터 변경 없이 순수 UI만) ---
    function applyAppModeUI(mode, isInitialLoad = false, source = 'local') {
        // 함수 내에서 필요한 모든 DOM 요소를 다시 가져옵니다.
        const appModeToggleEl = document.getElementById('app-mode-toggle');
        const taskCountSelectorContainerEl = document.querySelector('.task-count-setting');
        const additionalTasksSectionEl = document.getElementById('additional-tasks-section');
        const statsVisualsContainerEl = document.querySelector('.stats-visuals');
        const shareAsImageBtnContainerEl = document.getElementById('share-as-image-btn-container');
        const currentSettingsContentDiv = document.querySelector('#settings-section .settings-content');
        const taskCountSelectorEl = document.getElementById('task-count-selector');
        const shareOptionsDivEl = document.querySelector('#share-section .share-options');
        const shareIncludeMemosLabelEl = document.getElementById('share-include-memos-label');
        const toggleSettingsBtnEl = document.getElementById('toggle-settings-btn'); // 오류 발생 지점
        const settingsSectionEl = document.getElementById('settings-section');
        const additionalTaskListDivEl = document.getElementById('additional-task-list');

        if (!document.body) { console.error("applyAppModeUI: document.body not found!"); return; }

        const oldAppModeUI = document.body.classList.contains('simple-mode') ? 'simple' : 'focus';

        document.body.classList.toggle('simple-mode', mode === 'simple');
        document.body.classList.toggle('focus-mode', mode === 'focus');
        const modeToSwitchToText = mode === 'simple' ? '집중' : '심플';

        if(appModeToggleEl) {
            appModeToggleEl.textContent = `${modeToSwitchToText} 모드로 전환`;
            appModeToggleEl.setAttribute('aria-label', `${modeToSwitchToText} 모드로 전환`);
        }
        if (shareOptionsDivEl) shareOptionsDivEl.classList.toggle('hidden', mode === 'simple');
        if (shareIncludeMemosLabelEl) shareIncludeMemosLabelEl.classList.toggle('hidden', mode === 'simple');

        if (mode === 'simple') {
            MAX_TASKS_CURRENT_MODE = 3;
            if(taskCountSelectorContainerEl) taskCountSelectorContainerEl.classList.add('hidden');
            if(additionalTasksSectionEl) additionalTasksSectionEl.classList.add('hidden');
            if (statsVisualsContainerEl) statsVisualsContainerEl.classList.add('hidden');
            if (shareAsImageBtnContainerEl) shareAsImageBtnContainerEl.classList.add('hidden');
            if (currentSettingsContentDiv && settingsSectionEl) {
                const simpleInfo = settingsSectionEl.querySelector('.simple-mode-settings-info');
                currentSettingsContentDiv.classList.add('hidden');
                if(simpleInfo) simpleInfo.classList.remove('hidden');
            }
            // toggleSettingsBtnEl 관련 로직 추가 (심플 모드에서 토글 섹션이 열려있었다면 닫기)
            if (toggleSettingsBtnEl && toggleSettingsBtnEl.classList.contains('active') && settingsSectionEl && !settingsSectionEl.classList.contains('hidden')) {
                settingsSectionEl.classList.add('hidden');
                const sections = getSectionsArray();
                const settingsSecInfo = sections.find(s => s.id === 'settings-section');
                if (settingsSecInfo && settingsSecInfo.button) toggleSettingsBtnEl.textContent = settingsSecInfo.baseText; // 버튼 텍스트 복원
                toggleSettingsBtnEl.classList.remove('active');
                toggleSettingsBtnEl.setAttribute('aria-expanded', 'false');
                settingsSectionEl.setAttribute('aria-hidden', 'true');
            }

        } else { // focus mode
            MAX_TASKS_CURRENT_MODE = focusModeTaskCountSetting;
            if(taskCountSelectorContainerEl) taskCountSelectorContainerEl.classList.remove('hidden');
            if(additionalTasksSectionEl) additionalTasksSectionEl.classList.remove('hidden');
            if (statsVisualsContainerEl) statsVisualsContainerEl.classList.remove('hidden');
            if (shareAsImageBtnContainerEl) shareAsImageBtnContainerEl.classList.remove('hidden');
            if (currentSettingsContentDiv && settingsSectionEl) {
                 const simpleInfo = settingsSectionEl.querySelector('.simple-mode-settings-info');
                 currentSettingsContentDiv.classList.remove('hidden');
                 if(simpleInfo) simpleInfo.classList.add('hidden');
            }
        }
        if(taskCountSelectorEl) taskCountSelectorEl.value = focusModeTaskCountSetting;

        if (source !== 'firestore' && oldAppModeUI !== mode && currentUser) {
            saveAppSettingsToFirestore();
        }
        if (source === 'local' || !isInitialLoad || source === 'firestore' ) {
            renderTasks();
            renderAdditionalTasks();
        }
        if (!isInitialLoad && source === 'local') {
            announceToScreenReader(`${mode === 'simple' ? '심플' : '집중'} 모드로 변경되었습니다.`);
        }
    }

    const appModeToggleForListener = document.getElementById('app-mode-toggle');
    if(appModeToggleForListener) {
        appModeToggleForListener.addEventListener('click', () => {
            const newMode = currentAppMode === 'simple' ? 'focus' : 'simple';
            currentAppMode = newMode;
            localStorage.setItem('oneulSetMode', currentAppMode);
            if(currentUser) saveAppSettingsToFirestore();
            applyAppModeUI(currentAppMode, false, 'local');
        });
    }

    function applyThemeUI(theme, isInitialLoad = false, source = 'local') {
        const themeToggleButtonEl = document.getElementById('theme-toggle');
        const chartCanvasEl = document.getElementById('daily-achievement-chart');
        let currentDailyAchievementChartCtx = chartCanvasEl ? chartCanvasEl.getContext('2d') : null;

        if (!document.body) { console.error("applyThemeUI: document.body not found!"); return; }
        document.body.classList.toggle('dark-theme', theme === 'dark');
        if(themeToggleButtonEl) themeToggleButtonEl.textContent = (theme === 'dark' ? '☀️' : '🌙');
        updateThemeColorMeta(theme);

        if (achievementChart) { achievementChart.destroy(); achievementChart = null; }
        if (currentAppMode === 'focus' && currentDailyAchievementChartCtx) {
             renderStatsVisuals();
        }
    }
    const themeToggleButtonForListener = document.getElementById('theme-toggle');
    if(themeToggleButtonForListener){
        themeToggleButtonForListener.addEventListener('click', () => {
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            currentTheme = newTheme;
            localStorage.setItem('oneulSetTheme', currentTheme);
            if(currentUser) saveAppSettingsToFirestore();
            applyThemeUI(currentTheme, false, 'local');
            announceToScreenReader(`테마가 ${newTheme === 'dark' ? '다크' : '라이트'} 모드로 변경되었습니다.`);
        });
    }

    function updateThemeColorMeta(theme) {
        let color = (theme === 'light') ? '#3498db' : '#5dade2';
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) themeColorMeta.setAttribute('content', color);
    }

    // --- 날짜 및 유틸리티 ---
    function getTodayDateString() { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; }
    function displayCurrentDate() {
        const currentDateElToSet = document.getElementById('current-date');
        if(currentDateElToSet){
            const today = new Date();
            const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
            currentDateElToSet.textContent = today.toLocaleDateString('ko-KR', options);
        } else { console.warn("displayCurrentDate: current-date element not found."); }
    }
    function autoGrowTextarea(element) { if(element) { element.style.height = "auto"; element.style.height = (element.scrollHeight) + "px"; } }

    // --- 상태 저장 및 로드 ---
    function saveState(source = 'local') {
        localStorage.setItem('oneulSetTasks', JSON.stringify(tasks));
        localStorage.setItem('oneulSetAdditionalTasks', JSON.stringify(additionalTasks));
        localStorage.setItem('oneulSetLastDate', getTodayDateString());
        localStorage.setItem('oneulSetHistory', JSON.stringify(history));
        updateStats();
        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals();
        if (currentUser && firestoreDB && source === 'local') { /* TODO: Save tasks, etc. */ }
    }

    function loadContentDataFromLocalStorage() {
        console.log("Loading content data (tasks, history) from Local Storage.");
        const storedTasks = localStorage.getItem('oneulSetTasks');
        const storedAdditionalTasks = localStorage.getItem('oneulSetAdditionalTasks');
        const storedLastDate = localStorage.getItem('oneulSetLastDate');
        const storedHistory = localStorage.getItem('oneulSetHistory');
        const todayDateStr = getTodayDateString();

        if (storedHistory) { try { history = JSON.parse(storedHistory); if (!Array.isArray(history)) history = []; } catch (e) { history = []; } }
        if (currentAppMode === 'focus' && storedAdditionalTasks) {
            try { additionalTasks = JSON.parse(storedAdditionalTasks); if(!Array.isArray(additionalTasks)) additionalTasks = []; } catch (e) { additionalTasks = [];}
        } else { additionalTasks = []; }

        if (storedLastDate === todayDateStr && storedTasks) {
            try { tasks = JSON.parse(storedTasks); if (!Array.isArray(tasks)) initializeTasks(); }
            catch (e) { initializeTasks(); }
        } else {
            if (storedTasks && storedLastDate) { /* 어제 데이터 히스토리 처리 */ }
            localStorage.setItem('oneulSetFocusTaskCountSettingBeforeReset', focusModeTaskCountSetting.toString());
            initializeTasks();
            if (currentAppMode === 'focus') additionalTasks = [];
            saveState('local');
        }
        while (tasks.length < 5) { tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });}
        if (tasks.length > 5) tasks = tasks.slice(0,5);

        renderTasks();
        renderAdditionalTasks();
        updateStats();
        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals();
        renderHistory();
    }
    function initializeTasks() { /* 이전과 동일 */ }

    const taskCountSelectorForListener = document.getElementById('task-count-selector');
    if(taskCountSelectorForListener){
        taskCountSelectorForListener.addEventListener('change', (e) => {
            if (currentAppMode === 'simple') return;
            const newCount = parseInt(e.target.value, 10);
            if (focusModeTaskCountSetting !== newCount) {
                focusModeTaskCountSetting = newCount;
                localStorage.setItem('oneulSetFocusTaskCountSetting', focusModeTaskCountSetting.toString());
                if (currentUser) saveAppSettingsToFirestore();
                applyAppModeUI(currentAppMode, false, 'local');
                announceToScreenReader(`핵심 할 일 개수가 ${newCount}개로 변경되었습니다.`);
            }
        });
    }
    const shareIncludeAdditionalCheckboxForListener = document.getElementById('share-include-additional');
    if (shareIncludeAdditionalCheckboxForListener) { /* 이전과 동일 */ }
    const shareIncludeMemosCheckboxForListener = document.getElementById('share-include-memos');
    if (shareIncludeMemosCheckboxForListener) { /* 이전과 동일 */ }

    function renderTasks() {
        const taskListDivEl = document.querySelector('.task-list');
        if(!taskListDivEl) { console.warn("renderTasks: task-list div not found."); return; }
        taskListDivEl.innerHTML = '';
        const tasksToRender = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
        tasksToRender.forEach((task, index) => {
            if (!task) { console.warn(`Task at index ${index} is undefined.`); return; }
            const originalTaskIndex = tasks.findIndex(t => t && t.id === task.id);
            if (originalTaskIndex === -1) return;
            const taskItem = document.createElement('div'); taskItem.classList.add('task-item');
            if (tasks[originalTaskIndex].completed) taskItem.classList.add('completed');
            const checkboxLabel = document.createElement('label'); checkboxLabel.classList.add('custom-checkbox-label');
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
            checkbox.checked = tasks[originalTaskIndex].completed;
            checkbox.setAttribute('aria-label', `핵심 할 일 ${index + 1} 완료`);
            checkbox.id = `task-checkbox-${tasks[originalTaskIndex].id}`; checkboxLabel.htmlFor = checkbox.id;
            const checkboxSpan = document.createElement('span'); checkboxSpan.classList.add('custom-checkbox-span');
            checkbox.addEventListener('change', () => {
                tasks[originalTaskIndex].completed = checkbox.checked;
                taskItem.classList.toggle('completed', checkbox.checked);
                checkAllDone(); saveState('local');
            });
            checkboxLabel.appendChild(checkbox); checkboxLabel.appendChild(checkboxSpan);
            const taskContentDiv = document.createElement('div'); taskContentDiv.classList.add('task-item-content');
            const textareaField = document.createElement('textarea'); textareaField.rows = "1";
            textareaField.placeholder = `할 일 ${index + 1}`; textareaField.value = tasks[originalTaskIndex].text;
            textareaField.setAttribute('aria-label', `할 일 ${index + 1} 내용`);
            textareaField.addEventListener('input', (e) => { tasks[originalTaskIndex].text = e.target.value; autoGrowTextarea(e.target); });
            textareaField.addEventListener('blur', () => { saveState('local'); });
            textareaField.addEventListener('focus', (e) => { autoGrowTextarea(e.target); });
            taskContentDiv.appendChild(textareaField);
            if (currentAppMode === 'focus') {
                const memoIcon = document.createElement('button'); memoIcon.classList.add('memo-icon');
                memoIcon.innerHTML = '<i class="fas fa-sticky-note"></i>';
                memoIcon.setAttribute('aria-label', `할 일 ${index + 1} 메모 보기/숨기기`);
                memoIcon.setAttribute('aria-expanded', 'false'); taskContentDiv.appendChild(memoIcon);
                const memoContainer = document.createElement('div'); memoContainer.classList.add('memo-container', 'hidden');
                const memoTextarea = document.createElement('textarea'); memoTextarea.rows = "1";
                memoTextarea.placeholder = "메모 추가..."; memoTextarea.value = tasks[originalTaskIndex].memo || "";
                memoTextarea.setAttribute('aria-label', `할 일 ${index + 1} 메모 내용`);
                memoTextarea.addEventListener('input', (e) => { tasks[originalTaskIndex].memo = e.target.value; autoGrowTextarea(e.target);});
                memoTextarea.addEventListener('blur', () => { saveState('local'); });
                memoContainer.appendChild(memoTextarea); taskItem.appendChild(memoContainer);
                memoIcon.addEventListener('click', () => {
                    const isHidden = memoContainer.classList.toggle('hidden');
                    memoIcon.setAttribute('aria-expanded', !isHidden);
                    if(!isHidden) memoTextarea.focus(); else textareaField.focus();
                    autoGrowTextarea(textareaField); if(!isHidden) autoGrowTextarea(memoTextarea);
                });
                if (tasks[originalTaskIndex].memo && tasks[originalTaskIndex].memo.trim() !== "") {
                    memoIcon.classList.add('has-memo');
                }
                memoTextarea.addEventListener('input', (e) => {
                    tasks[originalTaskIndex].memo = e.target.value; autoGrowTextarea(e.target);
                    memoIcon.classList.toggle('has-memo', e.target.value.trim() !== "");
                });
            }
            taskItem.appendChild(checkboxLabel); taskItem.appendChild(taskContentDiv);
            taskListDivEl.appendChild(taskItem); autoGrowTextarea(textareaField);
        });
        checkAllDone();
    }
    function checkAllDone() {
        const allDoneMessageElToCheck = document.getElementById('all-done-message');
        if(!allDoneMessageElToCheck || !tasks) return;
        const tasksToCheck = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
        const filledTasks = tasksToCheck.filter(task => task && typeof task.text === 'string' && task.text.trim() !== "");
        const completedFilledTasks = filledTasks.filter(task => task && task.completed);
        const shouldShowMessage = filledTasks.length > 0 && filledTasks.length === MAX_TASKS_CURRENT_MODE && completedFilledTasks.length === MAX_TASKS_CURRENT_MODE;
        allDoneMessageElToCheck.classList.toggle('hidden', !shouldShowMessage);
    }
    function renderAdditionalTasks() {
        const additionalTaskListDivElToCheck = document.getElementById('additional-task-list');
        if (currentAppMode === 'simple' || !additionalTaskListDivElToCheck) {
            if(additionalTaskListDivElToCheck) additionalTaskListDivElToCheck.innerHTML = ''; return;
        }
        additionalTaskListDivElToCheck.innerHTML = '';
        if (additionalTasks.length === 0) {
            const p = document.createElement('p'); p.textContent = '추가된 과제가 없습니다.';
            p.classList.add('no-additional-tasks'); additionalTaskListDivElToCheck.appendChild(p); return;
        }
        additionalTasks.forEach((task, index) => { /* 이전과 동일 */ });
    }
    function setupAdditionalTaskListener() {
        const addBtn = document.getElementById('add-additional-task-btn');
        const addInput = document.getElementById('add-additional-task-input');
        if (addBtn && addInput) {
            addBtn.addEventListener('click', () => {
                if (currentAppMode === 'simple') return;
                const text = addInput.value.trim();
                if (text) {
                    additionalTasks.push({ id: Date.now(), text: text, completed: false });
                    addInput.value = ''; renderAdditionalTasks(); saveState('local');
                    announceToScreenReader(`추가 과제 "${text}"가 추가되었습니다.`); addInput.focus();
                }
            });
            addInput.addEventListener('keypress', (e) => {
                if (currentAppMode === 'simple') return; if (e.key === 'Enter') addBtn.click();
            });
        }
    }
    function getSectionsArray() {
        return [
            { id: 'history-section', button: document.getElementById('toggle-history-btn'), baseText: '기록' },
            { id: 'stats-section', button: document.getElementById('toggle-stats-btn'), baseText: '통계' },
            { id: 'share-section', button: document.getElementById('toggle-share-btn'), baseText: '공유' },
            { id: 'settings-section', button: document.getElementById('toggle-settings-btn'), baseText: '설정' }
        ];
    }
    function toggleSection(sectionIdToToggle) {
        const sections = getSectionsArray();
        let sectionOpenedName = "";
        sections.forEach(sec => {
            if (!sec.button || !document.getElementById(sec.id)) return;
            const sectionElement = document.getElementById(sec.id);
            const isSimpleMode = document.body.classList.contains('simple-mode');
            const currentStatsVisualsContainer = document.querySelector('.stats-visuals');
            const currentShareAsImageBtnContainer = document.getElementById('share-as-image-btn-container');
            const currentSettingsContentDiv = document.querySelector('#settings-section .settings-content');
            const currentShareOptionsDiv = document.querySelector('#share-section .share-options');

            if (isSimpleMode) {
                if (sec.id === 'stats-section' && currentStatsVisualsContainer) currentStatsVisualsContainer.classList.add('hidden');
                if (sec.id === 'share-section' && currentShareAsImageBtnContainer) currentShareAsImageBtnContainer.classList.add('hidden');
                if (sec.id === 'settings-section' && currentSettingsContentDiv) currentSettingsContentDiv.classList.add('hidden');
                if (sec.id === 'share-section' && currentShareOptionsDiv) currentShareOptionsDiv.classList.add('hidden');
            } else {
                if (sec.id === 'stats-section' && currentStatsVisualsContainer) currentStatsVisualsContainer.classList.remove('hidden');
                if (sec.id === 'share-section' && currentShareAsImageBtnContainer) currentShareAsImageBtnContainer.classList.remove('hidden');
                if (sec.id === 'settings-section' && currentSettingsContentDiv) currentSettingsContentDiv.classList.remove('hidden');
                if (sec.id === 'share-section' && currentShareOptionsDiv) currentShareOptionsDiv.classList.remove('hidden');
            }
            if (sec.id === sectionIdToToggle) { /* 이전과 동일 */ } else { /* 이전과 동일 */ }
        });
        if(sectionOpenedName) announceToScreenReader(`${sectionOpenedName} 섹션이 열렸습니다.`);
    }
    function setupFooterToggleListeners() {
        getSectionsArray().forEach(sec => {
            if (sec.button) sec.button.addEventListener('click', () => toggleSection(sec.id));
        });
    }
    function renderHistory() {
        const historyListDivEl = document.getElementById('history-list');
        if (!historyListDivEl) return;
        if (history.length === 0) { historyListDivEl.innerHTML = '<p>지난 기록이 없습니다.</p>'; return; }
        historyListDivEl.innerHTML = '';
        history.forEach(entry => { /* 이전과 동일 */ });
    }
    function calculateAchievementRate(days) { /* 이전과 동일 */ return "0%";}
    function updateStats() {
        const weeklyStatsElToSet = document.getElementById('weekly-stats');
        const monthlyStatsElToSet = document.getElementById('monthly-stats');
        if(weeklyStatsElToSet) weeklyStatsElToSet.textContent = `지난 7일간 달성률: ${calculateAchievementRate(7)}`;
        if(monthlyStatsElToSet) monthlyStatsElToSet.textContent = `지난 30일간 달성률: ${calculateAchievementRate(30)}`;
    }
    function renderStatsVisuals() {
        const statsVisualsContainerEl = document.querySelector('.stats-visuals');
        const streakDaysElToSet = document.getElementById('streak-days');
        const mostAchievedDayElToSet = document.getElementById('most-achieved-day');
        const chartCanvasEl = document.getElementById('daily-achievement-chart');
        const currentDailyAchievementChartCtx = chartCanvasEl ? chartCanvasEl.getContext('2d') : null;

        if (currentAppMode === 'simple' || !window.Chart || !currentDailyAchievementChartCtx || !statsVisualsContainerEl || !streakDaysElToSet || !mostAchievedDayElToSet) {
             if(statsVisualsContainerEl) statsVisualsContainerEl.classList.add('hidden');
             if (achievementChart) { achievementChart.destroy(); achievementChart = null; }
             return;
        }
        if(statsVisualsContainerEl) statsVisualsContainerEl.classList.remove('hidden');
        // ... (이하 차트 로직은 이전과 동일, streakDaysElToSet, mostAchievedDayElToSet 사용)
    }
    const shareUrl = window.location.href;
    function getShareText() { /* 이전과 동일 */ return ""; }

    function setupOtherEventListeners() {
        const copyLinkBtnEl = document.getElementById('copy-link-btn');
        if(copyLinkBtnEl) copyLinkBtnEl.addEventListener('click', () => { /* 이전과 동일 */ });
        const shareTwitterBtnEl = document.getElementById('share-twitter-btn');
        if(shareTwitterBtnEl) shareTwitterBtnEl.addEventListener('click', (e) => { /* 이전과 동일 */ });
        const shareAsImageBtnEl = document.getElementById('share-as-image-btn');
        if (shareAsImageBtnEl && typeof html2canvas !== 'undefined') {
            shareAsImageBtnEl.addEventListener('click', () => { /* 이전과 동일 */ });
        }
        const exportDataBtnEl = document.getElementById('export-data-btn');
        if (exportDataBtnEl) {
            exportDataBtnEl.addEventListener('click', () => { /* 이전과 동일 */ });
        }
        const importDataBtnEl = document.getElementById('import-data-btn');
        const importFileInputEl = document.getElementById('import-file-input');
        if (importDataBtnEl && importFileInputEl) {
            importDataBtnEl.addEventListener('click', () => importFileInputEl.click() );
            importFileInputEl.addEventListener('change', (event) => { /* 이전과 동일 */ });
        }
        document.addEventListener('keydown', (e) => { /* 이전과 동일 */ });
    }

    // --- 초기화 실행 ---
    async function initializeApp() {
        console.log("Initializing app (v1.13.6)...");

        const currentDateElement = document.getElementById('current-date');
        const taskListElement = document.querySelector('.task-list');
        const authStatusElement = document.getElementById('auth-status');
        if (!currentDateElement || !taskListElement || !authStatusElement) {
            console.error("CRITICAL: Essential DOM elements not found. Aborting initialization.");
            document.body.innerHTML = '<div style="padding: 20px; text-align: center;">앱 로딩 중 오류 발생. 새로고침 해주세요. (Error Code: DOM_ESSENTIALS_MISSING)</div>';
            return;
        }

        displayCurrentDate();

        currentTheme = localStorage.getItem('oneulSetTheme') || 'dark';
        currentAppMode = localStorage.getItem('oneulSetMode') || 'simple';
        focusModeTaskCountSetting = parseInt(localStorage.getItem('oneulSetFocusTaskCountSetting') || '3', 10);
        try {
            shareOptions = JSON.parse(localStorage.getItem('oneulSetShareOptions')) || { includeAdditional: false, includeMemos: false };
        } catch(e) { shareOptions = { includeAdditional: false, includeMemos: false }; }

        applyThemeUI(currentTheme, true, 'local_init');
        applyAppModeUI(currentAppMode, true, 'local_init');
        const taskCountSelectorElInit = document.getElementById('task-count-selector');
        if(taskCountSelectorElInit) taskCountSelectorElInit.value = focusModeTaskCountSetting;
        const shareIncludeAdditionalElInit = document.getElementById('share-include-additional');
        if(shareIncludeAdditionalElInit) shareIncludeAdditionalElInit.checked = shareOptions.includeAdditional;
        const shareIncludeMemosElInit = document.getElementById('share-include-memos');
        if(shareIncludeMemosElInit) shareIncludeMemosElInit.checked = shareOptions.includeMemos;

        loadContentDataFromLocalStorage();

        setupAuthEventListeners();
        setupFooterToggleListeners();
        setupAdditionalTaskListener();
        setupOtherEventListeners();

        if (firebaseAuth) {
            firebaseAuth.onAuthStateChanged(async user => {
                console.log("Auth state changed. User:", user ? user.uid : 'No user');
                updateAuthUI(user);
                if (user) {
                    announceToScreenReader(`${user.displayName || user.email}님, 환영합니다.`);
                    try {
                        const firestoreSettings = await loadAppSettingsFromFirestore(user.uid);
                        if (firestoreSettings) {
                            applySettingsToLocalAndUI(firestoreSettings, 'firestore');
                        } else {
                            await saveAppSettingsToFirestore();
                        }
                        loadContentDataFromLocalStorage();
                        listenToAppSettingsChanges(user.uid);
                        const cloudStatus = document.getElementById('cloud-sync-status');
                        if(cloudStatus) cloudStatus.textContent = `로그인 됨. 클라우드 설정 동기화 활성.`;
                    } catch (error) { /* 오류 처리 */ }
                } else {
                    if (userSettingsUnsubscribe) userSettingsUnsubscribe(); userSettingsUnsubscribe = null;
                    currentUser = null;
                    const localTheme = localStorage.getItem('oneulSetTheme') || 'dark';
                    const localAppMode = localStorage.getItem('oneulSetMode') || 'simple';
                    // ... (설정 로드 및 UI 반영)
                    applyThemeUI(localTheme, true, 'local_logout');
                    applyAppModeUI(localAppMode, true, 'local_logout');
                    loadContentDataFromLocalStorage(); // 콘텐츠 로드
                    const cloudStatus = document.getElementById('cloud-sync-status');
                    if(cloudStatus) cloudStatus.textContent = '로그인하여 데이터를 클라우드에 동기화하세요.';
                }
            });
        } else {
            console.warn("Firebase Auth not available."); updateAuthUI(null);
            loadContentDataFromLocalStorage();
            const cloudStatus = document.getElementById('cloud-sync-status');
            if(cloudStatus) cloudStatus.textContent = '클라우드 서비스 사용 불가.';
        }
        console.log("App initialization sequence ended.");
    }

    initializeApp().catch(err => {
        console.error("FATAL: Error during initializeApp execution:", err);
        const body = document.querySelector('body');
        if (body) body.innerHTML = '<div style="padding: 20px; text-align: center;">앱 로딩 중 오류 발생. 새로고침 해주세요. (Error Code: INIT_FATAL)</div>';
    });
});
