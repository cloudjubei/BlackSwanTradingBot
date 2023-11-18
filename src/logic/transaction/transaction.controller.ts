import { Controller, Get, Param, Req, UseGuards, Post, Body, Query, Delete } from '@nestjs/common'
import { ApiQuery, ApiTags } from "@nestjs/swagger"
import { TransactionService } from './transaction.service'
import WalletModel from 'models/WalletModel.dto'
import TradingSetupModel, { TradingSetupModelUtils } from 'models/trading/TradingSetupModel.dto'
import { TradingSetupsService } from 'logic/trading/setups/trading-setups.service'
import TradingSetupActionModel from 'models/trading/action/TradingSetupActionModel.dto'
import TradingSetupActionType from 'models/trading/action/TradingSetupActionType.dto'
import TradingSetupTradeTransactionStatus from 'models/trading/trade/TradingSetupTradeTransactionStatus.dto'

@ApiTags("transaction")
@Controller("transactions")
export class TransactionController
{
    constructor(
        private readonly transactionService: TransactionService,
        private readonly tradingSetupsService: TradingSetupsService
    ) {}

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

    @Get('walletMargin/free')
    async getWalletMarginFree() : Promise<WalletModel>
    {
        return await this.transactionService.getWalletMarginFree()
    }

    @Get('walletMargin/locked')
    async getWalletMarginLocked() : Promise<WalletModel>
    {
        return await this.transactionService.getWalletMarginLocked()
    }

    @Post('convertAllBTC')
    async convertAllBTC() : Promise<WalletModel>
    {
        return await this.transactionService.convertAllBTC()
    }

    @Post('forceBuy/:id')
    async forceBuy(@Param('id') id: string) : Promise<TradingSetupModel>
    {
        const setup = await this.tradingSetupsService.get(id)
        const transaction = await this.transactionService.makeTransaction(setup, new TradingSetupActionModel(TradingSetupActionType.MANUAL, 1))
        if (transaction){
            TradingSetupModelUtils.CreateBuyTrade(setup, transaction)
        }
        return setup
    }

    @Post('forceSell/:id')
    async forceSell(@Param('id') id: string) : Promise<TradingSetupModel>
    {
        const setup = await this.tradingSetupsService.get(id)

        if (setup.openTrades.length > 0){
            const trade = setup.openTrades[0]
            trade.status = TradingSetupTradeTransactionStatus.SELL_PARTIALLY_DONE
            trade.currentAction = new TradingSetupActionModel(TradingSetupActionType.MANUAL, -1)
        }
        return setup
    }
}