import { Controller, Get, Param, Req, UseGuards, Post, Body, Query, Delete } from '@nestjs/common'
import { ApiQuery, ApiTags } from "@nestjs/swagger"
import { SignalsService } from './signals.service'
import SignalModel from 'src/models/signals/SignalModel.dto'

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

    @Get(':id/port')
    async getSignalPort(@Param() id: string) : Promise<number | undefined>
    {
        return await this.signalsService.getSignalPort(id)
    }

    @Get(':id/token/:token')
    async getSignalToken(@Param() id: string, @Param() token: string) : Promise<SignalModel | undefined>
    {
        return await this.signalsService.getFromCache(id, token)
    }

    @Delete(':id')
    async removeSignal(@Param() id: string) : Promise<void>
    {
        return await this.signalsService.removeSignal(id)
    }
}