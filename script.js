// script.js - v2.0.2-robust-initialization-and-listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded - Script execution started.");

    // --- Firebase Config ---
    const firebaseConfig = {
        apiKey: "AIzaSyB54BtURvHN9YmC3HVGaClOo32zO44deu4",
        authDomain: "todayset-82fcc.firebaseapp.com",
        projectId: "todayset-82fcc",
        storageBucket: "todayset-82fcc.appspot.com", // Firebase 콘솔에서 정확한 값 확인 필수
        messagingSenderId: "432546292770",
        appId: "1:432546292770:web:ea8231f64c6f54792ad67b",
        measurementId: "G-Z4WPD221Y6"
    };

    // --- 전역 요소 참조 (초기화 시점에 할당) ---
    let authModal, authForm, authTitle, emailInput, passwordInput, authErrorEl, authSubmitBtn,
        toggleAuthModeBtn, googleSignInBtn, mainContainer, loadingOverlay, userProfileDiv,
        userEmailDisplay, logoutBtn, appModeToggle, taskListDiv, currentDateEl, allDoneMessageEl,
        themeToggleButton, taskCountSelectorContainer, taskCountSelector, liveRegion,
        additionalTasksSection, additionalTaskListDiv, addAdditionalTaskInput, addAdditionalTaskBtn,
        toggleHistoryBtn, toggleStatsBtn, toggleShareBtn, toggleSettingsBtn, historySection,
        historyControlsDiv, loadMoreHistoryBtn, statsSection, shareSection, settingsSection,
        settingsContentDiv, historyListDiv, weeklyStatsEl, monthlyStatsEl, statsVisualsContainer,
        dailyAchievementChartCtx, streakDaysEl, mostAchievedDayEl, copyLinkBtn, shareTwitterBtn,
        shareAsImageBtn, shareAsImageBtnContainer, shareOptionsDiv, shareIncludeAdditionalCheckbox,
        shareIncludeMemosCheckbox, shareIncludeMemosLabel, exportDataBtn, importDataBtn, importFileInput;

    // --- Firebase 서비스 참조 (초기화 시점에 할당) ---
    let auth, db, googleProvider;

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
        shareOptions: { includeAdditional: false, includeMemos: false }
    };
    let achievementChart = null;
    const HISTORY_PAGE_SIZE = 10;
    let lastHistoryDoc = null;
    let initialDataLoaded = false; // 초기 데이터 로드 완료 플래그

    function initializeDOMReferences() {
        console.log("Initializing DOM references...");
        authModal = document.getElementById('auth-modal');
        authForm = document.getElementById('auth-form');
        authTitle = document.getElementById('auth-title');
        emailInput = document.getElementById('email');
        passwordInput = document.getElementById('password');
        authErrorEl = document.getElementById('auth-error');
        authSubmitBtn = document.getElementById('auth-submit-btn');
        toggleAuthModeBtn = document.getElementById('toggle-auth-mode-btn');
        googleSignInBtn = document.getElementById('google-signin-btn');
        mainContainer = document.querySelector('.container');
        loadingOverlay = document.getElementById('loading-overlay');
        userProfileDiv = document.getElementById('user-profile');
        userEmailDisplay = document.getElementById('user-email-display');
        logoutBtn = document.getElementById('logout-btn');
        appModeToggle = document.getElementById('app-mode-toggle');
        taskListDiv = document.querySelector('.task-list');
        currentDateEl = document.getElementById('current-date');
        allDoneMessageEl = document.getElementById('all-done-message');
        themeToggleButton = document.getElementById('theme-toggle');
        taskCountSelectorContainer = document.querySelector('.task-count-setting');
        taskCountSelector = document.getElementById('task-count-selector');
        liveRegion = document.getElementById('live-region');
        additionalTasksSection = document.getElementById('additional-tasks-section');
        additionalTaskListDiv = document.getElementById('additional-task-list');
        addAdditionalTaskInput = document.getElementById('add-additional-task-input');
        addAdditionalTaskBtn = document.getElementById('add-additional-task-btn');
        toggleHistoryBtn = document.getElementById('toggle-history-btn');
        toggleStatsBtn = document.getElementById('toggle-stats-btn');
        toggleShareBtn = document.getElementById('toggle-share-btn');
        toggleSettingsBtn = document.getElementById('toggle-settings-btn');
        historySection = document.getElementById('history-section');
        historyControlsDiv = document.getElementById('history-controls');
        loadMoreHistoryBtn = document.getElementById('load-more-history-btn');
        statsSection = document.getElementById('stats-section');
        shareSection = document.getElementById('share-section');
        settingsSection = document.getElementById('settings-section');
        settingsContentDiv = document.querySelector('#settings-section .settings-content');
        historyListDiv = document.getElementById('history-list');
        weeklyStatsEl = document.getElementById('weekly-stats');
        monthlyStatsEl = document.getElementById('monthly-stats');
        statsVisualsContainer = document.querySelector('.stats-visuals');
        const chartCanvas = document.getElementById('daily-achievement-chart');
        if (chartCanvas) dailyAchievementChartCtx = chartCanvas.getContext('2d');
        streakDaysEl = document.getElementById('streak-days');
        mostAchievedDayEl = document.getElementById('most-achieved-day');
        copyLinkBtn = document.getElementById('copy-link-btn');
        shareTwitterBtn = document.getElementById('share-twitter-btn');
        shareAsImageBtn = document.getElementById('share-as-image-btn');
        shareAsImageBtnContainer = document.getElementById('share-as-image-btn-container');
        shareOptionsDiv = document.querySelector('#share-section .share-options');
        shareIncludeAdditionalCheckbox = document.getElementById('share-include-additional');
        shareIncludeMemosCheckbox = document.getElementById('share-include-memos');
        shareIncludeMemosLabel = document.getElementById('share-include-memos-label');
        exportDataBtn = document.getElementById('export-data-btn');
        importDataBtn = document.getElementById('import-data-btn');
        importFileInput = document.getElementById('import-file-input');

        if (!authModal || !mainContainer) {
            console.error("CRITICAL: AuthModal or MainContainer not found in DOM during initialization.");
            // 사용자에게 심각한 오류임을 알리는 UI 처리 (예: body에 오류 메시지 직접 삽입)
            document.body.innerHTML = "<p style='color:red; text-align:center; padding-top: 50px;'>앱 초기화 중 심각한 오류가 발생했습니다. 페이지를 새로고침하거나 관리자에게 문의하세요.</p>";
        }
    }

    function initializeFirebase() {
        console.log("Initializing Firebase...");
        try {
            if (typeof firebase === 'undefined') {
                throw new Error("Firebase SDK not loaded.");
            }
            firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.firestore();
            googleProvider = new firebase.auth.GoogleAuthProvider();
            console.log("Firebase initialized successfully.");
            return true;
        } catch (e) {
            console.error("Firebase initialization error:", e);
            if (loadingOverlay) hideLoading(); // 로딩 중이었다면 숨김
            // 사용자에게 더 명확한 오류 메시지 표시
            const errorMsgContainer = authModal || document.body; // authModal이 있으면 거기에, 없으면 body에
            const errorP = document.createElement('p');
            errorP.style.color = 'red';
            errorP.style.textAlign = 'center';
            errorP.style.padding = '10px';
            errorP.textContent = "앱 서비스 연결에 실패했습니다. 인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요. 문제가 지속되면 관리자에게 문의하세요.";
            if(errorMsgContainer.firstChild) errorMsgContainer.insertBefore(errorP, errorMsgContainer.firstChild);
            else errorMsgContainer.appendChild(errorP);
            return false;
        }
    }

    function showLoading(message = "처리 중...") { /* 이전과 동일 (null 체크 포함) */ }
    function hideLoading() { /* 이전과 동일 (null 체크 포함) */ }
    function announceToScreenReader(message) { /* 이전과 동일 (null 체크 포함) */ }
    function getTodayDateString() { /* 이전과 동일 */ }
    function displayCurrentDate() { /* 이전과 동일 (null 체크 포함) */ }
    function autoGrowTextarea(element) { /* 이전과 동일 (null 체크 포함) */ }

    if ('serviceWorker' in navigator) { /* 이전과 동일 (경로 확인 주석) */ }

    function updateAuthUI(user) {
        console.log("updateAuthUI called. User:", user ? user.uid : "null");
        currentUser = user;
        initialDataLoaded = false; // 사용자 변경 시 초기 데이터 로드 플래그 리셋

        if (!authModal || !mainContainer) {
            console.error("AuthModal or MainContainer is null in updateAuthUI. Cannot update UI.");
            hideLoading();
            return;
        }

        if (user) {
            authModal.classList.add('hidden');
            mainContainer.classList.remove('hidden');
            if (userProfileDiv) userProfileDiv.classList.remove('hidden');
            if (userEmailDisplay) userEmailDisplay.textContent = user.email || "사용자";
            console.log("User logged in. Attempting to load user data...");
            loadUserData(user.uid); // 비동기 함수
        } else {
            console.log("User not logged in or logged out.");
            authModal.classList.remove('hidden');
            mainContainer.classList.add('hidden');
            if (userProfileDiv) userProfileDiv.classList.add('hidden');
            if (userEmailDisplay) userEmailDisplay.textContent = '';

            // 모든 리스너 해제
            if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; console.log("Unsubscribed from tasks."); }
            if (unsubscribeAdditionalTasks) { unsubscribeAdditionalTasks(); unsubscribeAdditionalTasks = null; console.log("Unsubscribed from additional tasks."); }
            if (unsubscribeSettings) { unsubscribeSettings(); unsubscribeSettings = null; console.log("Unsubscribed from settings."); }

            initializeLocalData(); // 로컬 데이터 및 UI 상태 초기화
            renderTasks();         // 빈 할 일 목록 또는 안내 메시지 렌더링
            if (appSettings.appMode === 'focus' && additionalTaskListDiv) renderAdditionalTasks();
            hideLoading(); // 모든 처리 후 로딩 숨김
        }
    }

    async function loadUserData(userId) {
        console.log(`loadUserData started for UID: ${userId}`);
        showLoading("데이터 불러오는 중..."); // 이 함수 시작 시 로딩 표시

        const userDocRef = db.collection('usersData').doc(userId);
        let settingsDataLoaded = false;
        let coreDataLoadingInitiated = false;

        // 이전 리스너 해제
        if (unsubscribeSettings) { unsubscribeSettings(); unsubscribeSettings = null; }

        unsubscribeSettings = userDocRef.collection('settings').doc('userSettings')
            .onSnapshot(async (doc) => {
                console.log("Settings snapshot received:", doc.id, "Exists:", doc.exists, "Data:", doc.data());
                settingsDataLoaded = true;
                if (doc.exists) {
                    const newSettings = doc.data();
                    let settingsChanged = false;
                    Object.keys(appSettings).forEach(key => { // appSettings의 모든 키에 대해 비교
                        if (newSettings.hasOwnProperty(key) && JSON.stringify(appSettings[key]) !== JSON.stringify(newSettings[key])) {
                            appSettings[key] = newSettings[key];
                            settingsChanged = true;
                        }
                    });

                    if (settingsChanged || !initialDataLoaded) { // 변경되었거나, 아직 초기 데이터 로드가 안됐으면
                        console.log("Applying settings from Firebase:", JSON.parse(JSON.stringify(appSettings)));
                        applyAppSettingsToUI(true); // isInitialFirebaseLoad = true
                    }
                } else {
                    console.log("No settings document, creating with defaults and applying.");
                    try {
                        await userDocRef.collection('settings').doc('userSettings').set(appSettings);
                        applyAppSettingsToUI(true);
                    } catch (e) { console.error("Error saving default settings:", e); }
                }

                if (!coreDataLoadingInitiated) {
                    coreDataLoadingInitiated = true;
                    loadCoreData(userId); // 설정 로드 후 (또는 기본값 설정 후) 핵심 데이터 로드
                }
                if (!initialDataLoaded) { // 초기 데이터 로드 완료 조건 (settings 로드 후)
                    initialDataLoaded = true; // 이 플래그를 loadCoreData 완료 후로 옮길 수도 있음
                    // hideLoading(); // 여기서 숨기면 coreData 로드 전에 숨겨질 수 있음
                }

            }, (error) => {
                console.error("Error listening to settings: ", error);
                alert("설정 정보를 불러오는 중 오류가 발생했습니다.");
                hideLoading(); // 에러 시 로딩 숨김
            });
    }

    async function loadCoreData(userId) {
        console.log(`loadCoreData started for UID: ${userId}`);
        const userDocRef = db.collection('usersData').doc(userId);
        const todayDateStr = getTodayDateString();
        let tasksLoaded = false;
        let additionalTasksLoadedOrNotApplicable = appSettings.appMode === 'simple'; // 심플모드면 바로 true

        // 이전 리스너 해제
        if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; }
        if (unsubscribeAdditionalTasks && appSettings.appMode === 'focus') { unsubscribeAdditionalTasks(); unsubscribeAdditionalTasks = null; }


        unsubscribeTasks = userDocRef.collection('dailyTasks').doc(todayDateStr)
            .onSnapshot(async (doc) => {
                console.log("Tasks snapshot received for today:", doc.id, "Exists:", doc.exists, "Data:", doc.data());
                tasksLoaded = true;
                if (doc.exists) {
                    tasks = doc.data().tasks || [];
                    while (tasks.length < 5) { tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });}
                    if (tasks.length > 5) tasks = tasks.slice(0, 5);
                } else {
                    await handleNewDayInitialization(userId, todayDateStr); // 새 날짜 초기화 (비동기)
                    initializeTasksArray(); // 로컬 배열 즉시 초기화
                }
                if (!doc.metadata.hasPendingWrites || !initialDataLoaded) {
                     renderTasks();
                }
                updateStats();
                if (appSettings.appMode === 'focus') renderStatsVisuals();

                if (tasksLoaded && additionalTasksLoadedOrNotApplicable && initialDataLoaded) {
                    console.log("Core data loaded (tasks, and additional if applicable). Hiding loading.");
                    hideLoading();
                }

            }, (error) => {
                console.error("Error listening to tasks: ", error);
                tasksLoaded = true; // 에러 발생해도 로드 시도는 끝난 것으로 간주
                if (tasksLoaded && additionalTasksLoadedOrNotApplicable) hideLoading();
            });

        if (appSettings.appMode === 'focus') {
            unsubscribeAdditionalTasks = userDocRef.collection('additionalDailyTasks').doc(todayDateStr)
                .onSnapshot((doc) => {
                    console.log("Additional tasks snapshot received for today:", doc.id, "Exists:", doc.exists, "Data:", doc.data());
                    additionalTasksLoadedOrNotApplicable = true;
                    additionalTasks = doc.exists ? (doc.data().tasks || []) : [];
                    if ((!doc.metadata.hasPendingWrites || !initialDataLoaded) && appSettings.appMode === 'focus') {
                        renderAdditionalTasks();
                    }
                    if (tasksLoaded && additionalTasksLoadedOrNotApplicable && initialDataLoaded) {
                        console.log("Core data loaded (tasks and additional). Hiding loading.");
                        hideLoading();
                    }
                }, (error) => {
                    console.error("Error listening to additional tasks: ", error);
                    additionalTasksLoadedOrNotApplicable = true; // 에러 발생해도 로드 시도는 끝난 것으로 간주
                    if (tasksLoaded && additionalTasksLoadedOrNotApplicable) hideLoading();
                });
        } else { // 심플 모드인 경우
            if (tasksLoaded && initialDataLoaded) { // 태스크만 로드되면 완료
                 console.log("Core data loaded (tasks only, simple mode). Hiding loading.");
                 hideLoading();
            }
        }
    }
    // --- 나머지 함수들 (handleNewDayInitialization, initializeLocalData, etc.) ---
    // 이전 버전의 함수들을 그대로 사용하되, DOM 요소 접근 시 null 체크가 필요하면 추가합니다.
    // 디바운스 함수, applyAppSettingsToUI, applyAppMode, applyTheme 등도 이전 버전 유지 또는 필요시 DOM 요소 null 체크 추가.

    // --- 예시: applyAppSettingsToUI 수정 ---
    function applyAppSettingsToUI(isInitialFirebaseLoad = false) {
        console.log("Applying app settings to UI. Initial Firebase Load:", isInitialFirebaseLoad, "Settings:", JSON.parse(JSON.stringify(appSettings)));
        applyTheme(appSettings.theme); // 테마 먼저
        applyAppMode(appSettings.appMode, isInitialFirebaseLoad); // 모드 적용 (isInitialLoad 전달)

        if(taskCountSelector) taskCountSelector.value = appSettings.focusTaskCountSetting;
        MAX_TASKS_CURRENT_MODE = appSettings.appMode === 'simple' ? 3 : appSettings.focusTaskCountSetting;

        if (shareIncludeAdditionalCheckbox) shareIncludeAdditionalCheckbox.checked = appSettings.shareOptions.includeAdditional;
        if (shareIncludeMemosCheckbox) shareIncludeMemosCheckbox.checked = appSettings.shareOptions.includeMemos;

        // renderTasks와 renderAdditionalTasks는 각자의 onSnapshot 콜백에서
        // !doc.metadata.hasPendingWrites || !initialDataLoaded 조건으로 호출되므로,
        // 여기서 중복 호출을 피하거나, initialDataLoaded 플래그를 신중하게 관리해야 함.
        // 여기서는 모드 변경 등으로 인해 UI가 즉시 반영되어야 할 때를 위해 호출.
        renderTasks();
        if (appSettings.appMode === 'focus') {
            renderAdditionalTasks();
            renderStatsVisuals(); // 통계 시각화도 모드 변경 시 다시 그려야 할 수 있음
        }
    }


    // --- 모든 이벤트 리스너 및 나머지 로직은 이전 버전과 동일하게 유지 ---
    // (단, DOM 요소 사용 시 null이 될 수 있는 가능성을 항상 염두에 두고 방어적 코딩)
    // 여기에 이전 버전의 나머지 함수들을 붙여넣습니다. (getFirebaseErrorMessage, saveTasksToFirebase, ... initializeApp까지)
    // ... (이전 버전의 나머지 함수들 복붙) ...
    // --- handleNewDayInitialization, initializeLocalData, initializeTasksArray ---
    // --- saveTasksToFirebase, saveAdditionalTasksToFirebase, saveAppSettingsToFirebase ---
    // --- debounce, debouncedSaveTasks, debouncedSaveAdditionalTasks, debouncedSaveAppSettings ---
    // --- applyAppMode, appModeToggle listener ---
    // --- applyTheme, themeToggleButton listener, updateThemeColorMeta ---
    // --- taskCountSelector listener ---
    // --- renderTasks, checkAllDone ---
    // --- renderAdditionalTasks, addAdditionalTaskBtn listener ---
    // --- sections, toggleSection, toggle-button listeners ---
    // --- loadHistory, loadMoreHistoryBtn listener, renderHistory ---
    // --- calculateAchievementRate, updateStats, renderStatsVisuals ---
    // --- shareUrl, getShareText, copyLinkBtn listener, shareTwitterBtn listener ---
    // --- shareIncludeAdditionalCheckbox, shareIncludeMemosCheckbox listeners ---
    // --- shareAsImageBtn listener ---
    // --- exportDataBtn, importDataBtn, importFileInput listeners ---
    // --- keydown listener ---

    // --- 앱 초기화 실행 ---
    function main() {
        console.log("Main function started.");
        initializeDOMReferences(); // DOM 요소 참조 먼저 초기화

        // 로컬 캐시된 테마/모드 UI에 우선 적용 (깜빡임 최소화)
        const localTheme = localStorage.getItem('oneulSetThemeLocalCache') || 'dark';
        const localMode = localStorage.getItem('oneulSetAppModeLocalCache') || 'simple';

        document.body.classList.toggle('dark-theme', localTheme === 'dark');
        if(themeToggleButton) themeToggleButton.textContent = localTheme === 'dark' ? '☀️' : '🌙';
        updateThemeColorMeta(localTheme); // PWA 테마색

        document.body.classList.toggle('simple-mode', localMode === 'simple');
        document.body.classList.toggle('focus-mode', localMode === 'focus');
        if(appModeToggle) {
            const modeToSwitchToText = localMode === 'simple' ? '집중' : '심플';
            appModeToggle.textContent = `${modeToSwitchToText} 모드로 전환`;
            appModeToggle.setAttribute('aria-label', `${modeToSwitchToText} 모드로 전환`);
        }
        // 나머지 UI 초기화 (appSettings 기본값 기준)
        if(taskCountSelector) taskCountSelector.value = appSettings.focusTaskCountSetting;
        MAX_TASKS_CURRENT_MODE = appSettings.appMode === 'simple' ? 3 : appSettings.focusTaskCountSetting;


        displayCurrentDate();

        if (!initializeFirebase()) { // Firebase 초기화 실패 시 더 이상 진행 안 함
            return;
        }

        // Firebase 인증 상태 변경 감지 시작
        auth.onAuthStateChanged(user => {
            showLoading("사용자 정보 확인 중..."); // onAuthStateChanged 콜백 시작 시 로딩 표시
            updateAuthUI(user);
        });

        // 푸터 섹션 버튼 초기화 (이 코드는 auth 상태와 무관하게 실행 가능)
        if (typeof sections !== 'undefined' && sections.length > 0) { // sections 배열 정의 확인
            sections.forEach(sec => {
                if(sec.button) sec.button.textContent = sec.baseText;
                const sectionElement = document.getElementById(sec.id);
                if (sectionElement) {
                    sectionElement.setAttribute('aria-hidden', 'true');
                    if(sec.button) sec.button.setAttribute('aria-expanded', 'false');
                }
            });
        } else {
            console.warn("`sections` array is not defined or empty. Footer toggles might not initialize correctly.");
        }
    }

    main(); // 앱 실행
});
