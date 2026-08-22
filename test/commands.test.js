/**
 * Loads every slash command module the same way deploy-commands.js does and
 * validates the handler contract + serialized command data. Runs fully offline —
 * it exercises everything up to (but excluding) the actual REST call.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const commandsRoot = path.join(__dirname, '..', 'commands');

/** All command modules under commands/<category>/*.js. */
async function loadAllCommands() {
    const out = [];
    for (const folder of fs.readdirSync(commandsRoot)) {
        const folderPath = path.join(commandsRoot, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;
        for (const file of fs.readdirSync(folderPath).filter((f) => f.endsWith('.js'))) {
            const module = await import(pathToFileURL(path.join(folderPath, file)));
            out.push({ folder, file, command: module.default });
        }
    }
    return out;
}

test('every command module has valid data + execute and serializes for deployment', async () => {
    const commands = await loadAllCommands();
    assert.ok(commands.length >= 5, `expected at least 5 commands, found ${commands.length}`);

    const names = new Set();
    for (const { folder, file, command } of commands) {
        assert.ok(command, `${folder}/${file} must have a default export`);
        assert.ok('data' in command, `${folder}/${file} missing "data"`);
        assert.ok('execute' in command && typeof command.execute === 'function',
            `${folder}/${file} missing "execute"`);

        // SlashCommandBuilder serialization must not throw and must be sane.
        const json = command.data.toJSON();
        assert.ok(json.name?.length > 0, `${folder}/${file} has an empty name`);
        assert.ok(json.description?.length > 0, `${folder}/${file} has an empty description`);
        assert.ok(!names.has(json.name), `duplicate command name: ${json.name}`);
        names.add(json.name);
    }
});
