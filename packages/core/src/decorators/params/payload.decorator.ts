import { MethodParamType } from '../../enums';
import { createParamDecorator } from './create-param-decorator';

/**
 * Injects the event payload into a controller method parameter.
 * Can optionally inject a specific property from the payload if a key is provided.
 *
 * @param data A key to extract a specific property from the payload object.
 */
export const Payload = createParamDecorator(MethodParamType.PAYLOAD);
