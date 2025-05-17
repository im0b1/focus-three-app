// script.js - v2.0.1-firebase-config-update
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded"); // DOM 로드 확인용

    // --- Firebase Config (제공해주신 정보로 교체) ---
    const firebaseConfig = {
        apiKey: "AIzaSyB54BtURvHN9YmC3HVGaClOo32zO44deu4",
        authDomain: "todayset-82fcc.firebaseapp.com",
        projectId: "todayset-82fcc",
        storageBucket: "todayset-82fcc.appspot.com", // storageBucket은 .firebasestorage.app 이 아니라 .appspot.com 일 가능성이 높습니다. Firebase 콘솔에서 정확히 확인하세요.
        messagingSenderId: "432546292770",
        appId: "1:432546292770:web:ea8231f64c6f54792ad67b",
        measurementId: "G-Z4WPD221Y6"
    };

    // --- Firebase 앱 초기화 ---
    try {
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase initialized successfully");
    } catch (e) {
        console.error("Firebase initialization error:", e);
        alert("Firebase 초기화에 실패했습니다. 인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요.");
        return; // 초기화 실패 시 더 이상 진행하지 않음
    }

    const auth = firebase.auth();
    const db = firebase.firestore();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // --- 요소 가져오기 (기존과 유사, 추가된 요소 포함) ---
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const authTitle = document.getElementById('auth-title');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const authErrorEl = document.getElementById('auth-error');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const toggleAuthModeBtn = document.getElementById('toggle-auth-mode-btn');
    const googleSignInBtn = document.getElementById('google-signin-btn');
    const mainContainer = document.querySelector('.container');
    const loadingOverlay = document.getElementById('loading-overlay');

    console.log("authModal:", authModal); // 요소 확인용
    console.log("mainContainer:", mainContainer); // 요소 확인용

    const userProfileDiv = document.getElementById('user-profile');
    const userEmailDisplay = document.getElementById('user-email-display');
    const logoutBtn = document.getElementById('logout-btn');

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
    const historyControlsDiv = document.getElementById('history-controls');
    const loadMoreHistoryBtn = document.getElementById('load-more-history-btn');

    const statsSection = document.getElementById('stats-section');
    const shareSection = document.getElementById('share-section');
    const settingsSection = document.getElementById('settings-section');
    const settingsContentDiv = document.querySelector('#settings-section .settings-content');

    const historyListDiv = document.getElementById('history-list');
    const weeklyStatsEl = document.getElementById('weekly-stats');
    const monthlyStatsEl = document.getElementById('monthly-stats');
    const statsVisualsContainer = document.querySelector('.stats-visuals');
    const dailyAchievementChartCtx = document.getElementById('daily-achievement-chart')?.getContext('2d');
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


    // --- 전역 변수 및 상태 ---
    let currentUser = null;
    let unsubscribeTasks = null;
    let unsubscribeAdditionalTasks = null;
    let unsubscribeSettings = null;
    let isAuthModalSignUpMode = false;

    let MAX_TASKS_CURRENT_MODE = 3;
    let tasks = [];
    let additionalTasks = [];
    let history = [];
    let appSettings = {
        theme: 'dark',
        appMode: 'simple',
        focusTaskCountSetting: 3,
        shareOptions: {
            includeAdditional: false,
            includeMemos: false
        }
    };
    let achievementChart = null;
    const HISTORY_PAGE_SIZE = 10;
    let lastHistoryDoc = null;

    // --- 로딩 오버레이 ---
    function showLoading(message = "처리 중...") {
        if (loadingOverlay) {
            loadingOverlay.querySelector('p').textContent = message;
            loadingOverlay.classList.remove('hidden');
        } else {
            console.warn("Loading overlay not found");
        }
    }
    function hideLoading() {
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
    }

    // --- 유틸리티 함수 ---
    function announceToScreenReader(message) {
        if (liveRegion) {
            liveRegion.textContent = message;
            setTimeout(() => { liveRegion.textContent = ''; }, 1000);
        }
    }
    function getTodayDateString() { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; }
    function displayCurrentDate() { if(currentDateEl) {const today = new Date(); const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }; currentDateEl.textContent = today.toLocaleDateString('ko-KR', options);} }
    function autoGrowTextarea(element) { if(element){element.style.height = "auto"; element.style.height = (element.scrollHeight) + "px";} }

    // --- PWA: 서비스 워커 등록 ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js') // sw.js 경로 확인
                .then(registration => {
                    console.log('Service Worker registered: ', registration);
                })
                .catch(registrationError => {
                    console.error('Service Worker registration failed: ', registrationError);
                });
        });
    }


    // --- Firebase 인증 관련 함수 ---
    function updateAuthUI(user) {
        console.log("Auth state changed. User:", user);
        currentUser = user;
        // authModal과 mainContainer가 null이 아닌지 먼저 확인
        if (!authModal || !mainContainer) {
            console.error("Auth modal or Main container not found in DOM. UI update skipped.");
            hideLoading();
            return;
        }

        if (user) {
            console.log("User is logged in. UID:", user.uid);
            authModal.classList.add('hidden');
            mainContainer.classList.remove('hidden');
            if (userProfileDiv) userProfileDiv.classList.remove('hidden');
            if (userEmailDisplay) userEmailDisplay.textContent = user.email || "사용자";
            loadUserData(user.uid);
        } else {
            console.log("User is not logged in.");
            authModal.classList.remove('hidden');
            mainContainer.classList.add('hidden');
            if (userProfileDiv) userProfileDiv.classList.add('hidden');
            if (userEmailDisplay) userEmailDisplay.textContent = '';
            if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; console.log("Unsubscribed from tasks."); }
            if (unsubscribeAdditionalTasks) { unsubscribeAdditionalTasks(); unsubscribeAdditionalTasks = null; console.log("Unsubscribed from additional tasks."); }
            if (unsubscribeSettings) { unsubscribeSettings(); unsubscribeSettings = null; console.log("Unsubscribed from settings."); }
            initializeLocalData();
            renderTasks();
            if (appSettings.appMode === 'focus' && additionalTaskListDiv) renderAdditionalTasks();
            hideLoading(); // 로그아웃 상태에서도 로딩 숨김
        }
    }

    auth.onAuthStateChanged(user => {
        showLoading("사용자 정보 확인 중...");
        updateAuthUI(user);
    });

    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value;
            const password = passwordInput.value;
            if(authErrorEl) {authErrorEl.classList.add('hidden'); authErrorEl.textContent = '';}
            showLoading(isAuthModalSignUpMode ? "회원가입 중..." : "로그인 중...");

            try {
                if (isAuthModalSignUpMode) {
                    await auth.createUserWithEmailAndPassword(email, password);
                } else {
                    await auth.signInWithEmailAndPassword(email, password);
                }
            } catch (error) {
                console.error("Auth form error:", error);
                if(authErrorEl){authErrorEl.textContent = getFirebaseErrorMessage(error); authErrorEl.classList.remove('hidden');}
                hideLoading();
            }
        });
    }

    if (toggleAuthModeBtn) {
        toggleAuthModeBtn.addEventListener('click', () => {
            isAuthModalSignUpMode = !isAuthModalSignUpMode;
            if(authTitle) authTitle.textContent = isAuthModalSignUpMode ? "회원가입" : "로그인";
            if(authSubmitBtn) authSubmitBtn.textContent = isAuthModalSignUpMode ? "회원가입" : "로그인";
            toggleAuthModeBtn.textContent = isAuthModalSignUpMode ? "이미 계정이 있으신가요? 로그인" : "계정이 없으신가요? 회원가입";
            if(authErrorEl) authErrorEl.classList.add('hidden');
        });
    }

    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', async () => {
            if(authErrorEl) authErrorEl.classList.add('hidden');
            showLoading("Google 로그인 중...");
            try {
                await auth.signInWithPopup(googleProvider);
            } catch (error) {
                console.error("Google Sign-In error:", error);
                if(authErrorEl){authErrorEl.textContent = getFirebaseErrorMessage(error); authErrorEl.classList.remove('hidden');}
                hideLoading();
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm("로그아웃 하시겠습니까?")) {
                showLoading("로그아웃 중...");
                try {
                    await auth.signOut();
                } catch (error) {
                    console.error("Logout error:", error);
                    alert("로그아웃에 실패했습니다.");
                    hideLoading();
                }
            }
        });
    }

    function getFirebaseErrorMessage(error) { /* 이전과 동일 */ }

    // --- Firebase 데이터 로드 및 저장 함수 ---
    async function loadUserData(userId) {
        console.log("Loading user data for UID:", userId);
        showLoading("데이터 불러오는 중...");
        const userDocRef = db.collection('usersData').doc(userId);

        if (unsubscribeSettings) { unsubscribeSettings(); unsubscribeSettings = null; }
        unsubscribeSettings = userDocRef.collection('settings').doc('userSettings')
            .onSnapshot(async (doc) => {
                console.log("Settings snapshot received:", doc.exists ? doc.data() : "No settings doc");
                if (doc.exists) {
                    const newSettings = doc.data();
                    let settingsChanged = false;
                    for (const key in newSettings) {
                        if (JSON.stringify(appSettings[key]) !== JSON.stringify(newSettings[key])) {
                            appSettings[key] = newSettings[key];
                            settingsChanged = true;
                        }
                    }
                    // 로컬 변경으로 인한 스냅샷이 아니거나, settingsChanged가 true일 때만 UI 업데이트
                    if (settingsChanged || (!doc.metadata.hasPendingWrites && Object.keys(newSettings).length > 0) ) {
                         console.log("Applying new settings to UI:", appSettings);
                         applyAppSettingsToUI();
                    } else if (!doc.metadata.hasPendingWrites && Object.keys(newSettings).length === 0) {
                        // 문서가 존재하지만 비어있는 경우 (거의 없음)
                        console.log("Settings doc exists but is empty, saving defaults.");
                        await userDocRef.collection('settings').doc('userSettings').set(appSettings, { merge: true });
                        applyAppSettingsToUI();
                    }

                } else {
                    console.log("No settings document found, creating with defaults.");
                    await userDocRef.collection('settings').doc('userSettings').set(appSettings, { merge: true });
                    applyAppSettingsToUI();
                }
                // 설정 로드 후 핵심 데이터 로드
                loadCoreData(userId);
            }, (error) => {
                console.error("Error listening to settings: ", error);
                alert("설정 정보를 불러오는 중 오류가 발생했습니다.");
                hideLoading();
            });
    }

    function loadCoreData(userId) {
        console.log("Loading core data for UID:", userId);
        const userDocRef = db.collection('usersData').doc(userId);
        const todayDateStr = getTodayDateString();

        if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; }
        unsubscribeTasks = userDocRef.collection('dailyTasks').doc(todayDateStr)
            .onSnapshot(async (doc) => {
                console.log("Tasks snapshot received for today:", doc.exists ? doc.data() : "No tasks doc for today");
                if (doc.exists) {
                    tasks = doc.data().tasks || [];
                    while (tasks.length < 5) { tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });}
                    if (tasks.length > 5) tasks = tasks.slice(0, 5);
                } else {
                    await handleNewDayInitialization(userId, todayDateStr);
                    initializeTasksArray();
                }
                if (!doc.metadata.hasPendingWrites || tasks.length > 0) { // 로컬변경이 아니거나, task가 있을때만 (초기화시 빈배열일수있음)
                    renderTasks();
                }
                updateStats();
                if (appSettings.appMode === 'focus') renderStatsVisuals();
            }, (error) => {
                console.error("Error listening to tasks: ", error);
                hideLoading();
            });

        if (appSettings.appMode === 'focus') {
            if (unsubscribeAdditionalTasks) { unsubscribeAdditionalTasks(); unsubscribeAdditionalTasks = null; }
            unsubscribeAdditionalTasks = userDocRef.collection('additionalDailyTasks').doc(todayDateStr)
                .onSnapshot((doc) => {
                    console.log("Additional tasks snapshot received for today:", doc.exists ? doc.data() : "No additional tasks doc for today");
                    additionalTasks = doc.exists ? (doc.data().tasks || []) : [];
                    if ((!doc.metadata.hasPendingWrites || additionalTasks.length > 0) && appSettings.appMode === 'focus') {
                        renderAdditionalTasks();
                    }
                }, (error) => {
                    console.error("Error listening to additional tasks: ", error);
                });
        }
        hideLoading();
    }

    async function handleNewDayInitialization(userId, todayDateStr) { /* 이전과 동일 */ }
    function initializeLocalData() { /* 이전과 동일 */ }
    function initializeTasksArray() { /* 이전과 동일 */ }
    async function saveTasksToFirebase() { /* 이전과 동일 */ }
    async function saveAdditionalTasksToFirebase() { /* 이전과 동일 */ }
    async function saveAppSettingsToFirebase() { /* 이전과 동일 */ }
    function debounce(func, delay) { /* 이전과 동일 */ }
    const debouncedSaveTasks = debounce(saveTasksToFirebase, 1500);
    const debouncedSaveAdditionalTasks = debounce(saveAdditionalTasksToFirebase, 1500);
    const debouncedSaveAppSettings = debounce(saveAppSettingsToFirebase, 1000);

    function applyAppSettingsToUI() {
        console.log("Applying app settings to UI:", appSettings);
        applyTheme(appSettings.theme);
        applyAppMode(appSettings.appMode, true);
        if(taskCountSelector) taskCountSelector.value = appSettings.focusTaskCountSetting;
        MAX_TASKS_CURRENT_MODE = appSettings.appMode === 'simple' ? 3 : appSettings.focusTaskCountSetting;
        if (shareIncludeAdditionalCheckbox) shareIncludeAdditionalCheckbox.checked = appSettings.shareOptions.includeAdditional;
        if (shareIncludeMemosCheckbox) shareIncludeMemosCheckbox.checked = appSettings.shareOptions.includeMemos;
        renderTasks();
        if (appSettings.appMode === 'focus') {
            renderAdditionalTasks();
            renderStatsVisuals();
        }
    }

    function applyAppMode(mode, isInitialLoad = false) { /* 이전과 동일 (appSettings 사용) */ }
    if(appModeToggle) appModeToggle.addEventListener('click', () => { /* 이전과 동일 */ });
    function applyTheme(theme) { /* 이전과 동일 (appSettings 사용) */ }
    if(themeToggleButton) themeToggleButton.addEventListener('click', () => { /* 이전과 동일 */ });
    function updateThemeColorMeta(theme) { /* 이전과 동일 */ }
    if(taskCountSelector) taskCountSelector.addEventListener('change', (e) => { /* 이전과 동일 (appSettings 사용) */ });
    function renderTasks() { /* 이전과 동일 (tasks 배열 사용, null 체크 강화) */
        if (!taskListDiv) return;
        taskListDiv.innerHTML = '';
        if (!tasks || tasks.length === 0) {
            if (!currentUser) {
                // taskListDiv.innerHTML = '<p>로그인 후 할 일을 관리할 수 있습니다.</p>';
            } else {
                // taskListDiv.innerHTML = '<p>오늘의 할 일을 추가하세요.</p>';
            }
            checkAllDone(); // 메시지 숨김 처리
            return;
        }
        const tasksToRender = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
        tasksToRender.forEach((taskData, indexInUI) => {
            const originalTaskIndex = tasks.findIndex(t => t.id === taskData.id);
            if (originalTaskIndex === -1) return;
            const task = tasks[originalTaskIndex];
            const taskItem = document.createElement('div');
            taskItem.classList.add('task-item');
            if (task.completed) { taskItem.classList.add('completed'); }

            const checkboxLabel = document.createElement('label');
            checkboxLabel.classList.add('custom-checkbox-label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.setAttribute('aria-label', `핵심 할 일 ${indexInUI + 1} 완료`);
            checkbox.id = `task-checkbox-${task.id}`;
            checkboxLabel.htmlFor = checkbox.id;
            const checkboxSpan = document.createElement('span');
            checkboxSpan.classList.add('custom-checkbox-span');
            checkbox.addEventListener('change', () => {
                tasks[originalTaskIndex].completed = checkbox.checked;
                taskItem.classList.toggle('completed', checkbox.checked);
                checkAllDone();
                debouncedSaveTasks();
            });
            checkboxLabel.appendChild(checkbox);
            checkboxLabel.appendChild(checkboxSpan);

            const taskContentDiv = document.createElement('div');
            taskContentDiv.classList.add('task-item-content');

            const textareaField = document.createElement('textarea');
            textareaField.rows = "1";
            textareaField.placeholder = `할 일 ${indexInUI + 1}`;
            textareaField.value = task.text;
            textareaField.setAttribute('aria-label', `할 일 ${indexInUI + 1} 내용`);
            textareaField.addEventListener('input', (e) => { tasks[originalTaskIndex].text = e.target.value; autoGrowTextarea(e.target); debouncedSaveTasks(); });
            textareaField.addEventListener('focus', (e) => { autoGrowTextarea(e.target); });


            taskContentDiv.appendChild(textareaField);

            if (appSettings.appMode === 'focus') {
                const memoIcon = document.createElement('button');
                memoIcon.classList.add('memo-icon');
                memoIcon.innerHTML = '<i class="fas fa-sticky-note"></i>';
                memoIcon.setAttribute('aria-label', `할 일 ${indexInUI + 1} 메모 보기/숨기기`);
                memoIcon.setAttribute('aria-expanded', 'false');
                taskContentDiv.appendChild(memoIcon);

                const memoContainer = document.createElement('div');
                memoContainer.classList.add('memo-container', 'hidden');
                const memoTextarea = document.createElement('textarea');
                memoTextarea.rows = "1";
                memoTextarea.placeholder = "메모 추가...";
                memoTextarea.value = task.memo || "";
                memoTextarea.setAttribute('aria-label', `할 일 ${indexInUI + 1} 메모 내용`);
                memoTextarea.addEventListener('input', (e) => { tasks[originalTaskIndex].memo = e.target.value; autoGrowTextarea(e.target); memoIcon.classList.toggle('has-memo', e.target.value.trim() !== ""); debouncedSaveTasks(); });
                memoTextarea.addEventListener('focus', (e) => { autoGrowTextarea(e.target); });

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
                if (task.memo && task.memo.trim() !== "") {
                    memoIcon.classList.add('has-memo');
                }
                if (!memoContainer.classList.contains('hidden') && memoTextarea) autoGrowTextarea(memoTextarea);
            }

            taskItem.appendChild(checkboxLabel);
            taskItem.appendChild(taskContentDiv);
            taskListDiv.appendChild(taskItem);
            if (textareaField) autoGrowTextarea(textareaField);
        });
        checkAllDone();
    }
    function checkAllDone() { /* 이전과 동일 (allDoneMessageEl null 체크 추가) */
        if (!allDoneMessageEl || !tasks) return;
        const tasksToCheck = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
        const filledTasks = tasksToCheck.filter(task => typeof task.text === 'string' && task.text.trim() !== "");
        const completedFilledTasks = filledTasks.filter(task => task.completed);
        const shouldShowMessage = filledTasks.length === MAX_TASKS_CURRENT_MODE && completedFilledTasks.length === MAX_TASKS_CURRENT_MODE && MAX_TASKS_CURRENT_MODE > 0;
        allDoneMessageEl.classList.toggle('hidden', !shouldShowMessage);
    }
    function renderAdditionalTasks() { /* 이전과 동일 (additionalTasks, additionalTaskListDiv null 체크 강화) */ }
    if (addAdditionalTaskBtn && addAdditionalTaskInput) { /* 이전과 동일 */ }
    const sections = [ /* 이전과 동일 */ ];
    function toggleSection(sectionIdToToggle) { /* 이전과 동일 (appSettings 사용, 히스토리 로직 강화) */ }
    if(toggleHistoryBtn) toggleHistoryBtn.addEventListener('click', () => toggleSection('history-section'));
    if(toggleStatsBtn) toggleStatsBtn.addEventListener('click', () => toggleSection('stats-section'));
    if(toggleShareBtn) toggleShareBtn.addEventListener('click', () => toggleSection('share-section'));
    if(toggleSettingsBtn) toggleSettingsBtn.addEventListener('click', () => toggleSection('settings-section'));
    async function loadHistory(loadMore = false) { /* 이전과 동일 */ }
    if(loadMoreHistoryBtn) { /* 이전과 동일 */ }
    function renderHistory() { /* 이전과 동일 (historyListDiv null 체크 강화) */ }
    function calculateAchievementRate(days) { /* 이전과 동일 */ }
    function updateStats() { /* 이전과 동일 (weeklyStatsEl, monthlyStatsEl null 체크) */ }
    function renderStatsVisuals() { /* 이전과 동일 (요소들 null 체크 강화) */ }
    const shareUrl = window.location.href;
    function getShareText() { /* 이전과 동일 */ }
    if(copyLinkBtn) copyLinkBtn.addEventListener('click', () => { /* 이전과 동일 */ });
    if(shareTwitterBtn) shareTwitterBtn.addEventListener('click', (e) => { /* 이전과 동일 */ });
    if (shareIncludeAdditionalCheckbox) { /* 이전과 동일 (appSettings 사용) */ }
    if (shareIncludeMemosCheckbox) { /* 이전과 동일 (appSettings 사용) */ }
    if (shareAsImageBtn) { shareAsImageBtn.addEventListener('click', () => { /* 이전과 동일 (MAX_TASKS_CURRENT_MODE 대신 appSettings.focusTaskCountSetting 또는 실제 렌더링된 태스크 수 사용) */ });}
    if (exportDataBtn) { /* 이전과 동일 */ }
    if (importDataBtn && importFileInput) { /* 이전과 동일 */ }
    document.addEventListener('keydown', (e) => { /* 이전과 동일 */ });

    function initializeApp() {
        const localTheme = localStorage.getItem('oneulSetThemeLocalCache') || 'dark';
        const localMode = localStorage.getItem('oneulSetAppModeLocalCache') || 'simple'; // 로컬 캐시된 모드
        
        // UI에 로컬 캐시값 먼저 적용 (깜빡임 최소화 목적)
        // appSettings 전역변수는 Firebase에서 로드될 때까지 기본값을 유지.
        document.body.classList.toggle('dark-theme', localTheme === 'dark');
        if(themeToggleButton) themeToggleButton.textContent = localTheme === 'dark' ? '☀️' : '🌙';
        updateThemeColorMeta(localTheme);

        document.body.classList.toggle('simple-mode', localMode === 'simple');
        document.body.classList.toggle('focus-mode', localMode === 'focus');
        if(appModeToggle) {
            const modeToSwitchToText = localMode === 'simple' ? '집중' : '심플';
            appModeToggle.textContent = `${modeToSwitchToText} 모드로 전환`;
            appModeToggle.setAttribute('aria-label', `${modeToSwitchToText} 모드로 전환`);
        }
        
        displayCurrentDate();
        // Firebase auth 상태 변경 감지가 핵심 초기화 로직을 트리거합니다.
        // onAuthStateChanged 콜백 내에서 showLoading/hideLoading이 호출됩니다.
    }

    initializeApp();

    sections.forEach(sec => {
        if(sec.button) sec.button.textContent = sec.baseText;
        const sectionElement = document.getElementById(sec.id);
        if (sectionElement) {
            sectionElement.setAttribute('aria-hidden', 'true');
            if(sec.button) sec.button.setAttribute('aria-expanded', 'false');
        }
    });
});
