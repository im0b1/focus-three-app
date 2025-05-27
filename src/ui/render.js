// src/ui/render.js - v2.0.0-refactor - UI Rendering Module

import { appState } from '../state.js';
import { announceToScreenReader, showUserFeedback, getTodayDateString } from '../utils.js';
import { domElements } from './domElements.js';

let achievementChart = null; // Chart.js instance

// Helper function to update theme color meta tag
export function updateThemeColorMeta(theme) {
    let color = (theme === 'light') ? '#3498db' : '#5dade2';
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) themeColorMeta.setAttribute('content', color);
}

// Applies app mode UI changes
export function applyAppModeUI(mode, source = 'local') {
    document.body.classList.toggle('simple-mode', mode === 'simple');
    document.body.classList.toggle('focus-mode', mode === 'focus');

    const modeToSwitchToText = mode === 'simple' ? '집중' : '심플';
    if(domElements.appModeToggleEl) {
        domElements.appModeToggleEl.textContent = `${modeToSwitchToText} 모드로 전환`;
        domElements.appModeToggleEl.setAttribute('aria-label', `${modeToSwitchToText} 모드로 전환`);
    }

    if (domElements.shareOptionsDivEl) domElements.shareOptionsDivEl.classList.toggle('hidden', mode === 'simple');

    if (mode === 'simple') {
        if(domElements.taskCountSelectorEl.parentElement) domElements.taskCountSelectorEl.parentElement.classList.add('hidden');
        if(domElements.additionalTasksSectionEl) domElements.additionalTasksSectionEl.classList.add('hidden');
        if (domElements.statsVisualsContainerEl) domElements.statsVisualsContainerEl.classList.add('hidden');
        if (domElements.shareAsImageBtnContainerEl) domElements.shareAsImageBtnContainerEl.classList.add('hidden');
        if (domElements.currentSettingsContentDiv && domElements.settingsSectionEl) {
            if(domElements.simpleModeSettingsInfoEl) domElements.simpleModeSettingsInfoEl.classList.remove('hidden');
            domElements.currentSettingsContentDiv.classList.add('hidden');
        }
        // Force close settings if open in simple mode
        if (domElements.toggleSettingsBtnEl && domElements.toggleSettingsBtnEl.classList.contains('active') && domElements.settingsSectionEl && !domElements.settingsSectionEl.classList.contains('hidden')) {
            domElements.settingsSectionEl.classList.add('hidden');
            const sections = [ { id: 'settings-section', button: domElements.toggleSettingsBtnEl, baseText: '설정' } ]; // Only settings
            const settingsSecInfo = sections.find(s => s.id === 'settings-section');
            if (settingsSecInfo && settingsSecInfo.button) domElements.toggleSettingsBtnEl.textContent = settingsSecInfo.baseText;
            domElements.toggleSettingsBtnEl.classList.remove('active');
            domElements.toggleSettingsBtnEl.setAttribute('aria-expanded', 'false');
            domElements.settingsSectionEl.setAttribute('aria-hidden', 'true');
        }
    } else {
        if(domElements.taskCountSelectorEl.parentElement) domElements.taskCountSelectorEl.parentElement.classList.remove('hidden');
        if(domElements.additionalTasksSectionEl) domElements.additionalTasksSectionEl.classList.remove('hidden');
        if (domElements.statsVisualsContainerEl) domElements.statsVisualsContainerEl.classList.remove('hidden');
        if (domElements.shareAsImageBtnContainerEl) domElements.shareAsImageBtnContainerEl.classList.remove('hidden');
        if (domElements.currentSettingsContentDiv && domElements.settingsSectionEl) {
             if(domElements.simpleModeSettingsInfoEl) domElements.simpleModeSettingsInfoEl.classList.add('hidden');
             domElements.currentSettingsContentDiv.classList.remove('hidden');
        }
    }
}

// Applies theme UI changes
export function applyThemeUI(theme, source = 'local') {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    if(domElements.themeToggleButtonEl) domElements.themeToggleButtonEl.textContent = (theme === 'dark' ? '☀️' : '🌙');
    updateThemeColorMeta(theme);
    // Destroy and re-render chart if active to apply new theme colors
    if (achievementChart) {
        achievementChart.destroy();
        achievementChart = null;
    }
    renderStatsVisuals(); // Will re-create chart with new theme colors
}

// Updates Auth UI based on user status
export function updateAuthUI(user) {
    const isLoggedIn = !!user;
    if(domElements.loginBtnEl) domElements.loginBtnEl.classList.toggle('hidden', isLoggedIn);
    if(domElements.signupBtnEl) domElements.signupBtnEl.classList.toggle('hidden', isLoggedIn);
    if(domElements.userEmailSpanEl) domElements.userEmailSpanEl.textContent = isLoggedIn ? (user.displayName || user.email || '사용자') : '';
    if(domElements.userEmailSpanEl) domElements.userEmailSpanEl.classList.toggle('hidden', !isLoggedIn);
    if(domElements.logoutBtnEl) domElements.logoutBtnEl.classList.toggle('hidden', !isLoggedIn);

    // Update sync status message
    if (!navigator.onLine) {
        if(domElements.cloudSyncStatusDivEl) domElements.cloudSyncStatusDivEl.textContent = '현재 오프라인입니다.';
    } else if (isLoggedIn) {
        if(domElements.cloudSyncStatusDivEl) domElements.cloudSyncStatusDivEl.textContent = `로그인 됨 (${domElements.userEmailSpanEl.textContent}). 클라우드 동기화 활성.`;
    } else {
        if(domElements.cloudSyncStatusDivEl) domElements.cloudSyncStatusDivEl.textContent = '로그인하여 데이터를 클라우드에 동기화하세요.';
    }
}

// Displays the current date
export function displayCurrentDate() {
    if(domElements.currentDateEl){
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        domElements.currentDateEl.textContent = today.toLocaleDateString('ko-KR', options);
    }
}

// Adjusts textarea height automatically
export function autoGrowTextarea(element) {
    if(element) {
        element.style.height = "auto";
        element.style.height = (element.scrollHeight) + "px";
    }
}

// Renders the main tasks list
export function renderTasks() {
    if(!domElements.taskListDivEl) { console.warn("renderTasks: task-list div not found."); return; }

    domElements.taskListDivEl.innerHTML = ''; // Clear existing content

    const maxTasksForMode = appState.settings.focusTaskCount;
    const tasksToRender = appState.tasks.slice(0, maxTasksForMode);

    tasksToRender.forEach((task, index) => {
        if (!task || typeof task.id === 'undefined' || typeof task.text === 'undefined' || typeof task.completed === 'undefined') {
            console.warn(`Malformed task data at index ${index}:`, task);
            return;
        }

        const taskItem = document.createElement('div');
        taskItem.classList.add('task-item');
        if (task.completed) taskItem.classList.add('completed');

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

        checkboxLabel.appendChild(checkbox);
        checkboxLabel.appendChild(checkboxSpan);

        const taskContentDiv = document.createElement('div');
        taskContentDiv.classList.add('task-item-content');

        const textareaField = document.createElement('textarea');
        textareaField.rows = "1";
        textareaField.placeholder = `할 일 ${index + 1}`;
        textareaField.value = task.text;
        textareaField.setAttribute('aria-label', `할 일 ${index + 1} 내용`);

        taskContentDiv.appendChild(textareaField);

        taskItem.appendChild(checkboxLabel);
        taskItem.appendChild(taskContentDiv);
        domElements.taskListDivEl.appendChild(taskItem);

        autoGrowTextarea(textareaField);
    });
    checkAllDone();
}

// Checks if all tasks are done and updates the message
export function checkAllDone() {
    if(!domElements.allDoneMessageEl || !appState.tasks) return;
    const tasksToCheck = appState.tasks.slice(0, appState.settings.focusTaskCount);
    const filledTasks = tasksToCheck.filter(task => task && typeof task.text === 'string' && task.text.trim() !== "");
    const completedFilledTasks = filledTasks.filter(task => task && task.completed);
    const shouldShowMessage = filledTasks.length > 0 && filledTasks.length === appState.settings.focusTaskCount && completedFilledTasks.length === appState.settings.focusTaskCount;
    domElements.allDoneMessageEl.classList.toggle('hidden', !shouldShowMessage);
}

// Renders the additional tasks list
export function renderAdditionalTasks() {
    if (appState.settings.appMode === 'simple' || !domElements.additionalTaskListDivEl) {
        if(domElements.additionalTaskListDivEl) domElements.additionalTaskListDivEl.innerHTML = '';
        return;
    }
    domElements.additionalTaskListDivEl.innerHTML = '';
    if (appState.additionalTasks.length === 0) {
        const p = document.createElement('p');
        p.textContent = '추가된 과제가 없습니다.';
        p.classList.add('no-additional-tasks');
        domElements.additionalTaskListDivEl.appendChild(p);
        return;
    }
    appState.additionalTasks.forEach((task, index) => {
        if (!task || typeof task.id === 'undefined' || typeof task.text === 'undefined' || typeof task.completed === 'undefined') {
            console.warn(`Malformed additional task data at index ${index}:`, task);
            return;
        }

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

        checkboxLabel.appendChild(checkbox);
        checkboxLabel.appendChild(checkboxSpan);

        const taskText = document.createElement('span');
        taskText.classList.add('additional-task-text');
        taskText.textContent = task.text;

        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-additional-task-btn');
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        deleteBtn.setAttribute('aria-label', `추가 과제 "${task.text}" 삭제`);

        taskItem.appendChild(checkboxLabel);
        taskItem.appendChild(taskText);
        taskItem.appendChild(deleteBtn);
        domElements.additionalTaskListDivEl.appendChild(taskItem);
    });
}

// Renders the history list
export function renderHistory() {
    if (!domElements.historyListDivEl) return;
    if (appState.history.length === 0) {
        domElements.historyListDivEl.innerHTML = '<p>지난 기록이 없습니다.</p>';
        return;
    }
    domElements.historyListDivEl.innerHTML = '';
    appState.history.forEach(entry => {
        if (!entry || typeof entry.date === 'undefined' || !Array.isArray(entry.tasks) || typeof entry.achieved === 'undefined') {
            console.warn(`Malformed history entry:`, entry);
            return;
        }
        const entryDiv = document.createElement('div');
        entryDiv.classList.add('history-entry');
        entryDiv.dataset.achieved = entry.achieved ? "true" : "false";

        const dateStrong = document.createElement('strong');
        dateStrong.textContent = `${entry.date.replaceAll('-', '.')}. ${entry.achieved ? "🎯" : ""}`;
        entryDiv.appendChild(dateStrong);

        const ul = document.createElement('ul');
        entry.tasks.forEach(task => {
            if(!task || typeof task.text !== 'string' || typeof task.completed !== 'boolean') {
                console.warn(`Malformed task in history entry:`, task);
                return;
            }
            const li = document.createElement('li');
            li.textContent = task.text.length > 50 ? task.text.substring(0, 50) + "..." : task.text;
            li.title = task.text;
            if (task.completed) { li.classList.add('completed'); }
            ul.appendChild(li);
        });
        entryDiv.appendChild(ul);
        domElements.historyListDivEl.appendChild(entryDiv);
    });
}

// Calculates achievement rate for a given number of days
function calculateAchievementRate(days) {
    if (appState.history.length === 0) return "0% (기록 없음)";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let achievementCount = 0, relevantDaysCount = 0;

    const relevantHistory = appState.history.filter(entry => {
        if (!entry || !entry.date) return false;
        const entryDate = new Date(entry.date);
        entryDate.setHours(0,0,0,0);
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

// Updates stats UI elements
export function updateStatsUI() {
    if(domElements.weeklyStatsEl) domElements.weeklyStatsEl.textContent = `지난 7일간 달성률: ${calculateAchievementRate(7)}`;
    if(domElements.monthlyStatsEl) domElements.monthlyStatsEl.textContent = `지난 30일간 달성률: ${calculateAchievementRate(30)}`;
}

// Renders stats visuals (streak, most achieved day, chart)
export function renderStatsVisuals() {
    if (appState.settings.appMode === 'simple' || !window.Chart || !domElements.chartCanvasEl || !domElements.statsVisualsContainerEl || !domElements.streakDaysEl || !domElements.mostAchievedDayEl) {
         if(domElements.statsVisualsContainerEl) domElements.statsVisualsContainerEl.classList.add('hidden');
         if (achievementChart) { achievementChart.destroy(); achievementChart = null; }
         return;
    }
    if(domElements.statsVisualsContainerEl) domElements.statsVisualsContainerEl.classList.remove('hidden');

    // Calculate Streak
    let currentStreak = 0;
    let dateToCheck = new Date();
    dateToCheck.setHours(0,0,0,0);

    const todayTasksForStreak = appState.tasks.slice(0, appState.settings.focusTaskCount);
    const todayFilled = todayTasksForStreak.every(t => t && t.text.trim() !== "");
    const todayCompleted = todayTasksForStreak.every(t => t && t.completed);
    if (todayFilled && todayTasksForStreak.length === appState.settings.focusTaskCount && todayCompleted && appState.settings.focusTaskCount > 0) {
        currentStreak++;
    } else {
        dateToCheck.setDate(dateToCheck.getDate() - 1); // Check yesterday's history
    }

    const historySorted = [...appState.history].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    for (let i = 0; i < historySorted.length; i++) {
        const entryDate = new Date(historySorted[i].date);
        entryDate.setHours(0,0,0,0);
        if (entryDate.getTime() === dateToCheck.getTime() && historySorted[i].achieved) {
            currentStreak++;
            dateToCheck.setDate(dateToCheck.getDate() - 1);
        } else if (entryDate.getTime() < dateToCheck.getTime()) {
            break;
        }
        if (currentStreak > 365) break;
    }
    if (domElements.streakDaysEl) domElements.streakDaysEl.textContent = `${currentStreak}일`;

    // Calculate Most Achieved Day
    const dayMap = ['일', '월', '화', '수', '목', '금', '토'];
    const achievementByDay = [0,0,0,0,0,0,0];
    appState.history.filter(entry => entry.achieved).forEach(entry => {
        achievementByDay[new Date(entry.date).getDay()]++;
    });
    const maxAchievedCount = Math.max(...achievementByDay);
    const mostAchievedDays = [];
    achievementByDay.forEach((count, index) => {
        if (count === maxAchievedCount && count > 0) mostAchievedDays.push(dayMap[index]);
    });
    if (domElements.mostAchievedDayEl) domElements.mostAchievedDayEl.textContent = mostAchievedDays.length > 0 ? mostAchievedDays.join(', ') + '요일' : '기록 없음';

    // Render Daily Achievement Chart
    const labels = [];
    const dataPoints = [];
    const todayForChart = new Date();
    todayForChart.setHours(0,0,0,0);

    for (let i = 29; i >= 0; i--) {
        const targetDate = new Date(todayForChart);
        targetDate.setDate(todayForChart.getDate() - i);
        const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        labels.push(dateStr.substring(5));

        let achievedThisDay = false;
        if (i === 0) { // Today's tasks from current appState
            const todayTasks = appState.tasks.slice(0, appState.settings.focusTaskCount);
            const filled = todayTasks.every(t=> t && t.text.trim() !== "");
            const completed = todayTasks.every(t => t && t.completed);
            achievedThisDay = filled && todayTasks.length === appState.settings.focusTaskCount && completed && appState.settings.focusTaskCount > 0;
        } else { // Past dates from history
            const entry = appState.history.find(h => h.date === dateStr);
            if (entry) achievedThisDay = entry.achieved;
        }
        dataPoints.push(achievedThisDay ? 1 : 0);
    }

    if (achievementChart) achievementChart.destroy(); // Destroy previous chart instance

    const isDarkMode = document.body.classList.contains('dark-theme');
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--chart-grid-color-dark' : '--chart-grid-color-light').trim();
    const fontColor = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--chart-font-color-dark' : '--chart-font-color-light').trim();
    const primaryButtonBg = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--button-primary-bg-dark' : '--button-primary-bg-light').trim();

    if (domElements.chartCanvasEl && window.Chart) {
        achievementChart = new Chart(domElements.chartCanvasEl.getContext('2d'), {
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
                        beginAtZero: true,
                        max: 1,
                        ticks: {
                            stepSize: 1,
                            color: fontColor,
                            callback: (v) => v === 1 ? '달성' : (v === 0 ? '미달성' : null)
                        },
                        grid: { color: gridColor }
                    },
                    x: {
                        ticks: { color: fontColor },
                        grid: { color: gridColor }
                    }
                },
                plugins: {
                    legend: { labels: { color: fontColor } },
                    tooltip: { callbacks: { label: (c) => c.parsed.y === 1 ? '달성' : '미달성' } }
                }
            }
        });
        domElements.chartCanvasEl.setAttribute('aria-label', '지난 30일간 일일 목표 달성 추이 그래프');
    }
}

// Creates and displays the authentication modal
export function createAuthModal(type, emailPasswordHandler, googleHandler) {
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
        await googleHandler();
        if (appState.currentUser) modal.remove();
    };

    const form = document.createElement('form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const emailVal = emailInput.value;
        const passwordVal = passwordInput.value;
        await emailPasswordHandler(emailVal, passwordVal);
        if (appState.currentUser) modal.remove();
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

    // Cache the modal element
    domElements.authModal = modal;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Setup for sharing as image (uses html2canvas)
export function setupShareAsImageListener() {
    if (domElements.shareAsImageBtnEl && typeof html2canvas !== 'undefined') {
        domElements.shareAsImageBtnEl.addEventListener('click', () => {
            if (appState.settings.appMode === 'simple') {
                showUserFeedback("이미지 공유는 집중 모드에서만 사용 가능합니다.", 'warning');
                return;
            }
            const originalBtnText = domElements.shareAsImageBtnEl.innerHTML;
            domElements.shareAsImageBtnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
            domElements.shareAsImageBtnEl.disabled = true;

            const captureArea = document.createElement('div');
            captureArea.id = 'image-capture-area';
            captureArea.style.padding = '20px';
            captureArea.style.width = '500px';

            const isDarkMode = document.body.classList.contains('dark-theme');
            captureArea.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--container-bg-color-dark' : '--container-bg-color-light').trim();
            captureArea.style.color = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--text-color-primary-dark' : '--text-color-primary-light').trim();
            captureArea.style.fontFamily = getComputedStyle(document.body).fontFamily;
            captureArea.style.lineHeight = getComputedStyle(document.body).lineHeight;

            const titleEl = document.createElement('h1');
            titleEl.textContent = "오늘셋";
            titleEl.style.fontSize = '2em';
            titleEl.style.fontWeight = '700';
            titleEl.style.textAlign = 'center';
            titleEl.style.marginBottom = '5px';
            captureArea.appendChild(titleEl);

            const dateEl = document.createElement('p');
            if(domElements.currentDateEl) dateEl.textContent = domElements.currentDateEl.textContent;
            dateEl.style.fontSize = '0.9em';
            dateEl.style.textAlign = 'center';
            dateEl.style.marginBottom = '15px';
            dateEl.style.color = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--text-color-tertiary-dark' : '--text-color-tertiary-light').trim();
            captureArea.appendChild(dateEl);

            const taskListWrapperOriginal = document.querySelector('.task-list-wrapper');
            if (taskListWrapperOriginal) {
                const taskListWrapperClone = taskListWrapperOriginal.cloneNode(true);
                const clonedAllDoneMsg = taskListWrapperClone.querySelector('#all-done-message');
                if (clonedAllDoneMsg && clonedAllDoneMsg.classList.contains('hidden')) clonedAllDoneMsg.remove();
                const clonedTaskList = taskListWrapperClone.querySelector('.task-list');
                if (clonedTaskList) {
                    const allClonedItems = Array.from(clonedTaskList.children);
                    allClonedItems.forEach((item, index) => {
                        if (index >= appState.settings.focusTaskCount) item.remove(); // Only render up to current focus count
                    });
                }
                taskListWrapperClone.style.marginTop = '0';
                captureArea.appendChild(taskListWrapperClone);
            }

            if (appState.settings.appMode === 'focus' && appState.settings.shareOptions.includeAdditional && appState.additionalTasks.length > 0) {
                const additionalTasksSectionOriginal = document.getElementById('additional-tasks-section');
                if(additionalTasksSectionOriginal){
                    const additionalTasksSectionClone = document.createElement('section');
                    additionalTasksSectionClone.innerHTML = `<h2><i class="fas fa-stream"></i> 추가 과제</h2>`;
                    const clonedAdditionalList = document.createElement('div');
                    appState.additionalTasks.forEach(task => {
                        const item = document.createElement('div');
                        item.style.padding = '5px 0';
                        item.style.borderBottom = '1px dashed var(--border-color)';
                        if (task.completed) item.style.textDecoration = 'line-through';
                        item.textContent = (task.completed ? '✅ ' : '◻️ ') + task.text;
                        clonedAdditionalList.appendChild(item);
                    });
                    if (clonedAdditionalList.lastChild) clonedAdditionalList.lastChild.style.borderBottom = 'none';
                    additionalTasksSectionClone.appendChild(clonedAdditionalList);
                    additionalTasksSectionClone.style.marginTop = '20px';
                    captureArea.appendChild(additionalTasksSectionClone);
                }
            }

            const linkEl = document.createElement('p');
            linkEl.textContent = 'todayset.vercel.app';
            linkEl.style.fontSize = '0.8em';
            linkEl.style.textAlign = 'center';
            linkEl.style.marginTop = '20px';
            linkEl.style.color = getComputedStyle(document.documentElement).getPropertyValue(isDarkMode ? '--link-color-dark' : '--link-color-light').trim();
            captureArea.appendChild(linkEl);

            captureArea.style.position = 'absolute';
            captureArea.style.left = '-9999px';
            document.body.appendChild(captureArea);

            html2canvas(captureArea, {
                useCORS: true,
                scale: window.devicePixelRatio || 1,
                logging: false,
                onclone: (clonedDoc) => {
                    const originalTaskTextareas = Array.from(domElements.taskListDivEl.querySelectorAll('.task-item textarea'));
                    const clonedTaskTextareas = Array.from(clonedDoc.querySelectorAll('.task-list-wrapper .task-item textarea'));
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
                showUserFeedback("할 일 목록 이미지가 다운로드되었습니다.", 'success');
            }).catch(err => {
                console.error('이미지 생성 실패:', err);
                showUserFeedback('이미지 생성에 실패했습니다.', 'error');
            }).finally(() => {
                if (document.body.contains(captureArea)) document.body.removeChild(captureArea);
                domElements.shareAsImageBtnEl.innerHTML = originalBtnText;
                domElements.shareAsImageBtnEl.disabled = false;
            });
        });
    }
}

