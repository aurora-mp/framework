import { Type, ModuleMetadata, Token, Provider } from '../types';
import { Container } from './container';

/**
 * Wraps a module’s metadata and DI state for internal management.
 * Handles providers, controllers, imports, and exports for a single module.
 *
 * @category Core
 * @public
 */
export class ModuleWrapper {
    /**
     * Modules imported by this module.
     */
    private readonly _imports = new Set<ModuleWrapper>();

    /**
     * Controller classes declared in this module.
     */
    private readonly _controllers = new Set<Type>();

    /**
     * Tokens exported by this module for other modules to consume.
     */
    private readonly _exports = new Set<Token>();

    /**
     * The DI container instance scoped to this module.
     * Initially holds provider definitions, later replaced with their instantiated values.
     */
    public readonly container = new Container();

    /**
     * Creates a new ModuleWrapper.
     *
     * @param type The module’s class constructor.
     * @param metadata The metadata extracted from the `@Module` decorator, including
     *                 imports, controllers, providers, and exports.
     */
    constructor(
        public readonly type: Type,
        public readonly metadata: ModuleMetadata,
    ) {
        // Register controllers and exports from metadata
        metadata.controllers?.forEach((c) => this._controllers.add(c));
        metadata.exports?.forEach((e) => this._exports.add(e));

        // Register provider definitions (class or value) in this module’s container
        metadata.providers?.forEach((p) => {
            const token = this.getTokenFromProvider(p);
            this.container.register(token, p); // store the provider definition
        });
    }

    /**
     * Gets the set of modules imported by this module.
     */
    public get imports(): Set<ModuleWrapper> {
        return this._imports;
    }

    /**
     * Gets the set of controller classes declared in this module.
     */
    public get controllers(): Set<Type> {
        return this._controllers;
    }

    /**
     * Gets the set of tokens this module exports.
     */
    public get exports(): Set<Token> {
        return this._exports;
    }

    /**
     * Adds an imported module to this module’s import graph.
     *
     * @param importedModule The ModuleWrapper instance to import.
     */
    public addImport(importedModule: ModuleWrapper): void {
        this._imports.add(importedModule);
    }

    /**
     * Determines the DI token for a provider definition.
     * If the provider is a class constructor, the constructor itself is the token;
     * otherwise uses the `provide` property of the Provider object.
     *
     * @param provider The provider definition (class or object).
     * @returns The token under which this provider is registered.
     */
    private getTokenFromProvider(provider: Provider): Token {
        return typeof provider === 'function' ? provider : provider.provide;
    }
}
