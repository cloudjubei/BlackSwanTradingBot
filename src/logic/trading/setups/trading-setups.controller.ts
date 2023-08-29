import { Controller, Get, Param, Req, UseGuards, Post, Body, Query, Delete } from '@nestjs/common'
import { ApiQuery, ApiTags } from "@nestjs/swagger"
import { TradingSetupsService } from './trading-setups.service'
import TradingSetupModel from 'src/models/trading/TradingSetupModel.dto'

@ApiTags("trading")
@Controller("setups")
export class TradingSetupsController
{
    constructor(private readonly tradingSetupsService: TradingSetupsService) {}

    @Get('allSgn')
    async getAllSignals(@Param() id: string) : Promise<TradingSetupModel[]>
    {
        return await this.tradingSetupsService.getAll()
    }

    // @Post('add')
    // async add(@Body() config: string) : Promise<TradingSetupModel>
    // {
    //     return await this.tradingSetupsService.create(config)
    // }

    @Get(':id')
    async get(@Param() id: string) : Promise<TradingSetupModel | undefined>
    {
        return await this.tradingSetupsService.get(id)
    }

    @Delete(':id')
    async remove(@Param() id: string) : Promise<TradingSetupModel | undefined>
    {
        return await this.tradingSetupsService.remove(id)
    }
}