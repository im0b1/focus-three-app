// src/state.js - v2.0.0-refactor - Centralized State Management

// Initial state for the application
export const appState = {
    tasks: [],
    additionalTasks: [],
    history: [],
    settings: {
        appMode: 'simple',
        theme: 'dark',
        focusTaskCount: 3,
        shareOptions: { includeAdditional: false },
        lastDate: '' // Last date tasks were processed for daily reset
    },
    currentUser: null, // Firebase User object
};

// Internal list of subscribers
const listeners = [];

/**
 * Updates a portion of the appState and notifies all registered listeners.
 * @param {function(state: object): void} updaterFn A function that receives the current state
 *                                                  and modifies it directly.
 * @param {object} [options] Options for the state update.
 * @param {boolean} [options.skipSave=false] If true, skip saving to local storage/Firestore after this update.
 * @param {string} [options.source='state_update'] Source of the state update (e.g., 'local_load', 'firestore_update', 'import').
 */
export function setState(updaterFn, options = {}) {
    const { skipSave = false, source = 'state_update' } = options;

    // Apply the update function to a copy of the state
    // For simplicity, we'll directly modify the original state.
    // In a more complex app, you might deep clone to ensure immutability.
    updaterFn(appState);

    // Notify all listeners with the new state
    listeners.forEach(listener => listener({ ...appState })); // Pass a copy to listeners

    // Save state if not explicitly skipped
    // The actual saving logic is handled in app.js after state change subscription
    // This allows app.js to decide when to save (local vs. firebase)
}

/**
 * Registers a callback function to be called whenever the appState changes.
 * @param {function(newState: object): void} listener The callback function to register.
 */
export function subscribeToStateChanges(listener) {
    listeners.push(listener);
}

/**
 * Unregisters a callback function.
 * @param {function(newState: object): void} listener The callback function to unregister.
 */
export function unsubscribeFromStateChanges(listener) {
    const index = listeners.indexOf(listener);
    if (index > -1) {
        listeners.splice(index, 1);
    }
}

