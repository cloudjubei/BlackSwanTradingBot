import { Controller, Get, Param, Req, UseGuards, Post, Body, Query, Delete } from '@nestjs/common'
import { ApiQuery, ApiTags } from "@nestjs/swagger"
import { PricesService } from './prices.service'
import ConfigConnectionInputModel from 'commons/models/config/ConfigConnectionInputModel.dto'
import PriceModel from 'commons/models/price/PriceModel.dto'

@ApiTags("prices")
@Controller("prices")
export class PricesController
{
    constructor(private readonly pricesService: PricesService) {}

    @Get('allTokens')
    async getAllTokens() : Promise<string[]>
    {
        return await this.pricesService.getAllTokens()
    }

    @Get(':tokenPair/:interval/latest')
    async getLatest(@Param('tokenPair') tokenPair: string, @Param('interval') interval: string) : Promise<PriceModel | undefined>
    {
        return await this.pricesService.getFromCache(tokenPair, interval)
    }

    @Get(':tokenPair/:interval/all')
    async getAll(@Param('tokenPair') tokenPair: string, @Param('interval') interval: string) : Promise<PriceModel[] | undefined>
    {
        return await this.pricesService.getAllFromCache(tokenPair, interval)
    }

    @Post(':tokenPair/:intervals')
    async add(@Param('tokenPair') tokenPair: string, @Param('intervals') intervals: string[], @Body() config: ConfigConnectionInputModel) : Promise<void>
    {
        return await this.pricesService.add(tokenPair, intervals, config)
    }

    @Delete(':tokenPair')
    async remove(@Param('tokenPair') tokenPair: string) : Promise<string | undefined>
    {
        return await this.pricesService.remove(tokenPair)
    }
}