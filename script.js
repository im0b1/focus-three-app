// script.js - v1.10
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

    // --- 전역 변수 ---
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

    // --- 유틸리티 함수 ---
    function announceToScreenReader(message) {
        if (liveRegion) {
            liveRegion.textContent = message;
            setTimeout(() => { liveRegion.textContent = ''; }, 1000);
        }
    }

    // --- 모드 관리 ---
    function applyAppMode(mode, isInitialLoad = false) {
        currentAppMode = mode;
        localStorage.setItem('oneulSetMode', mode);
        document.body.classList.toggle('simple-mode', mode === 'simple');
        document.body.classList.toggle('focus-mode', mode === 'focus'); 
        
        const modeToSwitchToText = mode === 'simple' ? '집중' : '심플';
        appModeToggle.textContent = `${modeToSwitchToText} 모드로 전환`;
        appModeToggle.setAttribute('aria-label', `${modeToSwitchToText} 모드로 전환`);

        if (shareOptionsDiv) shareOptionsDiv.classList.toggle('hidden', mode === 'simple');
        if (shareIncludeMemosLabel) shareIncludeMemosLabel.classList.toggle('hidden', mode === 'simple');

        if (mode === 'simple') {
            MAX_TASKS_CURRENT_MODE = 3;
            taskCountSelectorContainer.classList.add('hidden');
            additionalTasksSection.classList.add('hidden');
            if (statsVisualsContainer) statsVisualsContainer.classList.add('hidden');
            if (shareAsImageBtnContainer) shareAsImageBtnContainer.classList.add('hidden');
            if (settingsContentDiv) settingsContentDiv.classList.add('hidden');

            if (toggleSettingsBtn && toggleSettingsBtn.classList.contains('active') && settingsSection && settingsSection.classList.contains('hidden')) {
                 toggleSettingsBtn.textContent = sections.find(s => s.id === 'settings-section').baseText;
                 toggleSettingsBtn.classList.remove('active');
                 toggleSettingsBtn.setAttribute('aria-expanded', 'false');
            } else if (toggleSettingsBtn && toggleSettingsBtn.classList.contains('active') && settingsSection && !settingsSection.classList.contains('hidden')) {
                settingsSection.classList.add('hidden');
                toggleSettingsBtn.textContent = sections.find(s => s.id === 'settings-section').baseText;
                toggleSettingsBtn.classList.remove('active');
                toggleSettingsBtn.setAttribute('aria-expanded', 'false');
                settingsSection.setAttribute('aria-hidden', 'true');
            }
        } else { // focus mode 
            MAX_TASKS_CURRENT_MODE = focusModeTaskCountSetting;
            taskCountSelectorContainer.classList.remove('hidden');
            additionalTasksSection.classList.remove('hidden');
            if (statsVisualsContainer) statsVisualsContainer.classList.remove('hidden');
            if (shareAsImageBtnContainer) shareAsImageBtnContainer.classList.remove('hidden');
            if (settingsContentDiv) settingsContentDiv.classList.remove('hidden');
        }
        taskCountSelector.value = focusModeTaskCountSetting;

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

    appModeToggle.addEventListener('click', () => {
        const newMode = currentAppMode === 'simple' ? 'focus' : 'simple';
        applyAppMode(newMode);
    });

    // --- 테마 관리 ---
    function applyTheme(theme) {
        if (theme === 'dark') { document.body.classList.add('dark-theme'); themeToggleButton.textContent = '☀️'; localStorage.setItem('oneulSetTheme', 'dark'); }
        else { document.body.classList.remove('dark-theme'); themeToggleButton.textContent = '🌙'; localStorage.setItem('oneulSetTheme', 'light'); }
        if (achievementChart) achievementChart.destroy(); achievementChart = null;
        if (currentAppMode === 'focus') renderStatsVisuals();
    }
    themeToggleButton.addEventListener('click', () => {
        const isDarkMode = document.body.classList.contains('dark-theme');
        const newTheme = isDarkMode ? 'light' : 'dark';
        applyTheme(newTheme);
        announceToScreenReader(`테마가 ${newTheme === 'dark' ? '다크' : '라이트'} 모드로 변경되었습니다.`);
    });
    
    // --- 날짜 및 유틸리티 ---
    function getTodayDateString() { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; }
    function displayCurrentDate() { const today = new Date(); const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }; currentDateEl.textContent = today.toLocaleDateString('ko-KR', options); }
    function autoGrowTextarea(element) { element.style.height = "auto"; element.style.height = (element.scrollHeight) + "px"; }

    // --- 상태 저장 및 로드 ---
    function saveState() {
        localStorage.setItem('oneulSetTasks', JSON.stringify(tasks));
        localStorage.setItem('oneulSetAdditionalTasks', JSON.stringify(additionalTasks));
        localStorage.setItem('oneulSetLastDate', getTodayDateString());
        localStorage.setItem('oneulSetHistory', JSON.stringify(history));
        localStorage.setItem('oneulSetFocusTaskCountSetting', focusModeTaskCountSetting.toString());
        localStorage.setItem('oneulSetShareOptions', JSON.stringify(shareOptions));
        updateStats();
        if (currentAppMode === 'focus') renderStatsVisuals();
    }

    function loadState() {
        const savedAppMode = localStorage.getItem('oneulSetMode') || 'simple';
        
        const storedFocusTaskCount = localStorage.getItem('oneulSetFocusTaskCountSetting');
        if (storedFocusTaskCount) {
            focusModeTaskCountSetting = parseInt(storedFocusTaskCount, 10);
        } else {
            focusModeTaskCountSetting = 3;
        }
        taskCountSelector.value = focusModeTaskCountSetting;

        const storedShareOptions = localStorage.getItem('oneulSetShareOptions');
        if (storedShareOptions) {
            try {
                shareOptions = JSON.parse(storedShareOptions);
                if (shareIncludeAdditionalCheckbox) shareIncludeAdditionalCheckbox.checked = shareOptions.includeAdditional;
                if (shareIncludeMemosCheckbox) shareIncludeMemosCheckbox.checked = shareOptions.includeMemos;
            } catch (e) { console.error("Error parsing share options:", e); }
        }


        applyAppMode(savedAppMode, true);

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
                while(tasks.length < 5) {
                    tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });
                }
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
            saveState();
        }
        
        while (tasks.length < 5) {
            tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });
        }
        if (tasks.length > 5) {
            tasks = tasks.slice(0, 5);
        }
        
        updateStats();
        if (currentAppMode === 'focus') renderStatsVisuals();
        if (currentAppMode === 'focus') renderAdditionalTasks();

        setTimeout(() => { 
            const firstTaskTextarea = taskListDiv.querySelector('.task-item:first-child textarea');
            if (firstTaskTextarea && window.innerWidth > 768) {
                if (document.activeElement === document.body || document.activeElement === null) {
                   firstTaskTextarea.focus();
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
    
    taskCountSelector.addEventListener('change', (e) => {
        if (currentAppMode === 'simple') return;
        const newCount = parseInt(e.target.value, 10);
        const oldCountDisplay = MAX_TASKS_CURRENT_MODE;
        focusModeTaskCountSetting = newCount; 
        MAX_TASKS_CURRENT_MODE = newCount;
        
        renderTasks();
        saveState();
        announceToScreenReader(`핵심 할 일 개수가 ${oldCountDisplay}개에서 ${newCount}개로 변경되었습니다.`);
    });

    // --- 할 일 렌더링 및 관리 ---
    function renderTasks() {
        taskListDiv.innerHTML = '';
        const tasksToRender = tasks.slice(0, MAX_TASKS_CURRENT_MODE);

        tasksToRender.forEach((task, index) => {
            const originalTaskIndex = tasks.findIndex(t => t.id === task.id);

            const taskItem = document.createElement('div');
            taskItem.classList.add('task-item');
            if (task.completed) { taskItem.classList.add('completed'); }

            const checkboxLabel = document.createElement('label');
            checkboxLabel.classList.add('custom-checkbox-label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.setAttribute('aria-label', `핵심 할 일 ${index + 1} 완료`);
            checkbox.id = `task-checkbox-${task.id}`;
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
            textareaField.value = task.text;
            textareaField.setAttribute('aria-label', `할 일 ${index + 1} 내용`);
            textareaField.addEventListener('input', (e) => { tasks[originalTaskIndex].text = e.target.value; autoGrowTextarea(e.target); });
            textareaField.addEventListener('blur', () => { saveState(); });
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
                memoTextarea.value = task.memo || "";
                memoTextarea.setAttribute('aria-label', `할 일 ${index + 1} 메모 내용`);
                memoTextarea.addEventListener('input', (e) => { tasks[originalTaskIndex].memo = e.target.value; autoGrowTextarea(e.target);});
                memoTextarea.addEventListener('blur', () => { saveState(); });
                memoContainer.appendChild(memoTextarea);
                taskItem.appendChild(memoContainer);

                memoIcon.addEventListener('click', () => {
                    const isHidden = memoContainer.classList.toggle('hidden');
                    memoIcon.setAttribute('aria-expanded', !isHidden);
                    if(!isHidden) memoTextarea.focus();
                    else textareaField.focus();
                    autoGrowTextarea(textareaField); // 할 일 textarea 높이도 재조정
                    if(!isHidden) autoGrowTextarea(memoTextarea); // 메모 textarea 높이도 재조정
                });
                if (task.memo && task.memo.trim() !== "") {
                    memoIcon.classList.add('has-memo');
                }
                memoTextarea.addEventListener('input', (e) => {
                    tasks[originalTaskIndex].memo = e.target.value;
                    autoGrowTextarea(e.target);
                    memoIcon.classList.toggle('has-memo', e.target.value.trim() !== "");
                });
                if (!memoContainer.classList.contains('hidden')) autoGrowTextarea(memoTextarea);
            }

            taskItem.appendChild(checkboxLabel);
            taskItem.appendChild(taskContentDiv);
            taskListDiv.appendChild(taskItem);
            autoGrowTextarea(textareaField);
        });
        checkAllDone();
    }

    function checkAllDone() {
        const tasksToCheck = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
        const filledTasks = tasksToCheck.filter(task => typeof task.text === 'string' && task.text.trim() !== "");
        const completedFilledTasks = filledTasks.filter(task => task.completed);
        const shouldShowMessage = filledTasks.length === MAX_TASKS_CURRENT_MODE && completedFilledTasks.length === MAX_TASKS_CURRENT_MODE && MAX_TASKS_CURRENT_MODE > 0;
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
                saveState();
            });
            checkboxLabel.appendChild(checkbox);
            checkboxLabel.appendChild(checkboxSpan);

            const taskText = document.createElement('span');
            taskText.classList.add('additional-task-text');
            taskText.textContent = task.text;
            if (task.completed) taskText.style.textDecoration = 'line-through';

            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-additional-task-btn');
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.setAttribute('aria-label', `추가 과제 "${task.text}" 삭제`);
            deleteBtn.addEventListener('click', () => {
                additionalTasks.splice(index, 1);
                renderAdditionalTasks();
                saveState();
                announceToScreenReader(`추가 과제 "${task.text}"가 삭제되었습니다.`);
            });

            taskItem.appendChild(checkboxLabel);
            taskItem.appendChild(taskText);
            taskItem.appendChild(deleteBtn);
            additionalTaskListDiv.appendChild(taskItem);
        });
    }

    if (addAdditionalTaskBtn) {
        addAdditionalTaskBtn.addEventListener('click', () => {
            if (currentAppMode === 'simple') return;
            const text = addAdditionalTaskInput.value.trim();
            if (text) {
                additionalTasks.push({ id: Date.now(), text: text, completed: false });
                addAdditionalTaskInput.value = '';
                renderAdditionalTasks();
                saveState();
                announceToScreenReader(`추가 과제 "${text}"가 추가되었습니다.`);
                addAdditionalTaskInput.focus();
            }
        });
        addAdditionalTaskInput.addEventListener('keypress', (e) => {
            if (currentAppMode === 'simple') return;
            if (e.key === 'Enter') {
                addAdditionalTaskBtn.click();
            }
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
            } else { // 'focus' mode
                 if (sec.id === 'stats-section' && statsVisualsContainer) statsVisualsContainer.classList.remove('hidden');
                 if (sec.id === 'share-section' && shareAsImageBtnContainer) shareAsImageBtnContainer.classList.remove('hidden');
                 if (sec.id === 'settings-section' && settingsContentDiv) settingsContentDiv.classList.remove('hidden');
                 if (sec.id === 'share-section' && shareOptionsDiv) shareOptionsDiv.classList.remove('hidden');
            }

            if (sec.id === sectionIdToToggle) {
                const isHidden = sectionElement.classList.contains('hidden');
                if (currentAppMode === 'simple' && sec.id === 'settings-section' && isHidden) {
                     sectionElement.classList.remove('hidden'); 
                } else if (currentAppMode === 'simple' && sec.id === 'settings-section' && !isHidden) {
                     sectionElement.classList.add('hidden');
                } else {
                    sectionElement.classList.toggle('hidden');
                }

                sec.button.textContent = sectionElement.classList.contains('hidden') ? sec.baseText : `${sec.baseText} 닫기`;
                sec.button.setAttribute('aria-expanded', !sectionElement.classList.contains('hidden'));
                sectionElement.setAttribute('aria-hidden', sectionElement.classList.contains('hidden'));
                
                if (!sectionElement.classList.contains('hidden')) { 
                    sec.button.classList.add('active');
                    sectionOpenedName = sec.baseText;
                    if (sec.id === 'history-section') renderHistory();
                    if (sec.id === 'stats-section') { 
                        updateStats(); 
                        if (currentAppMode === 'focus') renderStatsVisuals(); 
                    }
                } else { 
                    sec.button.classList.remove('active');
                    sectionOpenedName = "";
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
        if (history.length === 0) { historyListDiv.innerHTML = '<p>지난 기록이 없습니다.</p>'; return; }
        historyListDiv.innerHTML = '';
        history.forEach(entry => {
            if (!entry || !entry.date || !Array.isArray(entry.tasks)) return;
            const entryDiv = document.createElement('div'); entryDiv.classList.add('history-entry'); entryDiv.dataset.achieved = entry.achieved ? "true" : "false"; const dateStrong = document.createElement('strong'); dateStrong.textContent = `${entry.date.replaceAll('-', '.')}. ${entry.achieved ? "🎯" : ""}`; entryDiv.appendChild(dateStrong); const ul = document.createElement('ul');
            entry.tasks.forEach(task => { if(!task || typeof task.text !== 'string') return; const li = document.createElement('li'); li.textContent = task.text.length > 50 ? task.text.substring(0, 50) + "..." : task.text; li.title = task.text; if (task.completed) { li.classList.add('completed'); } ul.appendChild(li); });
            entryDiv.appendChild(ul); historyListDiv.appendChild(entryDiv);
        });
    }

    function calculateAchievementRate(days) {
        if (history.length === 0) return "0% (기록 없음)";
        const today = new Date(); today.setHours(0, 0, 0, 0);
        let achievementCount = 0, relevantDaysCount = 0;
        for (let i = 0; i < Math.min(history.length, days * 2); i++) {
            const entry = history[i];
            const entryDate = new Date(entry.date);
            const diffTime = today.getTime() - entryDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < days && diffDays >= 0) {
                 relevantDaysCount++;
                 if (entry.achieved) { achievementCount++; }
            }
            if (relevantDaysCount >= days) break;
        }
        if (relevantDaysCount === 0) return `0% (최근 ${days}일 기록 없음)`;
        const rate = (achievementCount / relevantDaysCount) * 100;
        return `${rate.toFixed(0)}% (${achievementCount}/${relevantDaysCount}일)`;
    }
    function updateStats() {
        weeklyStatsEl.textContent = `지난 7일간 달성률: ${calculateAchievementRate(7)}`;
        monthlyStatsEl.textContent = `지난 30일간 달성률: ${calculateAchievementRate(30)}`;
    }

    function renderStatsVisuals() {
        if (currentAppMode === 'simple' || !Chart || !dailyAchievementChartCtx || !statsVisualsContainer) {
            if(statsVisualsContainer) statsVisualsContainer.classList.add('hidden');
            if (achievementChart) { achievementChart.destroy(); achievementChart = null; }
            return;
        }
        if(statsVisualsContainer) statsVisualsContainer.classList.remove('hidden');

        let currentStreak = 0;
        let dateToCheck = new Date();
        for (let i = 0; i < history.length + 1; i++) {
            const entryDateStr = `${dateToCheck.getFullYear()}-${String(dateToCheck.getMonth() + 1).padStart(2, '0')}-${String(dateToCheck.getDate()).padStart(2, '0')}`;
            const entry = history.find(h => h.date === entryDateStr);
            let achievedThisDay = false;
            if (entryDateStr === getTodayDateString()) {
                const todayTasksForStreak = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
                achievedThisDay = todayTasksForStreak.every(t => t.completed && t.text.trim() !== "") && todayTasksForStreak.length === MAX_TASKS_CURRENT_MODE && MAX_TASKS_CURRENT_MODE > 0;
            } else if (entry) {
                achievedThisDay = entry.achieved;
            }

            if (achievedThisDay) {
                currentStreak++;
            } else {
                break;
            }
            dateToCheck.setDate(dateToCheck.getDate() - 1);
        }
        streakDaysEl.textContent = `${currentStreak}일`;

        const dayMap = ['일', '월', '화', '수', '목', '금', '토'];
        const achievementByDay = [0, 0, 0, 0, 0, 0, 0];
        history.filter(entry => entry.achieved).forEach(entry => {
            const dayIndex = new Date(entry.date).getDay();
            achievementByDay[dayIndex]++;
        });
        const maxAchievedCount = Math.max(...achievementByDay);
        const mostAchievedDays = [];
        achievementByDay.forEach((count, index) => {
            if (count === maxAchievedCount && count > 0) {
                mostAchievedDays.push(dayMap[index]);
            }
        });
        mostAchievedDayEl.textContent = mostAchievedDays.length > 0 ? mostAchievedDays.join(', ') + '요일' : '기록 없음';

        const labels = [];
        const dataPoints = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() - i);
            const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
            labels.push(dateStr.substring(5));
            const entry = history.find(h => h.date === dateStr);
            let achievedTodayForChart = false;
            if (dateStr === getTodayDateString()) {
                const todayTasksForChart = tasks.slice(0, MAX_TASKS_CURRENT_MODE);
                achievedTodayForChart = todayTasksForChart.every(t => t.completed && t.text.trim() !== "") && todayTasksForChart.length === MAX_TASKS_CURRENT_MODE && MAX_TASKS_CURRENT_MODE > 0;
            }
            dataPoints.push((entry && entry.achieved) || achievedTodayForChart ? 1 : 0);
        }

        if (achievementChart) {
            achievementChart.destroy();
        }
        const isDarkMode = document.body.classList.contains('dark-theme');
        const gridColor = isDarkMode ? getComputedStyle(document.documentElement).getPropertyValue('--chart-grid-color-dark').trim() : getComputedStyle(document.documentElement).getPropertyValue('--chart-grid-color-light').trim();
        const fontColor = isDarkMode ? getComputedStyle(document.documentElement).getPropertyValue('--chart-font-color-dark').trim() : getComputedStyle(document.documentElement).getPropertyValue('--chart-font-color-light').trim();
        const primaryButtonBg = isDarkMode ? getComputedStyle(document.documentElement).getPropertyValue('--button-primary-bg-dark').trim() : getComputedStyle(document.documentElement).getPropertyValue('--button-primary-bg-light').trim();

        achievementChart = new Chart(dailyAchievementChartCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '일일 목표 달성 여부',
                    data: dataPoints,
                    borderColor: primaryButtonBg,
                    backgroundColor: Chart.helpers.color(primaryButtonBg).alpha(0.2).rgbString(),
                    tension: 0.1,
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true, max: 1, ticks: { stepSize: 1, color: fontColor, callback: (v) => v === 1 ? '달성' : (v === 0 ? '미달성' : null) }, grid: { color: gridColor }
                    },
                    x: { ticks: { color: fontColor }, grid: { color: gridColor } }
                },
                plugins: { legend: { labels: { color: fontColor } }, tooltip: { callbacks: { label: (c) => c.parsed.y === 1 ? '달성' : '미달성' } } }
            }
        });
        dailyAchievementChartCtx.canvas.setAttribute('aria-label', '지난 30일간 일일 목표 달성 추이 그래프');
    }

    const shareUrl = window.location.href;
    function getShareText() { 
        const hashtags = "#오늘할일 #집중력 #오늘셋팁";
        return `오늘 할 일, 딱 ${MAX_TASKS_CURRENT_MODE}개만 골라서 집중 완료! 🎯 이렇게 하니 하루가 깔끔하네. (비법은 오늘셋 🤫) ${hashtags}`;
    }

    copyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(shareUrl).then(() => { const originalHTML = copyLinkBtn.innerHTML; copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> 복사 완료!'; copyLinkBtn.classList.add('copy-success'); copyLinkBtn.disabled = true; setTimeout(() => { copyLinkBtn.innerHTML = originalHTML; copyLinkBtn.classList.remove('copy-success'); copyLinkBtn.disabled = false; }, 1500); announceToScreenReader("링크가 복사되었습니다."); }).catch(err => { console.error('링크 복사 실패:', err); alert('링크 복사에 실패했습니다.'); });
    });
    
    shareTwitterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText())}&url=${encodeURIComponent(shareUrl)}`;
        window.open(twitterUrl, '_blank');
    });

    if (shareIncludeAdditionalCheckbox) {
        shareIncludeAdditionalCheckbox.addEventListener('change', (e) => {
            shareOptions.includeAdditional = e.target.checked;
            saveState();
        });
    }
    if (shareIncludeMemosCheckbox) {
        shareIncludeMemosCheckbox.addEventListener('change', (e) => {
            shareOptions.includeMemos = e.target.checked;
            saveState();
        });
    }


    if (shareAsImageBtn) {
        shareAsImageBtn.addEventListener('click', () => {
            if (currentAppMode === 'simple' || !html2canvas) {
                alert("이미지 공유는 집중 모드에서만 사용 가능합니다.");
                return;
            }
            const originalBtnText = shareAsImageBtn.innerHTML;
            shareAsImageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
            shareAsImageBtn.disabled = true;

            const captureArea = document.createElement('div');
            captureArea.id = 'image-capture-area';
            captureArea.style.padding = '20px';
            captureArea.style.width = '500px';
            const isDarkMode = document.body.classList.contains('dark-theme');
            captureArea.style.backgroundColor = isDarkMode ? getComputedStyle(document.documentElement).getPropertyValue('--container-bg-color-dark').trim() : getComputedStyle(document.documentElement).getPropertyValue('--container-bg-color-light').trim();
            captureArea.style.color = isDarkMode ? getComputedStyle(document.documentElement).getPropertyValue('--text-color-primary-dark').trim() : getComputedStyle(document.documentElement).getPropertyValue('--text-color-primary-light').trim();
            captureArea.style.fontFamily = getComputedStyle(document.body).fontFamily;
            captureArea.style.lineHeight = getComputedStyle(document.body).lineHeight;
            
            const titleEl = document.createElement('h1');
            titleEl.textContent = "오늘셋";
            titleEl.style.fontSize = '2em'; titleEl.style.fontWeight = '700'; titleEl.style.textAlign = 'center'; titleEl.style.marginBottom = '5px';
            captureArea.appendChild(titleEl);

            const dateEl = document.createElement('p');
            dateEl.textContent = currentDateEl.textContent;
            dateEl.style.fontSize = '0.9em'; dateEl.style.textAlign = 'center'; dateEl.style.marginBottom = '15px';
            dateEl.style.color = isDarkMode ? getComputedStyle(document.documentElement).getPropertyValue('--text-color-tertiary-dark').trim() : getComputedStyle(document.documentElement).getPropertyValue('--text-color-tertiary-light').trim();
            captureArea.appendChild(dateEl);

            const taskListWrapperOriginal = document.querySelector('.task-list-wrapper');
            const taskListWrapperClone = taskListWrapperOriginal.cloneNode(true);
            
            const taskItemsOriginal = Array.from(taskListOriginal.querySelectorAll('.task-item'));
            const taskItemsClone = Array.from(taskListWrapperClone.querySelectorAll('.task-item'));

            taskItemsOriginal.slice(0, MAX_TASKS_CURRENT_MODE).forEach((originalItem, index) => {
                const clonedItem = taskItemsClone[index];
                if (!clonedItem) return;

                if (currentAppMode === 'focus' && shareOptions.includeMemos) {
                    const originalMemoContainer = originalItem.querySelector('.memo-container');
                    const clonedMemoContainer = clonedItem.querySelector('.memo-container');
                    const originalMemoTextarea = originalItem.querySelector('.memo-container textarea');
                    
                    if (originalMemoContainer && clonedMemoContainer && originalMemoTextarea && originalMemoTextarea.value.trim() !== "") {
                        clonedMemoContainer.classList.remove('hidden');
                        const clonedMemoTextarea = clonedMemoContainer.querySelector('textarea');
                        if (clonedMemoTextarea) {
                             // v1.10: 실제 렌더링된 높이를 반영하기 위해 div로 대체하거나, scrollHeight 기반으로 rows 조절
                            const memoDiv = document.createElement('div');
                            memoDiv.style.fontSize = getComputedStyle(clonedMemoTextarea).fontSize;
                            memoDiv.style.fontFamily = getComputedStyle(clonedMemoTextarea).fontFamily;
                            memoDiv.style.lineHeight = getComputedStyle(clonedMemoTextarea).lineHeight;
                            memoDiv.style.padding = getComputedStyle(clonedMemoTextarea).padding;
                            memoDiv.style.color = getComputedStyle(clonedMemoTextarea).color;
                            memoDiv.style.backgroundColor = getComputedStyle(clonedMemoTextarea).backgroundColor;
                            memoDiv.style.border = getComputedStyle(clonedMemoTextarea).border;
                            memoDiv.style.borderRadius = getComputedStyle(clonedMemoTextarea).borderRadius;
                            memoDiv.style.whiteSpace = 'pre-wrap';
                            memoDiv.style.wordBreak = 'break-word';
                            memoDiv.textContent = originalMemoTextarea.value;
                            clonedMemoContainer.replaceChild(memoDiv, clonedMemoTextarea);
                        }
                    } else if (clonedMemoContainer) {
                        clonedMemoContainer.remove(); 
                        const memoIcon = clonedItem.querySelector('.memo-icon');
                        if(memoIcon) memoIcon.remove();
                    }
                } else { // 메모 미포함 또는 심플 모드
                    clonedItem.querySelectorAll('.memo-icon, .memo-container').forEach(el => el.remove());
                }
            });
            
            const clonedTaskList = taskListWrapperClone.querySelector('.task-list');
            const allClonedItems = Array.from(clonedTaskList.children);
            allClonedItems.forEach((item, index) => {
                if (index >= MAX_TASKS_CURRENT_MODE) item.remove();
            });


            if(taskListWrapperClone.querySelector('#all-done-message.hidden')) {
                taskListWrapperClone.querySelector('#all-done-message').remove();
            }
            taskListWrapperClone.style.marginTop = '0';
            captureArea.appendChild(taskListWrapperClone);
            
            if (currentAppMode === 'focus' && shareOptions.includeAdditional && additionalTasks.length > 0) {
                const additionalTasksSectionOriginal = document.getElementById('additional-tasks-section');
                const additionalTasksSectionClone = additionalTasksSectionOriginal.cloneNode(true);
                additionalTasksSectionClone.classList.remove('toggle-section-static', 'hidden'); 
                additionalTasksSectionClone.querySelector('.add-additional-task').remove(); 
                additionalTasksSectionClone.style.marginTop = '20px';
                additionalTasksSectionClone.style.padding = '15px';
                additionalTasksSectionClone.style.backgroundColor = isDarkMode ? getComputedStyle(document.documentElement).getPropertyValue('--additional-task-bg-dark').trim() : getComputedStyle(document.documentElement).getPropertyValue('--additional-task-bg-light').trim();
                additionalTasksSectionClone.style.border = `1px solid ${isDarkMode ? getComputedStyle(document.documentElement).getPropertyValue('--additional-task-border-dark').trim() : getComputedStyle(document.documentElement).getPropertyValue('--additional-task-border-light').trim()}`;
                captureArea.appendChild(additionalTasksSectionClone);
            }

            const linkEl = document.createElement('p');
            linkEl.textContent = 'todayset.vercel.app'; // v1.10: 도메인 변경
            linkEl.style.fontSize = '0.8em'; linkEl.style.textAlign = 'center'; linkEl.style.marginTop = '20px';
            linkEl.style.color = isDarkMode ? getComputedStyle(document.documentElement).getPropertyValue('--link-color-dark').trim() : getComputedStyle(document.documentElement).getPropertyValue('--link-color-light').trim();
            captureArea.appendChild(linkEl);
            
            captureArea.style.position = 'absolute'; captureArea.style.left = '-9999px';
            document.body.appendChild(captureArea);

            html2canvas(captureArea, {
                useCORS: true, scale: 2, logging: false,
                onclone: (clonedDoc) => {
                    const clonedTaskTextareas = Array.from(clonedDoc.querySelectorAll('.task-list-wrapper .task-item textarea'));
                    taskItemsOriginal.slice(0, MAX_TASKS_CURRENT_MODE).forEach((originalItem, i) => {
                        const originalTextarea = originalItem.querySelector('textarea:not(.memo-container textarea)');
                        if (clonedTaskTextareas[i] && originalTextarea) {
                            clonedTaskTextareas[i].value = originalTextarea.value;
                            clonedTaskTextareas[i].style.height = "auto";
                            clonedTaskTextareas[i].style.height = (clonedTaskTextareas[i].scrollHeight) + "px";
                        }
                    });

                    if (currentAppMode === 'focus' && shareOptions.includeAdditional) {
                        const originalAdditionalTaskTexts = Array.from(document.querySelectorAll('#additional-task-list .additional-task-text'));
                        const clonedAdditionalTaskTexts = Array.from(clonedDoc.querySelectorAll('#additional-task-list .additional-task-text'));
                        originalAdditionalTaskTexts.forEach((originalSpan, i) => {
                            if (clonedAdditionalTaskTexts[i]) {
                                clonedAdditionalTaskTexts[i].textContent = originalSpan.textContent;
                            }
                        });
                    }
                }
            }).then(canvas => {
                const imageURL = canvas.toDataURL('image/png');
                const downloadLink = document.createElement('a');
                downloadLink.href = imageURL;
                downloadLink.download = `오늘셋_Tasks_${getTodayDateString()}.png`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                announceToScreenReader("할 일 목록 이미지가 다운로드되었습니다.");
            }).catch(err => {
                console.error(' 이미지 생성 실패:', err);
                alert('이미지 생성에 실패했습니다.');
            }).finally(() => {
                document.body.removeChild(captureArea);
                shareAsImageBtn.innerHTML = originalBtnText;
                shareAsImageBtn.disabled = false;
            });
        });
    }

    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', () => {
            if (currentAppMode === 'simple') {
                alert("데이터 관리는 집중 모드에서 사용 가능합니다.");
                return;
            }
            const dataToExport = {
                tasks: tasks,
                additionalTasks: additionalTasks,
                history: history,
                theme: localStorage.getItem('oneulSetTheme') || 'dark',
                focusTaskCountSetting: focusModeTaskCountSetting,
                appMode: currentAppMode,
                shareOptions: shareOptions
            };
            const dataStr = JSON.stringify(dataToExport, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const exportFileDefaultName = `오늘셋_backup_${getTodayDateString()}.json`;
            let linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            linkElement.remove();
            const originalText = exportDataBtn.textContent;
            exportDataBtn.innerHTML = "내보내기 완료!";
            announceToScreenReader("데이터를 성공적으로 내보냈습니다.");
            setTimeout(() => { exportDataBtn.textContent = originalText; }, 2000);
        });

        importDataBtn.addEventListener('click', () => {
            if (currentAppMode === 'simple') {
                alert("데이터 관리는 집중 모드에서 사용 가능합니다.");
                return;
            }
            importFileInput.click();
        });

        importFileInput.addEventListener('change', (event) => {
             if (currentAppMode === 'simple') return;
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        if (confirm("현재 데이터를 덮어쓰고 가져온 데이터로 복원하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
                            tasks = importedData.tasks || [];
                            while(tasks.length < 5) {
                                tasks.push({ id: Date.now() + tasks.length + Math.random(), text: '', completed: false, memo: '' });
                            }
                            if(tasks.length > 5) tasks = tasks.slice(0,5);

                            additionalTasks = importedData.additionalTasks || [];
                            history = importedData.history || [];
                            
                            focusModeTaskCountSetting = importedData.focusTaskCountSetting || importedData.proModeTaskCountSetting || 3; 
                            
                            let importedAppMode = importedData.appMode || 'focus';
                            if (importedAppMode === 'pro') importedAppMode = 'focus';

                            shareOptions = importedData.shareOptions || { includeAdditional: false, includeMemos: false };

                            applyAppMode(importedAppMode, true); 
                            applyTheme(importedData.theme || 'dark'); 
                                                        
                            saveState();
                            loadState(); 
                            renderTasks();
                            
                            alert("데이터를 성공적으로 가져왔습니다.");
                            announceToScreenReader("데이터를 성공적으로 가져왔습니다.");
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

     document.addEventListener('keydown', (e) => {
        if ((e.altKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
            if (currentAppMode === 'focus' && addAdditionalTaskInput) {
                e.preventDefault();
                addAdditionalTaskInput.focus();
            }
        }

        if (e.key === 'Escape') {
            if (currentAppMode === 'focus') {
                const activeMemoContainer = document.querySelector('.memo-container:not(.hidden)');
                if (activeMemoContainer) {
                    const taskItem = activeMemoContainer.closest('.task-item');
                    const memoIcon = taskItem?.querySelector('.memo-icon');
                    memoIcon?.click(); 
                }
                if (document.activeElement === addAdditionalTaskInput) {
                    addAdditionalTaskInput.blur();
                }
            }
        }

        if (document.activeElement.closest('.task-list')) {
            const currentTaskItem = document.activeElement.closest('.task-item');
            if (!currentTaskItem) return;

            const focusableElementsInItem = Array.from(currentTaskItem.querySelectorAll('textarea, .memo-icon'));
            const currentIndex = focusableElementsInItem.indexOf(document.activeElement);

            if (e.key === 'Tab' && !e.shiftKey && currentIndex === focusableElementsInItem.length - 1) {
                const allTaskItems = Array.from(taskListDiv.querySelectorAll('.task-item'));
                const currentTaskItemIndex = allTaskItems.indexOf(currentTaskItem);
                if (currentTaskItemIndex < MAX_TASKS_CURRENT_MODE - 1) {
                    e.preventDefault();
                    allTaskItems[currentTaskItemIndex + 1].querySelector('textarea').focus();
                }
            } else if (e.key === 'Tab' && e.shiftKey && currentIndex === 0) {
                 const allTaskItems = Array.from(taskListDiv.querySelectorAll('.task-item'));
                const currentTaskItemIndex = allTaskItems.indexOf(currentTaskItem);
                if (currentTaskItemIndex > 0) {
                    e.preventDefault();
                    const prevItemFocusables = Array.from(allTaskItems[currentTaskItemIndex - 1].querySelectorAll('textarea, .memo-icon'));
                    if (prevItemFocusables.length > 0) {
                        prevItemFocusables[prevItemFocusables.length -1].focus();
                    } else {
                         allTaskItems[currentTaskItemIndex - 1].querySelector('textarea').focus();
                    }
                }
            }
        }
    });

    // --- 초기화 실행 ---
    const initialTheme = localStorage.getItem('oneulSetTheme') || 'dark';
    const taskListOriginal = document.querySelector('.task-list'); 
    
    applyTheme(initialTheme);
    displayCurrentDate();
    loadState(); 
    renderTasks();
    
    sections.forEach(sec => {
        if(sec.button) sec.button.textContent = sec.baseText;
        const sectionElement = document.getElementById(sec.id);
        if (sectionElement) {
            sectionElement.setAttribute('aria-hidden', 'true');
            if(sec.button) sec.button.setAttribute('aria-expanded', 'false');
        }
    });
});
