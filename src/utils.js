// src/utils.js - v2.0.1-bugfix-1 - Utility Functions Module

import { domElements } from './ui/domElements.js'; // domElements를 임포트

/**
 * Shorthand for document.querySelector.
 * @param {string} selector CSS selector string.
 * @returns {Element | null} The first matching element or null.
 */
export function $(selector) {
    return document.querySelector(selector);
}

/**
 * Announces a message to screen readers using an ARIA live region.
 * @param {string} message The message to announce.
 */
export function announceToScreenReader(message) {
    if (domElements.liveRegionEl) {
        domElements.liveRegionEl.textContent = message;
    }
}

/**
 * Displays a user feedback message as a toast.
 * @param {string} message The message to display to the user.
 * @param {'info' | 'success' | 'warning' | 'error'} type The type of message.
 * @param {boolean} [isBackgroundSync=false] If true, this is a background sync message and won't show a toast.
 */
export function showUserFeedback(message, type = 'info', isBackgroundSync = false) {
    console.log(`[Feedback - ${type.toUpperCase()}] ${message}`);

    if (domElements.liveRegionEl) {
        domElements.liveRegionEl.textContent = message; // Also announce to screen reader
    }

    if (isBackgroundSync) {
        return; // Skip toast for background sync messages
    }

    const toastContainer = document.getElementById('toast-container') || (() => {
        const div = document.createElement('div');
        div.id = 'toast-container';
        document.body.appendChild(div);
        return div;
    })();

    const MAX_VISIBLE_TOASTS = 2;
    const existingToasts = toastContainer.querySelectorAll('.toast-message');

    if (existingToasts.length >= MAX_VISIBLE_TOASTS) {
        const oldestToast = toastContainer.firstElementChild;
        if (oldestToast) {
            oldestToast.classList.remove('show');
            oldestToast.addEventListener('transitionend', () => oldestToast.remove(), { once: true });
        }
    }

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3500);
}

/**
 * Gets the current date string in YYYY-MM-DD format.
 * @returns {string} Current date string.
 */
export function getTodayDateString() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

/**
 * Returns an array of objects representing toggleable sections and their corresponding buttons.
 * Used for managing section visibility and button text/ARIA attributes.
 * @returns {Array<Object>} An array of section information objects.
 */
export function getSectionsArray() {
    // domElements 객체가 초기화되었는지 확인 (앱 시작 시 호출되므로 대부분 항상 초기화됨)
    if (!domElements.toggleHistoryBtnEl) {
        console.error("DOM elements are not fully initialized when getSectionsArray is called.");
        // Fallback for robustness, though domElements.init() should prevent this
        return [
            { id: 'history-section', button: document.getElementById('toggle-history-btn'), baseText: '기록' },
            { id: 'stats-section', button: document.getElementById('toggle-stats-btn'), baseText: '통계' },
            { id: 'share-section', button: document.getElementById('toggle-share-btn'), baseText: '공유' },
            { id: 'settings-section', button: document.getElementById('toggle-settings-btn'), baseText: '설정' }
        ];
    }

    return [
        { id: 'history-section', button: domElements.toggleHistoryBtnEl, baseText: '기록' },
        { id: 'stats-section', button: domElements.toggleStatsBtnEl, baseText: '통계' },
        { id: 'share-section', button: domElements.toggleShareBtnEl, baseText: '공유' },
        { id: 'settings-section', button: domElements.toggleSettingsBtnEl, baseText: '설정' }
    ];
}
