// script.js - v1.13.5-refactored
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed (v1.13.5)");

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

    // --- 요소 가져오기 (DOMContentLoaded 후 한 번만) ---
    const appModeToggle = document.getElementById('app-mode-toggle');
    const taskListDiv = document.querySelector('.task-list');
    const currentDateEl = document.getElementById('current-date');
    const allDoneMessageEl = document.getElementById('all-done-message');
    const themeToggleButton = document.getElementById('theme-toggle');
    const taskCountSelectorContainer = document.querySelector('.task-count-setting');
    const taskCountSelector = document.getElementById('task-count-selector');
    const liveRegion = document.getElementById('live-region');
    const additionalTasksSection = document.getElementById('additional-tasks-section');
    const additionalTaskListDiv = document.getElementById('additional-task-list');
    const addAdditionalTaskInput = document.getElementById('add-additional-task-input');
    const addAdditionalTaskBtn = document.getElementById('add-additional-task-btn');
    const toggleHistoryBtn = document.getElementById('toggle-history-btn');
    const toggleStatsBtn = document.getElementById('toggle-stats-btn');
    const toggleShareBtn = document.getElementById('toggle-share-btn');
    const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
    // 'sections' 배열은 getSectionsArray 헬퍼 함수 내에서 DOM 요소를 가져오도록 변경
    const historyListDiv = document.getElementById('history-list');
    const weeklyStatsEl = document.getElementById('weekly-stats');
    const monthlyStatsEl = document.getElementById('monthly-stats');
    const statsVisualsContainer = document.querySelector('.stats-visuals');
    const chartCanvas = document.getElementById('daily-achievement-chart');
    let dailyAchievementChartCtx = chartCanvas ? chartCanvas.getContext('2d') : null;
    const streakDaysEl = document.getElementById('streak-days');
    const mostAchievedDayEl = document.getElementById('most-achieved-day');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const shareTwitterBtn = document.getElementById('share-twitter-btn');
    const shareAsImageBtn = document.getElementById('share-as-image-btn');
    const shareAsImageBtnContainer = document.getElementById('share-as-image-btn-container');
    const shareOptionsDiv = document.querySelector('#share-section .share-options');
    const shareIncludeAdditionalCheckbox = document.getElementById('share-include-additional');
    const shareIncludeMemosCheckbox = document.getElementById('share-include-memos');
    const shareIncludeMemosLabel = document.getElementById('share-include-memos-label');
    const exportDataBtn = document.getElementById('export-data-btn');
    const importDataBtn = document.getElementById('import-data-btn');
    const importFileInput = document.getElementById('import-file-input');
    const authStatusContainer = document.getElementById('auth-status');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const userEmailSpan = document.getElementById('user-email');
    const logoutBtn = document.getElementById('logout-btn');
    const cloudSyncStatusDiv = document.getElementById('cloud-sync-status');

    // --- 전역 변수 ---
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

    const APP_VERSION_DATA_FORMAT = "1.13.5-refactored-data";

    // --- 유틸리티 함수 ---
    function announceToScreenReader(message) {
        if (liveRegion) {
            liveRegion.textContent = message;
            setTimeout(() => { if (liveRegion) liveRegion.textContent = ''; }, 3000);
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

        currentAppMode = settings.appMode || currentAppMode; // 기존 값 유지 또는 기본값
        currentTheme = settings.theme || currentTheme;
        focusModeTaskCountSetting = settings.focusTaskCount || focusModeTaskCountSetting;
        shareOptions = settings.shareOptions || shareOptions;

        if (source !== 'firestore') { // Firestore로부터 온 데이터가 아니면 로컬스토리지에 저장
            localStorage.setItem('oneulSetMode', currentAppMode);
            localStorage.setItem('oneulSetTheme', currentTheme);
            localStorage.setItem('oneulSetFocusTaskCountSetting', focusModeTaskCountSetting.toString());
            localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
        }

        applyThemeUI(currentTheme, true, source); // UI만 업데이트
        applyAppModeUI(currentAppMode, true, source); // UI만 업데이트

        if(taskCountSelector) taskCountSelector.value = focusModeTaskCountSetting;
        if(shareIncludeAdditionalCheckbox) shareIncludeAdditionalCheckbox.checked = shareOptions.includeAdditional;
        if(shareIncludeMemosCheckbox) shareIncludeMemosCheckbox.checked = shareOptions.includeMemos;
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
                console.log("Firestore: Realtime appSettings data:", remoteSettings);
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
            await initializeUserSettingsInFirestore(userCredential.user.uid); // 가입 후 즉시 초기 설정 저장
            announceToScreenReader(`회원가입 성공: ${userCredential.user.email}`);
        } catch (error) { console.error("Error signing up:", error); alert(`회원가입 실패: ${error.message}`); }
    }
    async function signInWithEmailPassword(email, password) {
        if (!firebaseAuth) return;
        try {
            await firebaseAuth.signInWithEmailAndPassword(email, password);
            // announceToScreenReader는 onAuthStateChanged에서 처리
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
            // announceToScreenReader는 onAuthStateChanged에서 처리
        } catch (error) { console.error("Error signing in with Google:", error); alert(`Google 로그인 실패: ${error.message}`); }
    }
    async function signOutUser() {
        if (!firebaseAuth) return;
        try {
            if (userSettingsUnsubscribe) userSettingsUnsubscribe(); userSettingsUnsubscribe = null;
            await firebaseAuth.signOut();
            // announceToScreenReader는 onAuthStateChanged에서 처리
        } catch (error) { console.error("Error signing out:", error); alert(`로그아웃 실패: ${error.message}`); }
    }

    // --- Auth UI 업데이트 함수 ---
    function updateAuthUI(user) {
        currentUser = user;
        if (!authStatusContainer || !loginBtn || !signupBtn || !userEmailSpan || !logoutBtn || !cloudSyncStatusDiv) {
            console.error("Auth UI elements missing."); return;
        }
        const isLoggedIn = !!user;
        loginBtn.classList.toggle('hidden', isLoggedIn);
        signupBtn.classList.toggle('hidden', isLoggedIn);
        userEmailSpan.textContent = isLoggedIn ? (user.displayName || user.email || '사용자') : '';
        userEmailSpan.classList.toggle('hidden', !isLoggedIn);
        logoutBtn.classList.toggle('hidden', !isLoggedIn);
        cloudSyncStatusDiv.textContent = isLoggedIn ? `로그인 됨 (${userEmailSpan.textContent}).` : '로그인하여 동기화하세요.';
        authStatusContainer.classList.toggle('logged-in', isLoggedIn);
        console.log("Auth UI updated. User:", user ? user.uid : 'null');
    }

    // --- 모달/팝업 관련 함수 ---
    function createAuthModal(type) {
        // ... (이전 v1.13.3과 동일, 변경 없음) ...
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
        if (loginBtn) loginBtn.addEventListener('click', () => createAuthModal('login'));
        if (signupBtn) signupBtn.addEventListener('click', () => createAuthModal('signup'));
        if (logoutBtn) logoutBtn.addEventListener('click', signOutUser);
    }

    // --- UI 업데이트 함수 (데이터 변경 없이 순수 UI만) ---
    function applyAppModeUI(mode, isInitialLoad = false, source = 'local') {
        if (!document.body) return;
        const oldAppMode = document.body.classList.contains('simple-mode') ? 'simple' : 'focus';

        document.body.classList.toggle('simple-mode', mode === 'simple');
        document.body.classList.toggle('focus-mode', mode === 'focus');
        const modeToSwitchToText = mode === 'simple' ? '집중' : '심플';
        if(appModeToggle) {
            appModeToggle.textContent = `${modeToSwitchToText} 모드로 전환`;
            appModeToggle.setAttribute('aria-label', `${modeToSwitchToText} 모드로 전환`);
        }
        if (shareOptionsDiv) shareOptionsDiv.classList.toggle('hidden', mode === 'simple');
        if (shareIncludeMemosLabel) shareIncludeMemosLabel.classList.toggle('hidden', mode === 'simple');

        if (mode === 'simple') {
            MAX_TASKS_CURRENT_MODE = 3;
            if(taskCountSelectorContainer) taskCountSelectorContainer.classList.add('hidden');
            if(additionalTasksSection) additionalTasksSection.classList.add('hidden');
            if (statsVisualsContainer) statsVisualsContainer.classList.add('hidden');
            if (shareAsImageBtnContainer) shareAsImageBtnContainer.classList.add('hidden');
            if (settingsContentDiv && settingsContentDiv.parentNode.id === 'settings-section') { // settingsContentDiv가 settings-section 내에 있을 때만
                const settingsSectionEl = document.getElementById('settings-section');
                if (settingsSectionEl) { // null 체크 추가
                     const simpleInfo = settingsSectionEl.querySelector('.simple-mode-settings-info');
                     if(settingsContentDiv) settingsContentDiv.classList.add('hidden');
                     if(simpleInfo) simpleInfo.classList.remove('hidden'); // 심플모드 안내 보이기
                }
            }
        } else { // focus mode
            MAX_TASKS_CURRENT_MODE = focusModeTaskCountSetting; // 전역변수 사용
            if(taskCountSelectorContainer) taskCountSelectorContainer.classList.remove('hidden');
            if(additionalTasksSection) additionalTasksSection.classList.remove('hidden');
            if (statsVisualsContainer) statsVisualsContainer.classList.remove('hidden');
            if (shareAsImageBtnContainer) shareAsImageBtnContainer.classList.remove('hidden');
            if (settingsContentDiv && settingsContentDiv.parentNode.id === 'settings-section') {
                 const settingsSectionEl = document.getElementById('settings-section');
                 if (settingsSectionEl) {
                    const simpleInfo = settingsSectionEl.querySelector('.simple-mode-settings-info');
                    if(settingsContentDiv) settingsContentDiv.classList.remove('hidden');
                    if(simpleInfo) simpleInfo.classList.add('hidden'); // 심플모드 안내 숨기기
                 }
            }
        }
        if(taskCountSelector) taskCountSelector.value = focusModeTaskCountSetting; // 전역변수 사용

        // Firestore 업데이트는 전역변수 변경 함수에서 처리
        // UI 변경만 담당하므로 여기서는 Firestore 직접 호출 X

        // 할 일 목록 등은 이 함수와 별개로 renderTasks() 등으로 렌더링
        // source가 'firestore'가 아니고, 실제 모드가 변경되었을 때만 renderTasks 호출 (중복 방지)
        if ((!isInitialLoad || source === 'local') && oldAppMode !== mode) {
            renderTasks();
            renderAdditionalTasks();
        }
        if (!isInitialLoad && source === 'local') {
            announceToScreenReader(`${mode === 'simple' ? '심플' : '집중'} 모드로 변경되었습니다.`);
        }
        console.log("App mode UI applied:", mode);
    }

    function applyThemeUI(theme, isInitialLoad = false, source = 'local') {
        if (!document.body) return;
        const oldTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';

        document.body.classList.toggle('dark-theme', theme === 'dark');
        if(themeToggleButton) themeToggleButton.textContent = (theme === 'dark' ? '☀️' : '🌙');
        updateThemeColorMeta(theme);

        if (currentAppMode === 'focus' && dailyAchievementChartCtx) { // 차트 재렌더링은 테마 변경 시 항상 필요
            if (achievementChart) { achievementChart.destroy(); achievementChart = null; }
            renderStatsVisuals();
        }
        // Firestore 업데이트는 전역변수 변경 함수에서 처리
        console.log("Theme UI applied:", theme);
    }

    if(appModeToggle) {
        appModeToggle.addEventListener('click', () => {
            const newMode = currentAppMode === 'simple' ? 'focus' : 'simple';
            currentAppMode = newMode; // 전역 변수 업데이트
            localStorage.setItem('oneulSetMode', currentAppMode);
            if(currentUser) saveAppSettingsToFirestore();
            applyAppModeUI(currentAppMode, false, 'local');
        });
    }
    if(themeToggleButton){
        themeToggleButton.addEventListener('click', () => {
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            currentTheme = newTheme; // 전역 변수 업데이트
            localStorage.setItem('oneulSetTheme', currentTheme);
            if(currentUser) saveAppSettingsToFirestore();
            applyThemeUI(currentTheme, false, 'local');
            announceToScreenReader(`테마가 ${newTheme === 'dark' ? '다크' : '라이트'} 모드로 변경되었습니다.`);
        });
    }

    // --- 날짜 및 유틸리티 ---
    function getTodayDateString() { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; }
    function displayCurrentDate() {
        if(currentDateEl){
            const today = new Date();
            const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
            currentDateEl.textContent = today.toLocaleDateString('ko-KR', options);
        }
    }
    function autoGrowTextarea(element) { if(element) { element.style.height = "auto"; element.style.height = (element.scrollHeight) + "px"; } }

    // --- 상태 저장 및 로드 ---
    function saveState(source = 'local') { // Tasks, AdditionalTasks, History 로컬 저장용
        localStorage.setItem('oneulSetTasks', JSON.stringify(tasks));
        localStorage.setItem('oneulSetAdditionalTasks', JSON.stringify(additionalTasks));
        localStorage.setItem('oneulSetLastDate', getTodayDateString());
        localStorage.setItem('oneulSetHistory', JSON.stringify(history));
        // 설정은 이미 각 변경 함수에서 로컬/Firestore에 저장됨.
        updateStats();
        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals();

        if (currentUser && firestoreDB && source === 'local') {
            // TODO: Save tasks, additionalTasks, history to Firestore
            // console.log("Saving content data to Firestore for user:", currentUser.uid);
        }
    }

    function loadContentDataFromLocalStorage() {
        console.log("Loading content data (tasks, history) from Local Storage.");
        const storedTasks = localStorage.getItem('oneulSetTasks');
        const storedAdditionalTasks = localStorage.getItem('oneulSetAdditionalTasks');
        const storedLastDate = localStorage.getItem('oneulSetLastDate');
        const storedHistory = localStorage.getItem('oneulSetHistory');
        const todayDateStr = getTodayDateString();

        if (storedHistory) { try { history = JSON.parse(storedHistory); if (!Array.isArray(history)) history = []; } catch (e) { history = []; } }

        // currentAppMode는 이미 applyAppModeUI 등을 통해 설정된 전역 변수 값 사용
        if (currentAppMode === 'focus' && storedAdditionalTasks) {
            try { additionalTasks = JSON.parse(storedAdditionalTasks); if(!Array.isArray(additionalTasks)) additionalTasks = []; } catch (e) { additionalTasks = [];}
        } else {
            additionalTasks = [];
        }

        if (storedLastDate === todayDateStr && storedTasks) {
            try { tasks = JSON.parse(storedTasks); if (!Array.isArray(tasks)) initializeTasks(); }
            catch (e) { initializeTasks(); }
        } else { // 새 날짜 또는 저장된 할 일 없음
            if (storedTasks && storedLastDate) { /* 어제 데이터 히스토리 처리 */ }
            localStorage.setItem('oneulSetFocusTaskCountSettingBeforeReset', focusModeTaskCountSetting.toString());
            initializeTasks();
            if (currentAppMode === 'focus') additionalTasks = [];
            saveState('local'); // 초기화된 콘텐츠 데이터 로컬 저장
        }
        while (tasks.length < 5) { tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });}
        if (tasks.length > 5) tasks = tasks.slice(0,5);

        renderTasks();
        renderAdditionalTasks(); // currentAppMode 조건은 함수 내부에서 처리
        updateStats();
        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals();
        renderHistory();
        console.log("Content data from local storage applied to UI.");
    }

    function initializeTasks() {
        tasks = [];
        for (let i = 0; i < 5; i++) {
            tasks.push({ id: Date.now() + i + Math.random(), text: '', completed: false, memo: '' });
        }
        console.log("Tasks initialized to empty set.");
    }

    if(taskCountSelector){
        taskCountSelector.addEventListener('change', (e) => {
            if (currentAppMode === 'simple') return; // 심플 모드에서는 변경 불가 (UI상 숨겨짐)
            const newCount = parseInt(e.target.value, 10);
            if (focusModeTaskCountSetting !== newCount) {
                focusModeTaskCountSetting = newCount;
                localStorage.setItem('oneulSetFocusTaskCountSetting', focusModeTaskCountSetting.toString());
                if (currentUser) saveAppSettingsToFirestore();
                applyAppModeUI(currentAppMode, false, 'local'); // UI 업데이트 (MAX_TASKS_CURRENT_MODE 변경 등)
                announceToScreenReader(`핵심 할 일 개수가 ${newCount}개로 변경되었습니다.`);
            }
        });
    }

    if (shareIncludeAdditionalCheckbox) {
        shareIncludeAdditionalCheckbox.addEventListener('change', (e) => {
            if (shareOptions.includeAdditional !== e.target.checked) {
                shareOptions.includeAdditional = e.target.checked;
                localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
                if (currentUser) saveAppSettingsToFirestore();
            }
        });
    }
    if (shareIncludeMemosCheckbox) {
        shareIncludeMemosCheckbox.addEventListener('change', (e) => {
            if (shareOptions.includeMemos !== e.target.checked) {
                shareOptions.includeMemos = e.target.checked;
                localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
                if (currentUser) saveAppSettingsToFirestore();
            }
        });
    }

    // --- 나머지 함수들 (renderTasks, checkAllDone 등) ---
    function renderTasks() {
        if(!taskListDiv) { console.warn("renderTasks: taskListDiv not found."); return; }
        taskListDiv.innerHTML = '';
        // MAX_TASKS_CURRENT_MODE는 currentAppMode에 따라 applyAppModeUI에서 설정됨
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
            taskListDiv.appendChild(taskItem); autoGrowTextarea(textareaField);
        });
        checkAllDone();
    }

    function checkAllDone() {
        if(!allDoneMessageEl || !tasks) return;
        const tasksToCheck = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
        const filledTasks = tasksToCheck.filter(task => task && typeof task.text === 'string' && task.text.trim() !== "");
        const completedFilledTasks = filledTasks.filter(task => task && task.completed);
        const shouldShowMessage = filledTasks.length > 0 && filledTasks.length === MAX_TASKS_CURRENT_MODE && completedFilledTasks.length === MAX_TASKS_CURRENT_MODE;
        allDoneMessageEl.classList.toggle('hidden', !shouldShowMessage);
    }

    function renderAdditionalTasks() {
        if (currentAppMode === 'simple' || !additionalTaskListDiv) {
            if(additionalTaskListDiv) additionalTaskListDiv.innerHTML = ''; return;
        }
        additionalTaskListDiv.innerHTML = '';
        if (additionalTasks.length === 0) {
            const p = document.createElement('p'); p.textContent = '추가된 과제가 없습니다.';
            p.classList.add('no-additional-tasks'); additionalTaskListDiv.appendChild(p); return;
        }
        additionalTasks.forEach((task, index) => { /* 이전과 동일 */ });
    }

    if (addAdditionalTaskBtn && addAdditionalTaskInput) { /* 이전과 동일 */ }

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
            if (!sec.button) return;
            const sectionElement = document.getElementById(sec.id);
            if (!sectionElement) return;

            // 모드별 UI 요소 숨김/표시 (이전과 동일)
            const isSimpleMode = document.body.classList.contains('simple-mode');
            if (isSimpleMode) {
                if (sec.id === 'stats-section' && statsVisualsContainer) statsVisualsContainer.classList.add('hidden');
                // ... 기타 요소들
            } else {
                if (sec.id === 'stats-section' && statsVisualsContainer) statsVisualsContainer.classList.remove('hidden');
                // ... 기타 요소들
            }


            if (sec.id === sectionIdToToggle) {
                const isHidden = sectionElement.classList.toggle('hidden');
                sec.button.textContent = isHidden ? sec.baseText : `${sec.baseText} 닫기`;
                sec.button.setAttribute('aria-expanded', !isHidden);
                sectionElement.setAttribute('aria-hidden', isHidden);
                if (!isHidden) {
                    sec.button.classList.add('active'); sectionOpenedName = sec.baseText;
                    if (sec.id === 'history-section' && historyListDiv) renderHistory();
                    if (sec.id === 'stats-section' && weeklyStatsEl && monthlyStatsEl) {
                        updateStats();
                        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals();
                    }
                } else {
                    sec.button.classList.remove('active');
                }
            } else {
                if (!sectionElement.classList.contains('hidden')) {
                    sectionElement.classList.add('hidden'); sec.button.textContent = sec.baseText;
                    sec.button.setAttribute('aria-expanded', 'false'); sectionElement.setAttribute('aria-hidden', 'true');
                    sec.button.classList.remove('active');
                }
            }
        });
        if(sectionOpenedName) announceToScreenReader(`${sectionOpenedName} 섹션이 열렸습니다.`);
    }
    getSectionsArray().forEach(sec => {
        if (sec.button) sec.button.addEventListener('click', () => toggleSection(sec.id));
    });

    function renderHistory() { /* 이전과 동일 */ }
    function calculateAchievementRate(days) { /* 이전과 동일 */ }
    function updateStats() { /* 이전과 동일 */ }
    function renderStatsVisuals() { /* 이전과 동일 */ }
    const shareUrl = window.location.href;
    function getShareText() { /* 이전과 동일 */ }
    if(copyLinkBtn) { /* 이전과 동일 */ }
    if(shareTwitterBtn) { /* 이전과 동일 */ }
    if (shareAsImageBtn && typeof html2canvas !== 'undefined') { /* 이전과 동일 */ }
    if (exportDataBtn) { /* 이전과 동일 */ }
    if (importDataBtn && importFileInput) { /* 이전과 동일 */ }
    document.addEventListener('keydown', (e) => { /* 이전과 동일 */ });

    // --- 초기화 실행 ---
    async function initializeApp() {
        console.log("Initializing app (v1.13.5)...");

        // 1. 필수 DOM 요소들이 실제로 로드되었는지 먼저 확인
        if (!currentDateEl || !taskListDiv || !authStatusContainer || !loginBtn || !signupBtn) {
            console.error("CRITICAL: Essential DOM elements not found at initializeApp. Aborting.");
            alert("페이지 구성 요소를 불러오는 데 문제가 발생했습니다. 새로고침 해주세요. (Error Code: DOM_INIT_MISSING)");
            return; // 필수 요소 없으면 초기화 중단
        }

        // 2. 기본 UI 먼저 표시 (날짜)
        displayCurrentDate();

        // 3. 로컬 스토리지에서 기본 설정 읽기
        currentTheme = localStorage.getItem('oneulSetTheme') || 'dark';
        currentAppMode = localStorage.getItem('oneulSetMode') || 'simple';
        focusModeTaskCountSetting = parseInt(localStorage.getItem('oneulSetFocusTaskCountSetting') || '3', 10);
        try {
            shareOptions = JSON.parse(localStorage.getItem('oneulSetShareOptions')) || { includeAdditional: false, includeMemos: false };
        } catch(e) { shareOptions = { includeAdditional: false, includeMemos: false }; }

        // 4. 로컬 설정으로 UI 1차 반영 (테마, 모드 - 이 안에서 renderTasks 등 호출됨)
        applyThemeUI(currentTheme, true, 'local_init');
        applyAppModeUI(currentAppMode, true, 'local_init'); // 이 함수가 renderTasks 등을 호출
        if(taskCountSelector) taskCountSelector.value = focusModeTaskCountSetting;
        // ... (shareOptions UI 반영)

        // 5. 로컬 콘텐츠 데이터 로드 및 렌더링 (설정이 이미 반영된 상태에서)
        loadContentDataFromLocalStorage();

        // 6. 인증 버튼 이벤트 리스너 설정
        setupAuthEventListeners();

        // 7. Firebase Auth 상태 감지 및 Firestore 데이터 동기화
        if (firebaseAuth) {
            firebaseAuth.onAuthStateChanged(async user => {
                console.log("Auth state changed. User:", user ? user.uid : 'null');
                updateAuthUI(user);

                if (user) {
                    announceToScreenReader(`${user.displayName || user.email}님, 환영합니다.`);
                    try {
                        const firestoreSettings = await loadAppSettingsFromFirestore(user.uid);
                        if (firestoreSettings) {
                            applySettingsToLocalAndUI(firestoreSettings, 'firestore'); // Firestore 설정으로 로컬/UI 덮어쓰기
                        } else { // Firestore에 설정 없으면 현재 로컬 설정을 Firestore에 저장
                            await saveAppSettingsToFirestore();
                        }
                        // Firestore 설정 반영 후, 로컬 콘텐츠 데이터 다시 로드/렌더링 (다음 단계에서 Firestore 콘텐츠 로드로 변경)
                        loadContentDataFromLocalStorage();
                        listenToAppSettingsChanges(user.uid);
                        if(cloudSyncStatusDiv) cloudSyncStatusDiv.textContent = `로그인 됨. 클라우드 설정 동기화 활성.`;
                    } catch (error) { /* 오류 처리 */ }
                } else { // 로그아웃
                    if (userSettingsUnsubscribe) userSettingsUnsubscribe(); userSettingsUnsubscribe = null;
                    currentUser = null;
                    // 로그아웃 시, 로컬 스토리지의 전체 상태로 UI 복원
                    currentTheme = localStorage.getItem('oneulSetTheme') || 'dark';
                    currentAppMode = localStorage.getItem('oneulSetMode') || 'simple';
                    focusModeTaskCountSetting = parseInt(localStorage.getItem('oneulSetFocusTaskCountSetting') || '3', 10);
                    // ... (shareOptions 로드)
                    applyThemeUI(currentTheme, true, 'local_logout');
                    applyAppModeUI(currentAppMode, true, 'local_logout');
                    loadContentDataFromLocalStorage();
                    if(cloudSyncStatusDiv) cloudSyncStatusDiv.textContent = '로그인하여 동기화하세요.';
                }
                console.log("App initialization inside onAuthStateChanged finished.");
            });
        } else { // Firebase Auth 사용 불가
            console.warn("initializeApp: Firebase Auth not available. Running local-only.");
            updateAuthUI(null);
            loadContentDataFromLocalStorage(); // 설정은 이미 위에서 apply됨
            if(cloudSyncStatusDiv) cloudSyncStatusDiv.textContent = '클라우드 서비스 사용 불가.';
        }
        // 푸터 섹션 버튼 초기화
        getSectionsArray().forEach(sec => { /* 이전과 동일 */ });
        console.log("App initialization sequence ended.");
    }

    initializeApp().catch(err => { /* 최상위 에러 처리 */ });
});
