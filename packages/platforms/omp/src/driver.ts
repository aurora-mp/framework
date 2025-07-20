import { IPlatformDriver } from '@aurora-mp/core';
import { omp } from '@omp-node/core';

/**
 * Implements the IPlatformDriver interface using the OMP API.
 */
export class OmpServerDriver implements IPlatformDriver {
    public on(eventName: string, listener: (...args: unknown[]) => void): void {
        omp.on(eventName, listener);
    }

    public emit(_eventName: string, ..._args: unknown[]): void {}
}
