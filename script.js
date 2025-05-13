document.addEventListener('DOMContentLoaded', () => {
    // --- 요소 가져오기 ---
    const taskListDiv = document.querySelector('.task-list');
    const currentDateEl = document.getElementById('current-date');
    const allDoneMessageEl = document.getElementById('all-done-message');
    const themeToggleButton = document.getElementById('theme-toggle');
    // Footer 요소
    const toggleHistoryBtn = document.getElementById('toggle-history-btn');
    const toggleStatsBtn = document.getElementById('toggle-stats-btn');
    const toggleShareBtn = document.getElementById('toggle-share-btn');
    const historySection = document.getElementById('history-section');
    const statsSection = document.getElementById('stats-section');
    const shareSection = document.getElementById('share-section');
    // 통계 요소
    const historyListDiv = document.getElementById('history-list');
    const weeklyStatsEl = document.getElementById('weekly-stats');
    const monthlyStatsEl = document.getElementById('monthly-stats');
    // 공유 버튼 요소
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const shareTwitterBtn = document.getElementById('share-twitter-btn');

    // --- 전역 변수 ---
    const MAX_TASKS = 3;
    let tasks = [];
    let history = [];

    // --- 테마 관리 ---
    function applyTheme(theme) {
        if (theme === 'dark') { document.body.classList.add('dark-theme'); themeToggleButton.textContent = '☀️'; localStorage.setItem('focusThreeTheme', 'dark'); }
        else { document.body.classList.remove('dark-theme'); themeToggleButton.textContent = '🌙'; localStorage.setItem('focusThreeTheme', 'light'); }
    }
    themeToggleButton.addEventListener('click', () => {
        const isDarkMode = document.body.classList.contains('dark-theme'); applyTheme(isDarkMode ? 'light' : 'dark');
    });
    const savedTheme = localStorage.getItem('focusThreeTheme'); applyTheme(savedTheme || 'dark');

    // --- 날짜 및 유틸리티 ---
    function getTodayDateString() { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; }
    function displayCurrentDate() { const today = new Date(); const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }; currentDateEl.textContent = today.toLocaleDateString('ko-KR', options); }
    function autoGrowTextarea(element) { element.style.height = "auto"; element.style.height = (element.scrollHeight) + "px"; }

    // --- 상태 저장 및 로드 ---
    function saveState() { localStorage.setItem('focusThreeTasks', JSON.stringify(tasks)); localStorage.setItem('focusThreeLastDate', getTodayDateString()); localStorage.setItem('focusThreeHistory', JSON.stringify(history)); updateStats(); }
    function loadState() {
        const storedTasks = localStorage.getItem('focusThreeTasks'); const storedLastDate = localStorage.getItem('focusThreeLastDate'); const storedHistory = localStorage.getItem('focusThreeHistory'); const todayDateStr = getTodayDateString();
        if (storedHistory) { try { history = JSON.parse(storedHistory); if (!Array.isArray(history)) history = []; } catch (e) { history = []; } }
        if (storedLastDate === todayDateStr && storedTasks) { try { tasks = JSON.parse(storedTasks); if (!Array.isArray(tasks)) initializeTasks(); } catch (e) { initializeTasks(); } }
        else {
             if (storedTasks && storedLastDate) {
                try {
                    const yesterdayTasksData = JSON.parse(storedTasks);
                    if(Array.isArray(yesterdayTasksData)) {
                        const allYesterdayTasksFilled = yesterdayTasksData.every(task => task && typeof task.text === 'string' && task.text.trim() !== ""); const allYesterdayTasksCompleted = yesterdayTasksData.every(task => task && task.completed); const yesterdayAchieved = allYesterdayTasksFilled && yesterdayTasksData.length === MAX_TASKS && allYesterdayTasksCompleted;
                        if (!history.some(entry => entry.date === storedLastDate)) { history.unshift({ date: storedLastDate, tasks: yesterdayTasksData, achieved: yesterdayAchieved }); if (history.length > 60) history.splice(60); }
                    }
                } catch (e) { console.error("Error processing yesterday's tasks for history", e); }
            }
            initializeTasks(); saveState();
        }
        while(tasks.length < MAX_TASKS) { tasks.push({ id: Date.now() + tasks.length, text: '', completed: false }); } if(tasks.length > MAX_TASKS) { tasks = tasks.slice(0, MAX_TASKS); } updateStats();
    }
    function initializeTasks() { tasks = []; for (let i = 0; i < MAX_TASKS; i++) { tasks.push({ id: Date.now() + i, text: '', completed: false }); } }

    // --- 할 일 렌더링 및 관리 ---
    function renderTasks() {
        taskListDiv.innerHTML = '';
        tasks.forEach((task, index) => {
            const taskItem = document.createElement('div'); taskItem.classList.add('task-item'); if (task.completed) { taskItem.classList.add('completed'); }
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = task.completed; checkbox.setAttribute('aria-label', `할 일 ${index + 1} 완료`); checkbox.addEventListener('change', () => { tasks[index].completed = checkbox.checked; taskItem.classList.toggle('completed', checkbox.checked); checkAllDone(); saveState(); });
            const textareaField = document.createElement('textarea'); textareaField.rows = "1"; textareaField.placeholder = `할 일 ${index + 1}`; textareaField.value = task.text; textareaField.setAttribute('aria-label', `할 일 ${index + 1} 내용`); textareaField.addEventListener('input', (e) => { tasks[index].text = e.target.value; autoGrowTextarea(e.target); }); textareaField.addEventListener('blur', () => { saveState(); }); textareaField.addEventListener('focus', (e) => { autoGrowTextarea(e.target); });
            taskItem.appendChild(checkbox); taskItem.appendChild(textareaField); taskListDiv.appendChild(taskItem); autoGrowTextarea(textareaField);
        });
        checkAllDone();
    }
    function checkAllDone() { const filledTasks = tasks.filter(task => typeof task.text === 'string' && task.text.trim() !== ""); const completedFilledTasks = filledTasks.filter(task => task.completed); const shouldShowMessage = filledTasks.length === MAX_TASKS && completedFilledTasks.length === MAX_TASKS; allDoneMessageEl.classList.toggle('hidden', !shouldShowMessage); }

    // --- 섹션 토글 기능 (3개 섹션 관리) ---
    const sections = [
        { id: 'history-section', button: toggleHistoryBtn, showText: '지난 기록', hideText: '기록 숨기기' },
        { id: 'stats-section', button: toggleStatsBtn, showText: '통계', hideText: '통계 숨기기' },
        { id: 'share-section', button: toggleShareBtn, showText: '공유하기', hideText: '공유 닫기' }
    ];
    function toggleSection(sectionIdToToggle) {
        sections.forEach(sec => {
            const sectionElement = document.getElementById(sec.id); if (!sectionElement) return;
            if (sec.id === sectionIdToToggle) { const isHidden = sectionElement.classList.contains('hidden'); sectionElement.classList.toggle('hidden'); sec.button.textContent = isHidden ? sec.hideText : sec.showText; sec.button.setAttribute('aria-expanded', isHidden); sectionElement.setAttribute('aria-hidden', !isHidden); if (isHidden && sec.id === 'history-section') { renderHistory(); } }
            else { if (!sectionElement.classList.contains('hidden')) { sectionElement.classList.add('hidden'); sec.button.textContent = sec.showText; sec.button.setAttribute('aria-expanded', 'false'); sectionElement.setAttribute('aria-hidden', 'true'); } }
        });
    }
    toggleHistoryBtn.addEventListener('click', () => toggleSection('history-section'));
    toggleStatsBtn.addEventListener('click', () => toggleSection('stats-section'));
    toggleShareBtn.addEventListener('click', () => toggleSection('share-section'));

    // --- 지난 기록 렌더링 ---
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

    // --- 통계 계산 및 업데이트 ---
    function calculateAchievementRate(days) {
        if (history.length === 0) return "0% (기록 없음)"; const today = new Date(); today.setHours(0, 0, 0, 0); let achievementCount = 0, relevantDaysCount = 0;
        for (let i = 1; i <= days; i++) { const targetDate = new Date(today); targetDate.setDate(today.getDate() - i); const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`; const entry = history.find(h => h.date === targetDateStr); if (entry) { relevantDaysCount++; if (entry.achieved) { achievementCount++; } } }
        if (relevantDaysCount === 0) return "0% (기간 내 기록 없음)"; const rate = (achievementCount / relevantDaysCount) * 100; return `${rate.toFixed(0)}% (${achievementCount}/${relevantDaysCount}일)`;
    }
    function updateStats() { weeklyStatsEl.textContent = `지난 7일간 달성률: ${calculateAchievementRate(7)}`; monthlyStatsEl.textContent = `지난 30일간 달성률: ${calculateAchievementRate(30)}`; }

    // --- 공유 기능 ---
    const shareUrl = window.location.href; const shareText = "오늘 가장 중요한 3가지 일에 집중하세요! FocusThree와 함께! ✨";
    copyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(shareUrl).then(() => { const originalHTML = copyLinkBtn.innerHTML; copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> 복사 완료!'; copyLinkBtn.classList.add('copy-success'); copyLinkBtn.disabled = true; setTimeout(() => { copyLinkBtn.innerHTML = originalHTML; copyLinkBtn.classList.remove('copy-success'); copyLinkBtn.disabled = false; }, 1500); }).catch(err => { console.error('링크 복사 실패:', err); alert('링크 복사에 실패했습니다.'); });
    });
    shareTwitterBtn.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

    // --- 초기화 실행 ---
    displayCurrentDate(); loadState(); renderTasks();
    sections.forEach(sec => { const sectionElement = document.getElementById(sec.id); if (sectionElement) { sectionElement.setAttribute('aria-hidden', 'true'); sec.button.setAttribute('aria-expanded', 'false'); } });
});
