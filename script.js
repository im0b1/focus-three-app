document.addEventListener('DOMContentLoaded', () => {
    const taskListDiv = document.querySelector('.task-list');
    const currentDateEl = document.getElementById('current-date');
    const allDoneMessageEl = document.getElementById('all-done-message');
    const toggleHistoryBtn = document.getElementById('toggle-history-btn');
    const historySection = document.getElementById('history-section');
    const historyListDiv = document.getElementById('history-list');

    const MAX_TASKS = 3;
    let tasks = [];
    let history = [];

    function getTodayDateString() {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    function displayCurrentDate() {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        currentDateEl.textContent = today.toLocaleDateString('ko-KR', options);
    }

    // Textarea 자동 높이 조절 함수
    function autoGrowTextarea(element) {
        element.style.height = "auto"; // 높이를 내용에 맞게 초기화 (축소 가능하게)
        element.style.height = (element.scrollHeight) + "px"; // 스크롤 높이만큼 현재 높이 설정
    }

    function saveState() {
        localStorage.setItem('focusThreeTasks', JSON.stringify(tasks));
        localStorage.setItem('focusThreeLastDate', getTodayDateString());
        localStorage.setItem('focusThreeHistory', JSON.stringify(history));
    }

    function loadState() {
        const storedTasks = localStorage.getItem('focusThreeTasks');
        const storedLastDate = localStorage.getItem('focusThreeLastDate');
        const storedHistory = localStorage.getItem('focusThreeHistory');
        const todayDateStr = getTodayDateString();

        if (storedHistory) {
            history = JSON.parse(storedHistory);
        }

        if (storedLastDate === todayDateStr && storedTasks) {
            tasks = JSON.parse(storedTasks);
        } else {
            if (storedTasks) {
                const yesterdayTasks = JSON.parse(storedTasks);
                const completedYesterdayTasks = yesterdayTasks.filter(task => task.completed && task.text.trim() !== "");
                if (completedYesterdayTasks.length > 0) {
                    const dateToLog = storedLastDate || "이전 기록";
                    history.unshift({ date: dateToLog, tasks: completedYesterdayTasks });
                    if (history.length > 10) history.pop();
                }
            }
            initializeTasks();
            saveState(); // 날짜 변경 시 history 업데이트 후 즉시 저장
        }
        
        while(tasks.length < MAX_TASKS) {
            tasks.push({ id: Date.now() + tasks.length, text: '', completed: false });
        }
        if(tasks.length > MAX_TASKS) {
            tasks = tasks.slice(0, MAX_TASKS);
        }
    }

    function initializeTasks() {
        tasks = [];
        for (let i = 0; i < MAX_TASKS; i++) {
            tasks.push({ id: Date.now() + i, text: '', completed: false });
        }
    }

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
            checkbox.addEventListener('change', () => {
                tasks[index].completed = checkbox.checked;
                taskItem.classList.toggle('completed', checkbox.checked);
                checkAllDone();
                saveState();
            });

            // input 대신 textarea 사용
            const textareaField = document.createElement('textarea');
            textareaField.rows = "1"; // 초기에는 한 줄로 시작
            textareaField.placeholder = `할 일 ${index + 1}`;
            textareaField.value = task.text;
            
            textareaField.addEventListener('input', (e) => {
                tasks[index].text = e.target.value;
                autoGrowTextarea(e.target); // 입력 시 높이 자동 조절
                // 실시간 저장이 부담되면 blur에서만 saveState() 호출
                // saveState(); // 여기서 호출하면 입력마다 저장
            });
            textareaField.addEventListener('blur', () => {
                saveState(); // 포커스 잃을 때 저장
            });
            
            // 페이지 로드 시 또는 포커스 시에도 높이 조절 (초기 렌더링 시 내용이 있을 경우)
            textareaField.addEventListener('focus', (e) => {
                autoGrowTextarea(e.target);
            });


            taskItem.appendChild(checkbox);
            taskItem.appendChild(textareaField);
            taskListDiv.appendChild(taskItem);

            // DOM에 추가 후 즉시 높이 조절 (초기 렌더링 시 내용 있는 항목을 위해)
            autoGrowTextarea(textareaField);
        });
        checkAllDone();
    }

    function checkAllDone() {
        // 3개 모두 내용이 있고, 모두 체크되었을 때
        const allTasksFilledAndCompleted = tasks.every(task => task.text.trim() !== "" && task.completed);
        // 또는 3개의 칸이 모두 비어있지 않고, 그 중 완료된 것의 개수가 3개일 때 (더 유연한 조건)
        const filledTasks = tasks.filter(task => task.text.trim() !== "");
        const completedFilledTasks = filledTasks.filter(task => task.completed);

        if (filledTasks.length === MAX_TASKS && completedFilledTasks.length === MAX_TASKS) {
            allDoneMessageEl.classList.remove('hidden');
        } else {
            allDoneMessageEl.classList.add('hidden');
        }
    }

    function renderHistory() {
        if (history.length === 0) {
            historyListDiv.innerHTML = '<p>지난 기록이 없습니다.</p>';
            return;
        }
        historyListDiv.innerHTML = '';
        history.forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.classList.add('history-entry');

            const dateStrong = document.createElement('strong');
            dateStrong.textContent = `${entry.date.replaceAll('-', '.')}.`;
            entryDiv.appendChild(dateStrong);

            const ul = document.createElement('ul');
            entry.tasks.forEach(task => {
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
        historySection.classList.toggle('hidden');
        if (!historySection.classList.contains('hidden')) {
            renderHistory();
        }
    });

    // 초기화
    displayCurrentDate();
    loadState();
    renderTasks();
    // renderHistory(); // 초기에는 숨겨져 있으므로 버튼 클릭 시 호출
});
