export { PlayerEntity } from './player';

export {
    PLAYER_COMPONENT_METADATA_KEY,
    PlayerComponent,
    isPlayerComponent,
} from './player-component';
export type { IPlayerComponent, PlayerComponentCtor } from './player-component';

export { PlayerComponentRegistry } from './component-registry';

export { PlayerRegistry } from './player-registry';
export type { ComponentFactory } from './player-registry';

export { PlayerExtenderRegistry } from './player-extender';
export type { PlayerExtender } from './player-extender';
