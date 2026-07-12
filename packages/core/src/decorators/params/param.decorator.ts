import { createParamDecorator } from './create-param-decorator';
import { MethodParamType } from '../../enums';

/**
 * Parameter decorator to inject a specific property from the event payload.
 * It's an alias for `@Payload(key)`.
 *
 * @param data The key of the property to extract from the payload object.
 * @example
 * ```ts
 * onMoneyTransfer(@Param('amount') amount: number)
 * ```
 */
export const Param = createParamDecorator(MethodParamType.PARAM);
