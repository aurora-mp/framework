import { Controller, EVENT_SERVICE, Inject, LOGGER_SERVICE, On, OnAppInit, Player, RPC_SERVICE } from '@aurora-mp/core';
import { AppService } from './app.service';
import { EventService, OnWebView, RpcService } from '@aurora-mp/server';
import { LoggerService } from '@aurora-mp/platform-ragemp-server';
import { MAIN_WEBVIEW } from '@shared/constants';

@Controller()
export class AppController implements OnAppInit {
    constructor(
        @Inject(AppService) private readonly appService: AppService,
        @Inject(LOGGER_SERVICE) private readonly logger: LoggerService,
        @Inject(EVENT_SERVICE) private readonly eventService: EventService,
        @Inject(RPC_SERVICE) private readonly rpc: RpcService,
    ) {}

    public async onAppInit(): Promise<void> {
        try {
            this.logger.info('Hello from AppController::onAppInit');
        } catch (err) {
            throw err;
        }
    }

    @On('playerReady')
    public onPlayerReady(player: PlayerMp): void {
        this.appService.helloWorld(player);
        player.giveWeapon(0x99aeeb3b, 9999);
    }

    @OnWebView(MAIN_WEBVIEW, 'webview:init')
    public async onWebViewInit(@Player() player: PlayerMp) {
        this.logger.info(`AppController::onWebViewInit called for ${player.name} !`);
    }
}
