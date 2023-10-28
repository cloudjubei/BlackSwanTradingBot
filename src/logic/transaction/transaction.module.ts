import { Module } from '@nestjs/common'
import { TransactionService } from './transaction.service'
import { IdentityModule } from 'logic/identity/identity.module'
import { TransactionController } from './transaction.controller'
import { TradingSetupsModule } from 'logic/trading/setups/trading-setups.module'

@Module({
    imports: [
        IdentityModule,
        TradingSetupsModule
    ],
    controllers: [TransactionController],
    providers: [TransactionService],
    exports: [TransactionService],
})
export class TransactionModule {}
