// script.js - v1.14.1-critical-bugfix
document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
    const firebaseConfig = {
        apiKey: "AIzaSyB54BtURvHN9YmC3HVGaClOo32zO44deu4", // 실제 키로 교체 필요
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
            console.log("Firebase object found, attempting to initialize.");
            firebaseApp = firebase.initializeApp(firebaseConfig);
            console.log("Firebase app initialized:", firebaseApp ? 'Success' : 'Failed');

            if (firebase.auth) {
                firebaseAuth = firebase.auth();
                console.log("FirebaseAuth initialized:", firebaseAuth ? 'Success' : 'Failed');
            } else {
                console.error("firebase.auth is undefined. Authentication will not work.");
            }

            if (firebase.firestore) {
                firestoreDB = firebase.firestore();
                console.log("FirestoreDB initialized:", firestoreDB ? 'Success' : 'Failed');

                if (firestoreDB) {
                    firestoreDB.enablePersistence({ synchronizeTabs: true })
                        .then(() => console.log("Firestore persistence enabled."))
                        .catch((err) => {
                            if (err.code == 'failed-precondition') {
                                console.warn("Firestore: Multiple tabs open, persistence can only be enabled in one tab at a time or synchronizeTabs must be true.");
                            } else if (err.code == 'unimplemented') {
                                console.warn("Firestore: The current browser does not support all of the features required to enable persistence.");
                            } else {
                                console.error("Firestore: enablePersistence failed", err);
                            }
                        });
                }
            } else {
                console.error("firebase.firestore is undefined. Firestore database will not work.");
            }

            if (!firebaseApp || !firebaseAuth || !firestoreDB) {
                console.error("One or more Firebase SDK components failed to initialize properly. App functionality may be limited.");
                // 이 경우, 최소한의 UI라도 보여주기 위해 Firebase 의존성이 없는 로직은 계속 진행하도록 함
            }
        } else {
            console.error("Firebase SDK (firebase object) not loaded. Make sure Firebase scripts are included correctly in index.html before this script.");
            // Firebase 없이 로컬 모드로만 동작하도록 유도할 수도 있음
        }
    } catch (error) {
        console.error("CRITICAL: Error during Firebase initialization:", error);
        // Firebase 초기화 실패 시 사용자에게 알림을 줄 수도 있음
        // alert("Firebase 초기화에 실패했습니다. 일부 기능이 작동하지 않을 수 있습니다.");
    }

    // --- 요소 가져오기 ---
    // 모든 요소 가져오기 전에 null 체크를 하거나, optional chaining (?.) 사용 고려
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
    let shareOptions = {
        includeAdditional: false,
        includeMemos: false
    };
    let currentUser = null;
    let userSettingsUnsubscribe = null;

    const APP_VERSION_DATA_FORMAT = "1.14.1-critical-bugfix-data"; // 버전명 수정

    // --- 유틸리티 함수 ---
    function announceToScreenReader(message) {
        if (liveRegion) {
            liveRegion.textContent = message;
            setTimeout(() => { liveRegion.textContent = ''; }, 3000);
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
    function getUserDocRef(userId) {
        if (!firestoreDB || !userId) {
            console.warn("getUserDocRef: FirestoreDB or userId is not available.");
            return null;
        }
        return firestoreDB.collection('users').doc(userId);
    }

    async function initializeUserSettings(userId) {
        const userDocRef = getUserDocRef(userId);
        if (!userDocRef) {
            console.error("initializeUserSettings: Could not get userDocRef for", userId);
            return;
        }
        try {
            const docSnap = await userDocRef.get();
            if (!docSnap.exists || !docSnap.data()?.appSettings) {
                const initialSettings = {
                    appMode: 'simple', theme: 'dark', focusTaskCount: 3,
                    shareOptions: { includeAdditional: false, includeMemos: false },
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                };
                await userDocRef.set({ appSettings: initialSettings }, { merge: true });
                console.log("Firestore: Initial user settings created for", userId);
            } else {
                console.log("Firestore: User settings already exist for", userId);
            }
        } catch (error) {
            console.error("Error initializing user settings in Firestore for user " + userId + ":", error);
        }
    }

    async function loadUserSettingsFromFirestore(userId) {
        const userDocRef = getUserDocRef(userId);
        if (!userDocRef) return Promise.reject("User document reference not available for settings load.");

        console.log("Firestore: Attempting to load user settings for", userId);
        try {
            const docSnap = await userDocRef.get();
            if (docSnap.exists && docSnap.data()?.appSettings) {
                const settings = docSnap.data().appSettings;
                console.log("Firestore: User settings loaded:", settings);

                currentAppMode = settings.appMode || 'simple';
                currentTheme = settings.theme || 'dark';
                focusModeTaskCountSetting = settings.focusTaskCount || 3;
                shareOptions = settings.shareOptions || { includeAdditional: false, includeMemos: false };

                localStorage.setItem('oneulSetMode', currentAppMode);
                localStorage.setItem('oneulSetTheme', currentTheme);
                localStorage.setItem('oneulSetFocusTaskCountSetting', focusModeTaskCountSetting.toString());
                localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));

                applyTheme(currentTheme, true, 'firestore');
                applyAppMode(currentAppMode, true, 'firestore');
                if(taskCountSelector) taskCountSelector.value = focusModeTaskCountSetting;
                if(shareIncludeAdditionalCheckbox) shareIncludeAdditionalCheckbox.checked = shareOptions.includeAdditional;
                if(shareIncludeMemosCheckbox) shareIncludeMemosCheckbox.checked = shareOptions.includeMemos;

                announceToScreenReader("클라우드에서 설정을 불러왔습니다.");
                return settings;
            } else {
                console.log("Firestore: No settings document found for user, initializing.");
                await initializeUserSettings(userId);
                return loadUserSettingsFromFirestore(userId);
            }
        } catch (error) {
            console.error("Error loading user settings from Firestore for " + userId + ":", error);
            announceToScreenReader("클라우드 설정 로드 실패. 로컬 설정을 사용합니다.");
            return Promise.reject(error);
        }
    }

    async function saveAppSettingsToFirestore() {
        if (!currentUser || !firestoreDB) {
            console.warn("saveAppSettingsToFirestore: Not logged in or Firestore not available.");
            return;
        }
        const userDocRef = getUserDocRef(currentUser.uid);
        if (!userDocRef) return;

        const settingsToSave = {
            appMode: currentAppMode, theme: currentTheme,
            focusTaskCount: focusModeTaskCountSetting, shareOptions: shareOptions,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await userDocRef.set({ appSettings: settingsToSave }, { merge: true });
            console.log("Firestore: App settings saved for user", currentUser.uid);
        } catch (error) {
            console.error("Error saving app settings to Firestore for " + currentUser.uid + ":", error);
            announceToScreenReader("클라우드에 설정 저장 실패.");
        }
    }

    function listenToUserSettings(userId) {
        if (userSettingsUnsubscribe) {
            console.log("Unsubscribing from previous user settings listener.");
            userSettingsUnsubscribe();
            userSettingsUnsubscribe = null; // 명시적으로 null 할당
        }

        const userDocRef = getUserDocRef(userId);
        if (!userDocRef) {
            console.error("listenToUserSettings: Cannot listen, userDocRef is null for", userId);
            return;
        }

        console.log("Setting up Firestore listener for user settings:", userId);
        userSettingsUnsubscribe = userDocRef.onSnapshot(async (doc) => {
            console.log("Firestore real-time update received for settings:", doc.id, doc.exists);
            if (doc.exists && doc.data()?.appSettings) {
                const settings = doc.data().appSettings;
                console.log("Firestore: Realtime settings update data:", settings);

                const localThemeForCompare = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
                let settingsChanged = false;
                if (settings.appMode !== currentAppMode) { currentAppMode = settings.appMode; settingsChanged = true; }
                if (settings.theme !== localThemeForCompare) { currentTheme = settings.theme; settingsChanged = true; }
                if (settings.focusTaskCount !== focusModeTaskCountSetting) { focusModeTaskCountSetting = settings.focusTaskCount; settingsChanged = true; }
                if (JSON.stringify(settings.shareOptions) !== JSON.stringify(shareOptions)) { shareOptions = settings.shareOptions; settingsChanged = true; }

                if (settingsChanged) {
                    console.log("Firestore: Settings changed by remote, updating local state and UI.");
                    localStorage.setItem('oneulSetMode', currentAppMode);
                    localStorage.setItem('oneulSetTheme', currentTheme);
                    localStorage.setItem('oneulSetFocusTaskCountSetting', focusModeTaskCountSetting.toString());
                    localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));

                    applyTheme(currentTheme, true, 'firestore');
                    applyAppMode(currentAppMode, true, 'firestore');
                    if(taskCountSelector) taskCountSelector.value = focusModeTaskCountSetting;
                    if(shareIncludeAdditionalCheckbox) shareIncludeAdditionalCheckbox.checked = shareOptions.includeAdditional;
                    if(shareIncludeMemosCheckbox) shareIncludeMemosCheckbox.checked = shareOptions.includeMemos;

                    renderTasks(); // 설정 변경으로 인해 UI 재렌더링
                    if(currentAppMode === 'focus') renderAdditionalTasks();

                    announceToScreenReader("클라우드 설정이 업데이트되었습니다.");
                } else {
                    console.log("Firestore: Realtime settings update received, but no actual change in values. Skipping UI update.");
                }
            } else {
                console.log("Firestore: User settings document does not exist in real-time listener for user " + userId + ". Initializing if appropriate.");
                // await initializeUserSettings(userId); // 여기서 다시 초기화하면 루프 발생 가능성, 로그인 시에만 처리하도록
            }
        }, error => {
            console.error("Error in user settings listener for " + userId + ":", error);
        });
    }

    // --- Firebase Authentication Functions ---
    async function signUpWithEmailPassword(email, password) {
        if (!firebaseAuth) { console.error("SignUp: FirebaseAuth not available."); return; }
        try {
            const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
            announceToScreenReader(`회원가입 성공: ${userCredential.user.email}`);
            await initializeUserSettings(userCredential.user.uid); // 중요: onAuthStateChanged보다 먼저 호출될 수 있도록
        } catch (error) {
            console.error("Error signing up:", error);
            alert(`회원가입 실패: ${error.message}`);
            announceToScreenReader(`회원가입 실패: ${error.message}`);
        }
    }

    async function signInWithEmailPassword(email, password) {
        if (!firebaseAuth) { console.error("SignIn: FirebaseAuth not available."); return; }
        try {
            const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
            announceToScreenReader(`로그인 성공: ${userCredential.user.email}`);
            // onAuthStateChanged가 나머지 처리 (데이터 로드, 리스너 설정)
        } catch (error) {
            console.error("Error signing in:", error);
            alert(`로그인 실패: ${error.message}`);
            announceToScreenReader(`로그인 실패: ${error.message}`);
        }
    }

    async function signInWithGoogle() {
        if (!firebaseAuth) { console.error("GoogleSignIn: FirebaseAuth not available."); return; }
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            const result = await firebaseAuth.signInWithPopup(provider);
            announceToScreenReader(`Google 로그인 성공: ${result.user.displayName || result.user.email}`);
            if (result.additionalUserInfo && result.additionalUserInfo.isNewUser) {
                await initializeUserSettings(result.user.uid); // 중요: onAuthStateChanged보다 먼저 호출될 수 있도록
            }
            // onAuthStateChanged가 나머지 처리
        } catch (error) {
            console.error("Error signing in with Google:", error);
            alert(`Google 로그인 실패: ${error.message}`);
            announceToScreenReader(`Google 로그인 실패: ${error.message}`);
        }
    }

    async function signOutUser() {
        if (!firebaseAuth) { console.error("SignOut: FirebaseAuth not available."); return; }
        try {
            if (userSettingsUnsubscribe) {
                console.log("Unsubscribing from user settings listener on sign out.");
                userSettingsUnsubscribe();
                userSettingsUnsubscribe = null;
            }
            await firebaseAuth.signOut();
            // onAuthStateChanged가 currentUser를 null로 하고 UI 업데이트 및 로컬 데이터 로드
            announceToScreenReader("로그아웃 되었습니다.");
        } catch (error) {
            console.error("Error signing out:", error);
            alert(`로그아웃 실패: ${error.message}`);
            announceToScreenReader(`로그아웃 실패: ${error.message}`);
        }
    }

    // --- Auth UI 업데이트 함수 ---
    function updateAuthUI(user) {
        currentUser = user; // 이 시점에서 currentUser가 설정됨
        if (!authStatusContainer || !loginBtn || !signupBtn || !userEmailSpan || !logoutBtn || !cloudSyncStatusDiv) {
            console.error("Auth UI elements not found. Cannot update Auth UI.");
            return;
        }
        if (user) {
            loginBtn.classList.add('hidden');
            signupBtn.classList.add('hidden');
            userEmailSpan.textContent = user.displayName || user.email || '사용자';
            userEmailSpan.classList.remove('hidden');
            logoutBtn.classList.remove('hidden');
            cloudSyncStatusDiv.textContent = `로그인 됨 (${user.displayName || user.email}).`; // 초기 상태
            authStatusContainer.classList.add('logged-in');
        } else {
            loginBtn.classList.remove('hidden');
            signupBtn.classList.remove('hidden');
            userEmailSpan.classList.add('hidden');
            userEmailSpan.textContent = '';
            logoutBtn.classList.add('hidden');
            cloudSyncStatusDiv.textContent = '로그인하여 데이터를 클라우드에 동기화하세요.';
            authStatusContainer.classList.remove('logged-in');
        }
    }

    // --- 모달/팝업 관련 함수 ---
    function createAuthModal(type) {
        const existingModal = document.getElementById('auth-modal');
        if (existingModal) existingModal.remove();
        const modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'auth-modal';
        const modalContent = document.createElement('div');
        modalContent.className = 'auth-modal-content';
        const closeBtn = document.createElement('span');
        closeBtn.className = 'auth-modal-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => modal.remove();
        const title = document.createElement('h2');
        title.textContent = type === 'login' ? '로그인' : '계정 만들기';
        const emailLabel = document.createElement('label');
        emailLabel.htmlFor = 'auth-email';
        emailLabel.textContent = '이메일';
        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.id = 'auth-email';
        emailInput.required = true;
        const passwordLabel = document.createElement('label');
        passwordLabel.htmlFor = 'auth-password';
        passwordLabel.textContent = '비밀번호';
        const passwordInput = document.createElement('input');
        passwordInput.type = 'password';
        passwordInput.id = 'auth-password';
        passwordInput.required = true;
        if (type === 'signup') passwordInput.minLength = 6;
        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.textContent = title.textContent;
        const googleBtn = document.createElement('button');
        googleBtn.type = 'button';
        googleBtn.id = 'google-signin-btn';
        googleBtn.innerHTML = '<i class="fab fa-google"></i> Google 계정으로 ' + (type === 'login' ? '로그인' : '시작하기');
        googleBtn.onclick = async () => {
            await signInWithGoogle(); // await 추가하여 완료 기다림 (선택적)
            // onAuthStateChanged가 UI 변경 및 모달 닫힘 여부 결정.
            // 성공 시 currentUser가 설정되고, 그에 따라 모달을 닫을지 판단 가능.
            if (firebaseAuth && firebaseAuth.currentUser) { // 로그인 성공 시 모달 닫기
                modal.remove();
            }
        };
        const form = document.createElement('form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const email = emailInput.value;
            const password = passwordInput.value;
            if (type === 'login') {
                await signInWithEmailPassword(email, password);
            } else {
                await signUpWithEmailPassword(email, password);
            }
            if (firebaseAuth && firebaseAuth.currentUser) { // 로그인/가입 성공 시 모달 닫기
                modal.remove();
            }
        };
        form.appendChild(emailLabel);
        form.appendChild(emailInput);
        form.appendChild(passwordLabel);
        form.appendChild(passwordInput);
        form.appendChild(submitBtn);
        modalContent.appendChild(closeBtn);
        modalContent.appendChild(title);
        modalContent.appendChild(form);
        modalContent.appendChild(document.createElement('hr'));
        modalContent.appendChild(googleBtn);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        emailInput.focus();
    }

    // --- Auth UI 이벤트 리스너 ---
    if (loginBtn) { loginBtn.addEventListener('click', () => createAuthModal('login')); }
    if (signupBtn) { signupBtn.addEventListener('click', () => createAuthModal('signup')); }
    if (logoutBtn) { logoutBtn.addEventListener('click', signOutUser); }

    // --- 모드 관리 ---
    function applyAppMode(mode, isInitialLoad = false, source = 'local') {
        const oldAppMode = currentAppMode;
        currentAppMode = mode;
        localStorage.setItem('oneulSetMode', currentAppMode); // 로컬에 항상 저장
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
            if (settingsContentDiv) settingsContentDiv.classList.add('hidden');
            if (toggleSettingsBtn && toggleSettingsBtn.classList.contains('active') && settingsSection && !settingsSection.classList.contains('hidden')) {
                settingsSection.classList.add('hidden');
                const settingsSecInfo = sections.find(s => s.id === 'settings-section');
                if (settingsSecInfo) toggleSettingsBtn.textContent = settingsSecInfo.baseText;
                toggleSettingsBtn.classList.remove('active');
                toggleSettingsBtn.setAttribute('aria-expanded', 'false');
                settingsSection.setAttribute('aria-hidden', 'true');
            }
        } else {
            MAX_TASKS_CURRENT_MODE = focusModeTaskCountSetting;
            if(taskCountSelectorContainer) taskCountSelectorContainer.classList.remove('hidden');
            if(additionalTasksSection) additionalTasksSection.classList.remove('hidden');
            if (statsVisualsContainer) statsVisualsContainer.classList.remove('hidden');
            if (shareAsImageBtnContainer) shareAsImageBtnContainer.classList.remove('hidden');
            if (settingsContentDiv) settingsContentDiv.classList.remove('hidden');
        }
        if(taskCountSelector) taskCountSelector.value = focusModeTaskCountSetting;

        if (source !== 'firestore' && oldAppMode !== currentAppMode) {
            saveAppSettingsToFirestore();
        }

        if (!isInitialLoad || source === 'firestore') {
            renderTasks(); // isInitialLoad=true이고 source=firestore면 UI 강제 업데이트
            if (currentAppMode === 'focus') renderAdditionalTasks();
            else if (additionalTaskListDiv) additionalTaskListDiv.innerHTML = '';
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
        const oldTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
        currentTheme = theme;

        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            if(themeToggleButton) themeToggleButton.textContent = '☀️';
        } else {
            document.body.classList.remove('dark-theme');
            if(themeToggleButton) themeToggleButton.textContent = '🌙';
        }
        localStorage.setItem('oneulSetTheme', currentTheme);
        updateThemeColorMeta(theme);

        if (achievementChart) { achievementChart.destroy(); achievementChart = null; }
        // renderStatsVisuals는 applyAppMode가 호출되면 그 안에서 처리될 수 있음.
        // 또는, 테마 변경 시 차트 재렌더링이 항상 필요하면 여기서 호출.
        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals();


        if (source !== 'firestore' && oldTheme !== currentTheme) {
            saveAppSettingsToFirestore();
        }
    }
    if(themeToggleButton){
        themeToggleButton.addEventListener('click', () => {
            const isDarkMode = document.body.classList.contains('dark-theme');
            const newTheme = isDarkMode ? 'light' : 'dark';
            applyTheme(newTheme, false, 'local');
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
        } else {
            console.warn("currentDateEl not found for displaying date.");
        }
    }
    function autoGrowTextarea(element) { if(element){ element.style.height = "auto"; element.style.height = (element.scrollHeight) + "px";} }

    // --- 상태 저장 및 로드 ---
    function saveState(source = 'local') {
        localStorage.setItem('oneulSetTasks', JSON.stringify(tasks));
        localStorage.setItem('oneulSetAdditionalTasks', JSON.stringify(additionalTasks));
        localStorage.setItem('oneulSetLastDate', getTodayDateString());
        localStorage.setItem('oneulSetHistory', JSON.stringify(history));
        // 설정은 각 변경 함수에서 로컬/Firestore에 저장
        localStorage.setItem('oneulSetFocusTaskCountSetting', focusModeTaskCountSetting.toString());
        localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));

        updateStats(); // 통계는 항상 로컬 데이터 기반으로 업데이트
        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals();

        if (currentUser && firestoreDB && source === 'local') {
            // TODO: Save tasks, additionalTasks, history to Firestore
            // console.log("TODO: Save tasks/additional/history to Firestore for user:", currentUser.uid);
        }
    }

    function loadStateFromLocalStorage() {
        console.log("Loading state from Local Storage.");
        // 설정 관련 변수들은 이미 Firestore 로드 시도 후, 또는 onAuthStateChanged에서 초기화됨.
        // 여기서는 주로 tasks, additionalTasks, history 등 콘텐츠 데이터 로드.
        const lsAppMode = localStorage.getItem('oneulSetMode') || 'simple';
        const lsTheme = localStorage.getItem('oneulSetTheme') || 'dark';
        const lsFocusTaskCount = localStorage.getItem('oneulSetFocusTaskCountSetting');
        const lsShareOptions = localStorage.getItem('oneulSetShareOptions');

        // 전역 변수에 로컬 스토리지 값 할당 (Firestore 로드 실패 또는 로그아웃 시 대비)
        currentAppMode = lsAppMode;
        currentTheme = lsTheme;
        focusModeTaskCountSetting = lsFocusTaskCount ? parseInt(lsFocusTaskCount, 10) : 3;
        try {
            shareOptions = lsShareOptions ? JSON.parse(lsShareOptions) : { includeAdditional: false, includeMemos: false };
        } catch(e) {
            console.error("Error parsing shareOptions from LS:", e);
            shareOptions = { includeAdditional: false, includeMemos: false };
        }

        // UI에 설정 반영
        applyTheme(currentTheme, true, 'local'); // source='local'로 Firestore 쓰기 방지
        applyAppMode(currentAppMode, true, 'local'); // source='local'로 Firestore 쓰기 방지
        if(taskCountSelector) taskCountSelector.value = focusModeTaskCountSetting;
        if(shareIncludeAdditionalCheckbox) shareIncludeAdditionalCheckbox.checked = shareOptions.includeAdditional;
        if(shareIncludeMemosCheckbox) shareIncludeMemosCheckbox.checked = shareOptions.includeMemos;


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
            try {
                tasks = JSON.parse(storedTasks);
                if (!Array.isArray(tasks)) initializeTasks();
            } catch (e) { initializeTasks(); }
        } else {
            if (storedTasks && storedLastDate) {
                try {
                    const yesterdayTasksData = JSON.parse(storedTasks);
                    const yesterdayFocusModeTaskCount = parseInt(localStorage.getItem('oneulSetFocusTaskCountSettingBeforeReset') || focusModeTaskCountSetting, 10);
                    if (Array.isArray(yesterdayTasksData)) {
                        const relevantYesterdayTasks = yesterdayTasksData.slice(0, yesterdayFocusModeTaskCount);
                        const allYesterdayTasksFilled = relevantYesterdayTasks.every(task => task && typeof task.text === 'string' && task.text.trim() !== "");
                        const allYesterdayTasksCompleted = relevantYesterdayTasks.every(task => task && task.completed);
                        const yesterdayAchieved = allYesterdayTasksFilled && relevantYesterdayTasks.length === yesterdayFocusModeTaskCount && allYesterdayTasksCompleted && yesterdayFocusModeTaskCount > 0;
                        if (!history.some(entry => entry.date === storedLastDate)) {
                            history.unshift({ date: storedLastDate, tasks: relevantYesterdayTasks, achieved: yesterdayAchieved });
                            if (history.length > 60) history.splice(60);
                        }
                    }
                } catch (e) { console.error("Error processing yesterday's tasks for history", e); }
            }
            localStorage.setItem('oneulSetFocusTaskCountSettingBeforeReset', focusModeTaskCountSetting.toString());
            initializeTasks(); // 새 날짜면 tasks 초기화
            if (currentAppMode === 'focus') additionalTasks = []; // 새 날짜면 additionalTasks 초기화
            saveState('local'); // 초기화된 상태 로컬 저장 (Firestore 동기화는 별도)
        }

        while (tasks.length < 5) { tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });}
        if (tasks.length > 5) tasks = tasks.slice(0,5);

        // 최종 UI 렌더링
        renderTasks();
        if (currentAppMode === 'focus') renderAdditionalTasks();
        else if (additionalTaskListDiv) additionalTaskListDiv.innerHTML = '';
        updateStats();
        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals();
        renderHistory();

        setTimeout(() => {
            if (taskListDiv) {
                const firstTaskTextarea = taskListDiv.querySelector('.task-item:first-child textarea');
                if (firstTaskTextarea && window.innerWidth > 768 && (document.activeElement === document.body || document.activeElement === null)) {
                    // firstTaskTextarea.focus();
                }
            }
        }, 100);
    }

    function initializeTasks() {
        tasks = [];
        for (let i = 0; i < 5; i++) {
            tasks.push({ id: Date.now() + i + Math.random(), text: '', completed: false, memo: '' });
        }
    }

    if(taskCountSelector){
        taskCountSelector.addEventListener('change', (e) => {
            if (currentAppMode === 'simple') return;
            const newCount = parseInt(e.target.value, 10);
            const oldFocusCount = focusModeTaskCountSetting;
            focusModeTaskCountSetting = newCount;
            MAX_TASKS_CURRENT_MODE = newCount;
            localStorage.setItem('oneulSetFocusTaskCountSetting', focusModeTaskCountSetting.toString());
            if (oldFocusCount !== focusModeTaskCountSetting) {
                saveAppSettingsToFirestore();
            }
            renderTasks();
            announceToScreenReader(`핵심 할 일 개수가 ${newCount}개로 변경되었습니다.`);
        });
    }

    if (shareIncludeAdditionalCheckbox) {
        shareIncludeAdditionalCheckbox.addEventListener('change', (e) => {
            const oldShareOptions = JSON.parse(JSON.stringify(shareOptions));
            shareOptions.includeAdditional = e.target.checked;
            localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
            if (JSON.stringify(oldShareOptions) !== JSON.stringify(shareOptions)) {
                saveAppSettingsToFirestore();
            }
        });
    }
    if (shareIncludeMemosCheckbox) {
        shareIncludeMemosCheckbox.addEventListener('change', (e) => {
            const oldShareOptions = JSON.parse(JSON.stringify(shareOptions));
            shareOptions.includeMemos = e.target.checked;
            localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
            if (JSON.stringify(oldShareOptions) !== JSON.stringify(shareOptions)) {
                saveAppSettingsToFirestore();
            }
        });
    }

    function renderTasks() {
        if(!taskListDiv) { console.warn("renderTasks: taskListDiv not found."); return; }
        taskListDiv.innerHTML = '';
        const tasksToRender = tasks.slice(0, MAX_TASKS_CURRENT_MODE);

        tasksToRender.forEach((task, index) => {
            if (!task) { // task 객체 자체가 null/undefined인 경우 방지
                console.warn(`Task at index ${index} is undefined.`);
                return;
            }
            const originalTaskIndex = tasks.findIndex(t => t && t.id === task.id); // t가 null/undefined가 아닌지 확인
            if (originalTaskIndex === -1) return;

            const taskItem = document.createElement('div');
            taskItem.classList.add('task-item');
            if (tasks[originalTaskIndex].completed) { taskItem.classList.add('completed'); }

            const checkboxLabel = document.createElement('label');
            checkboxLabel.classList.add('custom-checkbox-label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = tasks[originalTaskIndex].completed;
            checkbox.setAttribute('aria-label', `핵심 할 일 ${index + 1} 완료`);
            checkbox.id = `task-checkbox-${tasks[originalTaskIndex].id}`;
            checkboxLabel.htmlFor = checkbox.id;
            const checkboxSpan = document.createElement('span');
            checkboxSpan.classList.add('custom-checkbox-span');
            checkbox.addEventListener('change', () => {
                tasks[originalTaskIndex].completed = checkbox.checked;
                taskItem.classList.toggle('completed', checkbox.checked);
                checkAllDone();
                saveState('local');
            });
            checkboxLabel.appendChild(checkbox);
            checkboxLabel.appendChild(checkboxSpan);

            const taskContentDiv = document.createElement('div');
            taskContentDiv.classList.add('task-item-content');

            const textareaField = document.createElement('textarea');
            textareaField.rows = "1";
            textareaField.placeholder = `할 일 ${index + 1}`;
            textareaField.value = tasks[originalTaskIndex].text;
            textareaField.setAttribute('aria-label', `할 일 ${index + 1} 내용`);
            textareaField.addEventListener('input', (e) => { tasks[originalTaskIndex].text = e.target.value; autoGrowTextarea(e.target); });
            textareaField.addEventListener('blur', () => { saveState('local'); });
            textareaField.addEventListener('focus', (e) => { autoGrowTextarea(e.target); });

            taskContentDiv.appendChild(textareaField);

            if (currentAppMode === 'focus') {
                const memoIcon = document.createElement('button');
                memoIcon.classList.add('memo-icon');
                memoIcon.innerHTML = '<i class="fas fa-sticky-note"></i>';
                memoIcon.setAttribute('aria-label', `할 일 ${index + 1} 메모 보기/숨기기`);
                memoIcon.setAttribute('aria-expanded', 'false');
                taskContentDiv.appendChild(memoIcon);

                const memoContainer = document.createElement('div');
                memoContainer.classList.add('memo-container', 'hidden');
                const memoTextarea = document.createElement('textarea');
                memoTextarea.rows = "1";
                memoTextarea.placeholder = "메모 추가...";
                memoTextarea.value = tasks[originalTaskIndex].memo || "";
                memoTextarea.setAttribute('aria-label', `할 일 ${index + 1} 메모 내용`);
                memoTextarea.addEventListener('input', (e) => { tasks[originalTaskIndex].memo = e.target.value; autoGrowTextarea(e.target);});
                memoTextarea.addEventListener('blur', () => { saveState('local'); });
                memoContainer.appendChild(memoTextarea);
                taskItem.appendChild(memoContainer);

                memoIcon.addEventListener('click', () => {
                    const isHidden = memoContainer.classList.toggle('hidden');
                    memoIcon.setAttribute('aria-expanded', !isHidden);
                    if(!isHidden) memoTextarea.focus();
                    else textareaField.focus();
                    autoGrowTextarea(textareaField);
                    if(!isHidden) autoGrowTextarea(memoTextarea);
                });
                if (tasks[originalTaskIndex].memo && tasks[originalTaskIndex].memo.trim() !== "") {
                    memoIcon.classList.add('has-memo');
                }
                memoTextarea.addEventListener('input', (e) => {
                    tasks[originalTaskIndex].memo = e.target.value;
                    autoGrowTextarea(e.target);
                    memoIcon.classList.toggle('has-memo', e.target.value.trim() !== "");
                });
            }

            taskItem.appendChild(checkboxLabel);
            taskItem.appendChild(taskContentDiv);
            taskListDiv.appendChild(taskItem);
            autoGrowTextarea(textareaField);
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
            if(additionalTaskListDiv) additionalTaskListDiv.innerHTML = '';
            return;
        }
        additionalTaskListDiv.innerHTML = '';
        if (additionalTasks.length === 0) {
            const p = document.createElement('p');
            p.textContent = '추가된 과제가 없습니다.';
            p.classList.add('no-additional-tasks');
            additionalTaskListDiv.appendChild(p);
            return;
        }
        additionalTasks.forEach((task, index) => {
            if (!task) return; // task 객체 null/undefined 방지
            const taskItem = document.createElement('div');
            taskItem.classList.add('additional-task-item');
            if (task.completed) taskItem.classList.add('completed');
            const checkboxLabel = document.createElement('label');
            checkboxLabel.classList.add('custom-checkbox-label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.id = `additional-task-checkbox-${task.id}`;
            checkbox.setAttribute('aria-label', `추가 과제 "${task.text}" 완료`);
            checkboxLabel.htmlFor = checkbox.id;
            const checkboxSpan = document.createElement('span');
            checkboxSpan.classList.add('custom-checkbox-span');
            checkbox.addEventListener('change', () => {
                additionalTasks[index].completed = checkbox.checked;
                taskItem.classList.toggle('completed', checkbox.checked);
                saveState('local');
            });
            checkboxLabel.appendChild(checkbox);
            checkboxLabel.appendChild(checkboxSpan);
            const taskText = document.createElement('span');
            taskText.classList.add('additional-task-text');
            taskText.textContent = task.text;
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-additional-task-btn');
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.setAttribute('aria-label', `추가 과제 "${task.text}" 삭제`);
            deleteBtn.addEventListener('click', () => {
                const taskTextToAnnounce = additionalTasks[index].text;
                additionalTasks.splice(index, 1);
                renderAdditionalTasks();
                saveState('local');
                announceToScreenReader(`추가 과제 "${taskTextToAnnounce}"가 삭제되었습니다.`);
            });
            taskItem.appendChild(checkboxLabel);
            taskItem.appendChild(taskText);
            taskItem.appendChild(deleteBtn);
            additionalTaskListDiv.appendChild(taskItem);
        });
    }

    if (addAdditionalTaskBtn && addAdditionalTaskInput) {
        addAdditionalTaskBtn.addEventListener('click', () => {
            if (currentAppMode === 'simple') return;
            const text = addAdditionalTaskInput.value.trim();
            if (text) {
                additionalTasks.push({ id: Date.now(), text: text, completed: false });
                addAdditionalTaskInput.value = '';
                renderAdditionalTasks();
                saveState('local');
                announceToScreenReader(`추가 과제 "${text}"가 추가되었습니다.`);
                addAdditionalTaskInput.focus();
            }
        });
        addAdditionalTaskInput.addEventListener('keypress', (e) => {
            if (currentAppMode === 'simple') return;
            if (e.key === 'Enter') { addAdditionalTaskBtn.click(); }
        });
    }

    const sections = [
        { id: 'history-section', button: toggleHistoryBtn, baseText: '기록' },
        { id: 'stats-section', button: toggleStatsBtn, baseText: '통계' },
        { id: 'share-section', button: toggleShareBtn, baseText: '공유' },
        { id: 'settings-section', button: toggleSettingsBtn, baseText: '설정' }
    ];

    function toggleSection(sectionIdToToggle) {
        let sectionOpenedName = "";
        sections.forEach(sec => {
            if (!sec.button) return;
            const sectionElement = document.getElementById(sec.id);
            if (!sectionElement) return;
            if (currentAppMode === 'simple') {
                if (sec.id === 'stats-section' && statsVisualsContainer) statsVisualsContainer.classList.add('hidden');
                if (sec.id === 'share-section' && shareAsImageBtnContainer) shareAsImageBtnContainer.classList.add('hidden');
                if (sec.id === 'settings-section' && settingsContentDiv) settingsContentDiv.classList.add('hidden');
                if (sec.id === 'share-section' && shareOptionsDiv) shareOptionsDiv.classList.add('hidden');
            } else {
                 if (sec.id === 'stats-section' && statsVisualsContainer) statsVisualsContainer.classList.remove('hidden');
                 if (sec.id === 'share-section' && shareAsImageBtnContainer) shareAsImageBtnContainer.classList.remove('hidden');
                 if (sec.id === 'settings-section' && settingsContentDiv) settingsContentDiv.classList.remove('hidden');
                 if (sec.id === 'share-section' && shareOptionsDiv) shareOptionsDiv.classList.remove('hidden');
            }
            if (sec.id === sectionIdToToggle) {
                const isHidden = sectionElement.classList.toggle('hidden');
                sec.button.textContent = isHidden ? sec.baseText : `${sec.baseText} 닫기`;
                sec.button.setAttribute('aria-expanded', !isHidden);
                sectionElement.setAttribute('aria-hidden', isHidden);
                if (!isHidden) {
                    sec.button.classList.add('active');
                    sectionOpenedName = sec.baseText;
                    if (sec.id === 'history-section') renderHistory();
                    if (sec.id === 'stats-section') {
                        updateStats();
                        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals();
                    }
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
        if(sectionOpenedName) {
            announceToScreenReader(`${sectionOpenedName} 섹션이 열렸습니다.`);
        }
    }
    if(toggleHistoryBtn) toggleHistoryBtn.addEventListener('click', () => toggleSection('history-section'));
    if(toggleStatsBtn) toggleStatsBtn.addEventListener('click', () => toggleSection('stats-section'));
    if(toggleShareBtn) toggleShareBtn.addEventListener('click', () => toggleSection('share-section'));
    if(toggleSettingsBtn) toggleSettingsBtn.addEventListener('click', () => toggleSection('settings-section'));

    function renderHistory() {
        if (!historyListDiv) return;
        if (history.length === 0) { historyListDiv.innerHTML = '<p>지난 기록이 없습니다.</p>'; return; }
        historyListDiv.innerHTML = '';
        history.forEach(entry => {
            if (!entry || !entry.date || !Array.isArray(entry.tasks)) return;
            const entryDiv = document.createElement('div'); entryDiv.classList.add('history-entry'); entryDiv.dataset.achieved = entry.achieved ? "true" : "false"; const dateStrong = document.createElement('strong'); dateStrong.textContent = `${entry.date.replaceAll('-', '.')}. ${entry.achieved ? "🎯" : ""}`; entryDiv.appendChild(dateStrong); const ul = document.createElement('ul');
            entry.tasks.forEach(task => { if(!task || typeof task.text !== 'string') return; const li = document.createElement('li'); li.textContent = task.text.length > 50 ? task.text.substring(0, 50) + "..." : task.text; li.title = task.text; if (task.completed) { li.classList.add('completed'); } ul.appendChild(li); });
            entryDiv.appendChild(ul); historyListDiv.appendChild(entryDiv);
        });
    }

    function calculateAchievementRate(days) { /* 이전과 동일 */ return "0%"; } // 임시
    function updateStats() { /* 이전과 동일 */ }
    function renderStatsVisuals() { /* 이전과 동일 (Chart.js 관련 로직) */ }
    const shareUrl = window.location.href;
    function getShareText() { /* 이전과 동일 */ return ""; }
    if(copyLinkBtn) { /* 이전과 동일 */ }
    if(shareTwitterBtn) { /* 이전과 동일 */ }
    if (shareAsImageBtn && typeof html2canvas !== 'undefined') { /* 이전과 동일 */ }
    if (exportDataBtn) { /* 이전과 동일 */ }
    if (importDataBtn && importFileInput) { /* 이전과 동일 */ }
    document.addEventListener('keydown', (e) => { /* 이전과 동일 */ });


    // --- 초기화 실행 ---
    function initializeApp() {
        console.log("Initializing app...");
        // 최우선: 날짜 표시
        displayCurrentDate();

        // 테마는 로컬 스토리지 값으로 먼저 적용 (깜빡임 방지), Firestore에서 로드 후 다시 적용될 수 있음
        currentTheme = localStorage.getItem('oneulSetTheme') || 'dark';
        applyTheme(currentTheme, true, 'local'); // isInitialLoad=true, source='local'로 Firestore 쓰기 방지

        // Firebase Auth 상태 변경 감지 설정
        if (firebaseAuth) {
            firebaseAuth.onAuthStateChanged(async user => {
                console.log("Auth state changed. User:", user ? user.uid : 'null');
                updateAuthUI(user); // currentUser는 여기서 설정됨

                if (user) {
                    // 로그인된 사용자
                    announceToScreenReader(`${user.displayName || user.email}님, 환영합니다. 클라우드 데이터 동기화 중...`);
                    try {
                        await loadUserSettingsFromFirestore(user.uid); // Firestore에서 설정 로드 및 UI 반영
                        // 이 함수는 내부적으로 applyTheme, applyAppMode 호출
                        // TODO: Firestore에서 tasks, additionalTasks, history 로드 (다음 단계)
                        // await loadUserDataFromFirestore(user.uid);
                        console.log("User settings loaded/initialized from Firestore for", user.uid);
                        loadStateFromLocalStorage(); // Firestore 설정 로드 후, 로컬 할 일/히스토리 데이터 로드
                                                     // (다음 단계: Firestore 할 일 데이터 로드로 대체/병합)
                        listenToUserSettings(user.uid); // 설정 실시간 리스너 시작
                        // listenToUserTasks(user.uid); // 다음 단계에서 추가

                        if(cloudSyncStatusDiv) cloudSyncStatusDiv.textContent = `로그인 됨 (${user.displayName || user.email}). 클라우드 설정 동기화 활성.`;
                    } catch (error) {
                        console.error("Critical error during post-login data loading for " + user.uid + ":", error);
                        if(cloudSyncStatusDiv) cloudSyncStatusDiv.textContent = `클라우드 데이터 로드 실패. 로컬 데이터 사용 중.`;
                        // Firestore 로드 실패 시, 로컬 데이터로 완전 대체 (이미 로드되었거나 여기서 다시 로드)
                        loadStateFromLocalStorage();
                    }
                } else {
                    // 로그아웃된 사용자 또는 Firebase Auth 사용 불가
                    console.log("User logged out or Firebase Auth not fully available. Loading local data.");
                    if (userSettingsUnsubscribe) { // 리스너 해제
                        console.log("Unsubscribing from user settings listener on logout/auth_unavailable.");
                        userSettingsUnsubscribe();
                        userSettingsUnsubscribe = null;
                    }
                    currentUser = null; // 명시적으로 currentUser null 처리
                    loadStateFromLocalStorage(); // 로컬 데이터 로드 및 UI 반영
                    if(cloudSyncStatusDiv) cloudSyncStatusDiv.textContent = '로그인하여 데이터를 클라우드에 동기화하세요.';
                }
            });
        } else {
            // Firebase Auth 자체가 초기화 실패한 심각한 경우
            console.error("initializeApp: Firebase Auth is not available. App will run in local-only mode.");
            updateAuthUI(null); // Auth UI를 비로그인 상태로 명시적 업데이트
            loadStateFromLocalStorage(); // 로컬 데이터로만 실행
            if(cloudSyncStatusDiv) cloudSyncStatusDiv.textContent = '클라우드 서비스 사용 불가. 로컬 모드로 실행 중.';
        }

        // 푸터 섹션 초기화
        sections.forEach(sec => {
            if(sec.button) sec.button.textContent = sec.baseText;
            const sectionElement = document.getElementById(sec.id);
            if (sectionElement) {
                sectionElement.setAttribute('aria-hidden', 'true');
                if(sec.button) sec.button.setAttribute('aria-expanded', 'false');
            }
        });

        // 초기 렌더링 보장 (Firebase 로딩이 느릴 경우 대비)
        // 만약 onAuthStateChanged가 빠르게 null을 반환하고 loadStateFromLocalStorage가 호출되면 중복될 수 있으나,
        // UI가 최대한 빨리 보이도록 하기 위함.
        if (!currentUser) { // 아직 로그인 상태가 아니면 로컬 데이터로 일단 그림
            console.log("No current user on initial sync load, ensuring local data is rendered.");
            loadStateFromLocalStorage();
        }
    }

    initializeApp();
});
