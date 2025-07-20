import { IApplication } from './application.interface';

export interface AuroraPlugin {
    onInit?(app: IApplication): Promise<void> | void;
    onBootstrap?(app: IApplication): Promise<void> | void;
}
