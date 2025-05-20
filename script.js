// script.js - v1.13.0-firebase-auth
document.addEventListener('DOMContentLoaded', () => {
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
            firebaseAuth = firebase.auth && firebase.auth();
            firestoreDB = firebase.firestore && firebase.firestore();

            if (firebaseApp && firebaseAuth && firestoreDB) {
                console.log("Firebase SDK initialized successfully.");
                firestoreDB.enablePersistence()
                    .catch((err) => {
                        if (err.code == 'failed-precondition') {
                            console.warn("Firestore: Multiple tabs open, persistence can only be enabled in one tab at a time.");
                        } else if (err.code == 'unimplemented') {
                            console.warn("Firestore: The current browser does not support all of the features required to enable persistence.");
                        } else {
                            console.error("Firestore: enablePersistence failed", err);
                        }
                    });
            } else {
                console.error("Firebase SDK components (Auth or Firestore) failed to initialize.");
            }
        } else {
            console.error("Firebase SDK not loaded.");
        }
    } catch (error) {
        console.error("Error initializing Firebase:", error);
    }

    // --- 요소 가져오기 (기존 + 인증 관련) ---
    // ... (이전 요소들은 동일) ...
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

    // Auth UI Elements
    const authStatusContainer = document.getElementById('auth-status');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const userEmailSpan = document.getElementById('user-email');
    const logoutBtn = document.getElementById('logout-btn');
    const cloudSyncStatusDiv = document.getElementById('cloud-sync-status');

    // --- 전역 변수 ---
    // ... (이전 변수들은 동일) ...
    let MAX_TASKS_CURRENT_MODE = 3;
    let tasks = [];
    let additionalTasks = [];
    let history = [];
    let achievementChart = null;
    let currentAppMode = 'simple';
    let focusModeTaskCountSetting = 3;
    let shareOptions = {
        includeAdditional: false,
        includeMemos: false
    };
    let currentUser = null;

    const APP_VERSION_DATA_FORMAT = "1.13.0-firebase-auth-data";

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
                .then(registration => {
                    console.log('Service Worker registered: ', registration);
                })
                .catch(registrationError => {
                    console.error('Service Worker registration failed: ', registrationError);
                });
        });
    }

    // --- Firebase Authentication Functions ---
    async function signUpWithEmailPassword(email, password) {
        if (!firebaseAuth) return;
        try {
            const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
            // Signed in
            // currentUser = userCredential.user; // onAuthStateChanged에서 처리
            announceToScreenReader(`회원가입 성공: ${userCredential.user.email}`);
            // TODO: 신규 가입자 Firestore에 기본 데이터 구조 생성 (다음 단계)
            // await initializeUserData(userCredential.user);
        } catch (error) {
            console.error("Error signing up:", error);
            alert(`회원가입 실패: ${error.message}`);
            announceToScreenReader(`회원가입 실패: ${error.message}`);
        }
    }

    async function signInWithEmailPassword(email, password) {
        if (!firebaseAuth) return;
        try {
            const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
            // Signed in
            // currentUser = userCredential.user; // onAuthStateChanged에서 처리
            announceToScreenReader(`로그인 성공: ${userCredential.user.email}`);
        } catch (error) {
            console.error("Error signing in:", error);
            alert(`로그인 실패: ${error.message}`);
            announceToScreenReader(`로그인 실패: ${error.message}`);
        }
    }

    async function signInWithGoogle() {
        if (!firebaseAuth) return;
        const provider = new firebase.auth.GoogleAuthProvider(); // compat
        try {
            const result = await firebaseAuth.signInWithPopup(provider);
            // This gives you a Google Access Token. You can use it to access the Google API.
            // const credential = result.credential;
            // const token = credential.accessToken;
            // The signed-in user info.
            // currentUser = result.user; // onAuthStateChanged에서 처리
            announceToScreenReader(`Google 로그인 성공: ${result.user.displayName || result.user.email}`);
            // TODO: 신규 Google 가입자 Firestore에 기본 데이터 구조 생성 (다음 단계)
            // if (result.additionalUserInfo.isNewUser) {
            //    await initializeUserData(result.user);
            // }
        } catch (error) {
            console.error("Error signing in with Google:", error);
            // Handle Errors here.
            // const errorCode = error.code;
            // const errorMessage = error.message;
            // The email of the user's account used.
            // const email = error.email;
            // The firebase.auth.AuthCredential type that was used.
            // const credential = error.credential;
            alert(`Google 로그인 실패: ${error.message}`);
            announceToScreenReader(`Google 로그인 실패: ${error.message}`);
        }
    }

    async function signOutUser() {
        if (!firebaseAuth) return;
        try {
            await firebaseAuth.signOut();
            // Sign-out successful. currentUser는 onAuthStateChanged에서 null로 설정됨
            announceToScreenReader("로그아웃 되었습니다.");
        } catch (error) {
            console.error("Error signing out:", error);
            alert(`로그아웃 실패: ${error.message}`);
            announceToScreenReader(`로그아웃 실패: ${error.message}`);
        }
    }

    // --- Auth UI 업데이트 함수 ---
    function updateAuthUI(user) {
        currentUser = user;
        if (authStatusContainer && loginBtn && signupBtn && userEmailSpan && logoutBtn && cloudSyncStatusDiv) {
            if (user) {
                loginBtn.classList.add('hidden');
                signupBtn.classList.add('hidden');
                userEmailSpan.textContent = user.displayName || user.email || '사용자';
                userEmailSpan.classList.remove('hidden');
                logoutBtn.classList.remove('hidden');
                cloudSyncStatusDiv.textContent = `로그인 됨 (${user.displayName || user.email}).`;
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
        } else {
            console.error("Auth UI elements not found. Check index.html");
        }
    }

    // --- 모달/팝업 관련 함수 (간단한 버전) ---
    function createAuthModal(type) {
        // 기존 모달이 있으면 제거
        const existingModal = document.getElementById('auth-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'auth-modal'; // CSS 스타일링을 위함

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
        if (type === 'signup') passwordInput.minLength = 6; // Firebase 기본 비밀번호 길이

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.textContent = title.textContent;

        const googleBtn = document.createElement('button');
        googleBtn.type = 'button';
        googleBtn.id = 'google-signin-btn';
        googleBtn.innerHTML = '<i class="fab fa-google"></i> Google 계정으로 ' + (type === 'login' ? '로그인' : '시작하기');
        googleBtn.onclick = () => {
            signInWithGoogle();
            modal.remove();
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
            // 성공 여부와 관계없이 모달 닫기 (onAuthStateChanged가 UI 업데이트)
             if (currentUser) modal.remove(); // 로그인/가입 성공 시에만 닫기 (선택적)
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

        emailInput.focus(); // 모달 열리면 이메일 입력창에 포커스
    }

    // --- Auth UI 이벤트 리스너 ---
    if (loginBtn) {
        loginBtn.addEventListener('click', () => createAuthModal('login'));
    }
    if (signupBtn) {
        signupBtn.addEventListener('click', () => createAuthModal('signup'));
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', signOutUser);
    }

    // --- 나머지 코드 (모드 관리, 테마, 날짜, 상태 저장/로드, 할 일 렌더링 등) ---
    // saveState, loadState는 다음 단계에서 Firebase 연동 시 크게 수정될 예정입니다.
    // 현재는 로컬 스토리지 기반으로 동작합니다.
    function applyAppMode(mode, isInitialLoad = false) {
        currentAppMode = mode;
        localStorage.setItem('oneulSetMode', mode);
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
        } else { // focus mode
            MAX_TASKS_CURRENT_MODE = focusModeTaskCountSetting;
            if(taskCountSelectorContainer) taskCountSelectorContainer.classList.remove('hidden');
            if(additionalTasksSection) additionalTasksSection.classList.remove('hidden');
            if (statsVisualsContainer) statsVisualsContainer.classList.remove('hidden');
            if (shareAsImageBtnContainer) shareAsImageBtnContainer.classList.remove('hidden');
            if (settingsContentDiv) settingsContentDiv.classList.remove('hidden');
        }
        if(taskCountSelector) taskCountSelector.value = focusModeTaskCountSetting;
        while (tasks.length < 5) {
            tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });
        }
        renderTasks();
        if (currentAppMode === 'focus') renderAdditionalTasks();
        else if (additionalTaskListDiv) additionalTaskListDiv.innerHTML = '';
        if (!isInitialLoad) {
            saveState('local');
            announceToScreenReader(`${mode === 'simple' ? '심플' : '집중'} 모드로 변경되었습니다.`);
        }
    }
    if(appModeToggle) {
        appModeToggle.addEventListener('click', () => {
            const newMode = currentAppMode === 'simple' ? 'focus' : 'simple';
            applyAppMode(newMode);
        });
    }
    function updateThemeColorMeta(theme) {
        let color = '#5dade2';
        if (theme === 'light') { color = '#3498db'; }
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) themeColorMeta.setAttribute('content', color);
    }
    function applyTheme(theme, isInitialLoad = false) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            if(themeToggleButton) themeToggleButton.textContent = '☀️';
            localStorage.setItem('oneulSetTheme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            if(themeToggleButton) themeToggleButton.textContent = '🌙';
            localStorage.setItem('oneulSetTheme', 'light');
        }
        updateThemeColorMeta(theme);
        if (achievementChart) { achievementChart.destroy(); achievementChart = null; }
        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals();
    }
    if(themeToggleButton){
        themeToggleButton.addEventListener('click', () => {
            const isDarkMode = document.body.classList.contains('dark-theme');
            const newTheme = isDarkMode ? 'light' : 'dark';
            applyTheme(newTheme);
            announceToScreenReader(`테마가 ${newTheme === 'dark' ? '다크' : '라이트'} 모드로 변경되었습니다.`);
        });
    }
    function getTodayDateString() { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; }
    function displayCurrentDate() { if(currentDateEl){ const today = new Date(); const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }; currentDateEl.textContent = today.toLocaleDateString('ko-KR', options); } }
    function autoGrowTextarea(element) { if(element){ element.style.height = "auto"; element.style.height = (element.scrollHeight) + "px";} }
    function saveState(source = 'local') {
        localStorage.setItem('oneulSetTasks', JSON.stringify(tasks));
        localStorage.setItem('oneulSetAdditionalTasks', JSON.stringify(additionalTasks));
        localStorage.setItem('oneulSetLastDate', getTodayDateString());
        localStorage.setItem('oneulSetHistory', JSON.stringify(history));
        localStorage.setItem('oneulSetFocusTaskCountSetting', focusModeTaskCountSetting.toString());
        localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
        updateStats();
        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals();
        if (currentUser && firestoreDB && source === 'local') {
            // TODO: Firestore 저장 로직 (다음 단계)
            // console.log("Firebase save called for user:", currentUser.uid);
        }
    }
    function loadState(source = 'local') {
        // Firebase에서 먼저 로드하는 로직은 initializeApp의 onAuthStateChanged에서 처리
        const savedAppMode = localStorage.getItem('oneulSetMode') || 'simple';
        const storedFocusTaskCount = localStorage.getItem('oneulSetFocusTaskCountSetting');
        if (storedFocusTaskCount) {
            focusModeTaskCountSetting = parseInt(storedFocusTaskCount, 10);
        } else {
            focusModeTaskCountSetting = 3;
        }
        if(taskCountSelector) taskCountSelector.value = focusModeTaskCountSetting;
        const storedShareOptions = localStorage.getItem('oneulSetShareOptions');
        if (storedShareOptions) {
            try {
                shareOptions = JSON.parse(storedShareOptions);
                if (shareIncludeAdditionalCheckbox) shareIncludeAdditionalCheckbox.checked = shareOptions.includeAdditional;
                if (shareIncludeMemosCheckbox) shareIncludeMemosCheckbox.checked = shareOptions.includeMemos;
            } catch (e) { console.error("Error parsing share options:", e); }
        }
        applyAppMode(savedAppMode, true); // UI 렌더링을 위해 먼저 실행
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
                while(tasks.length < 5) { tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' }); }
                if(tasks.length > 5) tasks = tasks.slice(0,5);
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
            initializeTasks();
            if (currentAppMode === 'focus') additionalTasks = [];
            saveState('local');
        }
        while (tasks.length < 5) { tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' }); }
        if (tasks.length > 5) { tasks = tasks.slice(0, 5); }
        updateStats();
        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals();
        if (currentAppMode === 'focus') renderAdditionalTasks();
        renderTasks(); // loadState 후 항상 renderTasks 호출
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
            focusModeTaskCountSetting = newCount;
            MAX_TASKS_CURRENT_MODE = newCount;
            renderTasks();
            saveState('local');
            announceToScreenReader(`핵심 할 일 개수가 ${newCount}개로 변경되었습니다.`);
        });
    }
    function renderTasks() { /* ... 이전과 동일 ... */
        if(!taskListDiv) return;
        taskListDiv.innerHTML = '';
        const tasksToRender = tasks.slice(0, MAX_TASKS_CURRENT_MODE);

        tasksToRender.forEach((task, index) => {
            const originalTaskIndex = tasks.findIndex(t => t.id === task.id);
            if (originalTaskIndex === -1) return; // 안전 장치

            const taskItem = document.createElement('div');
            taskItem.classList.add('task-item');
            if (tasks[originalTaskIndex].completed) { taskItem.classList.add('completed'); } // 실제 tasks 배열의 completed 상태 사용

            const checkboxLabel = document.createElement('label');
            checkboxLabel.classList.add('custom-checkbox-label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = tasks[originalTaskIndex].completed; // 실제 tasks 배열의 completed 상태 사용
            checkbox.setAttribute('aria-label', `핵심 할 일 ${index + 1} 완료`);
            checkbox.id = `task-checkbox-${tasks[originalTaskIndex].id}`; // 고유 ID 사용
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
            textareaField.value = tasks[originalTaskIndex].text; // 실제 tasks 배열의 text 사용
            textareaField.setAttribute('aria-label', `할 일 ${index + 1} 내용`);
            textareaField.addEventListener('input', (e) => { tasks[originalTaskIndex].text = e.target.value; autoGrowTextarea(e.target); });
            textareaField.addEventListener('blur', () => { saveState('local'); }); // blur 시 저장
            textareaField.addEventListener('focus', (e) => { autoGrowTextarea(e.target); }); // 포커스 시 높이 조절

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
                memoTextarea.value = tasks[originalTaskIndex].memo || ""; // 실제 tasks 배열의 memo 사용
                memoTextarea.setAttribute('aria-label', `할 일 ${index + 1} 메모 내용`);
                memoTextarea.addEventListener('input', (e) => { tasks[originalTaskIndex].memo = e.target.value; autoGrowTextarea(e.target);});
                memoTextarea.addEventListener('blur', () => { saveState('local'); }); // blur 시 저장
                memoContainer.appendChild(memoTextarea);
                taskItem.appendChild(memoContainer); // taskItem에 memoContainer 추가

                memoIcon.addEventListener('click', () => {
                    const isHidden = memoContainer.classList.toggle('hidden');
                    memoIcon.setAttribute('aria-expanded', !isHidden);
                    if(!isHidden) memoTextarea.focus();
                    else textareaField.focus();
                    autoGrowTextarea(textareaField); // 메인 textarea 높이도 재조정
                    if(!isHidden) autoGrowTextarea(memoTextarea); // 메모 textarea 높이도 재조정
                });
                if (tasks[originalTaskIndex].memo && tasks[originalTaskIndex].memo.trim() !== "") {
                    memoIcon.classList.add('has-memo');
                }
                // 메모 내용 변경 시 has-memo 클래스 업데이트
                memoTextarea.addEventListener('input', (e) => {
                    tasks[originalTaskIndex].memo = e.target.value;
                    autoGrowTextarea(e.target);
                    memoIcon.classList.toggle('has-memo', e.target.value.trim() !== "");
                });
            }

            taskItem.appendChild(checkboxLabel);
            taskItem.appendChild(taskContentDiv);
            taskListDiv.appendChild(taskItem);
            autoGrowTextarea(textareaField); // 초기 높이 조절
        });
        checkAllDone();
     }
    function checkAllDone() { /* ... 이전과 동일 ... */
        if(!allDoneMessageEl || !tasks) return; // null 체크 추가
        const tasksToCheck = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
        // 실제 내용이 있는 할 일만 필터링
        const filledTasks = tasksToCheck.filter(task => typeof task.text === 'string' && task.text.trim() !== "");
        const completedFilledTasks = filledTasks.filter(task => task.completed);

        // 내용이 있는 모든 핵심과제가 완료되었을 때 메시지 표시
        const shouldShowMessage = filledTasks.length === MAX_TASKS_CURRENT_MODE && completedFilledTasks.length === MAX_TASKS_CURRENT_MODE && MAX_TASKS_CURRENT_MODE > 0;
        allDoneMessageEl.classList.toggle('hidden', !shouldShowMessage);
    }
    function renderAdditionalTasks() { /* ... 이전과 동일 ... */
        if (currentAppMode === 'simple' || !additionalTaskListDiv) {
            if(additionalTaskListDiv) additionalTaskListDiv.innerHTML = ''; // 심플모드면 내용 비우기
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
            const taskItem = document.createElement('div');
            taskItem.classList.add('additional-task-item');
            if (task.completed) taskItem.classList.add('completed');

            const checkboxLabel = document.createElement('label');
            checkboxLabel.classList.add('custom-checkbox-label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.id = `additional-task-checkbox-${task.id}`; // 고유 ID 사용
            checkbox.setAttribute('aria-label', `추가 과제 "${task.text}" 완료`);
            checkboxLabel.htmlFor = checkbox.id;
            const checkboxSpan = document.createElement('span');
            checkboxSpan.classList.add('custom-checkbox-span');

            checkbox.addEventListener('change', () => {
                additionalTasks[index].completed = checkbox.checked; // 실제 배열 업데이트
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
                const taskTextToAnnounce = additionalTasks[index].text; // 삭제 전 텍스트 저장
                additionalTasks.splice(index, 1); // 실제 배열에서 삭제
                renderAdditionalTasks(); // 목록 다시 렌더링
                saveState('local');
                announceToScreenReader(`추가 과제 "${taskTextToAnnounce}"가 삭제되었습니다.`);
            });

            taskItem.appendChild(checkboxLabel);
            taskItem.appendChild(taskText);
            taskItem.appendChild(deleteBtn);
            additionalTaskListDiv.appendChild(taskItem);
        });
    }
    if (addAdditionalTaskBtn && addAdditionalTaskInput) { /* ... 이전과 동일 ... */
        addAdditionalTaskBtn.addEventListener('click', () => {
            if (currentAppMode === 'simple') return;
            const text = addAdditionalTaskInput.value.trim();
            if (text) {
                additionalTasks.push({ id: Date.now(), text: text, completed: false }); // 고유 ID 생성
                addAdditionalTaskInput.value = '';
                renderAdditionalTasks();
                saveState('local');
                announceToScreenReader(`추가 과제 "${text}"가 추가되었습니다.`);
                addAdditionalTaskInput.focus(); // 입력 후 다시 포커스
            }
        });
        addAdditionalTaskInput.addEventListener('keypress', (e) => {
            if (currentAppMode === 'simple') return;
            if (e.key === 'Enter') {
                addAdditionalTaskBtn.click(); // Enter키로 추가
            }
        });
    }
    const sections = [ /* ... 이전과 동일 ... */
        { id: 'history-section', button: toggleHistoryBtn, baseText: '기록' },
        { id: 'stats-section', button: toggleStatsBtn, baseText: '통계' },
        { id: 'share-section', button: toggleShareBtn, baseText: '공유' },
        { id: 'settings-section', button: toggleSettingsBtn, baseText: '설정' }
    ];
    function toggleSection(sectionIdToToggle) { /* ... 이전과 동일 ... */
        let sectionOpenedName = "";
        sections.forEach(sec => {
            if (!sec.button) return; // 버튼 없으면 스킵

            const sectionElement = document.getElementById(sec.id);
            if (!sectionElement) return; // 섹션 요소 없으면 스킵

            // 모드에 따른 특정 UI 요소 표시/숨김 (토글 시 재확인)
            if (currentAppMode === 'simple') {
                if (sec.id === 'stats-section' && statsVisualsContainer) statsVisualsContainer.classList.add('hidden');
                if (sec.id === 'share-section' && shareAsImageBtnContainer) shareAsImageBtnContainer.classList.add('hidden');
                if (sec.id === 'settings-section' && settingsContentDiv) settingsContentDiv.classList.add('hidden');
                if (sec.id === 'share-section' && shareOptionsDiv) shareOptionsDiv.classList.add('hidden');
            } else { // 'focus' mode
                 if (sec.id === 'stats-section' && statsVisualsContainer) statsVisualsContainer.classList.remove('hidden');
                 if (sec.id === 'share-section' && shareAsImageBtnContainer) shareAsImageBtnContainer.classList.remove('hidden');
                 if (sec.id === 'settings-section' && settingsContentDiv) settingsContentDiv.classList.remove('hidden');
                 if (sec.id === 'share-section' && shareOptionsDiv) shareOptionsDiv.classList.remove('hidden');
            }

            if (sec.id === sectionIdToToggle) { // 토글하려는 섹션인 경우
                const isHidden = sectionElement.classList.toggle('hidden'); // 클래스 토글하고 현재 상태 가져오기
                sec.button.textContent = isHidden ? sec.baseText : `${sec.baseText} 닫기`;
                sec.button.setAttribute('aria-expanded', !isHidden);
                sectionElement.setAttribute('aria-hidden', isHidden);

                if (!isHidden) { // 섹션이 열렸다면
                    sec.button.classList.add('active');
                    sectionOpenedName = sec.baseText;
                    // 특정 섹션 열릴 때 추가 작업
                    if (sec.id === 'history-section') renderHistory();
                    if (sec.id === 'stats-section') {
                        updateStats();
                        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals();
                    }
                } else { // 섹션이 닫혔다면
                    sec.button.classList.remove('active');
                }
            } else { // 다른 섹션들은 모두 닫기
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
    function renderHistory() { /* ... 이전과 동일 ... */
        if (!historyListDiv) return; // null 체크
        if (history.length === 0) { historyListDiv.innerHTML = '<p>지난 기록이 없습니다.</p>'; return; }
        historyListDiv.innerHTML = ''; // 이전 내용 지우기
        history.forEach(entry => {
            if (!entry || !entry.date || !Array.isArray(entry.tasks)) return; // 유효성 검사
            const entryDiv = document.createElement('div'); entryDiv.classList.add('history-entry'); entryDiv.dataset.achieved = entry.achieved ? "true" : "false"; const dateStrong = document.createElement('strong'); dateStrong.textContent = `${entry.date.replaceAll('-', '.')}. ${entry.achieved ? "🎯" : ""}`; entryDiv.appendChild(dateStrong); const ul = document.createElement('ul');
            entry.tasks.forEach(task => { if(!task || typeof task.text !== 'string') return; const li = document.createElement('li'); li.textContent = task.text.length > 50 ? task.text.substring(0, 50) + "..." : task.text; li.title = task.text; if (task.completed) { li.classList.add('completed'); } ul.appendChild(li); });
            entryDiv.appendChild(ul); historyListDiv.appendChild(entryDiv);
        });
    }
    function calculateAchievementRate(days) { /* ... 이전과 동일 ... */
        if (history.length === 0) return "0% (기록 없음)";
        const today = new Date(); today.setHours(0, 0, 0, 0);
        let achievementCount = 0, relevantDaysCount = 0;
        const recentHistory = history.slice(0, days * 2); // 최대 2배수 정도만 봄

        for (let i = 0; i < recentHistory.length; i++) {
            const entry = recentHistory[i];
            if (!entry || !entry.date) continue;
            const entryDate = new Date(entry.date);
            const diffTime = today.getTime() - entryDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < days && diffDays >= 0) { // 0일 전 (오늘) ~ days-1일 전
                 relevantDaysCount++;
                 if (entry.achieved) { achievementCount++; }
            }
            if (relevantDaysCount >= days) break; // N일치 다 찾았으면 종료
        }
        if (relevantDaysCount === 0) return `0% (최근 ${days}일 기록 없음)`;
        const rate = (achievementCount / relevantDaysCount) * 100;
        return `${rate.toFixed(0)}% (${achievementCount}/${relevantDaysCount}일)`;
    }
    function updateStats() { /* ... 이전과 동일 ... */
        if(weeklyStatsEl) weeklyStatsEl.textContent = `지난 7일간 달성률: ${calculateAchievementRate(7)}`;
        if(monthlyStatsEl) monthlyStatsEl.textContent = `지난 30일간 달성률: ${calculateAchievementRate(30)}`;
    }
    function renderStatsVisuals() { /* ... 이전과 동일 ... */
        if (currentAppMode === 'simple' || !Chart || !dailyAchievementChartCtx || !statsVisualsContainer || !streakDaysEl || !mostAchievedDayEl) {
            if(statsVisualsContainer) statsVisualsContainer.classList.add('hidden'); // 심플모드이거나 필수요소 없으면 숨김
            if (achievementChart) { achievementChart.destroy(); achievementChart = null; }
            return;
        }
        if(statsVisualsContainer) statsVisualsContainer.classList.remove('hidden'); // 집중모드면 보이게

        // 연속 달성일 계산 (오늘 포함)
        let currentStreak = 0;
        let dateToCheck = new Date();
        // 1. 오늘의 달성 여부 먼저 확인
        const todayTasksForStreak = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
        const todayFilled = todayTasksForStreak.every(t => t.text.trim() !== "");
        const todayCompleted = todayTasksForStreak.every(t => t.completed);
        if (todayFilled && todayTasksForStreak.length === MAX_TASKS_CURRENT_MODE && todayCompleted && MAX_TASKS_CURRENT_MODE > 0) {
            currentStreak++;
        }
        // 2. 어제부터 히스토리 확인 (오늘 달성 못했으면 연속은 0이므로, 오늘 달성했을 때만 어제부터 체크)
        if (currentStreak > 0 || history.length > 0) { // 오늘 달성했거나, 히스토리가 있어야 어제부터 체크 의미 있음
            if (currentStreak > 0) { // 오늘 달성한 경우, 어제부터 히스토리 탐색
                 dateToCheck.setDate(dateToCheck.getDate() - 1); // 어제부터 시작
                 for (let i = 0; i < history.length; i++) { // 히스토리 전체 탐색
                    const entryDateStr = `${dateToCheck.getFullYear()}-${String(dateToCheck.getMonth() + 1).padStart(2, '0')}-${String(dateToCheck.getDate()).padStart(2, '0')}`;
                    const entry = history.find(h => h.date === entryDateStr);
                    if (entry && entry.achieved) {
                        currentStreak++;
                    } else {
                        break; // 연속 깨짐
                    }
                    dateToCheck.setDate(dateToCheck.getDate() - 1); // 하루씩 이전으로
                    if (currentStreak > 365) break; // 무한루프 방지 (1년 이상이면 충분)
                 }
            }
        }
        streakDaysEl.textContent = `${currentStreak}일`;

        // 최다 달성 요일
        const dayMap = ['일', '월', '화', '수', '목', '금', '토'];
        const achievementByDay = [0, 0, 0, 0, 0, 0, 0];
        history.filter(entry => entry.achieved).forEach(entry => { // 달성한 기록만
            const dayIndex = new Date(entry.date).getDay(); // 0 (일요일) ~ 6 (토요일)
            achievementByDay[dayIndex]++;
        });
        const maxAchievedCount = Math.max(...achievementByDay);
        const mostAchievedDays = [];
        achievementByDay.forEach((count, index) => {
            if (count === maxAchievedCount && count > 0) { // 최대값이면서 0보다 커야 의미 있음
                mostAchievedDays.push(dayMap[index]);
            }
        });
        mostAchievedDayEl.textContent = mostAchievedDays.length > 0 ? mostAchievedDays.join(', ') + '요일' : '기록 없음';

        // 최근 30일 달성 추이 (오늘 포함)
        const labels = [];
        const dataPoints = [];
        const todayForChart = new Date();
        for (let i = 29; i >= 0; i--) { // 오늘(i=0)부터 29일 전(i=29)까지
            const targetDate = new Date(todayForChart);
            targetDate.setDate(todayForChart.getDate() - i);
            const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
            labels.push(dateStr.substring(5)); // MM-DD 형식

            let achievedThisDayForChart = false;
            if (i === 0) { // 오늘 날짜인 경우
                const todayTasksForChart = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
                const filledForChart = todayTasksForChart.every(t=> t.text.trim() !== "");
                const completedForChart = todayTasksForChart.every(t => t.completed);
                achievedThisDayForChart = filledForChart && todayTasksForChart.length === MAX_TASKS_CURRENT_MODE && completedForChart && MAX_TASKS_CURRENT_MODE > 0;
            } else { // 과거 날짜인 경우 히스토리에서 찾기
                const entry = history.find(h => h.date === dateStr);
                if (entry) achievedThisDayForChart = entry.achieved;
            }
            dataPoints.push(achievedThisDayForChart ? 1 : 0);
        }

        if (achievementChart) { achievementChart.destroy(); } // 기존 차트 파괴

        const isDarkMode = document.body.classList.contains('dark-theme');
        const gridColor = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--chart-grid-color-dark' : '--chart-grid-color-light').trim();
        const fontColor = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--chart-font-color-dark' : '--chart-font-color-light').trim();
        const primaryButtonBg = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--button-primary-bg-dark' : '--button-primary-bg-light').trim();

        achievementChart = new Chart(dailyAchievementChartCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '일일 목표 달성 여부',
                    data: dataPoints,
                    borderColor: primaryButtonBg,
                    backgroundColor: Chart.helpers.color(primaryButtonBg).alpha(0.2).rgbString(), // chart.js v3+
                    tension: 0.1,
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 1, ticks: { stepSize: 1, color: fontColor, callback: (v) => v === 1 ? '달성' : (v === 0 ? '미달성' : null) }, grid: { color: gridColor } },
                    x: { ticks: { color: fontColor }, grid: { color: gridColor } }
                },
                plugins: { legend: { labels: { color: fontColor } }, tooltip: { callbacks: { label: (c) => c.parsed.y === 1 ? '달성' : '미달성' } } }
            }
        });
        if(dailyAchievementChartCtx.canvas) dailyAchievementChartCtx.canvas.setAttribute('aria-label', '지난 30일간 일일 목표 달성 추이 그래프');
    }
    const shareUrl = window.location.href; /* ... 이전과 동일 ... */
    function getShareText() { /* ... 이전과 동일 ... */
        const hashtags = "#오늘할일 #집중력 #오늘셋팁";
        return `오늘 할 일, 딱 ${MAX_TASKS_CURRENT_MODE}개만 골라서 집중 완료! 🎯 이렇게 하니 하루가 깔끔하네. (비법은 오늘셋 🤫) ${shareUrl} ${hashtags}`;
    }
    if(copyLinkBtn) { /* ... 이전과 동일 ... */
        copyLinkBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(shareUrl).then(() => { const originalHTML = copyLinkBtn.innerHTML; copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> 복사 완료!'; copyLinkBtn.classList.add('copy-success'); copyLinkBtn.disabled = true; setTimeout(() => { copyLinkBtn.innerHTML = originalHTML; copyLinkBtn.classList.remove('copy-success'); copyLinkBtn.disabled = false; }, 1500); announceToScreenReader("링크가 복사되었습니다."); }).catch(err => { console.error('링크 복사 실패:', err); alert('링크 복사에 실패했습니다.'); });
        });
    }
    if(shareTwitterBtn) { /* ... 이전과 동일 ... */
        shareTwitterBtn.addEventListener('click', (e) => {
            e.preventDefault(); // 기본 동작 방지
            const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText())}`; // URL은 텍스트에 포함
            window.open(twitterUrl, '_blank');
        });
    }
    if (shareIncludeAdditionalCheckbox) { /* ... 이전과 동일 ... */
        shareIncludeAdditionalCheckbox.addEventListener('change', (e) => {
            shareOptions.includeAdditional = e.target.checked;
            saveState('local'); // 설정 변경 시 저장
        });
    }
    if (shareIncludeMemosCheckbox) { /* ... 이전과 동일 ... */
        shareIncludeMemosCheckbox.addEventListener('change', (e) => {
            shareOptions.includeMemos = e.target.checked;
            saveState('local'); // 설정 변경 시 저장
        });
    }
    if (shareAsImageBtn && typeof html2canvas !== 'undefined') { /* ... 이전과 동일 ... */
        shareAsImageBtn.addEventListener('click', () => {
            if (currentAppMode === 'simple') {
                alert("이미지 공유는 집중 모드에서만 사용 가능합니다.");
                return;
            }
            const originalBtnText = shareAsImageBtn.innerHTML;
            shareAsImageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
            shareAsImageBtn.disabled = true;

            const captureArea = document.createElement('div');
            captureArea.id = 'image-capture-area'; // 임시 ID
            captureArea.style.padding = '20px';
            captureArea.style.width = '500px'; // 이미지 너비 고정
            const isDarkMode = document.body.classList.contains('dark-theme');
            captureArea.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--container-bg-color-dark' : '--container-bg-color-light').trim();
            captureArea.style.color = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--text-color-primary-dark' : '--text-color-primary-light').trim();
            captureArea.style.fontFamily = getComputedStyle(document.body).fontFamily;
            captureArea.style.lineHeight = getComputedStyle(document.body).lineHeight;

            const titleEl = document.createElement('h1');
            titleEl.textContent = "오늘셋";
            titleEl.style.fontSize = '2em'; titleEl.style.fontWeight = '700'; titleEl.style.textAlign = 'center'; titleEl.style.marginBottom = '5px';
            captureArea.appendChild(titleEl);

            const dateEl = document.createElement('p');
            if(currentDateEl) dateEl.textContent = currentDateEl.textContent; // null 체크
            dateEl.style.fontSize = '0.9em'; dateEl.style.textAlign = 'center'; dateEl.style.marginBottom = '15px';
            dateEl.style.color = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--text-color-tertiary-dark' : '--text-color-tertiary-light').trim();
            captureArea.appendChild(dateEl);

            const taskListWrapperOriginal = document.querySelector('.task-list-wrapper');
            if (taskListWrapperOriginal && taskListDiv) { // null 체크
                const taskListWrapperClone = taskListWrapperOriginal.cloneNode(true);
                // 불필요한 요소 제거 또는 수정 (캡처용)
                const clonedAllDoneMsg = taskListWrapperClone.querySelector('#all-done-message');
                if (clonedAllDoneMsg && clonedAllDoneMsg.classList.contains('hidden')) clonedAllDoneMsg.remove();

                // 핵심 과제만 (MAX_TASKS_CURRENT_MODE 만큼)
                const clonedTaskList = taskListWrapperClone.querySelector('.task-list');
                if (clonedTaskList) {
                    const allClonedItems = Array.from(clonedTaskList.children);
                    allClonedItems.forEach((item, index) => {
                        if (index >= MAX_TASKS_CURRENT_MODE) {
                             item.remove();
                        } else { // 메모 처리
                            const originalTaskItem = taskListDiv.children[index]; // Get original item for memo content
                            if (!originalTaskItem) return;

                            const memoIconClone = item.querySelector('.memo-icon');
                            const memoContainerClone = item.querySelector('.memo-container');

                            if (currentAppMode === 'focus' && shareOptions.includeMemos) {
                                const originalMemoTextarea = originalTaskItem.querySelector('.memo-container textarea');
                                if (memoContainerClone && originalMemoTextarea && originalMemoTextarea.value.trim() !== "") {
                                    memoContainerClone.classList.remove('hidden'); // 보이도록
                                    const memoTextareaClone = memoContainerClone.querySelector('textarea');
                                    if (memoTextareaClone) { // textarea를 div로 대체 (캡처용)
                                        const memoDiv = document.createElement('div');
                                        memoDiv.textContent = originalMemoTextarea.value;
                                        memoDiv.style.whiteSpace = 'pre-wrap';
                                        memoDiv.style.wordBreak = 'break-word';
                                        memoDiv.style.fontSize = getComputedStyle(memoTextareaClone).fontSize;
                                        memoDiv.style.fontFamily = getComputedStyle(memoTextareaClone).fontFamily;
                                        memoDiv.style.lineHeight = getComputedStyle(memoTextareaClone).lineHeight;
                                        memoDiv.style.padding = getComputedStyle(memoTextareaClone).padding;
                                        memoDiv.style.color = getComputedStyle(memoTextareaClone).color;
                                        memoContainerClone.replaceChild(memoDiv, memoTextareaClone);
                                    }
                                } else { // No memo or not including, remove memo elements
                                    if (memoContainerClone) memoContainerClone.remove();
                                    if (memoIconClone) memoIconClone.remove();
                                }
                            } else { // Not focus mode or not including memos
                                if (memoContainerClone) memoContainerClone.remove();
                                if (memoIconClone) memoIconClone.remove();
                            }
                        }
                    });
                }
                taskListWrapperClone.style.marginTop = '0'; // 위쪽 마진 제거
                captureArea.appendChild(taskListWrapperClone);
            }


            if (currentAppMode === 'focus' && shareOptions.includeAdditional && additionalTasks.length > 0) {
                const additionalTasksSectionOriginal = document.getElementById('additional-tasks-section');
                if(additionalTasksSectionOriginal && additionalTaskListDiv){ // null 체크
                    const additionalTasksSectionClone = additionalTasksSectionOriginal.cloneNode(true); // Clone the whole section for title
                    additionalTasksSectionClone.classList.remove('toggle-section-static', 'hidden'); // 보이도록
                    const addInputArea = additionalTasksSectionClone.querySelector('.add-additional-task');
                    if(addInputArea) addInputArea.remove(); // 입력 부분 제거

                    const clonedAdditionalList = additionalTasksSectionClone.querySelector('#additional-task-list');
                    if(clonedAdditionalList) { // Re-populate with current additional tasks
                        clonedAdditionalList.innerHTML = ''; // Clear cloned content
                        additionalTasks.forEach(task => {
                            const item = document.createElement('div');
                            item.className = 'additional-task-item'; // Add class for styling
                            if (task.completed) item.classList.add('completed');

                            // Create a simple text representation, no interactive elements
                            const textSpan = document.createElement('span');
                            textSpan.textContent = (task.completed ? '✅ ' : '◻️ ') + task.text;
                            textSpan.style.fontSize = '0.95em'; // Match style
                            textSpan.style.color = task.completed ? getComputedStyle(document.documentElement).getPropertyValue('--completed-text-color').trim() : 'inherit';
                            if(task.completed) textSpan.style.textDecoration = 'line-through';

                            item.appendChild(textSpan);
                            clonedAdditionalList.appendChild(item);
                        });
                    }
                    additionalTasksSectionClone.style.marginTop = '20px';
                    captureArea.appendChild(additionalTasksSectionClone);
                }
            }

            const linkEl = document.createElement('p');
            linkEl.textContent = 'todayset.vercel.app'; // 실제 앱 주소 또는 원하는 문구
            linkEl.style.fontSize = '0.8em'; linkEl.style.textAlign = 'center'; linkEl.style.marginTop = '20px';
            linkEl.style.color = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--link-color-dark' : '--link-color-light').trim();
            captureArea.appendChild(linkEl);

            captureArea.style.position = 'absolute'; captureArea.style.left = '-9999px';
            document.body.appendChild(captureArea);

            html2canvas(captureArea, {
                useCORS: true,
                scale: window.devicePixelRatio || 1,
                logging: false,
                onclone: (clonedDoc) => {
                    if (!taskListDiv) return;
                    const clonedTaskTextareas = Array.from(clonedDoc.querySelectorAll('.task-list-wrapper .task-item textarea:not(.memo-container textarea)'));
                    const originalTaskTextareas = Array.from(taskListDiv.querySelectorAll('.task-item textarea:not(.memo-container textarea)'));
                    clonedTaskTextareas.forEach((clonedTextarea, i) => {
                        if (originalTaskTextareas[i]) {
                            clonedTextarea.value = originalTaskTextareas[i].value;
                            clonedTextarea.style.height = "auto";
                            clonedTextarea.style.height = (clonedTextarea.scrollHeight) + "px";
                            clonedTextarea.style.overflowY = 'hidden';
                        }
                    });
                }
            }).then(canvas => {
                const imageURL = canvas.toDataURL('image/png');
                const downloadLink = document.createElement('a');
                downloadLink.href = imageURL;
                downloadLink.download = `오늘셋_할일_${getTodayDateString()}.png`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                announceToScreenReader("할 일 목록 이미지가 다운로드되었습니다.");
            }).catch(err => {
                console.error('이미지 생성 실패:', err);
                alert('이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
            }).finally(() => {
                if (document.body.contains(captureArea)) {
                    document.body.removeChild(captureArea);
                }
                shareAsImageBtn.innerHTML = originalBtnText;
                shareAsImageBtn.disabled = false;
            });
        });
    }
    if (exportDataBtn) { /* ... 이전과 동일 ... */
        exportDataBtn.addEventListener('click', () => {
            if (currentAppMode === 'simple' && !confirm("심플 모드에서는 일부 데이터(추가 과제, 메모 등)가 제외된 상태로 표시될 수 있습니다. 현재 집중 모드 설정과 모든 데이터를 포함하여 내보냅니다. 계속하시겠습니까?")) {
                 // return; // User cancelled
            }
            const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
            const settingsToExport = {
                appMode: currentAppMode,
                theme: currentTheme,
                focusTaskCount: focusModeTaskCountSetting,
                shareOptions: shareOptions
            };

            const dataToExport = {
                version: APP_VERSION_DATA_FORMAT,
                appSettings: settingsToExport,
                tasks: tasks, // Full tasks array (up to 5)
                additionalTasks: additionalTasks, // Full additional tasks
                history: history,
            };
            const dataStr = JSON.stringify(dataToExport, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const exportFileDefaultName = `오늘셋_백업_${getTodayDateString()}.json`;
            let linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click(); // 다운로드 트리거
            linkElement.remove(); // 링크 제거
            const originalText = exportDataBtn.innerHTML; // 아이콘 포함 텍스트
            exportDataBtn.innerHTML = '<i class="fas fa-check"></i> 내보내기 완료!';
            announceToScreenReader("로컬 데이터를 성공적으로 내보냈습니다.");
            setTimeout(() => { exportDataBtn.innerHTML = originalText; }, 2000);
        });
    }
    if (importDataBtn && importFileInput) { /* ... 이전과 동일 ... */
        importDataBtn.addEventListener('click', () => {
            importFileInput.click(); // 숨겨진 파일 입력 필드 클릭
        });

        importFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        if (confirm("현재 로컬 데이터를 덮어쓰고 가져온 데이터로 복원하시겠습니까? 이 작업은 되돌릴 수 없습니다. 클라우드 데이터와는 별개입니다.")) {
                            if (importedData.version !== APP_VERSION_DATA_FORMAT && !confirm(`데이터 형식이 현재 앱 버전(${APP_VERSION_DATA_FORMAT})과 다릅니다 (${importedData.version || '알 수 없음'}). 계속 진행하시겠습니까? 호환성 문제가 발생할 수 있습니다.`)) {
                                importFileInput.value = ''; // 파일 선택 초기화
                                return;
                            }

                            const importedSettings = importedData.appSettings;
                            if (importedSettings) {
                                currentAppMode = importedSettings.appMode || 'simple';
                                localStorage.setItem('oneulSetMode', currentAppMode);

                                const themeToApply = importedSettings.theme || 'dark';
                                localStorage.setItem('oneulSetTheme', themeToApply);

                                focusModeTaskCountSetting = importedSettings.focusTaskCount || 3;
                                localStorage.setItem('oneulSetFocusTaskCountSetting', focusModeTaskCountSetting.toString());
                                if(taskCountSelector) taskCountSelector.value = focusModeTaskCountSetting;

                                shareOptions = importedSettings.shareOptions || { includeAdditional: false, includeMemos: false };
                                localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
                                if (shareIncludeAdditionalCheckbox) shareIncludeAdditionalCheckbox.checked = shareOptions.includeAdditional;
                                if (shareIncludeMemosCheckbox) shareIncludeMemosCheckbox.checked = shareOptions.includeMemos;
                            } else {
                                currentAppMode = localStorage.getItem('oneulSetMode') || 'simple';
                                focusModeTaskCountSetting = parseInt(localStorage.getItem('oneulSetFocusTaskCountSetting') || '3', 10);
                            }

                            tasks = importedData.tasks || [];
                            additionalTasks = importedData.additionalTasks || [];
                            history = importedData.history || [];

                            while (tasks.length < 5) { tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });}
                            if (tasks.length > 5) tasks = tasks.slice(0,5);

                            applyTheme(localStorage.getItem('oneulSetTheme') || 'dark', true);
                            applyAppMode(currentAppMode, true);

                            updateStats();
                            if(currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals();
                            renderHistory();

                            saveState('local');

                            if (confirm("로컬 데이터를 성공적으로 가져왔습니다. 변경사항을 완전히 적용하려면 페이지를 새로고침하는 것이 좋습니다. 지금 새로고침하시겠습니까?")) {
                                window.location.reload();
                            } else {
                                announceToScreenReader("로컬 데이터를 성공적으로 가져왔습니다. 일부 변경사항은 페이지를 새로고침해야 적용될 수 있습니다.");
                            }
                        }
                    } catch (err) {
                        alert("데이터 가져오기 실패: 유효한 JSON 파일이 아니거나 파일이 손상되었습니다.");
                        console.error("Import error:", err);
                    } finally {
                        importFileInput.value = '';
                    }
                };
                reader.readAsText(file);
            }
        });
    }
    document.addEventListener('keydown', (e) => { /* ... 이전과 동일 ... */
        if ((e.altKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
            if (currentAppMode === 'focus' && addAdditionalTaskInput && additionalTasksSection && !additionalTasksSection.classList.contains('hidden')) {
                e.preventDefault();
                addAdditionalTaskInput.focus();
            }
        }

        if (e.key === 'Escape') {
            // 모달 닫기
            const authModal = document.getElementById('auth-modal');
            if (authModal) {
                authModal.remove();
                return; // 모달이 닫혔으면 다른 Escape 동작은 하지 않음
            }

            if (currentAppMode === 'focus') {
                const activeMemoContainer = document.querySelector('.memo-container:not(.hidden)');
                if (activeMemoContainer) {
                    const taskItem = activeMemoContainer.closest('.task-item');
                    const memoIcon = taskItem?.querySelector('.memo-icon');
                    memoIcon?.click();
                }
            }
            let sectionClosed = false;
            sections.forEach(sec => {
                const sectionElement = document.getElementById(sec.id);
                if (sectionElement && !sectionElement.classList.contains('hidden')) {
                    toggleSection(sec.id);
                    sectionClosed = true;
                }
            });
            if (sectionClosed) announceToScreenReader("열린 섹션이 닫혔습니다.");

            if (document.activeElement === addAdditionalTaskInput) {
                addAdditionalTaskInput.blur();
            }
        }

        if (document.activeElement?.closest('.task-list')) {
            const currentTaskItem = document.activeElement.closest('.task-item');
            if (!currentTaskItem || !taskListDiv) return;

            const focusableElementsInItem = Array.from(currentTaskItem.querySelectorAll('textarea, .memo-icon'));
            const currentIndex = focusableElementsInItem.indexOf(document.activeElement);
            const allTaskItems = Array.from(taskListDiv.querySelectorAll('.task-item'));
            const currentTaskItemIndex = allTaskItems.indexOf(currentTaskItem);

            if (e.key === 'Tab' && !e.shiftKey) {
                if (currentIndex === focusableElementsInItem.length - 1) {
                    if (currentTaskItemIndex < MAX_TASKS_CURRENT_MODE - 1 && currentTaskItemIndex < allTaskItems.length -1) {
                        e.preventDefault();
                        allTaskItems[currentTaskItemIndex + 1].querySelector('textarea:not(.memo-container textarea)')?.focus();
                    }
                }
            } else if (e.key === 'Tab' && e.shiftKey) {
                 if (currentIndex === 0) {
                    if (currentTaskItemIndex > 0) {
                        e.preventDefault();
                        const prevItemFocusables = Array.from(allTaskItems[currentTaskItemIndex - 1].querySelectorAll('textarea:not(.memo-container textarea), .memo-icon'));
                        prevItemFocusables[prevItemFocusables.length -1]?.focus();
                    }
                 }
            }
        }
    });


    // --- 초기화 실행 ---
    function initializeApp() {
        const initialTheme = localStorage.getItem('oneulSetTheme') || 'dark';
        applyTheme(initialTheme, true);
        displayCurrentDate();

        if (firebaseAuth) {
            firebaseAuth.onAuthStateChanged(user => {
                updateAuthUI(user);
                if (user) {
                    console.log("User logged in:", user.uid);
                    // TODO: Firestore에서 데이터 로드 (loadState('firebase'))
                    // 지금은 로컬 데이터 우선 로드, 추후 Firebase와 병합/선택 로직
                    loadState('local'); // 로그인 후 로컬 데이터 다시 로드 (UI 갱신)
                    announceToScreenReader(`${user.displayName || user.email}님, 환영합니다.`);
                } else {
                    console.log("User logged out or not logged in.");
                    loadState('local'); // 로그아웃 후 로컬 데이터 로드
                }
            });
        } else {
            console.warn("Firebase Auth not available. Falling back to local data only.");
            loadState('local');
        }

        sections.forEach(sec => {
            if(sec.button) sec.button.textContent = sec.baseText;
            const sectionElement = document.getElementById(sec.id);
            if (sectionElement) {
                sectionElement.setAttribute('aria-hidden', 'true');
                if(sec.button) sec.button.setAttribute('aria-expanded', 'false');
            }
        });
    }

    initializeApp();
});
