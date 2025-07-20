import { Injectable, type IConfigLoader } from '@aurora-mp/core';

@Injectable()
export class OmpConfigLoader implements IConfigLoader {
    public load(): Record<string, string> {
        const config: Record<string, string> = {};

        return config;
    }
}
