document.addEventListener('DOMContentLoaded', () => {
    const taskListDiv = document.querySelector('.task-list');
    const currentDateEl = document.getElementById('current-date');
    const allDoneMessageEl = document.getElementById('all-done-message');
    const toggleHistoryBtn = document.getElementById('toggle-history-btn');
    const historySection = document.getElementById('history-section');
    const historyListDiv = document.getElementById('history-list');
    const themeToggleButton = document.getElementById('theme-toggle');

    // 통계 요소
    const weeklyStatsEl = document.getElementById('weekly-stats');
    const monthlyStatsEl = document.getElementById('monthly-stats');

    // 공유 버튼 요소
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const shareTwitterBtn = document.getElementById('share-twitter-btn');
    // const shareInstagramBtn = document.getElementById('share-instagram-btn'); // 인스타 직접 공유는 어려움

    const MAX_TASKS = 3;
    let tasks = [];
    let history = []; // { date: "YYYY-MM-DD", tasks: [{text:"", completed:true}, ...] }

    // --- 테마 관리 ---
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            themeToggleButton.textContent = '☀️';
            localStorage.setItem('focusThreeTheme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            themeToggleButton.textContent = '🌙';
            localStorage.setItem('focusThreeTheme', 'light');
        }
    }
    themeToggleButton.addEventListener('click', () => {
        const currentTheme = localStorage.getItem('focusThreeTheme') || 'light';
        applyTheme(currentTheme === 'light' ? 'dark' : 'light');
    });
    const savedTheme = localStorage.getItem('focusThreeTheme');
    if (savedTheme) {
        applyTheme(savedTheme);
    }

    // --- 날짜 및 기본 유틸리티 ---
    function getTodayDateString() {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    function displayCurrentDate() {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        currentDateEl.textContent = today.toLocaleDateString('ko-KR', options);
    }

    function autoGrowTextarea(element) {
        element.style.height = "auto";
        element.style.height = (element.scrollHeight) + "px";
    }

    // --- 상태 저장 및 로드 ---
    function saveState() {
        localStorage.setItem('focusThreeTasks', JSON.stringify(tasks));
        localStorage.setItem('focusThreeLastDate', getTodayDateString());
        localStorage.setItem('focusThreeHistory', JSON.stringify(history));
        updateStats(); // 상태 변경 시 통계 업데이트
    }

    function loadState() {
        const storedTasks = localStorage.getItem('focusThreeTasks');
        const storedLastDate = localStorage.getItem('focusThreeLastDate');
        const storedHistory = localStorage.getItem('focusThreeHistory');
        const todayDateStr = getTodayDateString();

        if (storedHistory) {
            try {
                history = JSON.parse(storedHistory);
                if (!Array.isArray(history)) history = [];
            } catch (e) { history = []; }
        }

        if (storedLastDate === todayDateStr && storedTasks) {
            try {
                tasks = JSON.parse(storedTasks);
                if (!Array.isArray(tasks)) initializeTasks();
            } catch (e) { initializeTasks(); }
        } else {
            if (storedTasks && storedLastDate) { // 어제 날짜가 있어야 기록으로 넘김
                try {
                    const yesterdayTasksData = JSON.parse(storedTasks);
                    if(Array.isArray(yesterdayTasksData)) {
                        // 어제 날짜의 '모든 할 일'이 완료되었는지 체크
                        const allYesterdayTasksFilled = yesterdayTasksData.every(task => task && typeof task.text === 'string' && task.text.trim() !== "");
                        const allYesterdayTasksCompleted = yesterdayTasksData.every(task => task && task.completed);
                        
                        // '목표 달성 여부'를 기록 (3가지 모두 채우고 모두 완료했는지)
                        const yesterdayAchieved = allYesterdayTasksFilled && yesterdayTasksData.length === MAX_TASKS && allYesterdayTasksCompleted;

                        // 기록 객체에 'achieved' 속성 추가
                        history.unshift({ date: storedLastDate, tasks: yesterdayTasksData, achieved: yesterdayAchieved });
                        if (history.length > 60) history.splice(60); // 통계를 위해 기록 보관 기간 늘림 (예: 60일)
                    }
                } catch (e) { console.error("Error processing yesterday's tasks for history", e); }
            }
            initializeTasks();
            // saveState(); // initializeTasks 후 바로 저장 불필요, renderTasks 후 사용자가 입력/변경 시 저장됨
        }
        
        while(tasks.length < MAX_TASKS) {
            tasks.push({ id: Date.now() + tasks.length, text: '', completed: false });
        }
        if(tasks.length > MAX_TASKS) {
            tasks = tasks.slice(0, MAX_TASKS);
        }
        updateStats(); // 초기 로드 시 통계 업데이트
    }

    function initializeTasks() {
        tasks = [];
        for (let i = 0; i < MAX_TASKS; i++) {
            tasks.push({ id: Date.now() + i, text: '', completed: false });
        }
    }

    // --- 할 일 렌더링 및 관리 ---
    function renderTasks() {
        taskListDiv.innerHTML = '';
        tasks.forEach((task, index) => {
            const taskItem = document.createElement('div');
            taskItem.classList.add('task-item');
            if (task.completed) {
                taskItem.classList.add('completed');
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.setAttribute('aria-label', `할 일 ${index + 1} 완료`);
            checkbox.addEventListener('change', () => {
                tasks[index].completed = checkbox.checked;
                taskItem.classList.toggle('completed', checkbox.checked);
                checkAllDone();
                saveState();
            });

            const textareaField = document.createElement('textarea');
            textareaField.rows = "1";
            textareaField.placeholder = `할 일 ${index + 1}`;
            textareaField.value = task.text;
            textareaField.setAttribute('aria-label', `할 일 ${index + 1} 내용`);
            
            textareaField.addEventListener('input', (e) => {
                tasks[index].text = e.target.value;
                autoGrowTextarea(e.target);
            });
            textareaField.addEventListener('blur', () => {
                saveState();
            });
            textareaField.addEventListener('focus', (e) => {
                autoGrowTextarea(e.target);
            });

            taskItem.appendChild(checkbox);
            taskItem.appendChild(textareaField);
            taskListDiv.appendChild(taskItem);
            autoGrowTextarea(textareaField);
        });
        checkAllDone();
    }

    function checkAllDone() {
        const filledTasks = tasks.filter(task => typeof task.text === 'string' && task.text.trim() !== "");
        const completedFilledTasks = filledTasks.filter(task => task.completed);

        if (filledTasks.length === MAX_TASKS && completedFilledTasks.length === MAX_TASKS) {
            allDoneMessageEl.classList.remove('hidden');
        } else {
            allDoneMessageEl.classList.add('hidden');
        }
    }

    // --- 지난 기록 렌더링 ---
    function renderHistory() {
        if (history.length === 0) {
            historyListDiv.innerHTML = '<p>지난 기록이 없습니다.</p>';
            return;
        }
        historyListDiv.innerHTML = '';
        history.forEach(entry => {
            if (!entry || !entry.date || !Array.isArray(entry.tasks)) return;

            const entryDiv = document.createElement('div');
            entryDiv.classList.add('history-entry');
             // 목표 달성 여부에 따라 시각적 표시 (선택 사항)
            if (entry.achieved) {
                entryDiv.style.borderLeft = "3px solid var(--all-done-text)"; // 예시
            }


            const dateStrong = document.createElement('strong');
            dateStrong.textContent = `${entry.date.replaceAll('-', '.')}. ${entry.achieved ? "🎯" : ""}`; // 달성 시 아이콘 추가
            entryDiv.appendChild(dateStrong);

            const ul = document.createElement('ul');
            entry.tasks.forEach(task => {
                if(!task || typeof task.text !== 'string') return;
                const li = document.createElement('li');
                li.textContent = task.text;
                if (task.completed) {
                    li.classList.add('completed');
                }
                ul.appendChild(li);
            });
            entryDiv.appendChild(ul);
            historyListDiv.appendChild(entryDiv);
        });
    }
    toggleHistoryBtn.addEventListener('click', () => {
        const isHidden = historySection.classList.toggle('hidden');
        toggleHistoryBtn.textContent = isHidden ? "지난 기록 보기" : "지난 기록 숨기기";
        if (!isHidden) {
            renderHistory();
        }
    });

    // --- 통계 계산 및 업데이트 ---
    function calculateAchievementRate(days) {
        if (history.length === 0) return "0% (기록 없음)";

        const today = new Date();
        let achievementCount = 0;
        let relevantDaysCount = 0;

        for (let i = 0; i < days; i++) {
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() - i);
            const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
            
            const entry = history.find(h => h.date === targetDateStr);
            if (entry) {
                relevantDaysCount++;
                if (entry.achieved) { // 'achieved' 속성으로 판단
                    achievementCount++;
                }
            }
        }
        
        if (relevantDaysCount === 0) return "0% (기간 내 기록 없음)";
        const rate = (achievementCount / relevantDaysCount) * 100;
        return `${rate.toFixed(0)}% (${achievementCount}/${relevantDaysCount}일)`;
    }

    function updateStats() {
        weeklyStatsEl.textContent = `지난 7일간 달성률: ${calculateAchievementRate(7)}`;
        monthlyStatsEl.textContent = `지난 30일간 달성률: ${calculateAchievementRate(30)}`;
    }


    // --- 공유 기능 ---
    const shareUrl = window.location.href; // 현재 페이지 URL
    const shareText = "오늘 가장 중요한 3가지 일에 집중하세요! FocusThree와 함께! ✨";

    copyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('링크가 복사되었습니다!');
        }).catch(err => {
            console.error('링크 복사 실패:', err);
            alert('링크 복사에 실패했습니다.');
        });
    });

    shareTwitterBtn.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    // 인스타그램은 직접 텍스트/링크 공유가 어려워, 앱 소개 페이지 링크나 해시태그 사용 유도로 대체.
    // shareInstagramBtn.href = `...`; 


    // --- 초기화 ---
    displayCurrentDate();
    loadState(); // 통계 계산을 위해 기록 먼저 로드
    renderTasks();
    // updateStats(); // loadState에서 호출됨
});
