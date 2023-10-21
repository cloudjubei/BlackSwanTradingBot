import { Module } from '@nestjs/common'
import { WebsocketsService } from './websockets.service';
import { IdentityModule } from 'logic/identity/identity.module';

@Module({
    imports: [
        IdentityModule,
    ],
    providers: [WebsocketsService],
    exports: [WebsocketsService],
})
export class WebsocketsModule {}
