import 'reflect-metadata';
import { createRageApplication } from '@aurora-mp/platform-ragemp-client';
import { AppModule } from './app.module';

const bootstrap = async () => {
    const app = await createRageApplication(AppModule);
    await app.start();
};

bootstrap();
