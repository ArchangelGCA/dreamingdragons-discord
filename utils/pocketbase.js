import PocketBase from 'pocketbase';
import { config } from 'dotenv';

// Load environment variables
config();

let pbInstance = null;
let initializationPromise = null;
let initializationFailed = false;

/**
 * Initializes and authenticates the PocketBase instance if it hasn't been already.
 * Handles the singleton pattern with retry logic.
 * @returns {Promise<PocketBase|null>} A promise that resolves with the initialized PocketBase instance or null on failure.
 */
async function initializePocketBaseSingleton() {
    // If initialization previously failed, return null to prevent repeated crashes
    if (initializationFailed) {
        return null;
    }

    if (pbInstance) {
        // Check if pbInstance is still authenticated
        if (!pbInstance.authStore.isValid || !pbInstance.authStore.isSuperuser) {
            console.log('PocketBase instance is not authenticated. Reinitializing...');
            pbInstance = null;
            initializationPromise = null;
            return await initializePocketBaseSingleton();
        }

        return pbInstance;
    }

    if (initializationPromise) {
        return await initializationPromise;
    }

    initializationPromise = (async () => {
        console.log('Initializing PocketBase connection...');
        const pb = new PocketBase(process.env.POCKETBASE_URL);

        pb.autoCancellation(false);

        try {
            await pb.collection('_superusers').authWithPassword(
                process.env.POCKETBASE_ADMIN_EMAIL,
                process.env.POCKETBASE_ADMIN_PASSWORD,
                {
                    autoRefreshThreshold: 30 * 60, // 30 minutes
                    cache: "no-store"
                }
            );
            console.log('PocketBase admin authenticated successfully.');

            pb.authStore.onChange((token, model) => {
                console.log('[PocketBase Auth] Store changed. Token:', token ? 'present' : 'absent', 'Model:', model?.email || 'none');
            }, true);

            pbInstance = pb;
            return pbInstance;
        } catch (error) {
            console.error('CRITICAL: PocketBase admin authentication failed during initialization:', error);
            initializationPromise = null;
            initializationFailed = true;
            // Don't call process.exit() - let the caller handle the failure gracefully
            return null;
        }
    })();

    return await initializationPromise;
}

/**
 * Gets the singleton PocketBase instance.
 * Ensures it's initialized before returning.
 * @returns {Promise<PocketBase|null>} The initialized PocketBase client instance or null if initialization failed.
 */
export async function getPb() {
    return await initializePocketBaseSingleton();
}

/**
 * Resets the initialization state to allow retry.
 * Call this before attempting to reconnect after a failure.
 */
export function resetPbInitialization() {
    initializationFailed = false;
    initializationPromise = null;
    pbInstance = null;
}