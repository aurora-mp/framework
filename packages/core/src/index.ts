import 'reflect-metadata';

export * from './bootstrap';
export * from './constants';
export * from './decorators';
export * from './di';
export * from './enums';
export * from './errors';
export * from './interfaces';
export * from './rpc';
export * from './types';
export * from './utils';
export type { IConfigService } from './interfaces/config-service.interface';
export {
    PlayerEntity,
    PlayerRegistry,
    PlayerComponentRegistry,
    PlayerExtenderRegistry,
    PlayerComponent,
    PLAYER_COMPONENT_METADATA_KEY,
    isPlayerComponent,
} from './player';
export type {
    PlayerComponentCtor,
    IPlayerComponent,
    PlayerExtender,
    ComponentFactory,
} from './player';
