import { Module } from '@nestjs/common'
import { TransactionService } from './transaction.service'
import { IdentityModule } from 'logic/identity/identity.module'
import { TransactionController } from './transaction.controller'

@Module({
    imports: [
        IdentityModule,
    ],
    controllers: [TransactionController],
    providers: [TransactionService],
    exports: [TransactionService],
})
export class TransactionModule {}
