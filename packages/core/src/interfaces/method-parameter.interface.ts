import { MethodParamType } from '../enums';
import { ArgumentMetadata } from './argument-metadata.interface';

export interface BaseParameter extends ArgumentMetadata {
    metatype?: Function;
    method?: string;
    isOptional?: boolean;
    defaultValue?: any;
}

/**
 * Metadata for a controller method parameter that receives
 * the entire event payload.
 *
 * @public
 */
export interface PayloadParameter extends BaseParameter {
    /**
     * The parameter kind: inject the full payload object.
     */
    type: MethodParamType.PAYLOAD;
}

/**
 * Metadata for a controller method parameter that receives
 * a specific property from the event payload.
 *
 * @public
 */
export interface ParamParameter extends BaseParameter {
    /**
     * The parameter kind: inject a specific property from the payload.
     */
    type: MethodParamType.PARAM;

    /**
     * The key of the property to extract from the payload.
     */
    data: string;
}

/**
 * Metadata for a controller method parameter that receives
 * the player instance associated with the event.
 *
 * @public
 */
export interface PlayerParameter extends BaseParameter {
    /**
     * The parameter kind: inject the player object.
     */
    type: MethodParamType.PLAYER;
}

/**
 * Metadata for a controller method parameter that receives
 * the platform-provided source identifier for the event.
 *
 * @public
 */
export interface SourceParameter extends BaseParameter {
    /**
     * The parameter kind: inject the source identifier.
     */
    type: MethodParamType.SOURCE;
}

/**
 * Union type covering all possible controller method
 * parameter metadata shapes (payload, single property, source or player)
 *
 * @public
 */
export type MethodParameter = PayloadParameter | ParamParameter | PlayerParameter | SourceParameter;
