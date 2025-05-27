// src/ui/domElements.js - v2.0.1-bugfix-1 - DOM Elements Cache Module

// This object will hold all cached DOM elements
export const domElements = {
    // Header
    authStatusContainerEl: null,
    loginBtnEl: null,
    signupBtnEl: null,
    userEmailSpanEl: null,
    logoutBtnEl: null,
    cloudSyncStatusDivEl: null,
    taskCountSelectorEl: null,
    appModeToggleEl: null,
    themeToggleButtonEl: null,
    currentDateEl: null,

    // Main Content
    taskListDivEl: null,
    allDoneMessageEl: null,
    additionalTasksSectionEl: null,
    addAdditionalTaskInputEl: null,
    addAdditionalTaskBtnEl: null,
    additionalTaskListDivEl: null,

    // Footer Toggles
    toggleHistoryBtnEl: null,
    toggleStatsBtnEl: null,
    toggleShareBtnEl: null,
    toggleSettingsBtnEl: null,

    // Footer Sections
    historyListDivEl: null,
    weeklyStatsEl: null,
    monthlyStatsEl: null,
    streakDaysEl: null,
    mostAchievedDayEl: null,
    chartCanvasEl: null,
    statsVisualsContainerEl: null,
    shareIncludeAdditionalCheckboxEl: null,
    shareAsImageBtnEl: null,
    copyLinkBtnEl: null,
    shareTwitterBtnEl: null,
    shareAsImageBtnContainerEl: null,
    shareOptionsDivEl: null,
    exportDataBtnEl: null,
    importDataBtnEl: null,
    importFileInputEl: null,
    currentSettingsContentDiv: null,
    simpleModeSettingsInfoEl: null,
    settingsSectionEl: null, // ADDED: settingsSectionEl was missing

    // Global / Modals
    liveRegionEl: null,
    authModal: null, // This will be assigned when the modal is created

    // Method to initialize (cache) all elements
    init: function() {
        // Header
        this.authStatusContainerEl = document.getElementById('auth-status');
        this.loginBtnEl = document.getElementById('login-btn');
        this.signupBtnEl = document.getElementById('signup-btn');
        this.userEmailSpanEl = document.getElementById('user-email');
        this.logoutBtnEl = document.getElementById('logout-btn');
        this.cloudSyncStatusDivEl = document.getElementById('cloud-sync-status');
        this.taskCountSelectorEl = document.getElementById('task-count-selector');
        this.appModeToggleEl = document.getElementById('app-mode-toggle');
        this.themeToggleButtonEl = document.getElementById('theme-toggle');
        this.currentDateEl = document.getElementById('current-date');

        // Main Content
        this.taskListDivEl = document.querySelector('.task-list');
        this.allDoneMessageEl = document.getElementById('all-done-message');
        this.additionalTasksSectionEl = document.getElementById('additional-tasks-section');
        this.addAdditionalTaskInputEl = document.getElementById('add-additional-task-input');
        this.addAdditionalTaskBtnEl = document.getElementById('add-additional-task-btn');
        this.additionalTaskListDivEl = document.getElementById('additional-task-list');

        // Footer Toggles
        this.toggleHistoryBtnEl = document.getElementById('toggle-history-btn');
        this.toggleStatsBtnEl = document.getElementById('toggle-stats-btn');
        this.toggleShareBtnEl = document.getElementById('toggle-share-btn');
        this.toggleSettingsBtnEl = document.getElementById('toggle-settings-btn');

        // Footer Sections
        this.historyListDivEl = document.getElementById('history-list');
        this.weeklyStatsEl = document.getElementById('weekly-stats');
        this.monthlyStatsEl = document.getElementById('monthly-stats');
        this.streakDaysEl = document.getElementById('streak-days');
        this.mostAchievedDayEl = document.getElementById('most-achieved-day');
        this.chartCanvasEl = document.getElementById('daily-achievement-chart');
        this.statsVisualsContainerEl = document.querySelector('.stats-visuals');
        this.shareIncludeAdditionalCheckboxEl = document.getElementById('share-include-additional');
        this.shareAsImageBtnEl = document.getElementById('share-as-image-btn');
        this.copyLinkBtnEl = document.getElementById('copy-link-btn');
        this.shareTwitterBtnEl = document.getElementById('share-twitter-btn');
        this.shareAsImageBtnContainerEl = document.getElementById('share-as-image-btn-container');
        this.shareOptionsDivEl = document.querySelector('#share-section .share-options');

        this.exportDataBtnEl = document.getElementById('export-data-btn');
        this.importDataBtnEl = document.getElementById('import-data-btn');
        this.importFileInputEl = document.getElementById('import-file-input');
        this.currentSettingsContentDiv = document.querySelector('#settings-section .settings-content');
        this.simpleModeSettingsInfoEl = document.querySelector('#settings-section .simple-mode-settings-info');
        this.settingsSectionEl = document.getElementById('settings-section'); // ADDED this line

        // Global / Modals
        this.liveRegionEl = document.getElementById('live-region');

        // Initial sanity check
        if (!this.currentDateEl || !this.taskListDivEl || !this.authStatusContainerEl) {
            document.body.innerHTML = '<div style="text-align:center;padding:20px;">앱 로딩 오류: 필수 DOM 요소 누락. (DOM_MISSING)</div>';
            throw new Error("Missing essential DOM elements for app initialization.");
        }
    }
};
