import { WebviewService } from '@aurora-mp/client';
import { type ILogger, Inject, Injectable, LOGGER_SERVICE, WEBVIEW_SERVICE } from '@aurora-mp/core';
import { MAIN_WEBVIEW } from '@shared/constants';

@Injectable()
export class AppService {
    constructor(
        @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
        @Inject(WEBVIEW_SERVICE) private readonly webviewService: WebviewService,
    ) {}

    public onPlayerReady(): void {
        this.logger.info('Player ready.');

        // Create webview
        this.webviewService.create(MAIN_WEBVIEW, 'http://localhost:5173', true, false);
    }
}
