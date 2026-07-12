import { MethodParamType } from '../../enums';
import { createParamDecorator } from './create-param-decorator';

/**
 * Parameter decorator for injecting the player object associated with an event.
 *
 * @param data Optional. A key to extract a specific property from the player object (e.g., 'name', 'ip').
 * If not provided, the entire player object is injected.
 * @example
 * ```ts
 * // Injects the entire player object
 * onPlayerEvent(@Player() player: Player)
 *
 * // Injects only the player's name
 * onPlayerEvent(@Player('name') name: string)
 * ```
 */
export const Player = createParamDecorator(MethodParamType.PLAYER);
