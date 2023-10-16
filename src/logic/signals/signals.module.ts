import { Module } from '@nestjs/common'
import { SignalsService } from './signals.service'
import { SignalsController } from './signals.controller'
import { IdentityModule } from 'logic/identity/identity.module'

@Module({
    imports: [
        IdentityModule,
    ],
    controllers: [SignalsController],
    providers: [SignalsService],
    exports: [SignalsService],
})
export class SignalsModule {}
