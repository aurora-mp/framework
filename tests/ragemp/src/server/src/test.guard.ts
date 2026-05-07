import { ExecutionContext, Guard, Injectable } from '@aurora-mp/core';

@Injectable()
export class TestGuard implements Guard {
    public canActivate(context: ExecutionContext): boolean {
        const player = context.getPlayer() as PlayerMp;
        return player.name === 'neeko';
    }
}
