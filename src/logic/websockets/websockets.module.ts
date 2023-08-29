import { Module } from '@nestjs/common'
import { WebsocketsService } from './websockets.service';

@Module({
    providers: [WebsocketsService],
    exports: [WebsocketsService],
})
export class WebsocketsModule {}
