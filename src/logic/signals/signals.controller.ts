import { Controller, Get, Param, Req, UseGuards, Post, Body, Query, Delete } from '@nestjs/common'
import { ApiQuery, ApiTags } from "@nestjs/swagger"
import { SignalsService } from './signals.service'
import ConfigSignalInputModel from 'commons/models/config/ConfigSignalInputModel.dto'

@ApiTags("signals")
@Controller("signals")
export class SignalsController
{
    constructor(private readonly signalsService: SignalsService) {}

    @Get('allSignals')
    async getAllSignals() : Promise<string[]>
    {
        return await this.signalsService.getAllSignals()
    }

    @Get('allPorts')
    async getAllPorts() : Promise<number[]>
    {
        return await this.signalsService.getAllPorts()
    }

    @Post(':id')
    async add(@Param('id') id: string, @Body() signalConfig: ConfigSignalInputModel) : Promise<void>
    {
        return await this.signalsService.add(id, signalConfig)
    }

    @Get(':id/port')
    async getPort(@Param('id') id: string) : Promise<number | undefined>
    {
        return await this.signalsService.getSignalPort(id)
    }

    @Get(':id/tokens')
    async getTokens(@Param('id') id: string) : Promise<string[] | undefined>
    {
        return await this.signalsService.getSignalTokens(id)
    }

    @Delete(':id')
    async remove(@Param('id') id: string) : Promise<void>
    {
        return await this.signalsService.removeSignal(id)
    }
}