// script.js - v1.15.0-firestore-sync - FULL CODE
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed (v1.15.0)");

    // --- Firebase Configuration ---
    const firebaseConfig = {
        apiKey: "AIzaSyCOpwpjfVTelpwDuf-H05UWhZbuSPa5ETg",
        authDomain: "todayset-5fd1d.firebaseapp.com",
        projectId: "todayset-5fd1d",
        storageBucket: "todayset-5fd1d.firebasestorage.app", // Firebase 콘솔 값 사용
        messagingSenderId: "241640367345",
        appId: "1:241640367345:web:152b382f3fb4a05c943550",
        measurementId: "G-J2HZ3RJ6MQ"
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
    let userTasksUnsubscribe = null;
    let userAdditionalTasksUnsubscribe = null;
    let userHistoryUnsubscribe = null;
    let isInitialFirestoreLoadComplete = false;
    let isUpdatingFromFirestore = false; // Firestore 리스너로부터 데이터 업데이트 중임을 나타내는 플래그

    const APP_VERSION_DATA_FORMAT = "1.14.1-content-load-fix-data"; // 기존 버전 유지 (데이터 포맷 변경 없음)

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
    function getUserDocRef(userId) {
        return (firestoreDB && userId) ? firestoreDB.collection('users').doc(userId) : null;
    }

    async function initializeUserSettingsInFirestore(userId) {
        const userDocRef = getUserDocRef(userId);
        if (!userDocRef) return;
        try {
            const docSnap = await userDocRef.get();
            if (!docSnap.exists || !docSnap.data()?.appSettings) {
                const initialSettings = {
                    appMode: 'simple', theme: 'dark', focusTaskCount: 3,
                    shareOptions: { includeAdditional: false, includeMemos: false },
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                };
                await userDocRef.set({ appSettings: initialSettings }, { merge: true });
                console.log("Firestore: Initial appSettings created for", userId);
            }
        } catch (error) { console.error("Error initializing appSettings in Firestore for " + userId + ":", error); }
    }

    async function loadAppSettingsFromFirestore(userId) {
        const userDocRef = getUserDocRef(userId);
        if (!userDocRef) return Promise.reject("User settings ref not available.");
        try {
            const docSnap = await userDocRef.get();
            if (docSnap.exists && docSnap.data()?.appSettings) {
                return docSnap.data().appSettings;
            }
            console.log("Firestore: No appSettings for user, initializing.");
            await initializeUserSettingsInFirestore(userId);
            const newDocSnap = await userDocRef.get();
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

        // Firestore에서 업데이트 중일 때는 로컬 저장소에 다시 쓰지 않음
        if (source !== 'firestore') {
            localStorage.setItem('oneulSetMode', currentAppMode);
            localStorage.setItem('oneulSetTheme', currentTheme);
            localStorage.setItem('oneulSetFocusTaskCountSetting', focusModeTaskCountSetting.toString());
            localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
        }

        currentAppMode = settings.appMode || currentAppMode;
        currentTheme = settings.theme || currentTheme;
        focusModeTaskCountSetting = settings.focusTaskCount || focusModeTaskCountSetting;
        shareOptions = settings.shareOptions || shareOptions;
        
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
        if (!currentUser || !firestoreDB || isUpdatingFromFirestore) return; // 리스너 업데이트 중에는 저장 방지
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
        } catch (error) { console.error("Error saving app settings to Firestore for " + currentUser.uid + ":", error); }
    }

    function listenToAppSettingsChanges(userId) {
        if (userSettingsUnsubscribe) userSettingsUnsubscribe();
        const userDocRef = getUserDocRef(userId);
        if (!userDocRef) return;
        console.log("Setting up Firestore listener for appSettings:", userId);
        userSettingsUnsubscribe = userDocRef.onSnapshot(doc => {
            if (doc.exists && doc.data()?.appSettings) {
                const remoteSettings = doc.data().appSettings;
                const localThemeForCompare = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
                let changed = remoteSettings.appMode !== currentAppMode ||
                              remoteSettings.theme !== localThemeForCompare ||
                              remoteSettings.focusTaskCount !== focusModeTaskCountSetting ||
                              JSON.stringify(remoteSettings.shareOptions) !== JSON.stringify(shareOptions);
                if (changed) {
                    console.log("Firestore: AppSettings changed by remote, updating local state and UI.");
                    isUpdatingFromFirestore = true; // Firestore에서 업데이트 중 플래그 설정
                    applySettingsToLocalAndUI(remoteSettings, 'firestore');
                    announceToScreenReader("클라우드 설정이 업데이트되었습니다.");
                    isUpdatingFromFirestore = false; // 업데이트 완료 후 플래그 해제
                }
            }
        }, error => console.error("Error in appSettings listener for " + userId + ":", error));
    }

    async function saveTasksToFirestore() {
        if (!currentUser || !firestoreDB || isUpdatingFromFirestore) return;
        const userDocRef = getUserDocRef(currentUser.uid);
        if (!userDocRef) return;
        try {
            await userDocRef.set({ tasksData: { items: tasks, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() } }, { merge: true });
            console.log("Firestore: Tasks array saved.");
        } catch (error) { console.error("Error saving tasks array to Firestore:", error); }
    }
    async function saveAdditionalTasksToFirestore() {
        if (!currentUser || !firestoreDB || isUpdatingFromFirestore) return;
        const userDocRef = getUserDocRef(currentUser.uid);
        if (userDocRef) {
            try {
                await userDocRef.set({ additionalTasksData: { items: additionalTasks, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() } }, { merge: true });
                console.log("Firestore: Additional tasks array saved.");
            } catch (error) { console.error("Error saving additional tasks array to Firestore:", error); }
        }
    }
    async function saveHistoryToFirestore() {
        if (!currentUser || !firestoreDB || isUpdatingFromFirestore) return;
        const userDocRef = getUserDocRef(currentUser.uid);
        if (userDocRef) {
            try {
                await userDocRef.set({ historyData: { items: history, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() } }, { merge: true });
                console.log("Firestore: History array saved.");
            } catch (error) { console.error("Error saving history array to Firestore:", error); }
        }
    }

    // --- Firestore 리스너 구현 (새로운 부분) ---
    function listenToTasksChanges(userId) {
        if (userTasksUnsubscribe) userTasksUnsubscribe();
        const userDocRef = getUserDocRef(userId);
        if (!userDocRef) return;
        console.log("Setting up Firestore listener for tasksData:", userId);
        userTasksUnsubscribe = userDocRef.onSnapshot(doc => {
            if (doc.exists && doc.data()?.tasksData?.items) {
                const remoteTasks = doc.data().tasksData.items;
                // 로컬 데이터와 원격 데이터 비교 (간단한 JSON 문자열 비교)
                if (JSON.stringify(tasks) !== JSON.stringify(remoteTasks)) {
                    console.log("Firestore: Tasks changed by remote, updating local state and UI.");
                    isUpdatingFromFirestore = true;
                    tasks = remoteTasks;
                    while (tasks.length < 5) { tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });}
                    if (tasks.length > 5) tasks = tasks.slice(0,5);
                    renderTasks();
                    announceToScreenReader("핵심 할 일 목록이 클라우드에서 업데이트되었습니다.");
                    isUpdatingFromFirestore = false;
                }
            } else if (doc.exists && !doc.data()?.tasksData) {
                // tasksData 필드가 없는 경우 (초기 상태 등)
                console.log("Firestore: tasksData field not found in user document, initializing locally.");
                isUpdatingFromFirestore = true;
                initializeTasks(); // 로컬 데이터 초기화
                renderTasks();
                isUpdatingFromFirestore = false;
            }
        }, error => console.error("Error in tasks listener for " + userId + ":", error));
    }

    function listenToAdditionalTasksChanges(userId) {
        if (userAdditionalTasksUnsubscribe) userAdditionalTasksUnsubscribe();
        const userDocRef = getUserDocRef(userId);
        if (!userDocRef) return;
        console.log("Setting up Firestore listener for additionalTasksData:", userId);
        userAdditionalTasksUnsubscribe = userDocRef.onSnapshot(doc => {
            if (doc.exists && doc.data()?.additionalTasksData?.items) {
                const remoteAdditionalTasks = doc.data().additionalTasksData.items;
                 if (JSON.stringify(additionalTasks) !== JSON.stringify(remoteAdditionalTasks)) {
                    console.log("Firestore: Additional tasks changed by remote, updating local state and UI.");
                    isUpdatingFromFirestore = true;
                    additionalTasks = remoteAdditionalTasks;
                    renderAdditionalTasks();
                    announceToScreenReader("추가 할 일 목록이 클라우드에서 업데이트되었습니다.");
                    isUpdatingFromFirestore = false;
                }
            } else if (doc.exists && !doc.data()?.additionalTasksData) {
                console.log("Firestore: additionalTasksData field not found, initializing locally.");
                isUpdatingFromFirestore = true;
                additionalTasks = [];
                renderAdditionalTasks();
                isUpdatingFromFirestore = false;
            }
        }, error => console.error("Error in additionalTasks listener for " + userId + ":", error));
    }

    function listenToHistoryChanges(userId) {
        if (userHistoryUnsubscribe) userHistoryUnsubscribe();
        const userDocRef = getUserDocRef(userId);
        if (!userDocRef) return;
        console.log("Setting up Firestore listener for historyData:", userId);
        userHistoryUnsubscribe = userDocRef.onSnapshot(doc => {
            if (doc.exists && doc.data()?.historyData?.items) {
                const remoteHistory = doc.data().historyData.items;
                 if (JSON.stringify(history) !== JSON.stringify(remoteHistory)) {
                    console.log("Firestore: History changed by remote, updating local state and UI.");
                    isUpdatingFromFirestore = true;
                    history = remoteHistory;
                    renderHistory();
                    updateStats();
                    renderStatsVisuals();
                    announceToScreenReader("기록이 클라우드에서 업데이트되었습니다.");
                    isUpdatingFromFirestore = false;
                }
            } else if (doc.exists && !doc.data()?.historyData) {
                console.log("Firestore: historyData field not found, initializing locally.");
                isUpdatingFromFirestore = true;
                history = [];
                renderHistory();
                updateStats();
                renderStatsVisuals();
                isUpdatingFromFirestore = false;
            }
        }, error => console.error("Error in history listener for " + userId + ":", error));
    }

    async function loadContentDataFromFirestore(userId) {
        if (!firestoreDB || !userId) return Promise.resolve(false);
        const userDocRef = getUserDocRef(userId);
        if (!userDocRef) return Promise.resolve(false);

        console.log("Firestore: Attempting to load ALL content data for", userId);
        try {
            const docSnap = await userDocRef.get();
            let firestoreDataFound = false;
            if (docSnap.exists && docSnap.data()) {
                const data = docSnap.data();
                console.log("Firestore: Document data received:", data);

                isUpdatingFromFirestore = true; // 로딩 중 플래그 설정

                if (data.tasksData && Array.isArray(data.tasksData.items)) {
                    tasks = data.tasksData.items;
                    console.log(`Firestore: Tasks loaded (${tasks.length} items).`);
                    firestoreDataFound = true;
                } else {
                    console.log("Firestore: No tasksData found. Initializing tasks locally.");
                    initializeTasks();
                }

                if (data.additionalTasksData && Array.isArray(data.additionalTasksData.items)) {
                    additionalTasks = data.additionalTasksData.items;
                    console.log(`Firestore: AdditionalTasks loaded (${additionalTasks.length} items).`);
                    firestoreDataFound = true;
                } else {
                    console.log("Firestore: No additionalTasksData found. Initializing additionalTasks locally.");
                    additionalTasks = [];
                }

                if (data.historyData && Array.isArray(data.historyData.items)) {
                    history = data.historyData.items;
                    console.log(`Firestore: History loaded (${history.length} items).`);
                    firestoreDataFound = true;
                } else {
                    console.log("Firestore: No historyData found. Initializing history locally.");
                    history = [];
                }

                while (tasks.length < 5) { tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });}
                if (tasks.length > 5) tasks = tasks.slice(0,5);

                renderAllContentUI(); // UI 렌더링
                isUpdatingFromFirestore = false; // 로딩 완료 후 플래그 해제

                if (firestoreDataFound) announceToScreenReader("클라우드에서 데이터를 불러왔습니다.");
                return firestoreDataFound;
            } else {
                console.log("Firestore: No user document found for content for user " + userId + ". Initializing local content.");
                isUpdatingFromFirestore = true; // 초기화 중 플래그 설정
                initializeTasks(); additionalTasks = []; history = [];
                renderAllContentUI();
                isUpdatingFromFirestore = false; // 초기화 완료 후 플래그 해제
                return false;
            }
        } catch (error) {
            console.error("Error loading content data from Firestore for " + userId + ":", error);
            announceToScreenReader("클라우드 데이터 로드 중 오류 발생.");
            isUpdatingFromFirestore = false; // 에러 발생 시 플래그 해제
            loadContentDataFromLocalStorage(); // 오류 시 로컬 데이터로 복구
            return Promise.reject(error);
        }
    }

    function renderAllContentUI() {
        renderTasks();
        renderAdditionalTasks();
        renderHistory();
        updateStats();
        const chartCanvasEl = document.getElementById('daily-achievement-chart');
        const currentDailyAchievementChartCtx = chartCanvasEl ? chartCanvasEl.getContext('2d') : null;
        if (currentAppMode === 'focus' && currentDailyAchievementChartCtx) renderStatsVisuals();
    }

    // --- Firebase Authentication Functions ---
    async function signUpWithEmailPassword(email, password) {
        if (!firebaseAuth) return;
        try {
            const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
            await initializeUserSettingsInFirestore(userCredential.user.uid);
            // 새 사용자는 데이터도 초기화해야 함
            await saveTasksToFirestore();
            await saveAdditionalTasksToFirestore();
            await saveHistoryToFirestore();
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
                // 새 Google 사용자는 데이터도 초기화해야 함
                await saveTasksToFirestore();
                await saveAdditionalTasksToFirestore();
                await saveHistoryToFirestore();
            }
        } catch (error) { console.error("Error signing in with Google:", error); alert(`Google 로그인 실패: ${error.message}`); }
    }
    async function signOutUser() {
        if (!firebaseAuth) return;
        try {
            // 모든 리스너 해제
            if (userSettingsUnsubscribe) userSettingsUnsubscribe(); userSettingsUnsubscribe = null;
            if (userTasksUnsubscribe) userTasksUnsubscribe(); userTasksUnsubscribe = null;
            if (userAdditionalTasksUnsubscribe) userAdditionalTasksUnsubscribe(); userAdditionalTasksUnsubscribe = null;
            if (userHistoryUnsubscribe) userHistoryUnsubscribe(); userHistoryUnsubscribe = null;
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
            console.error("Auth UI elements missing."); return;
        }
        const isLoggedIn = !!user;
        loginBtnEl.classList.toggle('hidden', isLoggedIn);
        signupBtnEl.classList.toggle('hidden', isLoggedIn);
        userEmailSpanEl.textContent = isLoggedIn ? (user.displayName || user.email || '사용자') : '';
        userEmailSpanEl.classList.toggle('hidden', !isLoggedIn);
        logoutBtnEl.classList.toggle('hidden', !isLoggedIn);
        cloudSyncStatusDivEl.textContent = isLoggedIn ? `로그인 됨 (${userEmailSpanEl.textContent}).` : '로그인하여 데이터를 클라우드에 동기화하세요.';
        // authContainerEl은 정의되지 않은 변수이므로 주석 처리 또는 적절히 수정
        // authContainerEl.classList.toggle('logged-in', isLoggedIn);
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
        const appModeToggleEl = document.getElementById('app-mode-toggle');
        const taskCountSelectorContainerEl = document.querySelector('.task-count-setting');
        const additionalTasksSectionEl = document.getElementById('additional-tasks-section');
        const statsVisualsContainerEl = document.querySelector('.stats-visuals');
        const shareAsImageBtnContainerEl = document.getElementById('share-as-image-btn-container');
        const currentSettingsContentDiv = document.querySelector('#settings-section .settings-content');
        const taskCountSelectorEl = document.getElementById('task-count-selector');
        const shareOptionsDivEl = document.querySelector('#share-section .share-options');
        const shareIncludeMemosLabelEl = document.getElementById('share-include-memos-label');
        const toggleSettingsBtnEl = document.getElementById('toggle-settings-btn');
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
            if (toggleSettingsBtnEl && toggleSettingsBtnEl.classList.contains('active') && settingsSectionEl && !settingsSectionEl.classList.contains('hidden')) {
                settingsSectionEl.classList.add('hidden');
                const sections = getSectionsArray();
                const settingsSecInfo = sections.find(s => s.id === 'settings-section');
                if (settingsSecInfo && settingsSecInfo.button) toggleSettingsBtnEl.textContent = settingsSecInfo.baseText;
                toggleSettingsBtnEl.classList.remove('active');
                toggleSettingsBtnEl.setAttribute('aria-expanded', 'false');
                settingsSectionEl.setAttribute('aria-hidden', 'true');
            }
        } else {
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
        if ((!isInitialLoad || source === 'local_init' || source === 'firestore') && (oldAppModeUI !== mode || isInitialLoad) ) {
            renderTasks(); renderAdditionalTasks(); // 모드 변경 시 렌더링
        }
        if (!isInitialLoad && source === 'local') {
            announceToScreenReader(`${mode === 'simple' ? '심플' : '집중'} 모드로 변경되었습니다.`);
        }
    }
    const appModeToggleEl = document.getElementById('app-mode-toggle');
    if(appModeToggleEl) {
        appModeToggleEl.addEventListener('click', () => {
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
        if (currentAppMode === 'focus' && currentDailyAchievementChartCtx) renderStatsVisuals();
    }
    const themeToggleButtonEl = document.getElementById('theme-toggle');
    if(themeToggleButtonEl){
        themeToggleButtonEl.addEventListener('click', () => {
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
        }
    }
    function autoGrowTextarea(element) { if(element) { element.style.height = "auto"; element.style.height = (element.scrollHeight) + "px"; } }

    // --- 상태 저장 및 로드 ---
    function saveState(source = 'local') {
        localStorage.setItem('oneulSetTasks', JSON.stringify(tasks));
        localStorage.setItem('oneulSetAdditionalTasks', JSON.stringify(additionalTasks));
        localStorage.setItem('oneulSetLastDate', getTodayDateString());
        localStorage.setItem('oneulSetHistory', JSON.stringify(history));
        updateStats();
        const chartCanvasEl = document.getElementById('daily-achievement-chart');
        const currentDailyAchievementChartCtx = chartCanvasEl ? chartCanvasEl.getContext('2d') : null;
        if (currentAppMode === 'focus' && currentDailyAchievementChartCtx) renderStatsVisuals();

        // Firestore에서 업데이트 중이 아니라면 Firestore에 저장
        if (currentUser && firestoreDB && !isUpdatingFromFirestore) {
            saveTasksToFirestore();
            saveAdditionalTasksToFirestore();
            saveHistoryToFirestore();
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
        if (currentAppMode === 'focus' && storedAdditionalTasks) {
            try { additionalTasks = JSON.parse(storedAdditionalTasks); if(!Array.isArray(additionalTasks)) additionalTasks = []; } catch (e) { additionalTasks = [];}
        } else { additionalTasks = []; }

        let shouldResetTasks = false;
        if (storedLastDate === todayDateStr && storedTasks) {
            try { tasks = JSON.parse(storedTasks); if (!Array.isArray(tasks)) shouldResetTasks = true; }
            catch (e) { shouldResetTasks = true; }
        } else {
            shouldResetTasks = true;
            if (storedTasks && storedLastDate) { // 어제 날짜의 기록을 히스토리에 추가
                try {
                    const yesterdayTasksData = JSON.parse(storedTasks);
                    // 기존 focusModeTaskCountSetting 값을 사용해야 함 (리셋되기 전)
                    const yesterdayFocusModeTaskCount = parseInt(localStorage.getItem('oneulSetFocusTaskCountSettingBeforeReset') || '3', 10);
                    if (Array.isArray(yesterdayTasksData)) {
                        const relevantYesterdayTasks = yesterdayTasksData.slice(0, yesterdayFocusModeTaskCount);
                        const allFilled = relevantYesterdayTasks.every(t => t && t.text.trim() !== "");
                        const allCompleted = relevantYesterdayTasks.every(t => t && t.completed);
                        const achieved = allFilled && relevantYesterdayTasks.length === yesterdayFocusModeTaskCount && allCompleted && yesterdayFocusModeTaskCount > 0;
                        if (!history.some(entry => entry.date === storedLastDate)) { // 이미 기록되지 않은 경우에만 추가
                            history.unshift({ date: storedLastDate, tasks: relevantYesterdayTasks.map(t => ({id: t.id, text: t.text, completed: t.completed})), achieved: achieved });
                            if (history.length > 60) history.splice(60); // 최근 60일만 유지
                        }
                    }
                } catch (e) { console.error("Error processing yesterday's tasks for history", e); }
            }
            localStorage.setItem('oneulSetFocusTaskCountSettingBeforeReset', focusModeTaskCountSetting.toString()); // 오늘 날짜로 리셋되기 전의 설정 저장
        }

        if (shouldResetTasks) {
            initializeTasks();
            if (currentAppMode === 'focus') additionalTasks = []; // 간편 모드에서는 추가 할 일 없음
            // saveState('local'); // 로컬 초기화 후 자동 Firestore 저장 방지 (로그인 시 병합 로직에서 처리)
        }
        while (tasks.length < 5) { tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });}
        if (tasks.length > 5) tasks = tasks.slice(0,5);
        renderAllContentUI(); // 설정 로드 후 모든 콘텐츠 UI 렌더링
    }
    function initializeTasks() {
        tasks = [];
        for (let i = 0; i < 5; i++) {
            tasks.push({ id: Date.now() + i + Math.random(), text: '', completed: false, memo: '' });
        }
    }

    const taskCountSelectorEl = document.getElementById('task-count-selector');
    if(taskCountSelectorEl){
        taskCountSelectorEl.addEventListener('change', (e) => {
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
    const shareIncludeAdditionalCheckboxEl = document.getElementById('share-include-additional');
    if (shareIncludeAdditionalCheckboxEl) {
        shareIncludeAdditionalCheckboxEl.addEventListener('change', (e) => {
            if (shareOptions.includeAdditional !== e.target.checked) {
                shareOptions.includeAdditional = e.target.checked;
                localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
                if (currentUser) saveAppSettingsToFirestore();
            }
        });
    }
    const shareIncludeMemosCheckboxEl = document.getElementById('share-include-memos');
    if (shareIncludeMemosCheckboxEl) {
        shareIncludeMemosCheckboxEl.addEventListener('change', (e) => {
             if (shareOptions.includeMemos !== e.target.checked) {
                shareOptions.includeMemos = e.target.checked;
                localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
                if (currentUser) saveAppSettingsToFirestore();
            }
        });
    }

    function renderTasks() {
        const taskListDivEl = document.querySelector('.task-list');
        if(!taskListDivEl) { console.warn("renderTasks: task-list div not found."); return; }
        taskListDivEl.innerHTML = '';
        const tasksToRender = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
        tasksToRender.forEach((task, index) => {
            if (!task) { console.warn(`Task at index ${index} is undefined.`); return; }
            const originalTaskIndex = tasks.findIndex(t => t && t.id === task.id);
            if (originalTaskIndex === -1) {
                console.warn(`Task with id ${task.id} not found in global tasks array.`);
                return; // 전역 tasks 배열에 없는 항목은 렌더링하지 않음
            }
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
                taskItem.classList.toggle('completed', checkbox.checked); checkAllDone();
                saveState('local'); // 상태 변경 시 저장 (로컬 & 클라우드)
            });
            checkboxLabel.appendChild(checkbox); checkboxLabel.appendChild(checkboxSpan);
            const taskContentDiv = document.createElement('div'); taskContentDiv.classList.add('task-item-content');
            const textareaField = document.createElement('textarea'); textareaField.rows = "1";
            textareaField.placeholder = `할 일 ${index + 1}`; textareaField.value = tasks[originalTaskIndex].text;
            textareaField.setAttribute('aria-label', `할 일 ${index + 1} 내용`);
            textareaField.addEventListener('input', (e) => { tasks[originalTaskIndex].text = e.target.value; autoGrowTextarea(e.target); });
            textareaField.addEventListener('blur', () => {
                saveState('local'); // 상태 변경 시 저장 (로컬 & 클라우드)
            });
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
                memoTextarea.addEventListener('blur', () => {
                    saveState('local'); // 상태 변경 시 저장 (로컬 & 클라우드)
                });
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
        additionalTasks.forEach((task, index) => {
            if (!task) return;
            const taskItem = document.createElement('div'); taskItem.classList.add('additional-task-item');
            if (task.completed) taskItem.classList.add('completed');
            const checkboxLabel = document.createElement('label'); checkboxLabel.classList.add('custom-checkbox-label');
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
            checkbox.checked = task.completed; checkbox.id = `additional-task-checkbox-${task.id}`;
            checkbox.setAttribute('aria-label', `추가 과제 "${task.text}" 완료`); checkboxLabel.htmlFor = checkbox.id;
            const checkboxSpan = document.createElement('span'); checkboxSpan.classList.add('custom-checkbox-span');
            checkbox.addEventListener('change', () => {
                additionalTasks[index].completed = checkbox.checked;
                taskItem.classList.toggle('completed', checkbox.checked);
                saveState('local'); // 상태 변경 시 저장 (로컬 & 클라우드)
            });
            checkboxLabel.appendChild(checkbox); checkboxLabel.appendChild(checkboxSpan);
            const taskText = document.createElement('span'); taskText.classList.add('additional-task-text');
            taskText.textContent = task.text;
            const deleteBtn = document.createElement('button'); deleteBtn.classList.add('delete-additional-task-btn');
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>'; deleteBtn.setAttribute('aria-label', `추가 과제 "${task.text}" 삭제`);
            deleteBtn.addEventListener('click', () => {
                const taskToDelete = additionalTasks.splice(index, 1)[0];
                renderAdditionalTasks();
                saveState('local'); // 상태 변경 시 저장 (로컬 & 클라우드)
                announceToScreenReader(`추가 과제 "${taskToDelete.text}"가 삭제되었습니다.`);
            });
            taskItem.appendChild(checkboxLabel); taskItem.appendChild(taskText); taskItem.appendChild(deleteBtn);
            additionalTaskListDivElToCheck.appendChild(taskItem);
        });
    }

    // deleteAdditionalTaskFromFirestore 함수는 이제 saveAdditionalTasksToFirestore가 배열 전체를 다시 저장하므로 필요 없음.
    // 기존의 deleteAdditionalTaskFromFirestore 로직은 saveState('local') 호출로 대체됨
    // async function deleteAdditionalTaskFromFirestore(additionalTaskId) {
    //     if (!currentUser || !firestoreDB || !additionalTaskId) return;
    //     const userDocRef = getUserDocRef(currentUser.uid);
    //     if (!userDocRef) return;
    //     try {
    //         const updatedAdditionalTasks = additionalTasks.filter(at => at.id !== additionalTaskId);
    //         await userDocRef.set({ additionalTasksData: { items: updatedAdditionalTasks, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() } }, { merge: true });
    //         console.log("Firestore: AdditionalTask deleted via array update:", additionalTaskId);
    //     } catch (error) { console.error("Error deleting additionalTask from Firestore:", additionalTaskId, error); }
    // }

    function setupAdditionalTaskListener() {
        const addBtn = document.getElementById('add-additional-task-btn');
        const addInput = document.getElementById('add-additional-task-input');
        if (addBtn && addInput) {
            addBtn.addEventListener('click', () => {
                if (currentAppMode === 'simple') return;
                const text = addInput.value.trim();
                if (text) {
                    const newAdditionalTask = { id: Date.now(), text: text, completed: false };
                    additionalTasks.push(newAdditionalTask);
                    addInput.value = ''; renderAdditionalTasks();
                    saveState('local'); // 상태 변경 시 저장 (로컬 & 클라우드)
                    announceToScreenReader(`추가 과제 "${text}"가 추가되었습니다.`); addInput.focus();
                }
            });
            addInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addBtn.click(); } });
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
            if (sec.id === sectionIdToToggle) {
                const isHidden = sectionElement.classList.toggle('hidden');
                sec.button.textContent = isHidden ? sec.baseText : `${sec.baseText} 닫기`;
                sec.button.setAttribute('aria-expanded', !isHidden);
                sectionElement.setAttribute('aria-hidden', isHidden);
                if (!isHidden) {
                    sec.button.classList.add('active'); sectionOpenedName = sec.baseText;
                    const historyListDivEl = document.getElementById('history-list');
                    if (sec.id === 'history-section' && historyListDivEl) renderHistory();
                    const weeklyStatsElToSet = document.getElementById('weekly-stats');
                    const monthlyStatsElToSet = document.getElementById('monthly-stats');
                    const chartCanvasElForToggle = document.getElementById('daily-achievement-chart');
                    const dailyAchievementChartCtxForToggle = chartCanvasElForToggle ? chartCanvasElForToggle.getContext('2d') : null;
                    if (sec.id === 'stats-section' && weeklyStatsElToSet && monthlyStatsElToSet) {
                        updateStats();
                        if (currentAppMode === 'focus' && dailyAchievementChartCtxForToggle) renderStatsVisuals();
                    }
                } else { sec.button.classList.remove('active'); }
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
        history.forEach(entry => {
            if (!entry || !entry.date || !Array.isArray(entry.tasks)) return;
            const entryDiv = document.createElement('div'); entryDiv.classList.add('history-entry'); entryDiv.dataset.achieved = entry.achieved ? "true" : "false"; const dateStrong = document.createElement('strong'); dateStrong.textContent = `${entry.date.replaceAll('-', '.')}. ${entry.achieved ? "🎯" : ""}`; entryDiv.appendChild(dateStrong); const ul = document.createElement('ul');
            entry.tasks.forEach(task => { if(!task || typeof task.text !== 'string') return; const li = document.createElement('li'); li.textContent = task.text.length > 50 ? task.text.substring(0, 50) + "..." : task.text; li.title = task.text; if (task.completed) { li.classList.add('completed'); } ul.appendChild(li); });
            entryDiv.appendChild(ul); historyListDivEl.appendChild(entryDiv);
        });
    }
    function calculateAchievementRate(days) {
        if (history.length === 0) return "0% (기록 없음)";
        const today = new Date(); today.setHours(0, 0, 0, 0);
        let achievementCount = 0, relevantDaysCount = 0;
        // history 배열은 최신 날짜가 앞에 있으므로 앞에서부터 days*2 (넉넉하게) 검색
        const relevantHistory = history.filter(entry => {
            if (!entry || !entry.date) return false;
            const entryDate = new Date(entry.date);
            const diffTime = today.getTime() - entryDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            return diffDays < days && diffDays >= 0;
        });

        relevantDaysCount = relevantHistory.length;
        achievementCount = relevantHistory.filter(entry => entry.achieved).length;

        if (relevantDaysCount === 0) return `0% (최근 ${days}일 기록 없음)`;
        const rate = (achievementCount / relevantDaysCount) * 100;
        return `${rate.toFixed(0)}% (${achievementCount}/${relevantDaysCount}일)`;
    }
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
        let currentStreak = 0; let dateToCheck = new Date();
        dateToCheck.setHours(0,0,0,0); // 오늘 날짜 0시 0분 0초로 설정

        // 오늘 목표 달성 여부 확인
        const todayTasksForStreak = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
        const todayFilled = todayTasksForStreak.every(t => t && t.text.trim() !== "");
        const todayCompleted = todayTasksForStreak.every(t => t && t.completed);
        if (todayFilled && todayTasksForStreak.length === MAX_TASKS_CURRENT_MODE && todayCompleted && MAX_TASKS_CURRENT_MODE > 0) {
            currentStreak++;
        } else {
            // 오늘 목표를 달성하지 못했으면, 어제부터 기록을 확인
            dateToCheck.setDate(dateToCheck.getDate() - 1);
        }

        // 과거 기록을 확인하여 연속 달성 계산
        for (let i = 0; i < history.length; i++) {
            const entryDate = new Date(history[i].date);
            entryDate.setHours(0,0,0,0);
            if (entryDate.getTime() === dateToCheck.getTime() && history[i].achieved) {
                currentStreak++;
                dateToCheck.setDate(dateToCheck.getDate() - 1); // 다음 날짜 확인
            } else if (entryDate.getTime() < dateToCheck.getTime()) {
                // 기록이 없는 날짜나 달성하지 못한 날짜를 만나면 중단
                break;
            }
            if (currentStreak > 365) break; // 너무 긴 연속 기록은 불필요 (성능 상 한계)
        }

        if (streakDaysElToSet) streakDaysElToSet.textContent = `${currentStreak}일`;

        const dayMap = ['일', '월', '화', '수', '목', '금', '토']; const achievementByDay = [0,0,0,0,0,0,0];
        history.filter(entry => entry.achieved).forEach(entry => { achievementByDay[new Date(entry.date).getDay()]++; });
        const maxAchievedCount = Math.max(...achievementByDay); const mostAchievedDays = [];
        achievementByDay.forEach((count, index) => { if (count === maxAchievedCount && count > 0) mostAchievedDays.push(dayMap[index]); });
        if (mostAchievedDayElToSet) mostAchievedDayElToSet.textContent = mostAchievedDays.length > 0 ? mostAchievedDays.join(', ') + '요일' : '기록 없음';

        const labels = []; const dataPoints = []; const todayForChart = new Date();
        todayForChart.setHours(0,0,0,0); // 차트도 오늘 날짜 0시 0분 0초 기준
        for (let i = 29; i >= 0; i--) {
            const targetDate = new Date(todayForChart); targetDate.setDate(todayForChart.getDate() - i);
            const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
            labels.push(dateStr.substring(5)); // 'MM-DD' 형식

            let achievedThisDay = false;
            if (i === 0) { // 오늘 날짜는 현재 tasks 상태로 판단
                const todayTasks = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
                const filled = todayTasks.every(t=> t && t.text.trim() !== "");
                const completed = todayTasks.every(t => t && t.completed);
                achievedThisDay = filled && todayTasks.length === MAX_TASKS_CURRENT_MODE && completed && MAX_TASKS_CURRENT_MODE > 0;
            } else { // 과거 날짜는 history에서 찾아 판단
                const entry = history.find(h => h.date === dateStr);
                if (entry) achievedThisDay = entry.achieved;
            }
            dataPoints.push(achievedThisDay ? 1 : 0);
        }
        if (achievementChart) achievementChart.destroy();
        const isDarkMode = document.body.classList.contains('dark-theme');
        const gridColor = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--chart-grid-color-dark' : '--chart-grid-color-light').trim();
        const fontColor = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--chart-font-color-dark' : '--chart-font-color-light').trim();
        const primaryButtonBg = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--button-primary-bg-dark' : '--button-primary-bg-light').trim();
        if (currentDailyAchievementChartCtx && window.Chart) {
            achievementChart = new Chart(currentDailyAchievementChartCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '일일 목표 달성 여부', data: dataPoints, borderColor: primaryButtonBg,
                        backgroundColor: Chart.helpers.color(primaryButtonBg).alpha(0.2).rgbString(),
                        tension: 0.1, fill: true,
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, max: 1, ticks: { stepSize: 1, color: fontColor, callback: (v) => v === 1 ? '달성' : (v === 0 ? '미달성' : null) }, grid: { color: gridColor } },
                        x: { ticks: { color: fontColor }, grid: { color: gridColor } }
                    },
                    plugins: { legend: { labels: { color: fontColor } }, tooltip: { callbacks: { label: (c) => c.parsed.y === 1 ? '달성' : '미달성' } } }
                }
            });
            if(currentDailyAchievementChartCtx.canvas) currentDailyAchievementChartCtx.canvas.setAttribute('aria-label', '지난 30일간 일일 목표 달성 추이 그래프');
        }
    }
    const shareUrl = window.location.href;
    function getShareText() { const hashtags = "#오늘할일 #집중력 #오늘셋팁"; return `오늘 할 일, 딱 ${MAX_TASKS_CURRENT_MODE}개만 골라서 집중 완료! 🎯 (오늘셋 🤫) ${shareUrl} ${hashtags}`; }

    function setupShareAsImageListener() {
        const shareAsImageBtnEl = document.getElementById('share-as-image-btn');
        if (shareAsImageBtnEl && typeof html2canvas !== 'undefined') {
            shareAsImageBtnEl.addEventListener('click', () => {
                if (currentAppMode === 'simple') {
                    alert("이미지 공유는 집중 모드에서만 사용 가능합니다."); return;
                }
                const originalBtnText = shareAsImageBtnEl.innerHTML;
                shareAsImageBtnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
                shareAsImageBtnEl.disabled = true;
                const captureArea = document.createElement('div');
                captureArea.id = 'image-capture-area';
                captureArea.style.padding = '20px'; captureArea.style.width = '500px';
                const isDarkMode = document.body.classList.contains('dark-theme');
                captureArea.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--container-bg-color-dark' : '--container-bg-color-light').trim();
                captureArea.style.color = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--text-color-primary-dark' : '--text-color-primary-light').trim();
                captureArea.style.fontFamily = getComputedStyle(document.body).fontFamily;
                captureArea.style.lineHeight = getComputedStyle(document.body).lineHeight;
                const titleEl = document.createElement('h1'); titleEl.textContent = "오늘셋";
                titleEl.style.fontSize = '2em'; titleEl.style.fontWeight = '700'; titleEl.style.textAlign = 'center'; titleEl.style.marginBottom = '5px';
                captureArea.appendChild(titleEl);
                const currentDateElForCapture = document.getElementById('current-date');
                const dateEl = document.createElement('p');
                if(currentDateElForCapture) dateEl.textContent = currentDateElForCapture.textContent;
                dateEl.style.fontSize = '0.9em'; dateEl.style.textAlign = 'center'; dateEl.style.marginBottom = '15px';
                dateEl.style.color = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--text-color-tertiary-dark' : '--text-color-tertiary-light').trim();
                captureArea.appendChild(dateEl);
                const taskListWrapperOriginal = document.querySelector('.task-list-wrapper');
                const taskListDivForCapture = document.querySelector('.task-list');
                if (taskListWrapperOriginal && taskListDivForCapture) {
                    const taskListWrapperClone = taskListWrapperOriginal.cloneNode(true);
                    const clonedAllDoneMsg = taskListWrapperClone.querySelector('#all-done-message');
                    if (clonedAllDoneMsg && clonedAllDoneMsg.classList.contains('hidden')) clonedAllDoneMsg.remove();
                    const clonedTaskList = taskListWrapperClone.querySelector('.task-list');
                    if (clonedTaskList) {
                        const allClonedItems = Array.from(clonedTaskList.children);
                        allClonedItems.forEach((item, index) => {
                            if (index >= MAX_TASKS_CURRENT_MODE) item.remove();
                            else {
                                const originalTaskItem = taskListDivForCapture.children[index];
                                if (!originalTaskItem) return;
                                const memoIconClone = item.querySelector('.memo-icon');
                                const memoContainerClone = item.querySelector('.memo-container');
                                if (currentAppMode === 'focus' && shareOptions.includeMemos) {
                                    const originalMemoTextarea = originalTaskItem.querySelector('.memo-container textarea');
                                    if (memoContainerClone && originalMemoTextarea && originalMemoTextarea.value.trim() !== "") {
                                        memoContainerClone.classList.remove('hidden');
                                        const memoTextareaClone = memoContainerClone.querySelector('textarea');
                                        if (memoTextareaClone) {
                                            const memoDiv = document.createElement('div');
                                            memoDiv.textContent = originalMemoTextarea.value;
                                            memoDiv.style.whiteSpace = 'pre-wrap'; memoDiv.style.wordBreak = 'break-word';
                                            memoDiv.style.padding = getComputedStyle(memoTextareaClone).padding;
                                            memoContainerClone.replaceChild(memoDiv, memoTextareaClone);
                                        }
                                    } else {
                                        if (memoContainerClone) memoContainerClone.remove();
                                        if (memoIconClone) memoIconClone.remove();
                                    }
                                } else {
                                    if (memoContainerClone) memoContainerClone.remove();
                                    if (memoIconClone) memoIconClone.remove();
                                }
                            }
                        });
                    }
                    taskListWrapperClone.style.marginTop = '0'; captureArea.appendChild(taskListWrapperClone);
                }
                const additionalTaskListDivForCapture = document.getElementById('additional-task-list');
                if (currentAppMode === 'focus' && shareOptions.includeAdditional && additionalTasks.length > 0) {
                    const additionalTasksSectionOriginal = document.getElementById('additional-tasks-section');
                    if(additionalTasksSectionOriginal && additionalTaskListDivForCapture){
                        const additionalTasksSectionClone = document.createElement('section');
                        additionalTasksSectionClone.innerHTML = `<h2><i class="fas fa-stream"></i> 추가 과제</h2>`;
                        const clonedAdditionalList = document.createElement('div');
                        additionalTasks.forEach(task => {
                            const item = document.createElement('div'); item.style.padding = '5px 0';
                            item.style.borderBottom = '1px dashed var(--border-color)';
                            if (task.completed) item.style.textDecoration = 'line-through';
                            item.textContent = (task.completed ? '✅ ' : '◻️ ') + task.text;
                            clonedAdditionalList.appendChild(item);
                        });
                        if (clonedAdditionalList.lastChild) clonedAdditionalList.lastChild.style.borderBottom = 'none';
                        additionalTasksSectionClone.appendChild(clonedAdditionalList);
                        additionalTasksSectionClone.style.marginTop = '20px'; captureArea.appendChild(additionalTasksSectionClone);
                    }
                }
                const linkEl = document.createElement('p'); linkEl.textContent = 'todayset.vercel.app';
                linkEl.style.fontSize = '0.8em'; linkEl.style.textAlign = 'center'; linkEl.style.marginTop = '20px';
                linkEl.style.color = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--link-color-dark' : '--link-color-light').trim();
                captureArea.appendChild(linkEl);
                captureArea.style.position = 'absolute'; captureArea.style.left = '-9999px'; document.body.appendChild(captureArea);
                html2canvas(captureArea, { useCORS: true, scale: window.devicePixelRatio || 1, logging: false, onclone: (clonedDoc) => {
                    if (!taskListDivForCapture) return;
                    const clonedTaskTextareas = Array.from(clonedDoc.querySelectorAll('.task-list-wrapper .task-item textarea:not(.memo-container textarea)'));
                    const originalTaskTextareas = Array.from(taskListDivForCapture.querySelectorAll('.task-item textarea:not(.memo-container textarea)'));
                    clonedTaskTextareas.forEach((clonedTextarea, i) => {
                        if (originalTaskTextareas[i]) {
                            clonedTextarea.value = originalTaskTextareas[i].value;
                            clonedTextarea.style.height = "auto"; clonedTextarea.style.height = (clonedTextarea.scrollHeight) + "px";
                            clonedTextarea.style.overflowY = 'hidden';
                        }
                    });
                }}).then(canvas => {
                    const imageURL = canvas.toDataURL('image/png');
                    const downloadLink = document.createElement('a');
                    downloadLink.href = imageURL; downloadLink.download = `오늘셋_할일_${getTodayDateString()}.png`;
                    document.body.appendChild(downloadLink); downloadLink.click(); document.body.removeChild(downloadLink);
                    announceToScreenReader("할 일 목록 이미지가 다운로드되었습니다.");
                }).catch(err => { console.error('이미지 생성 실패:', err); alert('이미지 생성에 실패했습니다.');
                }).finally(() => {
                    if (document.body.contains(captureArea)) document.body.removeChild(captureArea);
                    shareAsImageBtnEl.innerHTML = originalBtnText; shareAsImageBtnEl.disabled = false;
                });
            });
        }
    }

    function setupOtherEventListeners() {
        const copyLinkBtnEl = document.getElementById('copy-link-btn');
        if(copyLinkBtnEl) copyLinkBtnEl.addEventListener('click', () => { navigator.clipboard.writeText(shareUrl).then(() => { const o = copyLinkBtnEl.innerHTML; copyLinkBtnEl.innerHTML = '<i class="fas fa-check"></i> 복사 완료!'; copyLinkBtnEl.classList.add('copy-success'); copyLinkBtnEl.disabled = true; setTimeout(() => { copyLinkBtnEl.innerHTML = o; copyLinkBtnEl.classList.remove('copy-success'); copyLinkBtnEl.disabled = false; }, 1500); announceToScreenReader("링크가 복사되었습니다."); }).catch(err => { console.error('링크 복사 실패:', err); alert('링크 복사에 실패했습니다.'); }); });
        const shareTwitterBtnEl = document.getElementById('share-twitter-btn');
        if(shareTwitterBtnEl) shareTwitterBtnEl.addEventListener('click', (e) => { e.preventDefault(); window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText())}`, '_blank'); });
        setupShareAsImageListener();
        const exportDataBtnEl = document.getElementById('export-data-btn');
        if (exportDataBtnEl) {
            exportDataBtnEl.addEventListener('click', () => {
                const currentThemeForExport = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
                const settingsToExport = { appMode: currentAppMode, theme: currentThemeForExport, focusTaskCount: focusModeTaskCountSetting, shareOptions: shareOptions };
                const dataToExport = { version: APP_VERSION_DATA_FORMAT, appSettings: settingsToExport, tasks: tasks, additionalTasks: additionalTasks, history: history, };
                const dataStr = JSON.stringify(dataToExport, null, 2);
                const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                const exportFileDefaultName = `오늘셋_백업_${getTodayDateString()}.json`;
                let linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri); linkElement.setAttribute('download', exportFileDefaultName);
                linkElement.click(); linkElement.remove();
                const o = exportDataBtnEl.innerHTML; exportDataBtnEl.innerHTML = '<i class="fas fa-check"></i> 내보내기 완료!';
                announceToScreenReader("로컬 데이터를 성공적으로 내보냈습니다.");
                setTimeout(() => { exportDataBtnEl.innerHTML = o; }, 2000);
            });
        }
        const importDataBtnEl = document.getElementById('import-data-btn');
        const importFileInputEl = document.getElementById('import-file-input');
        if (importDataBtnEl && importFileInputEl) {
            importDataBtnEl.addEventListener('click', () => importFileInputEl.click() );
            importFileInputEl.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const importedData = JSON.parse(e.target.result);
                            if (confirm("현재 로컬 데이터를 덮어쓰고 가져온 데이터로 복원하시겠습니까? (클라우드 데이터와는 별개)")) {
                                if (importedData.version !== APP_VERSION_DATA_FORMAT && !confirm(`데이터 형식 버전 불일치. 계속하시겠습니까? (가져온 버전: ${importedData.version || '알 수 없음'}, 현재 버전: ${APP_VERSION_DATA_FORMAT})`)) {
                                    importFileInputEl.value = ''; return;
                                }
                                const importedSettings = importedData.appSettings;
                                if (importedSettings) applySettingsToLocalAndUI(importedSettings, 'local_import');
                                tasks = importedData.tasks || [];
                                additionalTasks = importedData.additionalTasks || [];
                                history = importedData.history || [];
                                while (tasks.length < 5) { tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });}
                                if (tasks.length > 5) tasks = tasks.slice(0,5);
                                loadContentDataFromLocalStorage();
                                saveState('local'); // 가져온 데이터 로컬 저장 및 로그인 상태면 클라우드 저장
                                if (confirm("로컬 데이터 가져오기 성공. 새로고침하시겠습니까?")) window.location.reload();
                                else announceToScreenReader("로컬 데이터 가져오기 성공.");
                            }
                        } catch (err) { alert("데이터 가져오기 실패."); console.error("Import error:", err);
                        } finally { importFileInputEl.value = ''; }
                    };
                    reader.readAsText(file);
                }
            });
        }
        document.addEventListener('keydown', (e) => {
            const addAdditionalTaskInputEl = document.getElementById('add-additional-task-input');
            const additionalTasksSectionElForKey = document.getElementById('additional-tasks-section');
            if ((e.altKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
                if (currentAppMode === 'focus' && addAdditionalTaskInputEl && additionalTasksSectionElForKey && !additionalTasksSectionElForKey.classList.contains('hidden')) {
                    e.preventDefault(); addAdditionalTaskInputEl.focus();
                }
            }
            if (e.key === 'Escape') {
                const authModal = document.getElementById('auth-modal');
                if (authModal) { authModal.remove(); return; }
                if (currentAppMode === 'focus') {
                    const activeMemoContainer = document.querySelector('.memo-container:not(.hidden)');
                    if (activeMemoContainer) {
                        const taskItem = activeMemoContainer.closest('.task-item');
                        const memoIcon = taskItem?.querySelector('.memo-icon');
                        memoIcon?.click();
                    }
                }
                let sectionClosed = false;
                getSectionsArray().forEach(sec => {
                    const sectionElement = document.getElementById(sec.id);
                    if (sectionElement && !sectionElement.classList.contains('hidden')) {
                        toggleSection(sec.id); sectionClosed = true;
                    }
                });
                if (sectionClosed) announceToScreenReader("열린 섹션이 닫혔습니다.");
                if (document.activeElement === addAdditionalTaskInputEl) addAdditionalTaskInputEl.blur();
            }
        });
    }

    // --- 초기화 실행 ---
    async function initializeApp() {
        console.log("Initializing app (v1.15.0 - Firestore Sync)...");
        if (!document.getElementById('current-date') || !document.querySelector('.task-list') || !document.getElementById('auth-status')) {
            document.body.innerHTML = '<div style="text-align:center;padding:20px;">앱 로딩 오류. (DOM_MISSING)</div>'; return;
        }
        displayCurrentDate();
        currentTheme = localStorage.getItem('oneulSetTheme') || 'dark';
        currentAppMode = localStorage.getItem('oneulSetMode') || 'simple';
        focusModeTaskCountSetting = parseInt(localStorage.getItem('oneulSetFocusTaskCountSetting') || '3', 10);
        try { shareOptions = JSON.parse(localStorage.getItem('oneulSetShareOptions')) || { includeAdditional: false, includeMemos: false };
        } catch(e) { shareOptions = { includeAdditional: false, includeMemos: false }; }

        applySettingsToLocalAndUI({
            appMode: currentAppMode, theme: currentTheme,
            focusTaskCount: focusModeTaskCountSetting, shareOptions: shareOptions
        }, 'local_init');
        loadContentDataFromLocalStorage(); // 초기 로컬 데이터 로드

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
                    isInitialFirestoreLoadComplete = false; // Firestore 초기 로드 시작
                    try {
                        // 1. 설정 로드 및 동기화 (설정 리스너는 여기서 시작)
                        const firestoreSettings = await loadAppSettingsFromFirestore(user.uid);
                        if (firestoreSettings) applySettingsToLocalAndUI(firestoreSettings, 'firestore');
                        else await saveAppSettingsToFirestore(); // Firestore에 설정 없으면 로컬 설정 저장
                        listenToAppSettingsChanges(user.uid); // 설정 리스너 시작

                        // 2. 콘텐츠 데이터 로드 및 초기 동기화 (각 데이터 리스너는 여기서 시작)
                        const firestoreContentLoaded = await loadContentDataFromFirestore(user.uid);
                        if (!firestoreContentLoaded) {
                            // Firestore에 콘텐츠 데이터가 없으면, 로컬 데이터를 Firestore에 업로드
                            console.log("No content in Firestore, uploading local data if any.");
                            await saveTasksToFirestore();
                            await saveAdditionalTasksToFirestore();
                            await saveHistoryToFirestore();
                        }
                        // 각 데이터에 대한 실시간 리스너 시작
                        listenToTasksChanges(user.uid);
                        listenToAdditionalTasksChanges(user.uid);
                        listenToHistoryChanges(user.uid);

                        const cloudStatus = document.getElementById('cloud-sync-status');
                        if(cloudStatus) cloudStatus.textContent = `로그인 됨. 클라우드 동기화 활성.`;
                    } catch (error) {
                         console.error("Error during post-login Firestore operations:", error);
                         const cloudStatus = document.getElementById('cloud-sync-status');
                         if(cloudStatus) cloudStatus.textContent = `클라우드 데이터 처리 오류.`;
                         loadContentDataFromLocalStorage(); // 오류 시 로컬 데이터로 UI 복원
                    } finally {
                        isInitialFirestoreLoadComplete = true; // Firestore 초기 로드 완료
                    }
                } else { // 로그아웃
                    // 모든 리스너 해제 (상단 signOutUser 함수에서 이미 처리)
                    currentUser = null;
                    isInitialFirestoreLoadComplete = false; // 로그아웃 시 초기 로드 상태 해제
                    // 로컬 저장소에서 설정 및 콘텐츠를 다시 로드하여 UI 업데이트
                    const localSettings = {
                        appMode: localStorage.getItem('oneulSetMode') || 'simple',
                        theme: localStorage.getItem('oneulSetTheme') || 'dark',
                        focusTaskCount: parseInt(localStorage.getItem('oneulSetFocusTaskCountSetting') || '3', 10),
                        shareOptions: JSON.parse(localStorage.getItem('oneulSetShareOptions') || '{"includeAdditional":false,"includeMemos":false}')
                    };
                    applySettingsToLocalAndUI(localSettings, 'local_logout');
                    loadContentDataFromLocalStorage();
                    const cloudStatus = document.getElementById('cloud-sync-status');
                    if(cloudStatus) cloudStatus.textContent = '로그인하여 데이터를 클라우드에 동기화하세요.';
                    announceToScreenReader("로그아웃 되었습니다.");
                }
            });
        } else {
            console.warn("initializeApp: Firebase Auth is not available. Running local-only.");
            updateAuthUI(null); loadContentDataFromLocalStorage();
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
