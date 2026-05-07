import { Injectable, On, UseGuards } from '@aurora-mp/core';
import { TestGuard } from './test.guard';

@Injectable()
@UseGuards(TestGuard) // <-- Here if you need to "deny/allow" access of entire controller methods
export class TestController {
    constructor() {}

    @On('app:hello')
    // @UseGuards(TestGuard)
    async testGuardMethod(player: PlayerMp) {
        console.log(`testGuardMethod from ${player.name}`);
    }
}
