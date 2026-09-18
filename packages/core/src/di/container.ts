import { Token } from '../types';

/**
 * Simple dependency injection container that holds provider instances by token.
 * It allows registering and resolving values or class instances during application runtime.
 *
 * @category Core
 * @public
 */
export class Container {
    private readonly providers = new Map<Token, unknown>();

    /**
     * Registers a provider instance under the given token.
     * If a provider already exists for this token, it will be overridden.
     *
     * @param token The injection token (class constructor, string, or symbol).
     * @param value The instance or value to associate with the token.
     */
    public register<T>(token: Token<T>, value: T): void {
        if (this.providers.has(token)) {
            console.warn(`A provider with the token "${String(token)}" is already registered. It will be overridden.`);
        }
        this.providers.set(token, value);
    }

    /**
     * Retrieves the provider instance associated with the given token.
     *
     * @param token The injection token to resolve.
     * @returns The instance or value stored under the token.
     * @throws {Error} If no provider is found for the token.
     */
    public resolve<T>(token: Token<T>): T {
        const instance = this.providers.get(token);
        if (instance === undefined) {
            throw new Error(
                `No provider found for token "${String(token)}". Make sure it is provided in a module and exported if necessary.`,
            );
        }
        return instance as T;
    }

    /**
     * Checks whether a provider is registered for the given token.
     *
     * @param token The injection token to check.
     * @returns `true` if a provider exists, `false` otherwise.
     */
    public has<T>(token: Token<T>): boolean {
        return this.providers.has(token);
    }

    /**
     * Removes a registered provider, if any. Used to discard bootstrap
     * placeholders so a later resolution is forced to go through the real
     * module-provider lookup instead of returning the cached placeholder.
     *
     * @param token The injection token to remove.
     */
    public delete<T>(token: Token<T>): void {
        this.providers.delete(token);
    }

    /**
     * Returns an iterator over all registered provider instances.
     * Can be used for debugging or lifecycle management.
     *
     * @returns Iterable iterator of all stored provider values.
     */
    public getInstances(): IterableIterator<unknown> {
        return this.providers.values();
    }
}
