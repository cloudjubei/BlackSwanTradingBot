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

    @Post(':token/:port')
    async add(@Param() token: string, @Param() port: number) : Promise<void>
    {
        return await this.pricesService.add(token, port)
    }

    @Get(':token')
    async getPort(@Param() token: string) : Promise<number | undefined>
    {
        return await this.pricesService.getPort(token)
    }

    @Delete(':token')
    async remove(@Param() token: string) : Promise<number | undefined>
    {
        return await this.pricesService.remove(token)
    }
}