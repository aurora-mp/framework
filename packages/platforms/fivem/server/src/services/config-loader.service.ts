import { Injectable, type IConfigLoader } from '@aurora-mp/core';
const { readFileSync, existsSync } = require('fs');
const path = require('path');

@Injectable()
export class ConfigLoader implements IConfigLoader {
    public load(): Record<string, string> {
        const envPath = path.resolve(process.cwd(), '.env');
        const config: Record<string, string> = {};

        if (!existsSync(envPath)) {
            console.warn(`[Aurora] No .env file found at ${envPath}. Configuration will be empty.`);
            return config;
        }

        try {
            const raw = readFileSync(envPath, 'utf8');
            for (const line of raw.split(/[\r\n]+/)) {
                const trimmed = line.trim();

                // Ignore empty lines or comments
                if (!trimmed || trimmed.startsWith('#')) continue;

                // Split key from value
                const [key, ...rest] = trimmed.split('=');
                if (!key) continue;

                // Join the rest back in case the value contains '='
                const value = rest.join('=').trim().replace(/^"|"$/g, ''); // Remove quotes
                config[key.trim()] = value;
            }
        } catch (err) {
            console.error(`[Aurora] Failed to read or parse .env file:`, err);
        }

        return config;
    }
}
