// script.js - v2.0.0-firebase-auth-sync
document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Config (본인의 Firebase 프로젝트 설정으로 교체) ---
    const firebaseConfig = {
        apiKey: "AIzaSyB54BtURvHN9YmC3HVGaClOo32zO44deu4",
        authDomain: "todayset-82fcc.firebaseapp.com",
        projectId: "todayset-82fcc",
        storageBucket: "todayset-82fcc.firebasestorage.app",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "1:432546292770:web:ea8231f64c6f54792ad67b"
    };

    // --- Firebase 앱 초기화 ---
    firebase.initializeApp(firebaseConfig);
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

    const exportDataBtn = document.getElementById('export-data-btn'); // 로컬 백업용으로 유지
    const importDataBtn = document.getElementById('import-data-btn'); // 로컬 복원용으로 유지
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
    let history = []; // 히스토리는 필요시 로드
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
    const HISTORY_PAGE_SIZE = 10; // 한 번에 불러올 히스토리 개수
    let lastHistoryDoc = null; // 페이징용

    // --- 로딩 오버레이 ---
    function showLoading(message = "처리 중...") {
        loadingOverlay.querySelector('p').textContent = message;
        loadingOverlay.classList.remove('hidden');
    }
    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    // --- 유틸리티 함수 ---
    function announceToScreenReader(message) { /* 이전과 동일 */ }
    function getTodayDateString() { /* 이전과 동일 */ }
    function displayCurrentDate() { /* 이전과 동일 */ }
    function autoGrowTextarea(element) { /* 이전과 동일 */ }

    // --- PWA: 서비스 워커 등록 ---
    if ('serviceWorker' in navigator) { /* 이전과 동일 */ }


    // --- Firebase 인증 관련 함수 ---
    function updateAuthUI(user) {
        currentUser = user;
        if (user) {
            authModal.classList.add('hidden');
            mainContainer.classList.remove('hidden');
            userProfileDiv.classList.remove('hidden');
            userEmailDisplay.textContent = user.email || "사용자";
            loadUserData(user.uid);
        } else {
            authModal.classList.remove('hidden');
            mainContainer.classList.add('hidden');
            userProfileDiv.classList.add('hidden');
            userEmailDisplay.textContent = '';
            if (unsubscribeTasks) unsubscribeTasks();
            if (unsubscribeAdditionalTasks) unsubscribeAdditionalTasks();
            if (unsubscribeSettings) unsubscribeSettings();
            // 로컬 데이터 초기화 또는 로그인 유도
            initializeLocalData();
            renderTasks(); // 빈 화면 렌더링
            if (appSettings.appMode === 'focus') renderAdditionalTasks();
        }
        hideLoading();
    }

    auth.onAuthStateChanged(user => {
        showLoading("사용자 정보 확인 중...");
        updateAuthUI(user);
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;
        authErrorEl.classList.add('hidden');
        authErrorEl.textContent = '';
        showLoading(isAuthModalSignUpMode ? "회원가입 중..." : "로그인 중...");

        try {
            if (isAuthModalSignUpMode) {
                await auth.createUserWithEmailAndPassword(email, password);
                // 성공 시 onAuthStateChanged가 처리
            } else {
                await auth.signInWithEmailAndPassword(email, password);
                // 성공 시 onAuthStateChanged가 처리
            }
        } catch (error) {
            console.error("Auth error:", error);
            authErrorEl.textContent = getFirebaseErrorMessage(error);
            authErrorEl.classList.remove('hidden');
            hideLoading();
        }
    });

    toggleAuthModeBtn.addEventListener('click', () => {
        isAuthModalSignUpMode = !isAuthModalSignUpMode;
        authTitle.textContent = isAuthModalSignUpMode ? "회원가입" : "로그인";
        authSubmitBtn.textContent = isAuthModalSignUpMode ? "회원가입" : "로그인";
        toggleAuthModeBtn.textContent = isAuthModalSignUpMode ? "이미 계정이 있으신가요? 로그인" : "계정이 없으신가요? 회원가입";
        authErrorEl.classList.add('hidden');
    });

    googleSignInBtn.addEventListener('click', async () => {
        authErrorEl.classList.add('hidden');
        showLoading("Google 로그인 중...");
        try {
            await auth.signInWithPopup(googleProvider);
            // 성공 시 onAuthStateChanged가 처리
        } catch (error) {
            console.error("Google Sign-In error:", error);
            authErrorEl.textContent = getFirebaseErrorMessage(error);
            authErrorEl.classList.remove('hidden');
            hideLoading();
        }
    });

    logoutBtn.addEventListener('click', async () => {
        if (confirm("로그아웃 하시겠습니까?")) {
            showLoading("로그아웃 중...");
            try {
                await auth.signOut();
                // 성공 시 onAuthStateChanged가 처리
            } catch (error) {
                console.error("Logout error:", error);
                alert("로그아웃에 실패했습니다.");
                hideLoading();
            }
        }
    });

    function getFirebaseErrorMessage(error) {
        switch (error.code) {
            case 'auth/invalid-email': return '유효하지 않은 이메일 주소입니다.';
            case 'auth/user-disabled': return '사용 중지된 계정입니다.';
            case 'auth/user-not-found': return '사용자를 찾을 수 없습니다.';
            case 'auth/wrong-password': return '잘못된 비밀번호입니다.';
            case 'auth/email-already-in-use': return '이미 사용 중인 이메일입니다.';
            case 'auth/weak-password': return '비밀번호는 6자 이상이어야 합니다.';
            case 'auth/requires-recent-login': return '보안을 위해 다시 로그인해주세요.';
            case 'auth/too-many-requests': return '너무 많은 요청이 감지되었습니다. 잠시 후 다시 시도해주세요.';
            default: return '오류가 발생했습니다. 다시 시도해주세요.';
        }
    }

    // --- Firebase 데이터 로드 및 저장 함수 ---
    async function loadUserData(userId) {
        showLoading("데이터 불러오는 중...");
        const userDocRef = db.collection('usersData').doc(userId);

        // 1. 설정 데이터 먼저 로드 및 실시간 감지
        unsubscribeSettings = userDocRef.collection('settings').doc('userSettings')
            .onSnapshot(async (doc) => {
                if (doc.exists) {
                    const newSettings = doc.data();
                    // 기존 appSettings와 비교하여 변경된 부분만 업데이트 (최적화)
                    let settingsChanged = false;
                    for (const key in newSettings) {
                        if (JSON.stringify(appSettings[key]) !== JSON.stringify(newSettings[key])) {
                            appSettings[key] = newSettings[key];
                            settingsChanged = true;
                        }
                    }
                    if (settingsChanged || !doc.metadata.hasPendingWrites) { // 로컬 변경이 아닐 때만 UI 업데이트
                        applyAppSettingsToUI();
                    }
                } else {
                    // 기본 설정 저장
                    await userDocRef.collection('settings').doc('userSettings').set(appSettings, { merge: true });
                    applyAppSettingsToUI(); // UI에 기본값 적용
                }
                // 설정 로드 후 나머지 데이터 로드 시작
                loadCoreData(userId);
            }, (error) => {
                console.error("Error listening to settings: ", error);
                alert("설정 정보를 불러오는 중 오류가 발생했습니다.");
                hideLoading();
            });
    }

    function loadCoreData(userId) {
        const userDocRef = db.collection('usersData').doc(userId);
        const todayDateStr = getTodayDateString();

        // 2. 오늘의 핵심 과제 실시간 감지
        if (unsubscribeTasks) unsubscribeTasks();
        unsubscribeTasks = userDocRef.collection('dailyTasks').doc(todayDateStr)
            .onSnapshot(async (doc) => {
                if (doc.exists) {
                    tasks = doc.data().tasks || [];
                    // tasks 배열이 항상 5개 유지되도록 보정 (최적화 필요시 이 부분 조정)
                    while (tasks.length < 5) {
                        tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });
                    }
                    if (tasks.length > 5) tasks = tasks.slice(0, 5);
                } else {
                    // 오늘 데이터가 없으면 초기화 (어제 데이터 처리 로직은 여기 또는 별도 함수로)
                    await handleNewDayInitialization(userId, todayDateStr);
                    initializeTasksArray(); // 로컬 tasks 배열 초기화
                }
                if (!doc.metadata.hasPendingWrites) { // 로컬 변경으로 인한 스냅샷이 아닐 때만 렌더링
                     renderTasks();
                }
                updateStats(); // 통계는 tasks 변경시마다 업데이트
                if (appSettings.appMode === 'focus') renderStatsVisuals();
            }, (error) => {
                console.error("Error listening to tasks: ", error);
                hideLoading();
            });

        // 3. 오늘의 추가 과제 실시간 감지 (집중 모드일 때만)
        if (appSettings.appMode === 'focus') {
            if (unsubscribeAdditionalTasks) unsubscribeAdditionalTasks();
            unsubscribeAdditionalTasks = userDocRef.collection('additionalDailyTasks').doc(todayDateStr)
                .onSnapshot((doc) => {
                    additionalTasks = doc.exists ? (doc.data().tasks || []) : [];
                    if (!doc.metadata.hasPendingWrites && appSettings.appMode === 'focus') {
                        renderAdditionalTasks();
                    }
                }, (error) => {
                    console.error("Error listening to additional tasks: ", error);
                });
        }
        hideLoading(); // 모든 리스너 설정 후 로딩 숨김
    }


    async function handleNewDayInitialization(userId, todayDateStr) {
        // 어제 날짜 계산
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayDateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

        const userDocRef = db.collection('usersData').doc(userId);
        const batch = db.batch();

        try {
            // 어제 핵심 과제 데이터 가져오기
            const yesterdayTasksDoc = await userDocRef.collection('dailyTasks').doc(yesterdayDateStr).get();
            if (yesterdayTasksDoc.exists) {
                const yesterdayTasksData = yesterdayTasksDoc.data().tasks || [];
                const yesterdayFocusModeTaskCount = appSettings.focusTaskCountSetting; // 이전 설정을 가져오는 로직은 복잡해지므로 현재 설정 사용

                const relevantYesterdayTasks = yesterdayTasksData.slice(0, yesterdayFocusModeTaskCount);
                const allYesterdayTasksFilled = relevantYesterdayTasks.every(task => task && typeof task.text === 'string' && task.text.trim() !== "");
                const allYesterdayTasksCompleted = relevantYesterdayTasks.every(task => task && task.completed);
                const yesterdayAchieved = allYesterdayTasksFilled && relevantYesterdayTasks.length === yesterdayFocusModeTaskCount && allYesterdayTasksCompleted && yesterdayFocusModeTaskCount > 0;

                // 히스토리 저장 (중복 방지 로직은 Firestore 규칙이나 클라이언트 측에서 강화 가능)
                const historyRef = userDocRef.collection('history').doc(yesterdayDateStr);
                batch.set(historyRef, {
                    date: yesterdayDateStr,
                    tasks: relevantYesterdayTasks,
                    achieved: yesterdayAchieved,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp() // 정렬용
                }, { merge: true }); // 중복 방지를 위해 merge 사용
            }

            // 오늘의 핵심 과제 초기화
            const initialTasks = [];
            for (let i = 0; i < 5; i++) {
                initialTasks.push({ id: Date.now() + i + Math.random(), text: '', completed: false, memo: '' });
            }
            batch.set(userDocRef.collection('dailyTasks').doc(todayDateStr), { tasks: initialTasks });

            // 오늘의 추가 과제 초기화 (빈 배열)
            batch.set(userDocRef.collection('additionalDailyTasks').doc(todayDateStr), { tasks: [] });

            await batch.commit();
        } catch (error) {
            console.error("Error initializing new day data:", error);
        }
    }


    function initializeLocalData() { // 로그인 안됐을때 로컬 데이터 초기화
        initializeTasksArray();
        additionalTasks = [];
        history = [];
        // 기본 설정은 appSettings 전역변수 초기값 사용
    }
    function initializeTasksArray() {
        tasks = [];
        for (let i = 0; i < 5; i++) {
            tasks.push({ id: Date.now() + i + Math.random(), text: '', completed: false, memo: '' });
        }
    }


    async function saveTasksToFirebase() {
        if (!currentUser) return;
        const todayDateStr = getTodayDateString();
        try {
            await db.collection('usersData').doc(currentUser.uid).collection('dailyTasks').doc(todayDateStr).set({ tasks: tasks });
        } catch (error) {
            console.error("Error saving tasks: ", error);
            // 사용자에게 오류 알림 (예: 스낵바)
        }
    }

    async function saveAdditionalTasksToFirebase() {
        if (!currentUser || appSettings.appMode === 'simple') return;
        const todayDateStr = getTodayDateString();
        try {
            await db.collection('usersData').doc(currentUser.uid).collection('additionalDailyTasks').doc(todayDateStr).set({ tasks: additionalTasks });
        } catch (error) {
            console.error("Error saving additional tasks: ", error);
        }
    }

    async function saveAppSettingsToFirebase() {
        if (!currentUser) return;
        try {
            await db.collection('usersData').doc(currentUser.uid).collection('settings').doc('userSettings').set(appSettings, { merge: true });
        } catch (error) {
            console.error("Error saving settings: ", error);
        }
    }

    // 디바운스 함수 (최적화)
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    const debouncedSaveTasks = debounce(saveTasksToFirebase, 1500); // 1.5초 디바운스
    const debouncedSaveAdditionalTasks = debounce(saveAdditionalTasksToFirebase, 1500);
    const debouncedSaveAppSettings = debounce(saveAppSettingsToFirebase, 1000);


    // --- UI 적용 함수 ---
    function applyAppSettingsToUI() {
        // 테마 적용
        applyTheme(appSettings.theme);
        // 모드 적용
        applyAppMode(appSettings.appMode, true); // isInitialLoad = true로 불필요한 저장 방지
        // 핵심 할 일 개수
        taskCountSelector.value = appSettings.focusTaskCountSetting;
        MAX_TASKS_CURRENT_MODE = appSettings.appMode === 'simple' ? 3 : appSettings.focusTaskCountSetting;
        // 공유 옵션
        if (shareIncludeAdditionalCheckbox) shareIncludeAdditionalCheckbox.checked = appSettings.shareOptions.includeAdditional;
        if (shareIncludeMemosCheckbox) shareIncludeMemosCheckbox.checked = appSettings.shareOptions.includeMemos;

        renderTasks(); // 설정 변경 후 태스크 다시 렌더링
        if (appSettings.appMode === 'focus') {
            renderAdditionalTasks();
            renderStatsVisuals();
        }
    }


    // --- 모드 관리 (applyAppMode 수정) ---
    function applyAppMode(mode, isInitialLoad = false) {
        appSettings.appMode = mode; // 전역 설정에 반영
        localStorage.setItem('oneulSetAppModeLocalCache', mode); // 로컬 캐시 (UI 빠른 반응용)
        document.body.classList.toggle('simple-mode', mode === 'simple');
        document.body.classList.toggle('focus-mode', mode === 'focus');

        const modeToSwitchToText = mode === 'simple' ? '집중' : '심플';
        appModeToggle.textContent = `${modeToSwitchToText} 모드로 전환`;
        appModeToggle.setAttribute('aria-label', `${modeToSwitchToText} 모드로 전환`);

        // ... (이전 CSS 클래스 토글 로직 유지) ...
        if (shareOptionsDiv) shareOptionsDiv.classList.toggle('hidden', mode === 'simple');
        if (shareIncludeMemosLabel) shareIncludeMemosLabel.classList.toggle('hidden', mode === 'simple');

        if (mode === 'simple') {
            MAX_TASKS_CURRENT_MODE = 3;
            taskCountSelectorContainer.classList.add('hidden');
            additionalTasksSection.classList.add('hidden');
            if (statsVisualsContainer) statsVisualsContainer.classList.add('hidden');
            if (shareAsImageBtnContainer) shareAsImageBtnContainer.classList.add('hidden');
            if (settingsContentDiv) settingsContentDiv.classList.add('hidden');
             if (unsubscribeAdditionalTasks) { // 심플 모드에서는 추가과제 리스너 해제
                unsubscribeAdditionalTasks();
                unsubscribeAdditionalTasks = null;
             }
        } else { // focus mode
            MAX_TASKS_CURRENT_MODE = appSettings.focusTaskCountSetting;
            taskCountSelectorContainer.classList.remove('hidden');
            additionalTasksSection.classList.remove('hidden');
            if (statsVisualsContainer) statsVisualsContainer.classList.remove('hidden');
            if (shareAsImageBtnContainer) shareAsImageBtnContainer.classList.remove('hidden');
            if (settingsContentDiv) settingsContentDiv.classList.remove('hidden');
            // 집중 모드 진입 시 추가과제 리스너 다시 설정 (이미 loadCoreData에서 처리될 수 있으므로 중복 호출 주의)
            if (!unsubscribeAdditionalTasks && currentUser) {
                 const todayDateStr = getTodayDateString();
                 unsubscribeAdditionalTasks = db.collection('usersData').doc(currentUser.uid).collection('additionalDailyTasks').doc(todayDateStr)
                    .onSnapshot((doc) => {
                        additionalTasks = doc.exists ? (doc.data().tasks || []) : [];
                        if (!doc.metadata.hasPendingWrites) renderAdditionalTasks();
                    });
            }
        }
        taskCountSelector.value = appSettings.focusTaskCountSetting; // 현재 모드에 맞는 값으로 설정

        renderTasks();
        if (mode === 'focus') renderAdditionalTasks();
        else if (additionalTaskListDiv) additionalTaskListDiv.innerHTML = ''; // 심플 모드에서 추가과제 목록 비우기

        if (!isInitialLoad && currentUser) { // 초기 로드가 아니고, 로그인 상태일 때만 저장
            debouncedSaveAppSettings();
            announceToScreenReader(`${mode === 'simple' ? '심플' : '집중'} 모드로 변경되었습니다.`);
        }
    }

    appModeToggle.addEventListener('click', () => {
        const newMode = appSettings.appMode === 'simple' ? 'focus' : 'simple';
        applyAppMode(newMode); // isInitialLoad는 기본값 false
    });

    // --- 테마 관리 (applyTheme 수정) ---
    function applyTheme(theme) {
        appSettings.theme = theme; // 전역 설정에 반영
        localStorage.setItem('oneulSetThemeLocalCache', theme); // 로컬 캐시
        if (theme === 'dark') { document.body.classList.add('dark-theme'); themeToggleButton.textContent = '☀️';}
        else { document.body.classList.remove('dark-theme'); themeToggleButton.textContent = '🌙';}
        updateThemeColorMeta(theme);
        if (achievementChart) achievementChart.destroy(); achievementChart = null;
        if (appSettings.appMode === 'focus') renderStatsVisuals(); // 테마 변경 시 차트 다시 그리기
    }

    themeToggleButton.addEventListener('click', () => {
        const isDarkMode = document.body.classList.contains('dark-theme');
        const newTheme = isDarkMode ? 'light' : 'dark';
        applyTheme(newTheme);
        if (currentUser) debouncedSaveAppSettings();
        announceToScreenReader(`테마가 ${newTheme === 'dark' ? '다크' : '라이트'} 모드로 변경되었습니다.`);
    });

    function updateThemeColorMeta(theme) { /* 이전과 동일 */ }


    // --- 할 일 개수 선택 (taskCountSelector 수정) ---
    taskCountSelector.addEventListener('change', (e) => {
        if (appSettings.appMode === 'simple' || !currentUser) return;
        const newCount = parseInt(e.target.value, 10);
        // const oldCountDisplay = MAX_TASKS_CURRENT_MODE; // 사용 안 함
        appSettings.focusTaskCountSetting = newCount;
        MAX_TASKS_CURRENT_MODE = newCount;

        renderTasks(); // UI 즉시 반영
        debouncedSaveAppSettings(); // Firebase에 설정 저장
        announceToScreenReader(`핵심 할 일 개수가 ${newCount}개로 변경되었습니다.`);
    });

    // --- 할 일 렌더링 및 관리 (renderTasks, textarea 이벤트 핸들러 등 수정) ---
    function renderTasks() {
        taskListDiv.innerHTML = '';
        if (!tasks || tasks.length === 0) { // tasks가 로드되지 않았거나 비어있으면 아무것도 안 함
             if (currentUser) { /* 로딩 중이거나 아직 데이터 없는 상태 */ }
             else { /* 로그인 안 된 상태 */ }
            return;
        }
        const tasksToRender = tasks.slice(0, MAX_TASKS_CURRENT_MODE);

        tasksToRender.forEach((taskData, indexInUI) => {
            // tasks 배열에서 실제 task의 인덱스를 찾아야 함 (id 기반)
            const originalTaskIndex = tasks.findIndex(t => t.id === taskData.id);
            if (originalTaskIndex === -1) return; // 혹시 모를 오류 방지

            const task = tasks[originalTaskIndex]; // 실제 데이터 객체 사용

            const taskItem = document.createElement('div');
            // ... (이하 taskItem 생성 로직은 이전과 거의 동일, 이벤트 핸들러에서 debouncedSaveTasks 호출)

            // 체크박스 이벤트
            checkbox.addEventListener('change', () => {
                tasks[originalTaskIndex].completed = checkbox.checked;
                taskItem.classList.toggle('completed', checkbox.checked);
                checkAllDone();
                debouncedSaveTasks(); // 변경사항 Firebase에 저장
            });

            // 텍스트 영역 이벤트
            textareaField.addEventListener('input', (e) => { tasks[originalTaskIndex].text = e.target.value; autoGrowTextarea(e.target); debouncedSaveTasks(); }); // 입력 시마다 디바운스 저장
            textareaField.addEventListener('blur', () => { /* debouncedSaveTasks가 input에서 처리하므로 blur에서는 중복 호출 피할 수 있음 */ });

            if (appSettings.appMode === 'focus') {
                // ... (메모 아이콘 및 텍스트 영역 로직)
                // 메모 텍스트 영역 이벤트
                memoTextarea.addEventListener('input', (e) => {
                    tasks[originalTaskIndex].memo = e.target.value;
                    autoGrowTextarea(e.target);
                    memoIcon.classList.toggle('has-memo', e.target.value.trim() !== "");
                    debouncedSaveTasks(); // 메모 변경도 저장
                });
                 // ...
            }
            // ... (taskItem을 taskListDiv에 추가하는 부분)
        });
        checkAllDone();
    }

    function checkAllDone() { /* 이전과 동일 */ }

    // --- 추가 과제 관리 (renderAdditionalTasks, 이벤트 핸들러 수정) ---
    function renderAdditionalTasks() {
        if (appSettings.appMode === 'simple' || !additionalTaskListDiv) { /* ... */ return; }
        additionalTaskListDiv.innerHTML = '';
        if (!additionalTasks || additionalTasks.length === 0) { /* ... */ return; }

        additionalTasks.forEach((taskData, index) => { // index는 UI상의 인덱스, 실제 데이터는 id로 찾아야 함
            const task = additionalTasks[index]; // 여기서는 배열 순서가 DB 순서와 같다고 가정 (간소화)

            // ... (additionalTaskItem 생성 로직)

            // 체크박스 이벤트
            checkbox.addEventListener('change', () => {
                task.completed = checkbox.checked; // 직접 task 객체 수정
                taskItem.classList.toggle('completed', checkbox.checked);
                debouncedSaveAdditionalTasks();
            });

            // 삭제 버튼 이벤트
            deleteBtn.addEventListener('click', () => {
                additionalTasks.splice(index, 1); // 로컬 배열에서 제거
                renderAdditionalTasks(); // UI 다시 그리기
                debouncedSaveAdditionalTasks(); // 변경사항 Firebase에 저장
                announceToScreenReader(`추가 과제 "${task.text}"가 삭제되었습니다.`);
            });
            // ...
        });
    }

    if (addAdditionalTaskBtn) {
        addAdditionalTaskBtn.addEventListener('click', () => {
            if (appSettings.appMode === 'simple' || !currentUser) return;
            const text = addAdditionalTaskInput.value.trim();
            if (text) {
                additionalTasks.push({ id: Date.now().toString(), text: text, completed: false }); // id는 string으로
                addAdditionalTaskInput.value = '';
                renderAdditionalTasks();
                debouncedSaveAdditionalTasks();
                announceToScreenReader(`추가 과제 "${text}"가 추가되었습니다.`);
                addAdditionalTaskInput.focus();
            }
        });
        // ... (Enter 키 이벤트 핸들러)
    }


    // --- 섹션 토글 (toggleSection 수정) ---
    const sections = [ /* 이전과 동일 */ ];
    function toggleSection(sectionIdToToggle) {
        // ... (이전 로직과 거의 동일, appSettings.appMode 사용)
        if (sec.id === 'history-section' && !sectionElement.classList.contains('hidden')) {
            lastHistoryDoc = null; // 히스토리 섹션 열 때 페이징 초기화
            history = []; // 이전 히스토리 비우기
            historyListDiv.innerHTML = '<p>기록을 불러오는 중...</p>';
            historyControlsDiv.classList.remove('hidden');
            loadHistory(); // 히스토리 로드 시작
        }
        // ...
    }
    // ... (토글 버튼 이벤트 리스너)

    // --- 히스토리 로드 (loadHistory, renderHistory 수정) ---
    async function loadHistory(loadMore = false) {
        if (!currentUser) {
            historyListDiv.innerHTML = '<p>로그인 후 기록을 볼 수 있습니다.</p>';
            historyControlsDiv.classList.add('hidden');
            return;
        }
        if (!loadMore) { // 처음 로드하거나 섹션 다시 열 때
            lastHistoryDoc = null;
            history = [];
            historyListDiv.innerHTML = '<p>기록을 불러오는 중...</p>';
        } else {
            if (!lastHistoryDoc) { // 더 이상 로드할 문서가 없으면
                loadMoreHistoryBtn.textContent = "모든 기록을 불러왔습니다.";
                loadMoreHistoryBtn.disabled = true;
                return;
            }
        }
        loadMoreHistoryBtn.disabled = true;
        loadMoreHistoryBtn.textContent = "불러오는 중...";

        try {
            let query = db.collection('usersData').doc(currentUser.uid).collection('history')
                .orderBy('timestamp', 'desc') // 최신순 정렬
                .limit(HISTORY_PAGE_SIZE);

            if (loadMore && lastHistoryDoc) {
                query = query.startAfter(lastHistoryDoc);
            }

            const snapshot = await query.get();
            const newHistoryEntries = [];
            snapshot.forEach(doc => {
                newHistoryEntries.push(doc.data());
            });

            if (newHistoryEntries.length > 0) {
                history = loadMore ? [...history, ...newHistoryEntries] : newHistoryEntries;
                lastHistoryDoc = snapshot.docs[snapshot.docs.length - 1]; // 다음 페이지를 위한 마지막 문서 저장
            }

            renderHistory();

            if (newHistoryEntries.length < HISTORY_PAGE_SIZE) {
                loadMoreHistoryBtn.textContent = "모든 기록을 불러왔습니다.";
                loadMoreHistoryBtn.disabled = true;
            } else {
                loadMoreHistoryBtn.textContent = "더 많은 기록 불러오기";
                loadMoreHistoryBtn.disabled = false;
            }
            if (history.length === 0 && !loadMore) {
                 historyListDiv.innerHTML = '<p>지난 기록이 없습니다.</p>';
                 historyControlsDiv.classList.add('hidden');
            } else if (history.length > 0) {
                 historyControlsDiv.classList.remove('hidden');
            }

        } catch (error) {
            console.error("Error loading history:", error);
            historyListDiv.innerHTML = '<p>기록을 불러오는 중 오류가 발생했습니다.</p>';
            loadMoreHistoryBtn.textContent = "더 많은 기록 불러오기";
            loadMoreHistoryBtn.disabled = false;
        }
    }

    if(loadMoreHistoryBtn) {
        loadMoreHistoryBtn.addEventListener('click', () => loadHistory(true));
    }

    function renderHistory() {
        if (history.length === 0) {
             if (!currentUser) historyListDiv.innerHTML = '<p>로그인 후 기록을 볼 수 있습니다.</p>';
             // else loadHistory() 함수에서 초기 메시지 처리
            return;
        }
        // ... (이전 renderHistory 로직과 거의 동일, history 배열 사용)
    }


    // --- 통계 (updateStats, renderStatsVisuals 등 수정) ---
    // 이 부분은 history 배열이 Firebase에서 비동기적으로 로드되므로,
    // 통계 계산 시 history 배열을 직접 참조하도록 수정
    function calculateAchievementRate(days) { /* 이전과 동일 (history 배열 사용) */ }
    function updateStats() { /* 이전과 동일 (history 배열 사용) */ }
    function renderStatsVisuals() { /* 이전과 동일 (history, tasks 배열 사용) */ }

    // --- 공유 옵션 저장 (이벤트 핸들러 수정) ---
    if (shareIncludeAdditionalCheckbox) {
        shareIncludeAdditionalCheckbox.addEventListener('change', (e) => {
            appSettings.shareOptions.includeAdditional = e.target.checked;
            if (currentUser) debouncedSaveAppSettings();
        });
    }
    if (shareIncludeMemosCheckbox) {
        shareIncludeMemosCheckbox.addEventListener('change', (e) => {
            appSettings.shareOptions.includeMemos = e.target.checked;
            if (currentUser) debouncedSaveAppSettings();
        });
    }

    // --- 이미지 공유 (shareAsImageBtn 이벤트 핸들러 수정) ---
    // MAX_TASKS_CURRENT_MODE 대신 appSettings.focusTaskCountSetting 또는 실제 렌더링된 태스크 수 사용
    // ...

    // --- 데이터 관리 (로컬 백업/복원 기능 유지) ---
    // 이 기능은 클라우드 동기화와 별개로 로컬 브라우저 데이터에 대한 것임
    if (exportDataBtn) { /* 이전 로직 유지, 단 사용자에게 경고 문구 표시 */ }
    if (importDataBtn) { /* 이전 로직 유지, 단 사용자에게 경고 문구 표시 */ }


    // --- 단축키 및 초기화 실행 (수정) ---
    document.addEventListener('keydown', (e) => { /* 이전과 동일 */ });

    // --- 초기화 실행 순서 변경 ---
    function initializeApp() {
        // 로컬 캐시된 테마/모드 우선 적용 (깜빡임 최소화)
        const localTheme = localStorage.getItem('oneulSetThemeLocalCache') || 'dark';
        const localMode = localStorage.getItem('oneulSetAppModeLocalCache') || 'simple';
        applyTheme(localTheme); // UI에 즉시 반영, Firebase 설정 로드 후 덮어써질 수 있음
        applyAppMode(localMode, true); // isInitialLoad=true로 불필요한 저장 방지

        displayCurrentDate();
        // Firebase auth 상태 변경 감지가 핵심 초기화 로직을 트리거 (updateAuthUI -> loadUserData)
        // 따라서 여기서는 명시적인 loadState() 호출이 필요 없음.
    }

    initializeApp(); // 앱 초기화 시작

    // 푸터 섹션 버튼 초기 텍스트 설정 등
    sections.forEach(sec => { /* 이전과 동일 */ });
});
