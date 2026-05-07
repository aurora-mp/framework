import { Controller, Inject, On } from '@aurora-mp/core';
import { AppService } from './app.service';
import { OnServerRpc } from '@aurora-mp/client';

@Controller()
export class AppController {
    constructor(@Inject(AppService) private readonly appService: AppService) {}

    @On('playerReady')
    public onPlayerReady(): void {
        this.appService.onPlayerReady();
    }

    @OnServerRpc('rpc:getHelloFromClient')
    public sendHello(): string {
        return 'Hi brother!';
    }
}
