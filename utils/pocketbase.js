import PocketBase from 'pocketbase';
import { config } from 'dotenv';

// Load environment variables
config();

let pbInstance = null;
let lastAuthTime = 0;
const AUTH_TIMEOUT = 14 * 60 * 60 * 1000; // 14 hours in ms (PocketBase tokens expire after 15h)

/**
 * Initializes PocketBase and authenticates with admin credentials.
 * @returns {Promise<Client>}
 */
export async function initPocketBase() {

    const now = Date.now();

    // If we have a valid cached instance
    if (pbInstance && pbInstance.authStore.isValid && (now - lastAuthTime) < AUTH_TIMEOUT) {
        return pbInstance;
    }

    // Otherwise, create a new instance
    pbInstance = new PocketBase(process.env.POCKETBASE_URL);

    // Authenticate with the admin credentials
    try {
        await pbInstance.collection('_superusers').authWithPassword(
            process.env.POCKETBASE_ADMIN_EMAIL,
            process.env.POCKETBASE_ADMIN_PASSWORD
        );
        pbInstance.autoCancellation(false);
        lastAuthTime = now;
        console.log('PocketBase admin authenticated successfully.');
        return pbInstance;
    } catch (error) {
        console.error('PocketBase admin authentication failed:', error);
        process.exit(1);
    }
}

/**
 * Fetches the PocketBase instance.
 * @returns {Promise<Client>}
 * */
const pbPromise = initPocketBase();

/**
 * Fetches the PocketBase instance.
 * @returns {Promise<Client>}
 */
export async function getPb() {
    return await pbPromise;
}

/**
 * PocketBase client instance.
 * @type {Client}
 */
export const pb = await initPocketBase();