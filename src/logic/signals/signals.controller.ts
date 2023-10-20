import { Controller, Get, Param, Req, UseGuards, Post, Body, Query, Delete } from '@nestjs/common'
import { ApiQuery, ApiTags } from "@nestjs/swagger"
import { SignalsService } from './signals.service'
import ConfigSignalInputModel from 'commons/models/config/ConfigSignalInputModel.dto'
import SignalModel from 'commons/models/signal/SignalModel.dto'

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

    @Get(':id/tokens')
    async getTokens(@Param('id') id: string) : Promise<string[] | undefined>
    {
        return await this.signalsService.getSignalTokens(id)
    }

    @Get(':id/:tokenPair/:interval/latest')
    async getLatest(@Param('id') id: string, @Param('tokenPair') tokenPair: string, @Param('interval') interval: string) : Promise<SignalModel>
    {
        return await this.signalsService.getFromCache(id, tokenPair, interval)
    }

    @Get(':id/:tokenPair/:interval/all')
    async getAll(@Param('id') id: string, @Param('tokenPair') tokenPair: string, @Param('interval') interval: string) : Promise<SignalModel[]>
    {
        return await this.signalsService.getAllFromCache(id, tokenPair, interval)
    }

    @Post(':id')
    async add(@Param('id') id: string, @Body() signalConfig: ConfigSignalInputModel) : Promise<void>
    {
        return await this.signalsService.add(id, signalConfig)
    }

    @Delete(':id')
    async remove(@Param('id') id: string) : Promise<void>
    {
        return await this.signalsService.removeSignal(id)
    }
}