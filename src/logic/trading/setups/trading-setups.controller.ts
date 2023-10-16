import { Controller, Get, Param, Req, UseGuards, Post, Body, Query, Delete } from '@nestjs/common'
import { ApiQuery, ApiTags } from "@nestjs/swagger"
import { TradingSetupsService } from './trading-setups.service'
import TradingSetupModel from 'models/trading/TradingSetupModel.dto'
import TradingSetupConfigModel from 'models/trading/TradingSetupConfigModel.dto'

@ApiTags("trading")
@Controller("setups")
export class TradingSetupsController
{
    constructor(private readonly tradingSetupsService: TradingSetupsService) {}

    @Get('all')
    async getAll() : Promise<TradingSetupModel[]>
    {
        return await this.tradingSetupsService.getAll()
    }
    @Get(':id')
    async get(@Param('id') id: string) : Promise<TradingSetupModel | undefined>
    {
        return await this.tradingSetupsService.get(id)
    }

    @Post(':id/:startingFirstAmount/:startingSecondAmount')
    async add(@Param('id') id: string, @Param('startingFirstAmount') startingFirstAmount: string, @Param('startingSecondAmount') startingSecondAmount: string, @Body() config: TradingSetupConfigModel) : Promise<TradingSetupModel>
    {
        return await this.tradingSetupsService.create(id, config, startingFirstAmount, startingSecondAmount)
    }

    @Delete(':id')
    async remove(@Param('id') id: string) : Promise<TradingSetupModel | undefined>
    {
        return await this.tradingSetupsService.remove(id)
    }
}