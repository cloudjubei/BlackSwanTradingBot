import { Module } from '@nestjs/common'
import { PricesService } from './prices.service'
import { PricesController } from './prices.controller'
import { IdentityModule } from 'logic/identity/identity.module'

@Module({
    imports: [
        IdentityModule,
    ],
    controllers: [PricesController],
    providers: [PricesService],
    exports: [PricesService],
})
export class PricesModule {}
