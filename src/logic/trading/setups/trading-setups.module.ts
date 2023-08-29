import { Module } from '@nestjs/common'
import { TradingSetupsService } from './trading-setups.service'
import { TradingSetupsController } from './trading-setups.controller'

@Module({
    controllers: [TradingSetupsController],
    providers: [TradingSetupsService],
    exports: [TradingSetupsService],
})
export class TradingSetupsModule {}
