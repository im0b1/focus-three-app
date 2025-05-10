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
            // 날짜가 다르거나 저장된 할 일이 없으면 초기화
            // 어제 완료된 할 일이 있다면 기록으로 옮김
            if (storedTasks) {
                const yesterdayTasks = JSON.parse(storedTasks);
                const completedYesterdayTasks = yesterdayTasks.filter(task => task.completed && task.text.trim() !== "");
                if (completedYesterdayTasks.length > 0) {
                    const dateToLog = storedLastDate || "이전 기록"; // 날짜 정보가 없다면
                    history.unshift({ date: dateToLog, tasks: completedYesterdayTasks });
                    if (history.length > 10) history.pop(); // 기록은 최근 10개만 유지 (선택사항)
                }
            }
            initializeTasks();
        }
        // tasks 배열이 MAX_TASKS보다 짧으면 채워넣기 (데이터 구조 변경 시)
        while(tasks.length < MAX_TASKS) {
            tasks.push({ id: Date.now() + tasks.length, text: '', completed: false });
        }
        // tasks 배열이 MAX_TASKS보다 길면 자르기
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
        taskListDiv.innerHTML = ''; // 기존 목록 초기화
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

            const inputField = document.createElement('input');
            inputField.type = 'text';
            inputField.value = task.text;
            inputField.placeholder = `할 일 ${index + 1}`;
            inputField.addEventListener('input', (e) => {
                tasks[index].text = e.target.value;
                // 실시간 저장을 원하면 여기서 saveState(), 아니면 blur 이벤트 사용
            });
            inputField.addEventListener('blur', () => { // 포커스 잃을 때 저장
                saveState();
            });


            taskItem.appendChild(checkbox);
            taskItem.appendChild(inputField);
            taskListDiv.appendChild(taskItem);
        });
        checkAllDone(); // 초기 로드 시에도 체크
    }

    function checkAllDone() {
        const allCompleted = tasks.every(task => task.completed && task.text.trim() !== "");
        // 3개 모두 내용이 있고, 모두 체크되었을 때
        const allTasksFilled = tasks.every(task => task.text.trim() !== "");
        if (allTasksFilled && allCompleted) {
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
            dateStrong.textContent = `${entry.date.replaceAll('-', '.')}.`; // YYYY.MM.DD. 형식
            entryDiv.appendChild(dateStrong);

            const ul = document.createElement('ul');
            entry.tasks.forEach(task => {
                const li = document.createElement('li');
                li.textContent = task.text;
                if (task.completed) { // history에는 completed만 저장되지만, 명시적으로
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
    renderHistory(); // 초기에 기록 목록도 렌더링 (숨겨져 있음)
});