import { DuplicateProviderError, ProviderNotFoundError } from '../errors';
import { Token } from '../types';

export type ProviderScope = 'singleton' | 'transient';

export interface RegisterOptions {
    scope?: ProviderScope;
    allowOverride?: boolean;
}

export interface ProviderMetadata {
    lastRegisteredAt: Date;
    scope: ProviderScope;
    overrides: number;
}

export interface ContainerSnapshot {
    providerCount: number;
    tokens: string[];
}

/**
 * Simple dependency injection container that holds provider instances by token.
 * It allows registering and resolving values or class instances during application runtime.
 *
 * @category Core
 * @public
 */
export class Container {
    private readonly providers = new Map<Token, unknown>();
    private readonly metadata = new Map<Token, ProviderMetadata>();

    /**
     * Registers a provider instance under the given token.
     * If a provider already exists for this token, it will be overridden.
     *
     * @param token The injection token (class constructor, string, or symbol).
     * @param value The instance or value to associate with the token.
     *
     * @throws {DuplicateProviderError} If the token already exists and allowOverride is false.
     */
    public register<T>(token: Token<T>, value: T, options: RegisterOptions = {}): void {
        const { allowOverride = true } = options;
        const existed = this.providers.has(token);

        if (existed && !allowOverride) {
            throw new DuplicateProviderError(this.tokenToString(token));
        }

        this.providers.set(token, value);

        const prev = this.metadata.get(token);
        const scope: ProviderScope = options.scope ?? prev?.scope ?? 'singleton';

        this.metadata.set(token, {
            lastRegisteredAt: new Date(),
            scope,
            overrides: (prev?.overrides ?? 0) + (existed ? 1 : 0),
        });
    }

    /**
     * Retrieves the provider instance associated with the given token.
     *
     * @param token The injection token to resolve.
     * @returns The instance or value stored under the token.
     *
     * @throws {ProviderNotFoundError} if no provider is found
     */
    public resolve<T>(token: Token<T>): T {
        if (!this.providers.has(token)) {
            throw new ProviderNotFoundError(this.tokenToString(token), this.getAvailableTokens());
        }

        return this.providers.get(token) as T;
    }

    /**
     * Safely resolves a provider, returning undefined if not found.
     *
     * Useful when a dependency is optional or when you want to avoid throwing.
     *
     * @param token The injection token to resolve.
     * @returns The stored value, or undefined if the token is not registered.
     */
    public tryResolve<T>(token: Token<T>): T | undefined {
        if (!this.providers.has(token)) {
            return undefined;
        }

        return this.providers.get(token) as T;
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
     * Returns metadata about a registered provider.
     *
     * @param token The token to read metadata for.
     * @returns The provider metadata, or undefined if the token is not registered.
     */
    public getMetadata<T>(token: Token<T>): ProviderMetadata | undefined {
        return this.metadata.get(token);
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

    /**
     * Returns an iterator over all registered tokens.
     *
     * @returns Iterable iterator of all stored tokens.
     */
    public getTokens(): IterableIterator<Token> {
        return this.providers.keys();
    }

    /**
     * Removes a provider (and its metadata) by token.
     *
     * @param token The token to remove.
     * @returns true if the provider existed and was removed, false otherwise.
     */
    public remove<T>(token: Token<T>): boolean {
        const existed = this.providers.has(token);

        this.providers.delete(token);
        this.metadata.delete(token);

        return existed;
    }

    /**
     * Clears all providers and metadata from the container.
     *
     * Primarily useful in tests, or when rebuilding an application context.
     */
    public clear(): void {
        this.providers.clear();
        this.metadata.clear();
    }

    /**
     * Returns a lightweight snapshot of the container state for debugging/logging.
     *
     * @param maxTokens Maximum number of tokens to include in the snapshot for readability.
     * @returns A snapshot containing providerCount and a stringified token list.
     */
    public snapshot(maxTokens = 50): ContainerSnapshot {
        const tokens = Array.from(this.providers.keys())
            .slice(0, maxTokens)
            .map((t) => this.tokenToString(t));

        return {
            providerCount: this.providers.size,
            tokens,
        };
    }

    /**
     * Converts an injection token to a readable string for errors/logs.
     */
    private tokenToString(token: Token): string {
        if (typeof token === 'function') {
            return token.name;
        }

        if (typeof token === 'symbol') {
            return token.toString();
        }

        return String(token);
    }

    /**
     * Returns a friendly list of available tokens (stringified) for error messages.
     * Truncated to 10 tokens for readability.
     */
    private getAvailableTokens(): string {
        const tokens = Array.from(this.providers.keys())
            .map((t) => this.tokenToString(t))
            .slice(0, 10);

        return tokens.length > 0 ? tokens.join(', ') + (this.providers.size > 10 ? ', ...' : '') : 'none';
    }
}
