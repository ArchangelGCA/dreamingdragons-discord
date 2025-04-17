import PocketBase from 'pocketbase';
import { config } from 'dotenv';

// Load environment variables
config();

let pbInstance = null;
let initializationPromise = null;

/**
 * Initializes and authenticates the PocketBase instance if it hasn't been already.
 * Handles the singleton pattern.
 * @returns {Promise<PocketBase>} A promise that resolves with the initialized PocketBase instance.
 */
async function initializePocketBaseSingleton() {
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
                process.env.POCKETBASE_ADMIN_PASSWORD
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
            process.exit(1);
        }
    })();

    return await initializationPromise;
}

/**
 * Gets the singleton PocketBase instance.
 * Ensures it's initialized before returning.
 * @returns {Promise<PocketBase>} The initialized PocketBase client instance.
 */
export async function getPb() {
    return await initializePocketBaseSingleton();
}