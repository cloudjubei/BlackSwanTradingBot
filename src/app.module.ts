import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MissingModelsController } from './models/missingModels.controller'
import { ScheduleModule } from '@nestjs/schedule'
import { AppController } from './app.controller'
import { TradingModule } from './logic/trading/trading.module'
import { SignalsModule } from './logic/signals/signals.module'
import { PricesModule } from './logic/prices/prices.module'
import { WebsocketsModule } from './logic/websockets/websockets.module'

@Module({
    imports: [
        ConfigModule.forRoot({ envFilePath: ".env.local", isGlobal: true }),

        WebsocketsModule,

        PricesModule,
        SignalsModule,
        TradingModule,

        ScheduleModule.forRoot()
    ],
    controllers: [
        AppController,
        MissingModelsController
    ]
})
export class AppModule implements NestModule
{
  configure(consumer: MiddlewareConsumer)
  {
    consumer
  }
}
