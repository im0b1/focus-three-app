// script.js - v1.13.3-dom-ready-fix

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");

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
    let firebaseApp;
    let firebaseAuth;
    let firestoreDB;

    try {
        if (typeof firebase !== 'undefined' && firebase.initializeApp) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
            if (firebase.auth) firebaseAuth = firebase.auth();
            if (firebase.firestore) {
                firestoreDB = firebase.firestore();
                if (firestoreDB) {
                    firestoreDB.enablePersistence({ synchronizeTabs: true })
                        .catch(err => console.warn("Firestore persistence error:", err.code));
                }
            }
            console.log("Firebase SDK initialized:", { app: !!firebaseApp, auth: !!firebaseAuth, db: !!firestoreDB });
        } else {
            console.error("Firebase SDK (firebase object) not loaded.");
        }
    } catch (error) {
        console.error("CRITICAL: Error during Firebase initialization:", error);
    }

    // --- 요소 가져오기 ---
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
    const historySection = document.getElementById('history-section');
    const statsSection = document.getElementById('stats-section');
    const shareSection = document.getElementById('share-section');
    const settingsSection = document.getElementById('settings-section');
    const settingsContentDiv = document.querySelector('#settings-section .settings-content');
    const historyListDiv = document.getElementById('history-list');
    const weeklyStatsEl = document.getElementById('weekly-stats');
    const monthlyStatsEl = document.getElementById('monthly-stats');
    const statsVisualsContainer = document.querySelector('.stats-visuals');
    const chartCanvas = document.getElementById('daily-achievement-chart');
    let dailyAchievementChartCtx = null;
    if (chartCanvas) dailyAchievementChartCtx = chartCanvas.getContext('2d');
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
    let appInitialized = false;

    const APP_VERSION_DATA_FORMAT = "1.13.3-dom-ready-fix-data";

    // --- 유틸리티 함수 ---
    function announceToScreenReader(message) {
        const currentLiveRegion = document.getElementById('live-region'); // 함수 내에서 다시 가져오기
        if (currentLiveRegion) {
            currentLiveRegion.textContent = message;
            setTimeout(() => { if (currentLiveRegion) currentLiveRegion.textContent = ''; }, 3000);
        } else {
            console.warn("Live region not found for screen reader announcement.");
        }
    }

    // --- PWA: 서비스 워커 등록 ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => { console.log('Service Worker registered: ', registration); })
                .catch(registrationError => { console.error('Service Worker registration failed: ', registrationError); });
        });
    }

    // --- Firestore Data Functions ---
    function getUserSettingsRef(userId) {
        if (!firestoreDB || !userId) {
            console.warn("getUserSettingsRef: FirestoreDB or userId is not available.");
            return null;
        }
        return firestoreDB.collection('users').doc(userId);
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
                console.log("Firestore: Initial user appSettings created for", userId);
            }
        } catch (error) {
            console.error("Error initializing user appSettings in Firestore for user " + userId + ":", error);
        }
    }

    async function loadAppSettingsFromFirestore(userId) {
        const userSettingsRef = getUserSettingsRef(userId);
        if (!userSettingsRef) return Promise.reject("User settings reference not available.");
        console.log("Firestore: Attempting to load appSettings for", userId);
        try {
            const docSnap = await userSettingsRef.get();
            if (docSnap.exists && docSnap.data()?.appSettings) {
                const settings = docSnap.data().appSettings;
                console.log("Firestore: AppSettings loaded:", settings);
                return settings;
            } else {
                console.log("Firestore: No appSettings found for user, initializing.");
                await initializeUserSettingsInFirestore(userId);
                const newDocSnap = await userSettingsRef.get();
                if (newDocSnap.exists && newDocSnap.data()?.appSettings) {
                    return newDocSnap.data().appSettings;
                }
                return null;
            }
        } catch (error) {
            console.error("Error loading appSettings from Firestore for " + userId + ":", error);
            announceToScreenReader("클라우드 설정 로드 실패.");
            return Promise.reject(error);
        }
    }

    function applySettingsToLocalAndUI(settings, source = 'local') {
        console.log("Applying settings to local and UI from source:", source, settings);
        currentAppMode = settings.appMode || 'simple';
        currentTheme = settings.theme || 'dark';
        focusModeTaskCountSetting = settings.focusTaskCount || 3;
        shareOptions = settings.shareOptions || { includeAdditional: false, includeMemos: false };

        if (source !== 'firestore') {
            localStorage.setItem('oneulSetMode', currentAppMode);
            localStorage.setItem('oneulSetTheme', currentTheme);
            localStorage.setItem('oneulSetFocusTaskCountSetting', focusModeTaskCountSetting.toString());
            localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
        }

        applyTheme(currentTheme, true, source);
        applyAppMode(currentAppMode, true, source);

        const currentTaskCountSelector = document.getElementById('task-count-selector');
        if(currentTaskCountSelector) currentTaskCountSelector.value = focusModeTaskCountSetting;
        const currentShareIncludeAdditional = document.getElementById('share-include-additional');
        if(currentShareIncludeAdditional) currentShareIncludeAdditional.checked = shareOptions.includeAdditional;
        const currentShareIncludeMemos = document.getElementById('share-include-memos');
        if(currentShareIncludeMemos) currentShareIncludeMemos.checked = shareOptions.includeMemos;
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
            console.log("Firestore: App settings saved for user", currentUser.uid, settingsToSave);
        } catch (error) {
            console.error("Error saving app settings to Firestore for " + currentUser.uid + ":", error);
        }
    }

    function listenToAppSettingsChanges(userId) {
        if (userSettingsUnsubscribe) userSettingsUnsubscribe();
        const userSettingsRef = getUserSettingsRef(userId);
        if (!userSettingsRef) return;
        console.log("Setting up Firestore listener for appSettings:", userId);
        userSettingsUnsubscribe = userSettingsRef.onSnapshot(doc => {
            console.log("Firestore real-time update for appSettings:", doc.id, doc.exists);
            if (doc.exists && doc.data()?.appSettings) {
                const remoteSettings = doc.data().appSettings;
                console.log("Firestore: Realtime appSettings data:", remoteSettings);
                const localThemeForCompare = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
                let changed = false;
                if (remoteSettings.appMode !== currentAppMode) changed = true;
                if (remoteSettings.theme !== localThemeForCompare) changed = true;
                if (remoteSettings.focusTaskCount !== focusModeTaskCountSetting) changed = true;
                if (JSON.stringify(remoteSettings.shareOptions) !== JSON.stringify(shareOptions)) changed = true;

                if (changed) {
                    console.log("Firestore: AppSettings changed by remote, updating local state and UI.");
                    applySettingsToLocalAndUI(remoteSettings, 'firestore');
                    announceToScreenReader("클라우드 설정이 업데이트되었습니다.");
                }
            }
        }, error => {
            console.error("Error in appSettings listener for " + userId + ":", error);
        });
    }

    // --- Firebase Authentication Functions ---
    async function signUpWithEmailPassword(email, password) {
        if (!firebaseAuth) { console.error("SignUp: FirebaseAuth not available."); return; }
        try {
            const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
            announceToScreenReader(`회원가입 성공: ${userCredential.user.email}`);
            await initializeUserSettingsInFirestore(userCredential.user.uid);
        } catch (error) {
            console.error("Error signing up:", error); alert(`회원가입 실패: ${error.message}`);
        }
    }
    async function signInWithEmailPassword(email, password) {
        if (!firebaseAuth) { console.error("SignIn: FirebaseAuth not available."); return; }
        try {
            const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
            announceToScreenReader(`로그인 성공: ${userCredential.user.email}`);
        } catch (error) {
            console.error("Error signing in:", error); alert(`로그인 실패: ${error.message}`);
        }
    }
    async function signInWithGoogle() {
        if (!firebaseAuth) { console.error("GoogleSignIn: FirebaseAuth not available."); return; }
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            const result = await firebaseAuth.signInWithPopup(provider);
            announceToScreenReader(`Google 로그인 성공: ${result.user.displayName || result.user.email}`);
            if (result.additionalUserInfo && result.additionalUserInfo.isNewUser) {
                await initializeUserSettingsInFirestore(result.user.uid);
            }
        } catch (error) {
            console.error("Error signing in with Google:", error); alert(`Google 로그인 실패: ${error.message}`);
        }
    }
    async function signOutUser() {
        if (!firebaseAuth) { console.error("SignOut: FirebaseAuth not available."); return; }
        try {
            if (userSettingsUnsubscribe) userSettingsUnsubscribe(); userSettingsUnsubscribe = null;
            await firebaseAuth.signOut();
            announceToScreenReader("로그아웃 되었습니다.");
        } catch (error) {
            console.error("Error signing out:", error); alert(`로그아웃 실패: ${error.message}`);
        }
    }

    // --- Auth UI 업데이트 함수 ---
    function updateAuthUI(user) {
        currentUser = user;
        const loginButton = document.getElementById('login-btn');
        const signupButton = document.getElementById('signup-btn');
        const userEmailDisplay = document.getElementById('user-email');
        const logoutButton = document.getElementById('logout-btn');
        const cloudStatus = document.getElementById('cloud-sync-status');
        const authContainer = document.getElementById('auth-status');

        if (!authContainer || !loginButton || !signupButton || !userEmailDisplay || !logoutButton || !cloudStatus) {
            console.error("One or more Auth UI elements are missing. Cannot update Auth UI properly.");
            if (document.getElementById('login-btn')) document.getElementById('login-btn').classList.remove('hidden'); // 비상조치
            if (document.getElementById('signup-btn')) document.getElementById('signup-btn').classList.remove('hidden'); // 비상조치
            return;
        }
        if (user) {
            loginButton.classList.add('hidden'); signupButton.classList.add('hidden');
            userEmailDisplay.textContent = user.displayName || user.email || '사용자';
            userEmailDisplay.classList.remove('hidden'); logoutButton.classList.remove('hidden');
            cloudStatus.textContent = `로그인 됨 (${user.displayName || user.email}).`;
            authContainer.classList.add('logged-in');
        } else {
            loginButton.classList.remove('hidden'); signupButton.classList.remove('hidden');
            userEmailDisplay.classList.add('hidden'); userEmailDisplay.textContent = '';
            logoutButton.classList.add('hidden');
            cloudStatus.textContent = '로그인하여 데이터를 클라우드에 동기화하세요.';
            authContainer.classList.remove('logged-in');
        }
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
            const emailVal = emailInput.value; const passwordVal = passwordInput.value; // 변수명 변경
            if (type === 'login') await signInWithEmailPassword(emailVal, passwordVal);
            else await signUpWithEmailPassword(emailVal, passwordVal);
            if (firebaseAuth && firebaseAuth.currentUser) modal.remove();
        };
        form.appendChild(emailLabel); form.appendChild(emailInput); form.appendChild(passwordLabel); form.appendChild(passwordInput); form.appendChild(submitBtn);
        modalContent.appendChild(closeBtn); modalContent.appendChild(title); modalContent.appendChild(form);
        modalContent.appendChild(document.createElement('hr')); modalContent.appendChild(googleBtn);
        modal.appendChild(modalContent); document.body.appendChild(modal); emailInput.focus();
    }

    // --- Auth UI 이벤트 리스너 ---
    const loginButtonForListener = document.getElementById('login-btn');
    if (loginButtonForListener) loginButtonForListener.addEventListener('click', () => createAuthModal('login'));
    const signupButtonForListener = document.getElementById('signup-btn');
    if (signupButtonForListener) signupButtonForListener.addEventListener('click', () => createAuthModal('signup'));
    const logoutButtonForListener = document.getElementById('logout-btn');
    if (logoutButtonForListener) logoutButtonForListener.addEventListener('click', signOutUser);

    // --- 모드 관리 ---
    function applyAppMode(mode, isInitialLoad = false, source = 'local') {
        const currentAppModeToggle = document.getElementById('app-mode-toggle'); // 함수 내에서 DOM 요소 다시 참조
        const currentTaskCountSelectorContainer = document.querySelector('.task-count-setting');
        const currentAdditionalTasksSection = document.getElementById('additional-tasks-section');
        const currentStatsVisualsContainer = document.querySelector('.stats-visuals');
        const currentShareAsImageBtnContainer = document.getElementById('share-as-image-btn-container');
        const currentSettingsContentDiv = document.querySelector('#settings-section .settings-content');
        const currentTaskCountSelector = document.getElementById('task-count-selector');
        const currentShareOptionsDiv = document.querySelector('#share-section .share-options');
        const currentShareIncludeMemosLabel = document.getElementById('share-include-memos-label');
        const currentToggleSettingsBtn = document.getElementById('toggle-settings-btn');
        const currentSettingsSection = document.getElementById('settings-section');
        const currentAdditionalTaskListDiv = document.getElementById('additional-task-list');


        const oldAppMode = currentAppMode;
        currentAppMode = mode;
        if (source !== 'firestore') localStorage.setItem('oneulSetMode', currentAppMode);
        document.body.classList.toggle('simple-mode', mode === 'simple');
        document.body.classList.toggle('focus-mode', mode === 'focus');
        const modeToSwitchToText = mode === 'simple' ? '집중' : '심플';

        if(currentAppModeToggle) {
            currentAppModeToggle.textContent = `${modeToSwitchToText} 모드로 전환`;
            currentAppModeToggle.setAttribute('aria-label', `${modeToSwitchToText} 모드로 전환`);
        }
        if (currentShareOptionsDiv) currentShareOptionsDiv.classList.toggle('hidden', mode === 'simple');
        if (currentShareIncludeMemosLabel) currentShareIncludeMemosLabel.classList.toggle('hidden', mode === 'simple');

        if (mode === 'simple') {
            MAX_TASKS_CURRENT_MODE = 3;
            if(currentTaskCountSelectorContainer) currentTaskCountSelectorContainer.classList.add('hidden');
            if(currentAdditionalTasksSection) currentAdditionalTasksSection.classList.add('hidden');
            if (currentStatsVisualsContainer) currentStatsVisualsContainer.classList.add('hidden');
            if (currentShareAsImageBtnContainer) currentShareAsImageBtnContainer.classList.add('hidden');
            if (currentSettingsContentDiv) currentSettingsContentDiv.classList.add('hidden');

            if (currentToggleSettingsBtn && currentToggleSettingsBtn.classList.contains('active') && currentSettingsSection && !currentSettingsSection.classList.contains('hidden')) {
                currentSettingsSection.classList.add('hidden');
                const settingsSecInfo = sections.find(s => s.id === 'settings-section');
                if (settingsSecInfo) currentToggleSettingsBtn.textContent = settingsSecInfo.baseText;
                currentToggleSettingsBtn.classList.remove('active');
                currentToggleSettingsBtn.setAttribute('aria-expanded', 'false');
                currentSettingsSection.setAttribute('aria-hidden', 'true');
            }
        } else {
            MAX_TASKS_CURRENT_MODE = focusModeTaskCountSetting;
            if(currentTaskCountSelectorContainer) currentTaskCountSelectorContainer.classList.remove('hidden');
            if(currentAdditionalTasksSection) currentAdditionalTasksSection.classList.remove('hidden');
            if (currentStatsVisualsContainer) currentStatsVisualsContainer.classList.remove('hidden');
            if (currentShareAsImageBtnContainer) currentShareAsImageBtnContainer.classList.remove('hidden');
            if (currentSettingsContentDiv) currentSettingsContentDiv.classList.remove('hidden');
        }
        if(currentTaskCountSelector) currentTaskCountSelector.value = focusModeTaskCountSetting;

        if (source !== 'firestore' && oldAppMode !== currentAppMode && currentUser) {
            saveAppSettingsToFirestore();
        }
        if (source === 'local' || !isInitialLoad || source === 'firestore' ) {
            renderTasks();
            if (currentAppMode === 'focus' && currentAdditionalTasksSection) renderAdditionalTasks(); // currentAdditionalTasksSection null check
            else if (currentAdditionalTaskListDiv) currentAdditionalTaskListDiv.innerHTML = '';
        }
        if (!isInitialLoad && source === 'local') {
            announceToScreenReader(`${mode === 'simple' ? '심플' : '집중'} 모드로 변경되었습니다.`);
        }
    }
    if(appModeToggle) {
        appModeToggle.addEventListener('click', () => {
            const newMode = currentAppMode === 'simple' ? 'focus' : 'simple';
            applyAppMode(newMode, false, 'local');
        });
    }

    // --- 테마 관리 ---
    function applyTheme(theme, isInitialLoad = false, source = 'local') {
        const currentThemeToggleButton = document.getElementById('theme-toggle'); // 함수 내에서 다시 가져오기
        const currentDailyAchievementChartCtx = chartCanvas ? chartCanvas.getContext('2d') : null; // chartCanvas null check

        const oldTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
        currentTheme = theme;
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            if(currentThemeToggleButton) currentThemeToggleButton.textContent = '☀️';
        } else {
            document.body.classList.remove('dark-theme');
            if(currentThemeToggleButton) currentThemeToggleButton.textContent = '🌙';
        }
        if (source !== 'firestore') localStorage.setItem('oneulSetTheme', currentTheme);
        updateThemeColorMeta(theme);
        if (achievementChart) { achievementChart.destroy(); achievementChart = null; }
        if (currentAppMode === 'focus' && currentDailyAchievementChartCtx) renderStatsVisuals(); // currentDailyAchievementChartCtx 사용
        if (source !== 'firestore' && oldTheme !== currentTheme && currentUser) {
            saveAppSettingsToFirestore();
        }
    }
    if(themeToggleButton){
        themeToggleButton.addEventListener('click', () => {
            const newTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
            applyTheme(newTheme, false, 'local');
            announceToScreenReader(`테마가 ${newTheme === 'dark' ? '다크' : '라이트'} 모드로 변경되었습니다.`);
        });
    }

    // --- 날짜 및 유틸리티 ---
    function getTodayDateString() { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; }
    function displayCurrentDate() {
        const el = document.getElementById('current-date');
        if(el){
            const today = new Date();
            const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
            el.textContent = today.toLocaleDateString('ko-KR', options);
        } else {
            console.warn("displayCurrentDate: current-date element not found.");
        }
    }
    function autoGrowTextarea(element) { if(element){ element.style.height = "auto"; element.style.height = (element.scrollHeight) + "px";} }

    // --- 상태 저장 및 로드 ---
    function saveState(source = 'local') {
        localStorage.setItem('oneulSetTasks', JSON.stringify(tasks));
        localStorage.setItem('oneulSetAdditionalTasks', JSON.stringify(additionalTasks));
        localStorage.setItem('oneulSetLastDate', getTodayDateString());
        localStorage.setItem('oneulSetHistory', JSON.stringify(history));
        const currentDailyAchievementChartCtx = chartCanvas ? chartCanvas.getContext('2d') : null;
        updateStats();
        if (currentAppMode === 'focus' && currentDailyAchievementChartCtx) renderStatsVisuals();
        if (currentUser && firestoreDB && source === 'local') { /* TODO */ }
    }

    function loadContentDataFromLocalStorage() {
        console.log("Loading content data (tasks, history, etc.) from Local Storage.");
        const storedTasks = localStorage.getItem('oneulSetTasks');
        const storedAdditionalTasks = localStorage.getItem('oneulSetAdditionalTasks');
        const storedLastDate = localStorage.getItem('oneulSetLastDate');
        const storedHistory = localStorage.getItem('oneulSetHistory');
        const todayDateStr = getTodayDateString();

        if (storedHistory) { try { history = JSON.parse(storedHistory); if (!Array.isArray(history)) history = []; } catch (e) { history = []; } }
        if (currentAppMode === 'focus' && storedAdditionalTasks) {
            try { additionalTasks = JSON.parse(storedAdditionalTasks); if(!Array.isArray(additionalTasks)) additionalTasks = []; } catch (e) { additionalTasks = [];}
        } else {
            additionalTasks = [];
        }
        if (storedLastDate === todayDateStr && storedTasks) {
            try { tasks = JSON.parse(storedTasks); if (!Array.isArray(tasks)) initializeTasks(); }
            catch (e) { initializeTasks(); }
        } else {
            if (storedTasks && storedLastDate) { /* 어제 데이터 처리 */ }
            localStorage.setItem('oneulSetFocusTaskCountSettingBeforeReset', focusModeTaskCountSetting.toString());
            initializeTasks();
            if (currentAppMode === 'focus') additionalTasks = [];
            saveState('local'); // 콘텐츠 데이터 초기화 후 저장
        }
        while (tasks.length < 5) { tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });}
        if (tasks.length > 5) tasks = tasks.slice(0,5);

        renderTasks();
        const currentAdditionalTaskListDiv = document.getElementById('additional-task-list');
        if (currentAppMode === 'focus') renderAdditionalTasks();
        else if (currentAdditionalTaskListDiv) currentAdditionalTaskListDiv.innerHTML = '';

        const currentDailyAchievementChartCtx = chartCanvas ? chartCanvas.getContext('2d') : null;
        updateStats();
        if (currentAppMode === 'focus' && currentDailyAchievementChartCtx) renderStatsVisuals();
        renderHistory();
        console.log("Content data loaded and UI rendered.");
    }

    function initializeTasks() {
        tasks = [];
        for (let i = 0; i < 5; i++) {
            tasks.push({ id: Date.now() + i + Math.random(), text: '', completed: false, memo: '' });
        }
        console.log("Tasks initialized to empty set.");
    }

    const currentTaskCountSelectorForListener = document.getElementById('task-count-selector');
    if(currentTaskCountSelectorForListener){
        currentTaskCountSelectorForListener.addEventListener('change', (e) => {
            if (currentAppMode === 'simple') return;
            const newCount = parseInt(e.target.value, 10);
            const oldFocusCount = focusModeTaskCountSetting;
            focusModeTaskCountSetting = newCount;
            // MAX_TASKS_CURRENT_MODE는 applyAppMode에서 설정됨
            localStorage.setItem('oneulSetFocusTaskCountSetting', focusModeTaskCountSetting.toString());
            if (oldFocusCount !== focusModeTaskCountSetting && currentUser) {
                saveAppSettingsToFirestore();
            }
            applyAppMode(currentAppMode, false, 'local'); // 변경된 할 일 개수를 반영하여 UI 재렌더링
            announceToScreenReader(`핵심 할 일 개수가 ${newCount}개로 변경되었습니다.`);
        });
    }

    const currentShareIncludeAdditionalForListener = document.getElementById('share-include-additional');
    if (currentShareIncludeAdditionalForListener) {
        currentShareIncludeAdditionalForListener.addEventListener('change', (e) => {
            const oldShareOptions = JSON.parse(JSON.stringify(shareOptions));
            shareOptions.includeAdditional = e.target.checked;
            localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
            if (JSON.stringify(oldShareOptions) !== JSON.stringify(shareOptions) && currentUser) {
                saveAppSettingsToFirestore();
            }
        });
    }
    const currentShareIncludeMemosForListener = document.getElementById('share-include-memos');
    if (currentShareIncludeMemosForListener) {
        currentShareIncludeMemosForListener.addEventListener('change', (e) => {
            const oldShareOptions = JSON.parse(JSON.stringify(shareOptions));
            shareOptions.includeMemos = e.target.checked;
            localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
            if (JSON.stringify(oldShareOptions) !== JSON.stringify(shareOptions) && currentUser) {
                saveAppSettingsToFirestore();
            }
        });
    }

    function renderTasks() {
        const currentTaskListDiv = document.querySelector('.task-list');
        if(!currentTaskListDiv) { console.warn("renderTasks: task-list div not found."); return; }
        currentTaskListDiv.innerHTML = '';
        // MAX_TASKS_CURRENT_MODE는 currentAppMode에 따라 applyAppMode에서 설정됨
        const tasksToRender = tasks.slice(0, MAX_TASKS_CURRENT_MODE);

        tasksToRender.forEach((task, index) => {
            if (!task) { console.warn(`Task at index ${index} is undefined.`); return; }
            const originalTaskIndex = tasks.findIndex(t => t && t.id === task.id);
            if (originalTaskIndex === -1) return;

            const taskItem = document.createElement('div'); taskItem.classList.add('task-item');
            if (tasks[originalTaskIndex].completed) { taskItem.classList.add('completed'); }
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
            currentTaskListDiv.appendChild(taskItem); autoGrowTextarea(textareaField);
        });
        checkAllDone();
        console.log("Tasks rendered. Count:", tasksToRender.length);
    }

    function checkAllDone() {
        const currentAllDoneMessageEl = document.getElementById('all-done-message');
        if(!currentAllDoneMessageEl || !tasks) return;
        const tasksToCheck = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
        const filledTasks = tasksToCheck.filter(task => task && typeof task.text === 'string' && task.text.trim() !== "");
        const completedFilledTasks = filledTasks.filter(task => task && task.completed);
        const shouldShowMessage = filledTasks.length > 0 && filledTasks.length === MAX_TASKS_CURRENT_MODE && completedFilledTasks.length === MAX_TASKS_CURRENT_MODE;
        currentAllDoneMessageEl.classList.toggle('hidden', !shouldShowMessage);
    }

    function renderAdditionalTasks() {
        const currentAdditionalTaskListDiv = document.getElementById('additional-task-list');
        if (currentAppMode === 'simple' || !currentAdditionalTaskListDiv) {
            if(currentAdditionalTaskListDiv) currentAdditionalTaskListDiv.innerHTML = '';
            return;
        }
        currentAdditionalTaskListDiv.innerHTML = '';
        if (additionalTasks.length === 0) {
            const p = document.createElement('p'); p.textContent = '추가된 과제가 없습니다.';
            p.classList.add('no-additional-tasks'); currentAdditionalTaskListDiv.appendChild(p); return;
        }
        additionalTasks.forEach((task, index) => { /* 이전과 동일 */ });
    }

    const currentAddAdditionalTaskBtn = document.getElementById('add-additional-task-btn');
    const currentAddAdditionalTaskInput = document.getElementById('add-additional-task-input');
    if (currentAddAdditionalTaskBtn && currentAddAdditionalTaskInput) {
        currentAddAdditionalTaskBtn.addEventListener('click', () => {
            if (currentAppMode === 'simple') return;
            const text = currentAddAdditionalTaskInput.value.trim();
            if (text) {
                additionalTasks.push({ id: Date.now(), text: text, completed: false });
                currentAddAdditionalTaskInput.value = ''; renderAdditionalTasks(); saveState('local');
                announceToScreenReader(`추가 과제 "${text}"가 추가되었습니다.`); currentAddAdditionalTaskInput.focus();
            }
        });
        currentAddAdditionalTaskInput.addEventListener('keypress', (e) => {
            if (currentAppMode === 'simple') return; if (e.key === 'Enter') { currentAddAdditionalTaskBtn.click(); }
        });
    }

    const sections = [
        { id: 'history-section', button: document.getElementById('toggle-history-btn'), baseText: '기록' },
        { id: 'stats-section', button: document.getElementById('toggle-stats-btn'), baseText: '통계' },
        { id: 'share-section', button: document.getElementById('toggle-share-btn'), baseText: '공유' },
        { id: 'settings-section', button: document.getElementById('toggle-settings-btn'), baseText: '설정' }
    ];

    function toggleSection(sectionIdToToggle) { /* 이전과 동일, 함수 내에서 DOM 요소 다시 가져오거나 null 체크 */ }
    sections.forEach(sec => { // 이벤트 리스너 연결 시점에 버튼 존재 확인
        if (sec.button) {
            sec.button.addEventListener('click', () => toggleSection(sec.id));
        } else {
            console.warn(`Button for section ${sec.id} not found.`);
        }
    });

    function renderHistory() { /* 이전과 동일 */ }
    function calculateAchievementRate(days) { /* 이전과 동일 */ }
    function updateStats() { /* 이전과 동일 */ }
    function renderStatsVisuals() { /* 이전과 동일 */ }
    const shareUrl = window.location.href;
    function getShareText() { /* 이전과 동일 */ }
    const currentCopyLinkBtn = document.getElementById('copy-link-btn');
    if(currentCopyLinkBtn) { /* 이전과 동일 */ }
    const currentShareTwitterBtn = document.getElementById('share-twitter-btn');
    if(currentShareTwitterBtn) { /* 이전과 동일 */ }
    const currentShareAsImageBtn = document.getElementById('share-as-image-btn');
    if (currentShareAsImageBtn && typeof html2canvas !== 'undefined') { /* 이전과 동일 */ }
    const currentExportDataBtn = document.getElementById('export-data-btn');
    if (currentExportDataBtn) { /* 이전과 동일 */ }
    const currentImportDataBtn = document.getElementById('import-data-btn');
    const currentImportFileInput = document.getElementById('import-file-input');
    if (currentImportDataBtn && currentImportFileInput) { /* 이전과 동일 */ }

    document.addEventListener('keydown', (e) => { /* 이전과 동일 */ });

    // --- 초기화 실행 ---
    async function initializeApp() {
        console.log("Initializing app (v1.13.3)...");
        displayCurrentDate();

        // 로컬 설정 우선 로드 및 UI 1차 반영
        currentTheme = localStorage.getItem('oneulSetTheme') || 'dark';
        applyTheme(currentTheme, true, 'local_init_early');
        currentAppMode = localStorage.getItem('oneulSetMode') || 'simple';
        focusModeTaskCountSetting = parseInt(localStorage.getItem('oneulSetFocusTaskCountSetting') || '3', 10);
        try {
            shareOptions = JSON.parse(localStorage.getItem('oneulSetShareOptions')) || { includeAdditional: false, includeMemos: false };
        } catch(e) { shareOptions = { includeAdditional: false, includeMemos: false }; }
        applyAppMode(currentAppMode, true, 'local_init_early'); // 이 안에서 renderTasks 등 호출
        const currentTaskCountSelector = document.getElementById('task-count-selector');
        if(currentTaskCountSelector) currentTaskCountSelector.value = focusModeTaskCountSetting;
        const currentShareIncludeAdditional = document.getElementById('share-include-additional');
        if(currentShareIncludeAdditional) currentShareIncludeAdditional.checked = shareOptions.includeAdditional;
        const currentShareIncludeMemos = document.getElementById('share-include-memos');
        if(currentShareIncludeMemos) currentShareIncludeMemos.checked = shareOptions.includeMemos;

        loadContentDataFromLocalStorage(); // 콘텐츠 데이터 로드 및 렌더링 (초기 UI 완성)

        if (firebaseAuth) {
            firebaseAuth.onAuthStateChanged(async user => {
                console.log("Auth state changed. User:", user ? user.uid : 'null');
                updateAuthUI(user);

                if (user) {
                    announceToScreenReader(`${user.displayName || user.email}님, 환영합니다.`);
                    try {
                        const firestoreSettings = await loadAppSettingsFromFirestore(user.uid);
                        if (firestoreSettings) {
                            console.log("Applying Firestore settings to local and UI post-login.");
                            applySettingsToLocalAndUI(firestoreSettings, 'firestore');
                            // Firestore 설정 반영 후, 콘텐츠 데이터는 다시 로컬에서 로드 (다음 단계에서 Firestore 연동)
                            loadContentDataFromLocalStorage();
                        } else {
                            console.log("No settings in Firestore or init failed, ensuring local settings are synced up.");
                            await saveAppSettingsToFirestore(); // 현재 로컬 설정을 Firestore에 저장
                            loadContentDataFromLocalStorage(); // 로컬 콘텐츠 데이터 로드
                        }
                        listenToAppSettingsChanges(user.uid);
                        const currentCloudSyncStatusDiv = document.getElementById('cloud-sync-status');
                        if(currentCloudSyncStatusDiv) currentCloudSyncStatusDiv.textContent = `로그인 됨. 클라우드 설정 동기화 활성.`;
                    } catch (error) {
                        console.error("Error post-login Firestore ops for " + user.uid + ":", error);
                        const currentCloudSyncStatusDiv = document.getElementById('cloud-sync-status');
                        if(currentCloudSyncStatusDiv) currentCloudSyncStatusDiv.textContent = `클라우드 데이터 처리 오류.`;
                        loadContentDataFromLocalStorage(); // 오류 시 로컬 콘텐츠로 UI 복원
                    }
                } else {
                    console.log("User logged out. Using local data.");
                    if (userSettingsUnsubscribe) userSettingsUnsubscribe(); userSettingsUnsubscribe = null;
                    currentUser = null;
                    loadStateFromLocalStorage(); // 모든 상태 로컬 기준으로 복원
                    const currentCloudSyncStatusDiv = document.getElementById('cloud-sync-status');
                    if(currentCloudSyncStatusDiv) currentCloudSyncStatusDiv.textContent = '로그인하여 데이터를 클라우드에 동기화하세요.';
                }
                appInitialized = true;
                console.log("App initialization complete (after auth state change).");
            });
        } else {
            console.warn("initializeApp: Firebase Auth is not available. Running in local-only mode.");
            updateAuthUI(null);
            loadStateFromLocalStorage(); // 모든 상태 로컬 기준으로 로드
            const currentCloudSyncStatusDiv = document.getElementById('cloud-sync-status');
            if(currentCloudSyncStatusDiv) currentCloudSyncStatusDiv.textContent = '클라우드 서비스 사용 불가.';
            appInitialized = true;
            console.log("App initialization complete (local mode, no Firebase Auth).");
        }

        sections.forEach(sec => {
            const sectionButton = sec.button; // 이미 위에서 가져온 DOM 요소 사용
            if(sectionButton) sectionButton.textContent = sec.baseText;
            const sectionElement = document.getElementById(sec.id);
            if (sectionElement) {
                sectionElement.setAttribute('aria-hidden', 'true');
                if(sectionButton) sectionButton.setAttribute('aria-expanded', 'false');
            }
        });
    }
    // 로컬스토리지에서 모든 상태(설정+콘텐츠)를 로드하고 UI에 반영하는 함수
    function loadStateFromLocalStorage() {
        console.log("Loading ALL state from Local Storage (settings, tasks, etc.) for full UI restore.");
        // 1. 설정 로드
        currentAppMode = localStorage.getItem('oneulSetMode') || 'simple';
        currentTheme = localStorage.getItem('oneulSetTheme') || 'dark';
        focusModeTaskCountSetting = parseInt(localStorage.getItem('oneulSetFocusTaskCountSetting') || '3', 10);
        try {
            shareOptions = JSON.parse(localStorage.getItem('oneulSetShareOptions')) || { includeAdditional: false, includeMemos: false };
        } catch(e) {
            shareOptions = { includeAdditional: false, includeMemos: false };
        }
        // 2. 설정 UI 반영
        applyTheme(currentTheme, true, 'local_full_load');
        applyAppMode(currentAppMode, true, 'local_full_load'); // 이 안에서 renderTasks 등 호출
        const currentTaskCountSelector = document.getElementById('task-count-selector');
        if(currentTaskCountSelector) currentTaskCountSelector.value = focusModeTaskCountSetting;
        const currentShareIncludeAdditional = document.getElementById('share-include-additional');
        if(currentShareIncludeAdditional) currentShareIncludeAdditional.checked = shareOptions.includeAdditional;
        const currentShareIncludeMemos = document.getElementById('share-include-memos');
        if(currentShareIncludeMemos) currentShareIncludeMemos.checked = shareOptions.includeMemos;

        // 3. 콘텐츠 데이터 로드 및 UI 반영 (applyAppMode에서 renderTasks 등이 호출되므로,
        // loadContentDataFromLocalStorage를 여기서 다시 호출할 필요는 없을 수 있음.
        // 하지만 명시적으로 콘텐츠 관련 UI를 다시 그리려면 호출)
        loadContentDataFromLocalStorage();
    }

    initializeApp().catch(err => { // initializeApp 자체에서 발생하는 최상위 에러 처리
        console.error("FATAL: Error during initializeApp execution:", err);
        alert("앱을 시작하는 중 심각한 오류가 발생했습니다. 페이지를 새로고침하거나 나중에 다시 시도해주세요.");
        // 비상 UI (예: 오류 메시지만 표시)
        const body = document.querySelector('body');
        if (body) body.innerHTML = '<div style="padding: 20px; text-align: center;">앱 로딩 중 오류 발생. 새로고침 해주세요.</div>';
    });
});
