import { Controller, Get, Param, Req, UseGuards, Post, Body, Query, Delete } from '@nestjs/common'
import { ApiQuery, ApiTags } from "@nestjs/swagger"
import { PricesService } from './prices.service'

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

    @Get('allPorts')
    async getAllPorts() : Promise<number[]>
    {
        return await this.pricesService.getAllPorts()
    }

    @Post(':port/:token/:intervals')
    async add(@Param('port') port: number, @Param('token') token: string, @Param('intervals') intervals: string[]) : Promise<void>
    {
        return await this.pricesService.add(token, intervals, port)
    }

    @Get(':token')
    async getPort(@Param('token') token: string) : Promise<number | undefined>
    {
        return await this.pricesService.getPort(token)
    }

    @Delete(':token')
    async remove(@Param('token') token: string) : Promise<number | undefined>
    {
        return await this.pricesService.remove(token)
    }
}