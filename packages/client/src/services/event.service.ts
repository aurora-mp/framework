import { Injectable, Inject, PLATFORM_DRIVER, encodePlayerRefs } from '@aurora-mp/core';
import type { IPlatformDriver } from '@aurora-mp/core';

@Injectable()
export class EventService {
    constructor(@Inject(PLATFORM_DRIVER) private readonly platformDriver: IPlatformDriver<any>) {}

    public emit(eventName: string, ...args: any[]): void {
        if (!this.platformDriver.emit) {
            console.warn('[Aurora] Warning: The current platform driver does not support emit.');
            return;
        }

        this.platformDriver.emit(eventName, ...encodePlayerRefs(args));
    }

    public emitServer(eventName: string, ...args: any[]): void {
        if (!this.platformDriver.emitServer) {
            console.warn('[Aurora] Warning: The current platform driver does not support emitServer.');
            return;
        }

        this.platformDriver.emitServer(eventName, ...encodePlayerRefs(args));
    }
}
