// src/services/firebase.js - v2.0.0-refactor - Firebase Service Module

import { appState, setState } from '../state.js';
import { showUserFeedback } from '../utils.js';

const firebaseConfig = {
    apiKey: "AIzaSyCOpwpjfVTelpwDuf-H05UWhZbuSPa5ETg",
    authDomain: "todayset-5fd1d.firebaseapp.com",
    projectId: "todayset-5fd1d",
    storageBucket: "todayset-5fd1d.firebasestorage.app",
    messagingSenderId: "241640367345",
    appId: "1:241640367345:web:152b382f3fb4a05c943550",
    measurementId: "G-J2HZ3RJ6MQ"
};

let firebaseApp;
let firebaseAuth;
let firestoreDB;

// Firestore listener unsubscribers
let userSettingsUnsubscribe = null;
let userTasksUnsubscribe = null;
let userAdditionalTasksUnsubscribe = null;
let userHistoryUnsubscribe = null;

export function initializeFirebase() {
    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
        if (firebase.apps.length === 0) {
            console.log("Firebase: Initializing new Firebase app instance.");
            firebaseApp = firebase.initializeApp(firebaseConfig);
        } else {
            console.log("Firebase: SDK already initialized. Reusing existing app instance.");
            firebaseApp = firebase.app();
        }

        if (firebase.auth) {
            firebaseAuth = firebase.auth();
            console.log("Firebase: Auth module available.");
        } else {
            console.warn("Firebase: Auth module not available.");
            showUserFeedback("Firebase Auth 모듈 로드 실패.", 'warning');
        }

        if (firebase.firestore) {
            firestoreDB = firebase.firestore();
            console.log("Firebase: Firestore module available.");
            if (firestoreDB) {
                firestoreDB.enablePersistence({ synchronizeTabs: true })
                    .then(() => console.log("Firestore persistence enabled."))
                    .catch(err => {
                        if (err.code === 'failed-precondition') {
                            showUserFeedback("오프라인 데이터 동기화 실패: 다른 탭이 열려있습니다.", 'warning');
                            console.warn("Firestore persistence failed: Multiple tabs open, persistence can only be enabled in one.");
                        } else if (err.code === 'unimplemented') {
                            showUserFeedback("오프라인 데이터 동기화 실패: 브라우저가 지원하지 않습니다.", 'warning');
                            console.warn("Firestore persistence failed: The browser does not support all of the features required to enable persistence.");
                        } else {
                            showUserFeedback(`오프라인 데이터 동기화 실패: ${err.code}`, 'error');
                            console.error("Firestore persistence error:", err.code);
                        }
                    });
            }
        } else {
            console.warn("Firebase: Firestore module not available.");
            showUserFeedback("Firebase Firestore 모듈 로드 실패.", 'warning');
        }
    } else {
        console.error("Firebase SDK (firebase object) not loaded. Running in local-only mode.");
        showUserFeedback("클라우드 서비스 사용 불가: Firebase SDK 로드 실패. 오프라인 모드로 실행됩니다.", 'error');
    }
}

export function getUserDocRef(userId) {
    if (!firestoreDB) {
        console.warn("Firestore DB is not initialized. Cannot get user document reference.");
        return null;
    }
    if (!userId) {
        console.warn("User ID is null or undefined. Cannot get user document reference.");
        return null;
    }
    return firestoreDB.collection('users').doc(userId);
}

export async function initializeUserSettingsInFirestore(userId) {
    console.log(`Firestore: Attempting to initialize appSettings for user: ${userId}`);
    const userDocRef = getUserDocRef(userId);
    if (!userDocRef) {
        console.error("Firestore: User doc ref is null, cannot initialize settings.");
        return;
    }
    try {
        const docSnap = await userDocRef.get();
        if (!docSnap.exists || !docSnap.data()?.appSettings) {
            const initialSettings = {
                appMode: 'simple', theme: 'dark', focusTaskCount: 3,
                shareOptions: { includeAdditional: false },
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            };
            await userDocRef.set({ appSettings: initialSettings }, { merge: true });
            console.log("Firestore: Initial appSettings created for", userId);
        } else {
            console.log("Firestore: appSettings already exist for", userId);
        }
    } catch (error) {
        showUserFeedback(`Firestore 설정 초기화 실패: ${error.message}`, 'error');
        console.error("Error initializing appSettings in Firestore for " + userId + ":", error);
    }
}

export async function loadAppSettingsFromFirestore(userId) {
    console.log(`Firestore: Attempting to load appSettings for user: ${userId}`);
    const userDocRef = getUserDocRef(userId);
    if (!userDocRef) {
        console.error("Firestore: User settings ref not available, cannot load appSettings.");
        return Promise.reject("User settings ref not available.");
    }
    try {
        const docSnap = await userDocRef.get();
        if (docSnap.exists && docSnap.data()?.appSettings) {
            console.log("Firestore: appSettings loaded from cloud for", userId);
            return docSnap.data().appSettings;
        }
        console.log("Firestore: No appSettings found for user, attempting to initialize.");
        await initializeUserSettingsInFirestore(userId);
        const newDocSnap = await userDocRef.get();
        if (newDocSnap.exists && newDocSnap.data()?.appSettings) {
            console.log("Firestore: appSettings loaded after initialization for", userId);
            return newDocSnap.data().appSettings;
        } else {
            console.error("Firestore: Failed to load appSettings even after initialization for", userId);
            return null;
        }
    } catch (error) {
        console.error("Error loading appSettings from Firestore for " + userId + ":", error);
        showUserFeedback("클라우드 설정 로드 실패.", 'error');
        return Promise.reject(error);
    }
}

export async function saveAppSettingsToFirestore(settings) {
    if (!appState.currentUser) { console.warn("saveAppSettingsToFirestore: No current user logged in."); return; }
    if (!firestoreDB) { console.warn("saveAppSettingsToFirestore: Firestore DB is not initialized."); return; }
    if (!navigator.onLine) { console.warn("saveAppSettingsToFirestore: Offline, app settings not saved to Firestore."); return; }

    const userDocRef = getUserDocRef(appState.currentUser.uid);
    if (!userDocRef) { console.error("saveAppSettingsToFirestore: User doc ref is null, cannot save settings."); return; }

    const settingsToSave = {
        appMode: settings.appMode,
        theme: settings.theme,
        focusTaskCount: settings.focusTaskCount,
        shareOptions: settings.shareOptions,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };
    console.log("Firestore: Attempting to save app settings:", settingsToSave);
    try {
        await userDocRef.set({ appSettings: settingsToSave }, { merge: true });
        console.log("Firestore: App settings saved for user", appState.currentUser.uid);
    } catch (error) {
        showUserFeedback(`클라우드 설정 저장 실패: ${error.message}`, 'error');
        console.error("Error saving app settings to Firestore for " + appState.currentUser.uid + ":", error);
    }
}

export async function syncDataToFirestore() {
    if (!appState.currentUser) { console.warn("syncDataToFirestore: No current user logged in."); return; }
    if (!firestoreDB) { console.warn("syncDataToFirestore: Firestore DB is not initialized."); return; }
    if (!navigator.onLine) { console.warn("syncDataToFirestore: Offline. Data not saved to Firestore, will sync when online."); showUserFeedback("오프라인: 데이터는 네트워크 연결 시 동기화됩니다.", 'info'); return; }

    const userDocRef = getUserDocRef(appState.currentUser.uid);
    if (!userDocRef) { console.error("syncDataToFirestore: User doc ref is null, cannot sync data."); return; }

    console.log("Firestore: Attempting to sync all data (tasks, additional tasks, history) using batch write.");
    const batch = firestoreDB.batch();

    batch.set(userDocRef, { tasksData: { items: appState.tasks, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() } }, { merge: true });
    batch.set(userDocRef, { additionalTasksData: { items: appState.additionalTasks, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() } }, { merge: true });
    batch.set(userDocRef, { historyData: { items: appState.history, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() } }, { merge: true });

    try {
        await batch.commit();
        console.log("Firestore: All data (tasks, additional tasks, history) committed in a single batch.");
    } catch (error) {
        showUserFeedback(`클라우드 데이터 동기화 실패: ${error.message}`, 'error');
        console.error("Error syncing all data to Firestore:", error);
    }
}

export function listenToAppSettingsChanges(userId) {
    if (userSettingsUnsubscribe) userSettingsUnsubscribe();
    const userDocRef = getUserDocRef(userId);
    if (!userDocRef) { console.warn("listenToAppSettingsChanges: User doc ref is null, cannot set listener."); return; }
    console.log("Setting up Firestore listener for appSettings:", userId);
    userSettingsUnsubscribe = userDocRef.onSnapshot(doc => {
        if (doc.metadata.hasPendingWrites && doc.metadata.fromCache) {
             console.log("Firestore: Local change detected for appSettings, skipping UI re-render.");
             return;
        }

        if (doc.exists && doc.data()?.appSettings) {
            const remoteSettings = doc.data().appSettings;
            // Only update state if remote changes differ from current state to avoid loops
            if (JSON.stringify(appState.settings.appMode) !== JSON.stringify(remoteSettings.appMode) ||
                JSON.stringify(appState.settings.theme) !== JSON.stringify(remoteSettings.theme) ||
                JSON.stringify(appState.settings.focusTaskCount) !== JSON.stringify(remoteSettings.focusTaskCount) ||
                JSON.stringify(appState.settings.shareOptions) !== JSON.stringify(remoteSettings.shareOptions)) {
                console.log("Firestore: AppSettings changed by remote, updating local state and UI.");
                setState(state => {
                    state.settings.appMode = remoteSettings.appMode;
                    state.settings.theme = remoteSettings.theme;
                    state.settings.focusTaskCount = remoteSettings.focusTaskCount;
                    state.settings.shareOptions = remoteSettings.shareOptions;
                }, { source: 'firestore_update' });
                showUserFeedback("클라우드 설정이 업데이트되었습니다.", 'info', true);
            } else {
                console.log("Firestore: AppSettings remote update but no change detected or already synced. Not showing feedback.");
            }
        } else {
            console.log("Firestore: Document or appSettings field not found in snapshot for user", userId);
        }
    }, error => { showUserFeedback(`클라우드 설정 동기화 오류: ${error.message}`, 'error'); console.error("Error in appSettings listener for " + userId + ":", error); });
}

export function listenToTasksChanges(userId) {
    if (userTasksUnsubscribe) userTasksUnsubscribe();
    const userDocRef = getUserDocRef(userId);
    if (!userDocRef) { console.warn("listenToTasksChanges: User doc ref is null, cannot set listener."); return; }
    console.log("Setting up Firestore listener for tasksData:", userId);
    userTasksUnsubscribe = userDocRef.onSnapshot(doc => {
        if (doc.metadata.hasPendingWrites && doc.metadata.fromCache) {
             console.log("Firestore: Local change detected for tasksData, skipping UI re-render.");
             return;
        }

        if (doc.exists && doc.data()?.tasksData?.items) {
            const remoteTasks = doc.data().tasksData.items.map(t => ({
                id: t.id, text: t.text, completed: t.completed
            }));
            if (JSON.stringify(appState.tasks) !== JSON.stringify(remoteTasks)) {
                console.log("Firestore: Tasks changed by remote, updating local state and UI.");
                setState(state => {
                    state.tasks = remoteTasks;
                    while (state.tasks.length < 5) { state.tasks.push({ id: Date.now() + state.tasks.length + Math.random(), text: '', completed: false });}
                    if (state.tasks.length > 5) state.tasks = state.tasks.slice(0,5);
                }, { source: 'firestore_update' });
                showUserFeedback("핵심 할 일 목록이 클라우드에서 업데이트되었습니다.", 'info', true);
            } else {
                console.log("Firestore: Tasks remote update but no change detected or already synced. Not showing feedback.");
            }
        } else if (doc.exists && !doc.data()?.tasksData) {
            console.log("Firestore: tasksData field not found in user document, initializing locally.");
            setState(state => {
                state.tasks = [];
                for (let i = 0; i < 5; i++) {
                    state.tasks.push({ id: Date.now() + i + Math.random(), text: '', completed: false });
                }
            }, { source: 'firestore_update' });
        } else {
            console.log("Firestore: Document or tasksData field not found in snapshot for user", userId);
        }
    }, error => { showUserFeedback(`핵심 할 일 동기화 오류: ${error.message}`, 'error'); console.error("Error in tasks listener for " + userId + ":", error); });
}

export function listenToAdditionalTasksChanges(userId) {
    if (userAdditionalTasksUnsubscribe) userAdditionalTasksUnsubscribe();
    const userDocRef = getUserDocRef(userId);
    if (!userDocRef) { console.warn("listenToAdditionalTasksChanges: User doc ref is null, cannot set listener."); return; }
    console.log("Setting up Firestore listener for additionalTasksData:", userId);
    userAdditionalTasksUnsubscribe = userDocRef.onSnapshot(doc => {
        if (doc.metadata.hasPendingWrites && doc.metadata.fromCache) {
            console.log("Firestore: Local change detected for additionalTasksData, skipping UI re-render.");
            return;
        }

        if (doc.exists && doc.data()?.additionalTasksData?.items) {
            const remoteAdditionalTasks = doc.data().additionalTasksData.items;
             if (JSON.stringify(appState.additionalTasks) !== JSON.stringify(remoteAdditionalTasks)) {
                console.log("Firestore: Additional tasks changed by remote, updating local state and UI.");
                setState(state => { state.additionalTasks = remoteAdditionalTasks; }, { source: 'firestore_update' });
                showUserFeedback("추가 할 일 목록이 클라우드에서 업데이트되었습니다.", 'info', true);
            } else {
                console.log("Firestore: Additional tasks remote update but no change detected or already synced. Not showing feedback.");
            }
        } else if (doc.exists && !doc.data()?.additionalTasksData) {
            console.log("Firestore: additionalTasksData field not found, initializing locally.");
            setState(state => { state.additionalTasks = []; }, { source: 'firestore_update' });
        } else {
            console.log("Firestore: Document or additionalTasksData field not found in snapshot for user", userId);
        }
    }, error => { showUserFeedback(`추가 할 일 동기화 오류: ${error.message}`, 'error'); console.error("Error in additionalTasks listener for " + userId + ":", error); });
}

export function listenToHistoryChanges(userId) {
    if (userHistoryUnsubscribe) userHistoryUnsubscribe();
    const userDocRef = getUserDocRef(userId);
    if (!userDocRef) { console.warn("listenToHistoryChanges: User doc ref is null, cannot set listener."); return; }
    console.log("Setting up Firestore listener for historyData:", userId);
    userHistoryUnsubscribe = userDocRef.onSnapshot(doc => {
        if (doc.metadata.hasPendingWrites && doc.metadata.fromCache) {
            console.log("Firestore: Local change detected for historyData, skipping UI re-render.");
            return;
        }

        if (doc.exists && doc.data()?.historyData?.items) {
            const remoteHistory = doc.data().historyData.items.map(entry => ({
                ...entry,
                tasks: entry.tasks.map(t => ({ id: t.id, text: t.text, completed: t.completed }))
            }));
             if (JSON.stringify(appState.history) !== JSON.stringify(remoteHistory)) {
                console.log("Firestore: History changed by remote, updating local state and UI.");
                setState(state => { state.history = remoteHistory; }, { source: 'firestore_update' });
                showUserFeedback("기록이 클라우드에서 업데이트되었습니다.", 'info', true);
            } else {
                console.log("Firestore: History remote update but no change detected or already synced. Not showing feedback.");
            }
        } else if (doc.exists && !doc.data()?.historyData) {
            console.log("Firestore: historyData field not found, initializing locally.");
            setState(state => { state.history = []; }, { source: 'firestore_update' });
        } else {
            console.log("Firestore: Document or historyData field not found in snapshot for user", userId);
        }
    }, error => { showUserFeedback(`기록 동기화 오류: ${error.message}`, 'error'); console.error("Error in history listener for " + userId + ":", error); });
}

export async function loadFirebaseContent(userId) {
    if (!firestoreDB) { console.warn("loadFirebaseContent: Firestore DB is not initialized. Cannot load content."); return null; }
    if (!userId) { console.warn("loadFirebaseContent: No user ID provided. Cannot load content."); return null; }
    if (!navigator.onLine) { console.warn("loadFirebaseContent: Offline. Cannot load content from Firestore."); return null; }

    const userDocRef = getUserDocRef(userId);
    if (!userDocRef) { console.error("loadFirebaseContent: User doc ref is null, cannot load content."); return null; }

    console.log("Firestore: Attempting to load ALL content data for", userId);
    try {
        const docSnap = await userDocRef.get();
        let tasksFromFirestore = [];
        let additionalTasksFromFirestore = [];
        let historyFromFirestore = [];

        if (docSnap.exists && docSnap.data()) {
            const data = docSnap.data();

            if (data.tasksData && Array.isArray(data.tasksData.items)) {
                tasksFromFirestore = data.tasksData.items.map(t => ({
                    id: t.id, text: t.text, completed: t.completed
                }));
            }
            if (data.additionalTasksData && Array.isArray(data.additionalTasksData.items)) {
                additionalTasksFromFirestore = data.additionalTasksData.items;
            }
            if (data.historyData && Array.isArray(data.historyData.items)) {
                historyFromFirestore = data.historyData.items.map(entry => ({
                    ...entry,
                    tasks: entry.tasks.map(t => ({ id: t.id, text: t.text, completed: t.completed }))
                }));
            }
        }
        // Return loaded data to be processed by app.js daily reset logic
        return { tasks: tasksFromFirestore, additionalTasks: additionalTasksFromFirestore, history: historyFromFirestore };
    } catch (error) {
        console.error("Error loading content data from Firestore for " + userId + ":", error);
        throw error; // Propagate error for app.js to handle fallback
    }
}


export async function signUpWithEmailPassword(email, password) {
    if (!firebaseAuth) { showUserFeedback("인증 서비스를 사용할 수 없습니다.", 'error'); return; }
    try {
        console.log("Auth: Attempting email/password sign up.");
        const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
        console.log("Auth: User signed up:", userCredential.user.uid);
        await initializeUserSettingsInFirestore(userCredential.user.uid);
        await syncDataToFirestore(); // Initial data save for new user
        announceToScreenReader(`회원가입 성공: ${userCredential.user.email}`);
        showUserFeedback("회원가입 성공!", 'success');
    } catch (error) { showUserFeedback(`회원가입 실패: ${error.message}`, 'error'); console.error("Error signing up:", error); }
}

export async function signInWithEmailPassword(email, password) {
    if (!firebaseAuth) { showUserFeedback("인증 서비스를 사용할 수 없습니다.", 'error'); return; }
    try {
        console.log("Auth: Attempting email/password sign in.");
        await firebaseAuth.signInWithEmailAndPassword(email, password);
        console.log("Auth: User signed in with email/password.");
        showUserFeedback("로그인 성공!", 'success');
    } catch (error) { showUserFeedback(`로그인 실패: ${error.message}`, 'error'); console.error("Error signing in:", error); }
}

export async function signInWithGoogle() {
    if (!firebaseAuth) { showUserFeedback("인증 서비스를 사용할 수 없습니다.", 'error'); return; }
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        console.log("Auth: Attempting Google sign in.");
        const result = await firebaseAuth.signInWithPopup(provider);
        console.log("Auth: User signed in with Google.");
        if (result.additionalUserInfo && result.additionalUserInfo.isNewUser) {
            console.log("Auth: New Google user, initializing data.");
            await initializeUserSettingsInFirestore(result.user.uid);
            await syncDataToFirestore(); // Initial data save for new Google user
        }
        showUserFeedback("Google 로그인 성공!", 'success');
    } catch (error) { showUserFeedback(`Google 로그인 실패: ${error.message}`, 'error'); console.error("Error signing in with Google:", error); }
}

export async function signOutUser() {
    if (!firebaseAuth) { showUserFeedback("인증 서비스를 사용할 수 없습니다.", 'error'); return; }
    try {
        console.log("Auth: Attempting sign out.");
        await firebaseAuth.signOut();
        console.log("Auth: User signed out.");
    } catch (error) { showUserFeedback(`로그아웃 실패: ${error.message}`, 'error'); console.error("Error signing out:", error); }
}

export function stopFirestoreListeners() {
    if (userSettingsUnsubscribe) { userSettingsUnsubscribe(); userSettingsUnsubscribe = null; console.log("Firestore: Unsubscribed from appSettings."); }
    if (userTasksUnsubscribe) { userTasksUnsubscribe(); userTasksUnsubscribe = null; console.log("Firestore: Unsubscribed from tasksData."); }
    if (userAdditionalTasksUnsubscribe) { userAdditionalTasksUnsubscribe(); userAdditionalTasksUnsubscribe = null; console.log("Firestore: Unsubscribed from additionalTasksData."); }
    if (userHistoryUnsubscribe) { userHistoryUnsubscribe(); userHistoryUnsubscribe = null; console.log("Firestore: Unsubscribed from historyData."); }
}

// Ensure Firebase is initialized when this module is imported
initializeFirebase();

