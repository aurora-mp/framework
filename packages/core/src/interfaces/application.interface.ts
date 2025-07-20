import { Token } from '../types';
import { AuroraPlugin } from './plugin.interface';

/**
 * Represents a bootstrapped Aurora application instance,
 * exposing methods to start, retrieve dependencies, and gracefully shut down.
 *
 * @public
 */
export interface IApplication {
    /**
     * Attaches all controller event handlers to the platform driver
     * and starts listening for incoming events.
     * Call this after initializing the application to begin processing events.
     *
     * @returns A promise that resolves once the application has started.
     */
    start(): Promise<void>;

    /**
     * Retrieves an existing provider or controller instance from the root module’s DI context.
     *
     * @typeParam T The expected type of the resolved instance.
     * @param token The injection token or class constructor of the provider to resolve.
     * @returns A promise that resolves to the instance associated with the given token.
     * @throws If no provider is registered for the given token.
     */
    get<T = Token>(token: Token<T>): Promise<T>;

    /**
     * Performs a graceful shutdown of the application by invoking all
     * OnApplicationShutdown lifecycle hooks on controllers.
     *
     * @returns A promise that resolves once shutdown is complete.
     */
    close(): Promise<void>;

    usePlugins(...plugins: AuroraPlugin[]): this;
}
