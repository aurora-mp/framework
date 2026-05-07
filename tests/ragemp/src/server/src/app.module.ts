import { Module } from '@aurora-mp/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TestGuard } from './test.guard';
import { TestController } from './test.controller';

@Module({
    imports: [],
    providers: [AppService, TestGuard],
    controllers: [AppController, TestController],
    exports: [AppService],
})
export class AppModule {}
