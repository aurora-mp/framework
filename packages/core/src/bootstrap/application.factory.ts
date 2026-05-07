import {
    IApplication,
    type ILogger,
    IPlatformDriver,
    OnAppInit,
    OnAppStarted,
    OnAppShutdown,
    IConfigService,
    AuroraPlugin,
} from '../interfaces';
import {
    MODULE_METADATA_KEY,
    GLOBAL_MODULE_KEY,
    INJECT_TOKEN_KEY,
    PLATFORM_DRIVER,
    LOGGER_SERVICE,
    INJECT_PROPERTY_KEY,
    CONFIG_SERVICE,
} from '../constants';
import { ModuleWrapper, Container } from '../di';
import { ModuleMetadata, Provider, Token, Type } from '../types';
import { Scope } from '../enums';
import { getProviderScope, getTokenName, normalizeProvider, tokenToString } from '../utils';
import { ControllerFlowHandler } from './controller-flow.handler';
import { EventBinder } from './event-binder';
import { RpcBinder } from './rpc-binder';

/**
 * Bootstraps and manages the full Aurora application lifecycle:
 * - Scans modules and builds the DI graph
 * - Instantiates controllers up front (to support lifecycle hooks)
 * - Binds controller events to the platform driver via EventBinder
 *
 * Use {@link ApplicationFactory.create} to initialize and obtain the application instance.
 * @category Core
 * @public
 */
export class ApplicationFactory {
    private readonly applicationRef: IApplication;
    private readonly moduleWrappers = new Map<Type, ModuleWrapper>();
    private readonly globalModules = new Set<ModuleWrapper>();
    private readonly instanceContainer = new Container();
    private readonly flowHandler: ControllerFlowHandler;
    private readonly eventBinder: EventBinder;
    private readonly rpcBinder: RpcBinder;
    private readonly plugins: AuroraPlugin[] = [];

    private logger: ILogger = console;
    private config?: IConfigService;

    private started = false;
    private closed = false;

    private debug: boolean = false;

    /**
     * @param platformDriver The platform driver for event binding/runtime APIs.
     * @internal
     */
    private constructor(private readonly platformDriver: IPlatformDriver) {
        this.instanceContainer.register(PLATFORM_DRIVER, this.platformDriver);
        this.flowHandler = new ControllerFlowHandler(this.instanceContainer);
        this.eventBinder = new EventBinder(platformDriver, this.flowHandler);
        this.rpcBinder = new RpcBinder(platformDriver, this.flowHandler);
        this.applicationRef = {
            start: this.start.bind(this),
            get: this.get.bind(this),
            close: this.close.bind(this),
            usePlugins: this.usePlugins.bind(this),
        };
    }

    /**
     * Bootstraps an Aurora application and returns its public interface.
     * @param rootModule The application's root module (entry point)
     * @param platformDriver The platform driver for this runtime
     * @returns A Promise resolving to the IApplication instance
     */
    public static async create(
        rootModule: Type,
        platformDriver: IPlatformDriver,
        plugins: AuroraPlugin[] = [],
    ): Promise<IApplication> {
        const factory = new ApplicationFactory(platformDriver);
        factory.usePlugins(...plugins);
        await factory.initialize(rootModule);
        return factory.applicationRef;
    }

    public usePlugins(...plugins: AuroraPlugin[]): this {
        this.plugins.push(...plugins);
        return this;
    }

    /**
     * Starts the application and binds all controller event handlers.
     */
    public async start(): Promise<void> {
        if (this.started) {
            this.logger.warn('[Aurora] Application already started.');
            return;
        }

        this.started = true;
        this.logger.info('[Aurora] Starting application, binding events and rpcs.');

        // Binding controller events.
        this.bindControllerEvents();
        this.bindControllerRpcs();

        // Plugin lifecycle
        for (const plugin of this.plugins) {
            if (plugin.onBootstrap) {
                await plugin.onBootstrap(this.applicationRef);
            }
        }

        // Call lifecycle hooks and register shutdown listeners.
        await this.callLifecycle('onAppStarted');
        this.registerShutdownListeners();

        this.logger.info('[Aurora] Application started, listening for events and rpcs.');
    }

    /**
     * Shuts down the application and calls shutdown hooks.
     */
    public async close(signal?: string): Promise<void> {
        if (this.closed) {
            this.logger.warn('[Aurora] Application already closed.');
            return;
        }

        this.closed = true;
        this.logger.info(`[Aurora] Closing application (signal: ${signal})`);

        await this.callLifecycle('onAppShutdown', signal as unknown);

        this.logger.info('[Aurora] Application closed');
    }

    /**
     * Resolves an instance from the DI container.
     * @param token The provider token or class
     */
    public async get<T>(token: Token<T>): Promise<T> {
        if (!this.instanceContainer.has(token)) {
            throw new Error(
                `[Aurora] Provider for token "${getTokenName(token)}" could not be found in the application context.`,
            );
        }
        return this.instanceContainer.resolve(token);
    }

    /**
     * Binds all controller events (decorated handlers) to the platform driver via EventBinder.
     */
    private bindControllerEvents(): void {
        const controllersWithInstances: [Type, Record<string, unknown>][] = [];
        for (const module of this.moduleWrappers.values()) {
            for (const controllerType of module.controllers) {
                controllersWithInstances.push([
                    controllerType,
                    this.instanceContainer.resolve(controllerType) as Record<string, unknown>,
                ]);
            }
        }
        this.eventBinder.bindControllerEvents(controllersWithInstances);
    }

    private bindControllerRpcs(): void {
        const controllersWithInstances: [Type, Record<string, unknown>][] = [];
        for (const module of this.moduleWrappers.values()) {
            for (const controllerType of module.controllers) {
                controllersWithInstances.push([
                    controllerType,
                    this.instanceContainer.resolve(controllerType) as Record<string, unknown>,
                ]);
            }
        }
        this.rpcBinder.bindControllerRpcs(controllersWithInstances);
    }

    /**
     * Internal bootstrap: scans modules, builds the graph, and triggers instantiation.
     * @param rootModuleType The root module class
     */
    private async initialize(rootModuleType: Type): Promise<void> {
        // Scan all modules to build the dependency graph.
        await this.scanModules(rootModuleType);

        // Resolve and instantiate core services needed by the factory itself.
        const rootModule = this.moduleWrappers.get(rootModuleType)!;
        await this.initializeCoreServices(rootModule);

        // Plugin lifecycle
        for (const plugin of this.plugins) {
            if (plugin.onInit) {
                await plugin.onInit(this.applicationRef);
            }
        }

        if (this.debug) {
            this.logModulesTree();
        }

        // Instantiate all remaining providers and controllers.
        await this.instantiateModules();
        await this.callLifecycle('onAppInit');

        this.logger.info('[Aurora] Application initialized successfully.');
    }

    // TODO
    private registerShutdownListeners(): void {
        // process.on('SIGINT', async () => await this.close('SIGINT'));
        // process.on('SIGTERM', async () => await this.close('SIGTERM'));
    }

    /**
     * Recursively scans all modules, handles imports/exports and registers global modules.
     */
    private async scanModules(moduleType: Type, seen: Set<Type> = new Set()): Promise<ModuleWrapper> {
        if (seen.has(moduleType)) {
            throw new Error(
                `[Aurora] Circular dependency detected in module imports: ${moduleType.name} is part of a cycle.`,
            );
        }

        seen.add(moduleType);

        if (this.moduleWrappers.has(moduleType)) {
            return this.moduleWrappers.get(moduleType)!;
        }

        const metadata: ModuleMetadata = Reflect.getMetadata(MODULE_METADATA_KEY, moduleType);
        if (!metadata)
            throw new Error(`[Aurora] Class ${moduleType.name} is not a valid module. Did you forget @Module()?`);

        const moduleWrapper = new ModuleWrapper(moduleType, metadata);
        this.moduleWrappers.set(moduleType, moduleWrapper);

        // Register @Global modules
        if (Reflect.getMetadata(GLOBAL_MODULE_KEY, moduleType)) {
            this.globalModules.add(moduleWrapper);
        }

        // Recursively scan all imports
        for (const importedType of metadata.imports ?? []) {
            const importedModuleWrapper = await this.scanModules(importedType, new Set(seen));
            moduleWrapper.addImport(importedModuleWrapper);
        }
        return moduleWrapper;
    }

    /**
     * Eagerly instantiates and assigns core services like Logger and Config.
     */
    private async initializeCoreServices(rootModule: ModuleWrapper): Promise<void> {
        if (this.findModuleByProvider(CONFIG_SERVICE, rootModule)) {
            try {
                this.config = (await this.resolveDependency(CONFIG_SERVICE, rootModule)) as IConfigService;
                this.debug = this.config.get<boolean>('DEBUG', false);
            } catch {
                this.logger.warn(
                    `[Aurora] CONFIG_SERVICE not found or failed to load. Debug logging will be disabled.`,
                );
            }
        }

        try {
            this.logger = (await this.resolveDependency(LOGGER_SERVICE, rootModule)) as ILogger;
        } catch {
            this.logger.warn(`[Aurora] LOGGER_SERVICE not found. Falling back to console logging.`);
        }

        this.flowHandler.setLogger(this.logger);
    }

    /**
     * Prints the module graph in a tree format (debug/dev only).
     */
    private logModulesTree(): void {
        this.logger.debug('[Aurora] Modules tree');

        for (const [type, wrapper] of this.moduleWrappers.entries()) {
            const meta = wrapper.metadata;

            this.logger.debug(`- ${type.name}${this.globalModules.has(wrapper) ? ' [GLOBAL]' : ''}`);

            if (meta.imports?.length) this.logger.debug(`    imports: ${meta.imports.map((x) => x.name).join(', ')}`);
            if (meta.exports?.length)
                this.logger.debug(`    exports: ${meta.exports.map((x) => tokenToString(x)).join(', ')}`);
            if (meta.providers?.length)
                this.logger.debug(`    providers: ${meta.providers.map((x) => tokenToString(x)).join(', ')}`);
            if (meta.controllers?.length)
                this.logger.debug(`    controllers: ${meta.controllers.map((x) => x.name).join(', ')}`);
        }

        this.logger.debug('[Aurora] End tree\n');
    }

    private async callLifecycle<K extends keyof OnAppInit | keyof OnAppStarted | keyof OnAppShutdown>(
        hook: K,
        ...args: unknown[]
    ): Promise<void> {
        for (const wrapper of this.moduleWrappers.values()) {
            for (const ctrlType of wrapper.controllers) {
                const instance = this.instanceContainer.resolve(ctrlType) as any;
                const fn = instance[hook] as Function | undefined;
                if (typeof fn === 'function') {
                    this.logger.debug(`[Aurora] Calling ${hook} on ${ctrlType.name}.`);
                    await fn.apply(instance, args);
                }
            }
        }
    }

    /**
     * Instantiate all providers first, then all controllers.
     */
    private async instantiateModules(): Promise<void> {
        for (const moduleWrapper of this.moduleWrappers.values()) {
            for (const providerDef of moduleWrapper.metadata.providers ?? []) {
                const { provide } = normalizeProvider(providerDef);
                await this.resolveDependency(provide, moduleWrapper);
            }

            for (const controller of moduleWrapper.controllers) {
                await this.resolveDependency(controller, moduleWrapper);
            }
        }
    }

    /**
     * Create an instance of the given class, resolving and injecting both
     * constructor-parameter tokens and decorated property tokens.
     *
     * @param targetClass The class to instantiate.
     * @param contextModule The module wrapper providing the DI context.
     * @returns A Promise resolving to a new instance with all dependencies injected.
     */
    private async instantiateClass(
        targetClass: Type,
        contextModule: ModuleWrapper,
        seen: Set<Token>,
    ): Promise<unknown> {
        // Resolve constructor-parameter dependencies
        const paramTypes: (Type | undefined)[] = Reflect.getMetadata('design:paramtypes', targetClass) || [];
        const customTokens: (Token | undefined)[] = Reflect.getOwnMetadata(INJECT_TOKEN_KEY, targetClass) || [];

        const dependencies: unknown[] = [];
        for (let index = 0; index < paramTypes.length; index++) {
            const paramType = paramTypes[index];
            const token = customTokens[index] || paramType;

            if (!token) {
                throw new Error(
                    `[Aurora] Could not resolve dependency for ${targetClass.name} at constructor index ${index}.`,
                );
            }

            dependencies.push(await this.resolveDependency(token, contextModule, seen));
        }

        // Instantiate the class with resolved constructor args
        const instance = new (targetClass as any)(...dependencies);

        // Walk up the prototype chain to collect @Inject-decorated properties
        const propsToInject: { key: string | symbol; token: Token }[] = [];
        let ctor: any = targetClass;

        while (ctor && ctor !== Function.prototype) {
            const ownProps = Reflect.getOwnMetadata(INJECT_PROPERTY_KEY, ctor) as
                | Array<{ key: string | symbol; token: Token }>
                | undefined;

            if (ownProps) {
                propsToInject.push(...ownProps);
            }

            ctor = Object.getPrototypeOf(ctor);
        }

        // Resolve and assign each property dependency
        for (const { key, token } of propsToInject) {
            (instance as any)[key] = await this.resolveDependency(token, contextModule, seen);
        }

        // Wrap with method-level guard proxy
        if (this.flowHandler.hasGuards(targetClass)) {
            return this.flowHandler.wrapWithGuardsProxy(instance, targetClass);
        }

        return instance;
    }

    /**
     * Resolves a provider (controller/service) in the DI graph, including global modules.
     * @param token The token/class to resolve
     * @param contextModule The module to start searching from
     * @param seen (Cycle detection)
     */
    private async resolveDependency(
        token: Token,
        contextModule: ModuleWrapper,
        seen: Set<Token> = new Set(),
    ): Promise<unknown> {
        if (this.instanceContainer.has(token)) {
            return this.instanceContainer.resolve(token);
        }

        if (seen.has(token)) {
            throw new Error(`[Aurora] Circular dependency detected for token "${getTokenName(token)}".`);
        }

        seen.add(token);

        try {
            const destinationModule = this.findModuleByProvider(token, contextModule);
            if (!destinationModule) {
                throw new Error(`[AuroraDI] Cannot resolve dependency for token "${getTokenName(token)}"`);
            }

            const providerDef = this.findProviderDefinition(token, destinationModule);
            if (!providerDef) {
                throw new Error(`[AuroraDI] Cannot resolve dependency for token "${getTokenName(token)}"`);
            }

            const normalized = normalizeProvider(providerDef);
            const scope = getProviderScope(providerDef);

            // useValue
            if ('useValue' in normalized) {
                this.instanceContainer.register(token, normalized.useValue);
                return normalized.useValue;
            }

            // useFactory
            if ('useFactory' in normalized && normalized.useFactory) {
                const args = await Promise.all(
                    (normalized.inject ?? []).map(async ({ token: inj, optional }) => {
                        try {
                            return await this.resolveDependency(inj, destinationModule, seen);
                        } catch (err) {
                            if (optional) {
                                return undefined;
                            }
                            throw err;
                        }
                    }),
                );

                const result = await normalized.useFactory(...args);
                if (scope === Scope.SINGLETON) {
                    this.instanceContainer.register(token, result);
                }

                return result;
            }

            // useClass
            if ('useClass' in normalized && normalized.useClass) {
                const instance = await this.instantiateClass(normalized.useClass, destinationModule, seen);
                if (scope === Scope.SINGLETON) {
                    this.instanceContainer.register(token, instance);
                }
                return instance;
            }

            // Should not happen
            throw new Error(`[AuroraDI] Cannot resolve dependency for token "${getTokenName(token)}"`);
        } finally {
            // Pop from stack to avoid false positives for transient + shared deps.
            seen.delete(token);
        }
    }

    /**
     * Finds the module able to provide the given token.
     * 1. Current module (providers/controllers)
     * 2. Imported modules (recursive, if they export the token)
     * 3. All global modules (@Global)
     */
    private findModuleByProvider(token: Token, contextModule: ModuleWrapper): ModuleWrapper | undefined {
        // Current module
        if (this.findProviderDefinition(token, contextModule)) {
            return contextModule;
        }

        // Deep search in imports that export the token
        for (const imported of contextModule.imports) {
            if (imported.exports.has(token)) {
                const found = this.findModuleByProvider(token, imported);
                if (found) {
                    return found;
                }
            }
        }

        // Global modules
        for (const globalMod of this.globalModules) {
            if (globalMod.exports.has(token) && this.findProviderDefinition(token, globalMod)) {
                return globalMod;
            }
        }

        return undefined;
    }

    /**
     * Finds a provider definition for a token in a given module, including controllers.
     */
    private findProviderDefinition(token: Token, moduleWrapper: ModuleWrapper): Provider | Type | undefined {
        if (moduleWrapper.controllers.has(token as Type)) {
            return token as Type;
        }

        return moduleWrapper.metadata.providers?.find((provider) => {
            const normalized = normalizeProvider(provider);
            return normalized.provide === token;
        });
    }
}
