import PocketBase from 'pocketbase';
import { config } from 'dotenv';

// Load environment variables
config();

let pbInstance = null;
let lastAuthTime = 0;
const AUTH_TIMEOUT = 14 * 60 * 60 * 1000; // 14 hours in ms (PocketBase tokens expire after 15h)

// Initialize PocketBase
async function initPocketBase() {
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

const pbPromise = initPocketBase();

export async function getPb() {
    return await pbPromise;
}

export const pb = await initPocketBase();