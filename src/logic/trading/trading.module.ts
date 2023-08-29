import { Module } from '@nestjs/common'
import { TradingService } from './trading.service'
import { TradingSetupsModule } from './setups/trading-setups.module'
import { TransactionModule } from '../transaction/transaction.module'
import { PricesModule } from '../prices/prices.module'
import { SignalsModule } from '../signals/signals.module'
import { WebsocketsModule } from '../websockets/websockets.module'

@Module({
    imports: [
        WebsocketsModule,
        TransactionModule,
        PricesModule,
        SignalsModule,
        TradingSetupsModule,
    ],
    providers: [TradingService],
    exports: [TradingService],
})
export class TradingModule {}
