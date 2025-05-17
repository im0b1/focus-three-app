// script.js - v1.11-pwa
document.addEventListener('DOMContentLoaded', () => {
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
    if (chartCanvas) dailyAchievementChartCtx = chartCanvas.getContext('2d'); // null 체크 추가
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

    // --- 전역 변수 ---
    let MAX_TASKS_CURRENT_MODE = 3;
    let tasks = [];
    let additionalTasks = [];
    let history = [];
    let achievementChart = null;
    let currentAppMode = 'simple'; // HTML 기본값과 일치
    let focusModeTaskCountSetting = 3; // HTML 기본값과 일치
    let shareOptions = {
        includeAdditional: false,
        includeMemos: false
    };

    // --- 유틸리티 함수 ---
    function announceToScreenReader(message) {
        if (liveRegion) {
            liveRegion.textContent = message;
            setTimeout(() => { liveRegion.textContent = ''; }, 1000);
        }
    }

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

    // --- 모드 관리 ---
    function applyAppMode(mode, isInitialLoad = false) {
        currentAppMode = mode;
        localStorage.setItem('oneulSetMode', mode);
        document.body.classList.toggle('simple-mode', mode === 'simple');
        document.body.classList.toggle('focus-mode', mode === 'focus');

        const modeToSwitchToText = mode === 'simple' ? '집중' : '심플';
        if(appModeToggle) { // null 체크 추가
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

            // 심플 모드에서 설정 섹션이 열려있었다면 닫고 버튼 텍스트 원래대로
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

        // tasks 배열이 항상 5개 유지되도록 보정 (렌더링 시 MAX_TASKS_CURRENT_MODE 만큼만 사용)
        while (tasks.length < 5) {
            tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });
        }

        renderTasks();
        if (currentAppMode === 'focus') renderAdditionalTasks();
        else if (additionalTaskListDiv) additionalTaskListDiv.innerHTML = '';

        if (!isInitialLoad) {
            saveState();
            announceToScreenReader(`${mode === 'simple' ? '심플' : '집중'} 모드로 변경되었습니다.`);
        }
    }

    if(appModeToggle) { // null 체크 추가
        appModeToggle.addEventListener('click', () => {
            const newMode = currentAppMode === 'simple' ? 'focus' : 'simple';
            applyAppMode(newMode);
        });
    }


    // --- PWA: 테마 변경 시 theme-color 메타 태그 업데이트 ---
    function updateThemeColorMeta(theme) {
        let color = '#5dade2'; // 다크 테마 기본 (manifest.json과 일치)
        if (theme === 'light') {
            color = '#3498db'; // 라이트 테마 버튼 색 또는 주요 색상
        }
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) themeColorMeta.setAttribute('content', color);
    }


    // --- 테마 관리 ---
    function applyTheme(theme, isInitialLoad = false) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            if(themeToggleButton) themeToggleButton.textContent = '☀️'; // null 체크 추가
            localStorage.setItem('oneulSetTheme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            if(themeToggleButton) themeToggleButton.textContent = '🌙'; // null 체크 추가
            localStorage.setItem('oneulSetTheme', 'light');
        }
        updateThemeColorMeta(theme);
        if (achievementChart) { achievementChart.destroy(); achievementChart = null; }
        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals(); // null 체크 추가
    }

    if(themeToggleButton){ // null 체크 추가
        themeToggleButton.addEventListener('click', () => {
            const isDarkMode = document.body.classList.contains('dark-theme');
            const newTheme = isDarkMode ? 'light' : 'dark';
            applyTheme(newTheme);
            announceToScreenReader(`테마가 ${newTheme === 'dark' ? '다크' : '라이트'} 모드로 변경되었습니다.`);
        });
    }


    // --- 날짜 및 유틸리티 ---
    function getTodayDateString() { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; }
    function displayCurrentDate() { if(currentDateEl){ const today = new Date(); const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }; currentDateEl.textContent = today.toLocaleDateString('ko-KR', options); } }
    function autoGrowTextarea(element) { if(element){ element.style.height = "auto"; element.style.height = (element.scrollHeight) + "px";} }

    // --- 상태 저장 및 로드 ---
    function saveState() {
        localStorage.setItem('oneulSetTasks', JSON.stringify(tasks));
        localStorage.setItem('oneulSetAdditionalTasks', JSON.stringify(additionalTasks));
        localStorage.setItem('oneulSetLastDate', getTodayDateString());
        localStorage.setItem('oneulSetHistory', JSON.stringify(history));
        localStorage.setItem('oneulSetFocusTaskCountSetting', focusModeTaskCountSetting.toString());
        localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
        updateStats();
        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals(); // null 체크 추가
    }

    function loadState() {
        const savedAppMode = localStorage.getItem('oneulSetMode') || 'simple'; // HTML 기본값과 일치

        const storedFocusTaskCount = localStorage.getItem('oneulSetFocusTaskCountSetting');
        if (storedFocusTaskCount) {
            focusModeTaskCountSetting = parseInt(storedFocusTaskCount, 10);
        } else {
            focusModeTaskCountSetting = 3; // HTML 기본값과 일치
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

        applyAppMode(savedAppMode, true); // 테마보다 먼저 모드 적용 (MAX_TASKS_CURRENT_MODE 설정 위해)

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
                while(tasks.length < 5) { // 최대 5개까지는 빈 객체로 채움
                    tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });
                }
                 if(tasks.length > 5) tasks = tasks.slice(0,5); // 5개 초과 시 자르기
            } catch (e) { initializeTasks(); }
        } else { // 새 날짜 또는 저장된 할 일 없음
            if (storedTasks && storedLastDate) { // 어제 데이터가 있다면 히스토리에 추가
                try {
                    const yesterdayTasksData = JSON.parse(storedTasks);
                    // 어제의 focusModeTaskCountSetting을 알 수 없으므로, 현재 저장된 값 또는 기본값 사용
                    const yesterdayFocusModeTaskCount = parseInt(localStorage.getItem('oneulSetFocusTaskCountSettingBeforeReset') || focusModeTaskCountSetting, 10);

                    if (Array.isArray(yesterdayTasksData)) {
                        const relevantYesterdayTasks = yesterdayTasksData.slice(0, yesterdayFocusModeTaskCount);
                        const allYesterdayTasksFilled = relevantYesterdayTasks.every(task => task && typeof task.text === 'string' && task.text.trim() !== "");
                        const allYesterdayTasksCompleted = relevantYesterdayTasks.every(task => task && task.completed);
                        // 히스토리 기록 조건: 어제 핵심과제가 모두 채워져 있었고, 그 개수만큼 모두 완료했을 때
                        const yesterdayAchieved = allYesterdayTasksFilled && relevantYesterdayTasks.length === yesterdayFocusModeTaskCount && allYesterdayTasksCompleted && yesterdayFocusModeTaskCount > 0;

                        if (!history.some(entry => entry.date === storedLastDate)) { // 중복 저장 방지
                            history.unshift({ date: storedLastDate, tasks: relevantYesterdayTasks, achieved: yesterdayAchieved });
                            if (history.length > 60) history.splice(60); // 최대 60일치 기록
                        }
                    }
                } catch (e) { console.error("Error processing yesterday's tasks for history", e); }
            }
            localStorage.setItem('oneulSetFocusTaskCountSettingBeforeReset', focusModeTaskCountSetting.toString()); // 새 날짜 처리 전의 할일 개수 저장
            initializeTasks();
            if (currentAppMode === 'focus') additionalTasks = []; // 새 날짜면 추가 과제도 초기화
            saveState(); // 새 날짜면 초기화된 상태를 저장
        }

        // tasks 배열이 항상 5개 유지되도록 다시 한번 보정
        while (tasks.length < 5) {
            tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });
        }
        if (tasks.length > 5) {
            tasks = tasks.slice(0, 5);
        }

        updateStats(); // 통계 업데이트
        if (currentAppMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals(); // 통계 시각화
        if (currentAppMode === 'focus') renderAdditionalTasks(); // 추가 과제 렌더링

        // PWA 설치 후 첫 실행 시 또는 데이터 없을 때 첫 번째 할 일 입력칸에 자동 포커스 (데스크탑에서만)
        setTimeout(() => {
            if (taskListDiv) { // null 체크 추가
                const firstTaskTextarea = taskListDiv.querySelector('.task-item:first-child textarea');
                if (firstTaskTextarea && window.innerWidth > 768) { // 화면 너비 768px 초과 시
                    // 사용자가 다른 곳을 이미 클릭/포커스하지 않았을 경우에만
                    if (document.activeElement === document.body || document.activeElement === null) {
                       // firstTaskTextarea.focus(); // 자동 포커스는 UX에 따라 호불호가 갈리므로 주석 처리 또는 조건 강화
                    }
                }
            }
        }, 100);
    }

    function initializeTasks() {
        tasks = [];
        for (let i = 0; i < 5; i++) { // 항상 5개 생성
            tasks.push({ id: Date.now() + i + Math.random(), text: '', completed: false, memo: '' });
        }
    }

    if(taskCountSelector){ // null 체크 추가
        taskCountSelector.addEventListener('change', (e) => {
            if (currentAppMode === 'simple') return;
            const newCount = parseInt(e.target.value, 10);
            // const oldCountDisplay = MAX_TASKS_CURRENT_MODE; // 사용하지 않으므로 주석처리
            focusModeTaskCountSetting = newCount;
            MAX_TASKS_CURRENT_MODE = newCount;

            renderTasks(); // UI 즉시 반영
            saveState(); // 변경된 설정 저장
            announceToScreenReader(`핵심 할 일 개수가 ${newCount}개로 변경되었습니다.`);
        });
    }


    // --- 할 일 렌더링 및 관리 ---
    function renderTasks() {
        if(!taskListDiv) return; // null 체크 추가
        taskListDiv.innerHTML = '';
        const tasksToRender = tasks.slice(0, MAX_TASKS_CURRENT_MODE);

        tasksToRender.forEach((task, index) => {
            const originalTaskIndex = tasks.findIndex(t => t.id === task.id); // tasks 배열 내 실제 인덱스
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
                saveState();
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
            textareaField.addEventListener('blur', () => { saveState(); }); // blur 시 저장
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
                memoTextarea.addEventListener('blur', () => { saveState(); }); // blur 시 저장
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
                // 최초 로드 시 열려있을 경우 높이 조절 (이 경우는 없음, hidden이 기본)
                // if (!memoContainer.classList.contains('hidden')) autoGrowTextarea(memoTextarea);
            }

            taskItem.appendChild(checkboxLabel);
            taskItem.appendChild(taskContentDiv);
            taskListDiv.appendChild(taskItem);
            autoGrowTextarea(textareaField); // 초기 높이 조절
        });
        checkAllDone();
    }

    function checkAllDone() {
        if(!allDoneMessageEl || !tasks) return; // null 체크 추가
        const tasksToCheck = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
        // 실제 내용이 있는 할 일만 필터링
        const filledTasks = tasksToCheck.filter(task => typeof task.text === 'string' && task.text.trim() !== "");
        const completedFilledTasks = filledTasks.filter(task => task.completed);

        // 내용이 있는 모든 핵심과제가 완료되었을 때 메시지 표시
        const shouldShowMessage = filledTasks.length === MAX_TASKS_CURRENT_MODE && completedFilledTasks.length === MAX_TASKS_CURRENT_MODE && MAX_TASKS_CURRENT_MODE > 0;
        allDoneMessageEl.classList.toggle('hidden', !shouldShowMessage);
    }

    function renderAdditionalTasks() {
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
                saveState();
            });
            checkboxLabel.appendChild(checkbox);
            checkboxLabel.appendChild(checkboxSpan);

            const taskText = document.createElement('span');
            taskText.classList.add('additional-task-text');
            taskText.textContent = task.text;
            // if (task.completed) taskText.style.textDecoration = 'line-through'; // CSS 클래스로 처리

            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-additional-task-btn');
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.setAttribute('aria-label', `추가 과제 "${task.text}" 삭제`);
            deleteBtn.addEventListener('click', () => {
                const taskTextToAnnounce = additionalTasks[index].text; // 삭제 전 텍스트 저장
                additionalTasks.splice(index, 1); // 실제 배열에서 삭제
                renderAdditionalTasks(); // 목록 다시 렌더링
                saveState();
                announceToScreenReader(`추가 과제 "${taskTextToAnnounce}"가 삭제되었습니다.`);
            });

            taskItem.appendChild(checkboxLabel);
            taskItem.appendChild(taskText);
            taskItem.appendChild(deleteBtn);
            additionalTaskListDiv.appendChild(taskItem);
        });
    }

    if (addAdditionalTaskBtn && addAdditionalTaskInput) { // null 체크 추가
        addAdditionalTaskBtn.addEventListener('click', () => {
            if (currentAppMode === 'simple') return;
            const text = addAdditionalTaskInput.value.trim();
            if (text) {
                additionalTasks.push({ id: Date.now(), text: text, completed: false }); // 고유 ID 생성
                addAdditionalTaskInput.value = '';
                renderAdditionalTasks();
                saveState();
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

    // --- 섹션 토글 ---
    const sections = [ // 각 섹션 정보
        { id: 'history-section', button: toggleHistoryBtn, baseText: '기록' },
        { id: 'stats-section', button: toggleStatsBtn, baseText: '통계' },
        { id: 'share-section', button: toggleShareBtn, baseText: '공유' },
        { id: 'settings-section', button: toggleSettingsBtn, baseText: '설정' }
    ];

    function toggleSection(sectionIdToToggle) {
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

    // --- 히스토리 렌더링 ---
    function renderHistory() {
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

    // --- 통계 계산 및 렌더링 ---
    function calculateAchievementRate(days) {
        if (history.length === 0) return "0% (기록 없음)";
        const today = new Date(); today.setHours(0, 0, 0, 0);
        let achievementCount = 0, relevantDaysCount = 0;
        // 최근 N일 기록만 필터링하여 계산 (성능 고려)
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
    function updateStats() {
        if(weeklyStatsEl) weeklyStatsEl.textContent = `지난 7일간 달성률: ${calculateAchievementRate(7)}`;
        if(monthlyStatsEl) monthlyStatsEl.textContent = `지난 30일간 달성률: ${calculateAchievementRate(30)}`;
    }

    function renderStatsVisuals() {
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
            if (currentStreak === 0 && history.length > 0) { // 오늘 달성 못했지만 히스토리가 있는 경우 (오늘 이전의 연속일수)
                // 이 로직은 "현재" 연속일수를 의미하므로, 오늘 달성 못하면 0이 맞음.
                // 만약 "과거 최대 연속일수"를 구한다면 다른 로직 필요.
            } else { // 오늘 달성한 경우, 어제부터 히스토리 탐색
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

    // --- 공유 기능 ---
    const shareUrl = window.location.href;
    function getShareText() {
        const hashtags = "#오늘할일 #집중력 #오늘셋팁";
        // MAX_TASKS_CURRENT_MODE가 focusTaskCountSetting 또는 3으로 설정되므로 그걸 사용
        return `오늘 할 일, 딱 ${MAX_TASKS_CURRENT_MODE}개만 골라서 집중 완료! 🎯 이렇게 하니 하루가 깔끔하네. (비법은 오늘셋 🤫) ${shareUrl} ${hashtags}`;
    }

    if(copyLinkBtn) { // null 체크
        copyLinkBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(shareUrl).then(() => { const originalHTML = copyLinkBtn.innerHTML; copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> 복사 완료!'; copyLinkBtn.classList.add('copy-success'); copyLinkBtn.disabled = true; setTimeout(() => { copyLinkBtn.innerHTML = originalHTML; copyLinkBtn.classList.remove('copy-success'); copyLinkBtn.disabled = false; }, 1500); announceToScreenReader("링크가 복사되었습니다."); }).catch(err => { console.error('링크 복사 실패:', err); alert('링크 복사에 실패했습니다.'); });
        });
    }


    if(shareTwitterBtn) { // null 체크
        shareTwitterBtn.addEventListener('click', (e) => {
            e.preventDefault(); // 기본 동작 방지
            const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText())}`; // URL은 텍스트에 포함
            window.open(twitterUrl, '_blank');
        });
    }


    if (shareIncludeAdditionalCheckbox) {
        shareIncludeAdditionalCheckbox.addEventListener('change', (e) => {
            shareOptions.includeAdditional = e.target.checked;
            saveState(); // 설정 변경 시 저장
        });
    }
    if (shareIncludeMemosCheckbox) {
        shareIncludeMemosCheckbox.addEventListener('change', (e) => {
            shareOptions.includeMemos = e.target.checked;
            saveState(); // 설정 변경 시 저장
        });
    }


    if (shareAsImageBtn) { // null 체크
        shareAsImageBtn.addEventListener('click', () => {
            if (currentAppMode === 'simple' || !html2canvas) {
                alert("이미지 공유는 집중 모드에서만 사용 가능합니다.");
                return;
            }
            const originalBtnText = shareAsImageBtn.innerHTML;
            shareAsImageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
            shareAsImageBtn.disabled = true;

            // 캡처할 영역 동적 생성 (스타일 적용된 상태로)
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
            if (taskListWrapperOriginal) { // null 체크
                const taskListWrapperClone = taskListWrapperOriginal.cloneNode(true);
                // 불필요한 요소 제거 또는 수정 (캡처용)
                const clonedAllDoneMsg = taskListWrapperClone.querySelector('#all-done-message');
                if (clonedAllDoneMsg && clonedAllDoneMsg.classList.contains('hidden')) clonedAllDoneMsg.remove();

                // 핵심 과제만 (MAX_TASKS_CURRENT_MODE 만큼)
                const clonedTaskList = taskListWrapperClone.querySelector('.task-list');
                if (clonedTaskList) {
                    const allClonedItems = Array.from(clonedTaskList.children);
                    allClonedItems.forEach((item, index) => {
                        if (index >= MAX_TASKS_CURRENT_MODE) item.remove();
                        else { // 메모 처리
                            if (currentAppMode === 'focus' && shareOptions.includeMemos) {
                                const originalItem = taskListDiv.children[index]; // 원본 task-list에서 해당 아이템 찾기
                                if (originalItem) {
                                    const originalMemoTextarea = originalItem.querySelector('.memo-container textarea');
                                    const clonedMemoContainer = item.querySelector('.memo-container');
                                    if (clonedMemoContainer && originalMemoTextarea && originalMemoTextarea.value.trim() !== "") {
                                        clonedMemoContainer.classList.remove('hidden'); // 보이도록
                                        const clonedMemoTextarea = clonedMemoContainer.querySelector('textarea');
                                        if (clonedMemoTextarea) { // textarea를 div로 대체 (캡처용)
                                            const memoDiv = document.createElement('div');
                                            // ... (스타일 복사 및 내용 설정 - 이전 답변 참고)
                                            memoDiv.textContent = originalMemoTextarea.value; // 실제 값으로
                                            clonedMemoContainer.replaceChild(memoDiv, clonedMemoTextarea);
                                        }
                                    } else if (clonedMemoContainer) { // 메모 없거나 포함 안하면 제거
                                        clonedMemoContainer.remove();
                                        const memoIcon = item.querySelector('.memo-icon');
                                        if(memoIcon) memoIcon.remove();
                                    }
                                }
                            } else { // 메모 포함 안하면 제거
                                item.querySelectorAll('.memo-icon, .memo-container').forEach(el => el.remove());
                            }
                        }
                    });
                }
                taskListWrapperClone.style.marginTop = '0'; // 위쪽 마진 제거
                captureArea.appendChild(taskListWrapperClone);
            }


            if (currentAppMode === 'focus' && shareOptions.includeAdditional && additionalTasks.length > 0) {
                const additionalTasksSectionOriginal = document.getElementById('additional-tasks-section');
                if(additionalTasksSectionOriginal){ // null 체크
                    const additionalTasksSectionClone = additionalTasksSectionOriginal.cloneNode(true);
                    additionalTasksSectionClone.classList.remove('toggle-section-static', 'hidden'); // 보이도록
                    const addInputArea = additionalTasksSectionClone.querySelector('.add-additional-task');
                    if(addInputArea) addInputArea.remove(); // 입력 부분 제거
                    additionalTasksSectionClone.style.marginTop = '20px';
                    // ... (나머지 스타일링 - 이전 답변 참고)
                    captureArea.appendChild(additionalTasksSectionClone);
                }
            }

            const linkEl = document.createElement('p');
            linkEl.textContent = 'todayset.vercel.app'; // 실제 앱 주소 또는 원하는 문구
            linkEl.style.fontSize = '0.8em'; linkEl.style.textAlign = 'center'; linkEl.style.marginTop = '20px';
            linkEl.style.color = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--link-color-dark' : '--link-color-light').trim();
            captureArea.appendChild(linkEl);

            // 화면 밖에 임시로 추가하여 캡처
            captureArea.style.position = 'absolute'; captureArea.style.left = '-9999px';
            document.body.appendChild(captureArea);

            html2canvas(captureArea, {
                useCORS: true, // 외부 이미지(아이콘 등) 사용 시 필요할 수 있음
                scale: window.devicePixelRatio || 1, // 화면 배율 고려
                logging: false, // 콘솔 로그 비활성화
                onclone: (clonedDoc) => { // clone된 문서에서 textarea 값 재설정 (중요)
                    // 핵심과제 textarea 값 동기화
                    const clonedTaskTextareas = Array.from(clonedDoc.querySelectorAll('.task-list-wrapper .task-item textarea:not(.memo-container textarea)'));
                    if(taskListDiv){ // null 체크
                        const originalTaskTextareas = Array.from(taskListDiv.querySelectorAll('.task-item textarea:not(.memo-container textarea)'));
                        clonedTaskTextareas.forEach((clonedTextarea, i) => {
                            if (originalTaskTextareas[i]) {
                                clonedTextarea.value = originalTaskTextareas[i].value;
                                // 높이 자동 조절 다시 적용 (clone 시 스타일 누락될 수 있음)
                                clonedTextarea.style.height = "auto";
                                clonedTextarea.style.height = (clonedTextarea.scrollHeight) + "px";
                            }
                        });
                    }
                    // 추가과제 text 값 동기화 (span이므로 textContent로)
                    if (currentAppMode === 'focus' && shareOptions.includeAdditional && additionalTaskListDiv) { // null 체크
                        const originalAdditionalTaskTexts = Array.from(additionalTaskListDiv.querySelectorAll('.additional-task-text'));
                        const clonedAdditionalTaskTexts = Array.from(clonedDoc.querySelectorAll('#additional-task-list .additional-task-text'));
                        clonedAdditionalTaskTexts.forEach((clonedSpan, i) => {
                            if (originalAdditionalTaskTexts[i]) {
                                clonedSpan.textContent = originalAdditionalTaskTexts[i].textContent;
                            }
                        });
                    }
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
                document.body.removeChild(captureArea); // 임시 영역 제거
                shareAsImageBtn.innerHTML = originalBtnText;
                shareAsImageBtn.disabled = false;
            });
        });
    }

    // --- 데이터 관리 (로컬 스토리지 기반) ---
    if (exportDataBtn) { // null 체크
        exportDataBtn.addEventListener('click', () => {
            if (currentAppMode === 'simple' && !confirm("심플 모드에서는 일부 데이터(추가 과제, 메모 등)가 제외될 수 있습니다. 계속하시겠습니까?")) {
                 // return; // 심플 모드 경고 후 취소 시 중단 (선택적)
            }
            const dataToExport = {
                version: "3.0.0", // 데이터 형식 버전
                appSettings: appSettings,
                tasks: tasks,
                additionalTasks: additionalTasks,
                history: history,
            };
            const dataStr = JSON.stringify(dataToExport, null, 2); // null, 2는 예쁘게 출력
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const exportFileDefaultName = `오늘셋_백업_${getTodayDateString()}.json`;
            let linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click(); // 다운로드 트리거
            linkElement.remove(); // 링크 제거
            const originalText = exportDataBtn.textContent; // 아이콘 포함 텍스트
            exportDataBtn.innerHTML = '<i class="fas fa-check"></i> 내보내기 완료!';
            announceToScreenReader("데이터를 성공적으로 내보냈습니다.");
            setTimeout(() => { exportDataBtn.innerHTML = originalText; }, 2000);
        });
    }

    if (importDataBtn && importFileInput) { // null 체크
        importDataBtn.addEventListener('click', () => {
            if (currentAppMode === 'simple') {
                alert("데이터 가져오기는 집중 모드에서 사용해주세요. 데이터 유실을 방지할 수 있습니다.");
                // return; // 심플 모드에서 가져오기 방지 (선택적)
            }
            importFileInput.click(); // 숨겨진 파일 입력 필드 클릭
        });

        importFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        if (confirm("현재 데이터를 덮어쓰고 가져온 데이터로 복원하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
                            // 데이터 유효성 검사 (선택적이지만 권장)
                            if (importedData.version !== "3.0.0" && !confirm("데이터 형식이 현재 버전과 다를 수 있습니다. 계속 진행하시겠습니까?")) {
                                importFileInput.value = ''; // 파일 선택 초기화
                                return;
                            }

                            appSettings = importedData.appSettings || appSettings; // 없으면 기존 값 유지
                            tasks = importedData.tasks || [];
                            additionalTasks = importedData.additionalTasks || [];
                            history = importedData.history || [];

                            // 가져온 데이터로 UI 즉시 업데이트 및 상태 저장
                            applyAppMode(appSettings.appMode, true); // 모드 먼저 적용
                            applyTheme(appSettings.theme, true);    // 테마 적용

                            // tasks 배열 보정 (항상 5개 유지)
                            while (tasks.length < 5) { tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });}
                            if (tasks.length > 5) tasks = tasks.slice(0,5);

                            renderTasks();
                            if(appSettings.appMode === 'focus') renderAdditionalTasks();
                            updateStats();
                            if(appSettings.appMode === 'focus' && dailyAchievementChartCtx) renderStatsVisuals();
                            renderHistory(); // 히스토리도 다시 렌더링

                            saveState(); // 모든 변경사항 저장
                            alert("데이터를 성공적으로 가져왔습니다. 페이지를 새로고침하여 모든 변경사항을 적용하는 것이 좋습니다.");
                            announceToScreenReader("데이터를 성공적으로 가져왔습니다.");
                        }
                    } catch (err) {
                        alert("데이터 가져오기 실패: 유효한 JSON 파일이 아니거나 파일이 손상되었습니다.");
                        console.error("Import error:", err);
                    } finally {
                        importFileInput.value = ''; // 파일 선택 초기화
                    }
                };
                reader.readAsText(file);
            }
        });
    }


     // --- 단축키 ---
     document.addEventListener('keydown', (e) => {
        // Alt+N 또는 Ctrl+N 으로 추가 과제 입력창 포커스 (집중 모드에서만)
        if ((e.altKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
            if (currentAppMode === 'focus' && addAdditionalTaskInput && !additionalTasksSection.classList.contains('hidden')) {
                e.preventDefault();
                addAdditionalTaskInput.focus();
            }
        }

        // Escape 키 처리
        if (e.key === 'Escape') {
            // 열려있는 메모창 닫기 (집중 모드)
            if (currentAppMode === 'focus') {
                const activeMemoContainer = document.querySelector('.memo-container:not(.hidden)');
                if (activeMemoContainer) {
                    const taskItem = activeMemoContainer.closest('.task-item');
                    const memoIcon = taskItem?.querySelector('.memo-icon');
                    memoIcon?.click(); // 메모 아이콘 클릭하여 닫기
                }
            }
            // 열려있는 푸터 토글 섹션 닫기 (가장 마지막에 열린 것 하나만 닫거나, 모두 닫거나 - 여기서는 모두)
            let sectionClosed = false;
            sections.forEach(sec => {
                const sectionElement = document.getElementById(sec.id);
                if (sectionElement && !sectionElement.classList.contains('hidden')) {
                    toggleSection(sec.id); // 해당 섹션을 다시 토글하여 닫음
                    sectionClosed = true;
                }
            });
            if (sectionClosed) announceToScreenReader("열린 섹션이 닫혔습니다.");

            // 추가 과제 입력창 포커스 해제
            if (document.activeElement === addAdditionalTaskInput) {
                addAdditionalTaskInput.blur();
            }
        }

        // 할 일 목록 내 Tab 키 네비게이션 개선 (선택적 고급 기능)
        if (document.activeElement?.closest('.task-list')) {
            const currentTaskItem = document.activeElement.closest('.task-item');
            if (!currentTaskItem || !taskListDiv) return;

            const focusableElementsInItem = Array.from(currentTaskItem.querySelectorAll('textarea, .memo-icon'));
            const currentIndex = focusableElementsInItem.indexOf(document.activeElement);
            const allTaskItems = Array.from(taskListDiv.querySelectorAll('.task-item')); // 현재 렌더링된 task-item만
            const currentTaskItemIndex = allTaskItems.indexOf(currentTaskItem);

            if (e.key === 'Tab' && !e.shiftKey) { // Tab
                if (currentIndex === focusableElementsInItem.length - 1) { // 아이템의 마지막 포커스 요소에서 Tab
                    if (currentTaskItemIndex < MAX_TASKS_CURRENT_MODE - 1 && currentTaskItemIndex < allTaskItems.length -1) {
                        e.preventDefault();
                        allTaskItems[currentTaskItemIndex + 1].querySelector('textarea')?.focus();
                    }
                    // 마지막 아이템의 마지막 요소면 기본 Tab 동작 (다음 포커스 가능한 요소로)
                }
            } else if (e.key === 'Tab' && e.shiftKey) { // Shift + Tab
                 if (currentIndex === 0) { // 아이템의 첫 포커스 요소에서 Shift + Tab
                    if (currentTaskItemIndex > 0) {
                        e.preventDefault();
                        const prevItemFocusables = Array.from(allTaskItems[currentTaskItemIndex - 1].querySelectorAll('textarea, .memo-icon'));
                        prevItemFocusables[prevItemFocusables.length -1]?.focus(); // 이전 아이템의 마지막 포커스 요소로
                    }
                    // 첫 아이템의 첫 요소면 기본 Shift+Tab 동작
                 }
            }
        }
    });

    // --- 초기화 실행 ---
    function initializeApp() {
        const initialTheme = localStorage.getItem('oneulSetTheme') || 'dark'; // HTML 기본값과 일치
        applyTheme(initialTheme, true); // 테마 먼저 적용 (PWA 테마 색상 등)

        displayCurrentDate(); // 날짜 표시
        loadState();          // 로컬 스토리지에서 상태 로드 (이 안에서 모드 적용 및 UI 렌더링 포함)

        // 초기 로드 시 푸터 버튼 텍스트 설정 (loadState 이후에, 모드에 따라 UI 요소 상태가 결정되므로)
        sections.forEach(sec => {
            if(sec.button) sec.button.textContent = sec.baseText;
            const sectionElement = document.getElementById(sec.id);
            if (sectionElement) { // 모든 섹션은 초기에 닫힌 상태(aria-hidden=true)로 설정
                sectionElement.setAttribute('aria-hidden', 'true');
                if(sec.button) sec.button.setAttribute('aria-expanded', 'false');
            }
        });
    }

    initializeApp();
});
