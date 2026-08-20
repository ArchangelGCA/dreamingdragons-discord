import PocketBase from 'pocketbase';
import { config } from 'dotenv';

// Load environment variables
config();

let pbInstance = null;
let initializationPromise = null;

// Retry tuning (overridable via env). During container startup PocketBase may not
// be reachable yet, so we retry with backoff instead of permanently giving up.
const MAX_RETRIES = parseInt(process.env.POCKETBASE_MAX_RETRIES || '15', 10);
const BASE_RETRY_DELAY_MS = parseInt(process.env.POCKETBASE_RETRY_DELAY_MS || '2000', 10);
const MAX_RETRY_DELAY_MS = 30_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates a fresh authenticated PocketBase client, retrying with exponential
 * backoff until it succeeds or the retry budget is exhausted.
 * @returns {Promise<PocketBase|null>}
 */
async function connectWithRetry() {
    const url = process.env.POCKETBASE_URL;
    if (!url) {
        console.error('CRITICAL: POCKETBASE_URL is not set.');
        return null;
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const pb = new PocketBase(url);
        pb.autoCancellation(false);

        try {
            await pb.collection('_superusers').authWithPassword(
                process.env.POCKETBASE_ADMIN_EMAIL,
                process.env.POCKETBASE_ADMIN_PASSWORD,
                {
                    autoRefreshThreshold: 30 * 60, // 30 minutes
                    cache: 'no-store'
                }
            );

            console.log(`PocketBase admin authenticated successfully (attempt ${attempt}).`);

            pb.authStore.onChange((token, record) => {
                console.log(
                    '[PocketBase Auth] Store changed. Token:',
                    token ? 'present' : 'absent',
                    'Record:',
                    record?.email || 'none'
                );
            });

            return pb;
        } catch (error) {
            const delay = Math.min(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
            const reason = error?.originalError?.message || error?.message || 'unknown error';
            console.warn(
                `PocketBase auth attempt ${attempt}/${MAX_RETRIES} failed (${reason}). Retrying in ${delay}ms...`
            );
            if (attempt < MAX_RETRIES) {
                await sleep(delay);
            }
        }
    }

    console.error('CRITICAL: Exhausted PocketBase connection retries.');
    return null;
}

/**
 * Initializes and authenticates the PocketBase singleton if needed.
 * Re-authenticates automatically if the auth store becomes invalid.
 * @returns {Promise<PocketBase|null>}
 */
async function initializePocketBaseSingleton() {
    if (pbInstance) {
        if (pbInstance.authStore.isValid && pbInstance.authStore.isSuperuser) {
            return pbInstance;
        }
        console.log('PocketBase instance is no longer authenticated. Reinitializing...');
        pbInstance = null;
        initializationPromise = null;
    }

    if (initializationPromise) {
        return await initializationPromise;
    }

    initializationPromise = (async () => {
        console.log('Initializing PocketBase connection...');
        const pb = await connectWithRetry();
        pbInstance = pb;
        initializationPromise = null; // allow future retries if this returned null
        return pb;
    })();

    return await initializationPromise;
}

/**
 * Gets the singleton PocketBase instance, initializing it if necessary.
 * @returns {Promise<PocketBase|null>}
 */
export async function getPb() {
    return await initializePocketBaseSingleton();
}

/**
 * Resets the singleton so the next getPb() reconnects from scratch.
 */
export function resetPbInitialization() {
    initializationPromise = null;
    pbInstance = null;
}
