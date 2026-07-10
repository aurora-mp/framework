import { MethodParamType } from '../../enums';
import { createParamDecorator } from './create-param-decorator';

/** Injects the platform source id for the current event. */
export const Source = createParamDecorator(MethodParamType.SOURCE);
