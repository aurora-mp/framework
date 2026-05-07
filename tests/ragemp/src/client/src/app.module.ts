import { Module } from '@aurora-mp/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
    imports: [],
    controllers: [AppController],
    providers: [AppService],
    exports: [AppService],
})
export class AppModule {}
