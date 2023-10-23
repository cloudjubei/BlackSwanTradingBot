import { Controller, Get, Param, Req, UseGuards, Post, Body, Query, Delete } from '@nestjs/common'
import { ApiQuery, ApiTags } from "@nestjs/swagger"
import { TransactionService } from './transaction.service'
import WalletModel from 'models/WalletModel.dto'

@ApiTags("transaction")
@Controller("transactions")
export class TransactionController
{
    constructor(private readonly transactionService: TransactionService) {}

    @Get('wallet/free')
    async getWalletFree() : Promise<WalletModel>
    {
        return await this.transactionService.getWalletFree()
    }

    @Get('wallet/locked')
    async getWalletLocked() : Promise<WalletModel>
    {
        return await this.transactionService.getWalletLocked()
    }

    @Post('convertAllBTC')
    async convertAllBTC() : Promise<WalletModel>
    {
        return await this.transactionService.convertAllBTC()
    }
}