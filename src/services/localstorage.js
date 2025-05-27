// src/services/localstorage.js - v2.0.0-refactor - Local Storage Service Module

import { appState, setState } from '../state.js';
import { showUserFeedback, getTodayDateString } from '../utils.js';

const APP_VERSION_DATA_FORMAT = "1.14.1-content-load-fix-data"; // For data import/export compatibility

export function saveToLocalStorage() {
    try {
        localStorage.setItem('oneulSetTasks', JSON.stringify(appState.tasks));
        localStorage.setItem('oneulSetAdditionalTasks', JSON.stringify(appState.additionalTasks));
        localStorage.setItem('oneulSetLastDate', appState.settings.lastDate); // Use state's lastDate
        localStorage.setItem('oneulSetHistory', JSON.stringify(appState.history));
        localStorage.setItem('oneulSetMode', appState.settings.appMode);
        localStorage.setItem('oneulSetTheme', appState.settings.theme);
        localStorage.setItem('oneulSetFocusTaskCountSetting', appState.settings.focusTaskCount.toString());
        localStorage.setItem('oneulSetShareOptions', JSON.stringify(appState.settings.shareOptions));
        console.log("State saved to Local Storage.");
    } catch (e) {
        console.error("Error saving to local storage:", e);
        showUserFeedback("로컬 저장 중 오류 발생.", 'error');
    }
}

export function loadFromLocalStorage() {
    console.log("Loading initial data and settings from Local Storage.");
    let loadedState = {
        tasks: [],
        additionalTasks: [],
        history: [],
        settings: {
            appMode: 'simple',
            theme: 'dark',
            focusTaskCount: 3,
            shareOptions: { includeAdditional: false },
            lastDate: getTodayDateString() // Default to today if not found
        }
    };

    try {
        const storedTasks = localStorage.getItem('oneulSetTasks');
        if (storedTasks) {
            loadedState.tasks = JSON.parse(storedTasks).map(t => ({
                id: t.id, text: t.text, completed: t.completed
            }));
            if (!Array.isArray(loadedState.tasks)) throw new Error("Tasks data corrupted.");
        } else {
            // Initialize 5 empty tasks if none exist
            for (let i = 0; i < 5; i++) {
                loadedState.tasks.push({ id: Date.now() + i + Math.random(), text: '', completed: false });
            }
        }

        const storedAdditionalTasks = localStorage.getItem('oneulSetAdditionalTasks');
        if (storedAdditionalTasks) {
            loadedState.additionalTasks = JSON.parse(storedAdditionalTasks);
            if (!Array.isArray(loadedState.additionalTasks)) throw new Error("Additional tasks data corrupted.");
        }

        const storedHistory = localStorage.getItem('oneulSetHistory');
        if (storedHistory) {
            loadedState.history = JSON.parse(storedHistory).map(entry => ({
                ...entry,
                tasks: entry.tasks.map(t => ({ id: t.id, text: t.text, completed: t.completed }))
            }));
            if (!Array.isArray(loadedState.history)) throw new Error("History data corrupted.");
        }

        loadedState.settings.lastDate = localStorage.getItem('oneulSetLastDate') || getTodayDateString();
        loadedState.settings.appMode = localStorage.getItem('oneulSetMode') || 'simple';
        loadedState.settings.theme = localStorage.getItem('oneulSetTheme') || 'dark';
        loadedState.settings.focusTaskCount = parseInt(localStorage.getItem('oneulSetFocusTaskCountSetting') || '3', 10);

        const storedShareOptions = localStorage.getItem('oneulSetShareOptions');
        if (storedShareOptions) {
            loadedState.settings.shareOptions = JSON.parse(storedShareOptions);
            // Clean up old 'includeMemos' if present
            if (loadedState.settings.shareOptions.hasOwnProperty('includeMemos')) {
                delete loadedState.settings.shareOptions.includeMemos;
            }
        }

        // Apply loaded settings to appState directly after load
        // This is the initial sync from local storage to appState
        setState(state => {
            Object.assign(state.settings, loadedState.settings);
            state.tasks = loadedState.tasks;
            state.additionalTasks = loadedState.additionalTasks;
            state.history = loadedState.history;
        }, { skipSave: true, source: 'local_load' });

        return loadedState; // Return the loaded data for further processing (e.g., daily reset in app.js)

    } catch (e) {
        console.error("Error loading from local storage:", e);
        showUserFeedback(`로컬 데이터 손상: ${e.message}. 초기화합니다.`, 'warning');
        // If data is corrupted, clear local storage for these items and return initial state
        localStorage.removeItem('oneulSetTasks');
        localStorage.removeItem('oneulSetAdditionalTasks');
        localStorage.removeItem('oneulSetHistory');
        localStorage.removeItem('oneulSetMode');
        localStorage.removeItem('oneulSetTheme');
        localStorage.removeItem('oneulSetFocusTaskCountSetting');
        localStorage.removeItem('oneulSetShareOptions');
        return loadFromLocalStorage(); // Reload default initial state
    }
}

