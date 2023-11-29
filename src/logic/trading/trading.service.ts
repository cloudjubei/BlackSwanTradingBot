import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import TradingSetupModel, { TradingSetupModelUtils } from 'models/trading/TradingSetupModel.dto'
import { TradingSetupsService } from './setups/trading-setups.service'
import { TransactionService } from '../transaction/transaction.service'
import TradingSetupStatusType from 'models/trading/TradingSetupStatusType.dto'
import { PricesService } from '../prices/prices.service'
import { SignalsService } from '../signals/signals.service'
import { WebsocketsService } from '../websockets/websockets.service'
import { TradingSetupConfigModelUtils } from 'models/trading/TradingSetupConfigModel.dto'
import MathUtils from "commons/lib/mathUtils"
import SignalModel from "commons/models/signal/SignalModel.dto"
import PriceModel from "commons/models/price/PriceModel.dto"
import PriceKlineModel from 'commons/models/price/PriceKlineModel.dto'
import { IdentityService } from 'logic/identity/identity.service'
import StorageUtils from 'commons/lib/storageUtils'
import TradingSetupActionModel, { TradingSetupActionModelUtils } from 'models/trading/action/TradingSetupActionModel.dto'
import TradingSetupTradeModel, { TradingSetupTradeModelUtils } from 'models/trading/trade/TradingSetupTradeModel.dto'
import TradingSetupActionType from 'models/trading/action/TradingSetupActionType.dto'
import TradingSetupTradeTransactionStatus from 'models/trading/trade/TradingSetupTradeTransactionStatus.dto'
import ArrayUtils from 'commons/lib/arrayUtils'

@Injectable()
export class TradingService implements OnApplicationBootstrap
{
    hasSetup = false
    isUpdating = false

    constructor(
        private readonly identityService: IdentityService,
        private readonly websocketsService: WebsocketsService,
        private readonly transactionService: TransactionService,
        private readonly pricesService: PricesService,
        private readonly signalsService: SignalsService,
        private readonly tradingSetupsService: TradingSetupsService
    ){}

    onApplicationBootstrap()
    {
        this.setup()
    }

    @Cron(CronExpression.EVERY_SECOND)
    async update()
    {
        if (!this.hasSetup || this.isUpdating) { return }

        console.log(`TradingService update ${Date.now()}`)

        this.isUpdating = true
        try{
            await this.updatePrices()
            await this.updateSignals()
            await this.updateSetups()
        }catch(error){
            console.error(`${error} trace: ${error.stack}`)
        }
        this.isUpdating = false
    }

    private async setup()
    {
        if (this.hasSetup) { return }

        console.log(`TradingService setup ${Date.now()}`)

        await this.transactionService.setup()
        this.setupWebsocketConnections()

        this.hasSetup = true

        console.log(`TradingService done`)
    }

    private setupWebsocketConnections()
    {
        const priceUrls = this.pricesService.getAllUrls()
        for(const url of priceUrls){
            this.websocketsService.connect(url)
        }
        // const priceTokens = this.pricesService.getAllTokens()
        // for(const token of priceTokens){
        //     const url = this.pricesService.getUrl(token)
        //     this.websocketsService.listen(url, token, (price) => {
        //         console.log("LISTENED TO PRICE: ", price)
        //     })
        // }
        
        const signalUrls = this.signalsService.getAllUrls()
        for(const url of signalUrls){
            this.websocketsService.connect(url)
        }
        // const signalIds = this.signalsService.getAllSignals()
        // for(const signalId of signalIds){
        //     const url = this.signalsService.getSignalUrl(signalId)
        //     for(const token of this.signalsService.getSignalTokens(signalId)){
        //         this.websocketsService.listen(url, signalId + '-' + token + '-' + '1s', (signal) => {
        //             console.log("LISTENED TO SIGNAL: ", signal)
        //         })
        //     }
        // }
    }

    private async updatePrices()
    {
        for(const tokenPair of this.pricesService.getAllTokens()){
            const interval = '1s'
            const url = this.pricesService.getUrl(tokenPair)
            try{
                const price = await this.websocketsService.sendMessage(url, "price_latestKline", JSON.stringify({ tokenPair, interval }))
                if (price){
                    this.pricesService.storeInCache(price as PriceKlineModel)
                }
            }catch(error){
                // TODO: handle multiple timeouts
                console.error("updatePrices url: " + url + " tokenPair: " + tokenPair + " interval: " + interval + " error: ", error)
            }
        }

        const setups = this.tradingSetupsService.getAll()
        for(const setup of setups) {
            const tokenPair = TradingSetupModelUtils.GetTokenPair(setup)
            const interval = setup.config.interval
            if (interval === '1s') { continue }

            const url = this.pricesService.getUrl(tokenPair)

            try{
                const price = await this.websocketsService.sendMessage(url, "price_latestKline", JSON.stringify({ tokenPair, interval }))
                if (price){
                    this.pricesService.storeInCache(price as PriceKlineModel)
                }
            }catch(error){
                // TODO: handle multiple timeouts
                console.error("updatePrices url: " + url + " tokenPair: " + tokenPair + " interval: " + interval + " error: ", error)
            }
        }
    }

    private async updateSignals()
    {
        const setups = this.tradingSetupsService.getAll()
        for(const setup of setups) {
            const signalId = setup.config.signal
            const tokenPair = TradingSetupModelUtils.GetTokenPair(setup)
            const interval = setup.config.interval
            const url = this.signalsService.getSignalUrl(signalId)

            try{
                const signal = await this.websocketsService.sendMessage(url, "signal_latest", JSON.stringify({ identifier: signalId, tokenPair, interval }))
                if (signal){
                    this.signalsService.storeInCache(signalId, signal as SignalModel)
                }
            }catch(error){
                // TODO: handle multiple timeouts
                console.error("updateSignals signalId: " + signalId + " url: " + url + " token: " + tokenPair + " interval: " + interval + " error: ", error)
            }
        }
    }

    private async updateSetups()
    {
        let hasUpdate = false
        const setups = this.tradingSetupsService.getAllRunning()
        for(const setup of setups) {
            hasUpdate = hasUpdate || await this.updateSetup(setup)
        }

        // if (hasUpdate){
        StorageUtils.createOrWriteToFile('.', 'setups.json', JSON.stringify(this.tradingSetupsService.getAll()))
        // }
    }

    private async updateSetup(setup: TradingSetupModel) : Promise<boolean>
    {
        if (!TradingSetupModelUtils.IsRunning(setup)){ return false }
        if (!this.updatePrice(setup)) { return false }

        TradingSetupModelUtils.UpdateTerminating(setup)

        if (setup.manualOverrideAction){
            setup.currentAction = setup.manualOverrideAction
            setup.manualOverrideAction = undefined
            setup.timeoutTimestamp = 0
        }else{
            setup.currentAction = this.getAction(setup)
        }

        const tradesComplete = []
        for(const t of setup.openTrades){
            await this.updateOpenTrade(setup, t)
            if (t.status === TradingSetupTradeTransactionStatus.COMPLETE || t.status === TradingSetupTradeTransactionStatus.CANCELLED){
                tradesComplete.push(t)
            }
        }
        for(const t of tradesComplete){
            setup.openTrades = ArrayUtils.RemoveElement(setup.openTrades, t)
            setup.finishedTrades.push(t)
        }
        
        if (TradingSetupModelUtils.UpdateTermination(setup)){ return false }
        if (setup.timeoutTimestamp > Date.now()) { return false }
        return await this.attemptNewAction(setup)
    }

    private updatePrice(setup: TradingSetupModel) : boolean
    {
        const tokenPair = TradingSetupConfigModelUtils.GetTokenPair(setup.config)
        const interval = setup.config.interval
        const price = this.pricesService.getFromCache(tokenPair, interval)

        if (price){
            const priceAmount = price.price
            TradingSetupModelUtils.UpdatePrice(setup, priceAmount)
            return true
        }
        return false
    }

    private async updateOpenTrade(tradingSetup: TradingSetupModel, trade: TradingSetupTradeModel)
    {
        trade.updateTimestamp = Date.now()
        if (trade.status === TradingSetupTradeTransactionStatus.BUY_PENDING){
            try{
                const newTransaction = await this.transactionService.updateTransaction(tradingSetup, trade.buyTransaction)
                if (newTransaction){
                    TradingSetupTradeModelUtils.UpdateBuyTransaction(trade, tradingSetup, newTransaction)
                }
            }catch(e){
                console.error("updateOpenTrade BUY_PENDING error: " + JSON.stringify(e))
            }
            return
        }else if (trade.status === TradingSetupTradeTransactionStatus.BUY_DONE){
            let action = new TradingSetupActionModel(TradingSetupActionType.MANUAL)

            if (tradingSetup.status === TradingSetupStatusType.TERMINATING){
                action = new TradingSetupActionModel(TradingSetupActionType.TERMINATION, -1)
            }else{
                action = trade.manualOverrideAction ?? action
                trade.manualOverrideAction = undefined
            }
    
            if (TradingSetupActionModelUtils.IsNoOp(action)){
                const minAmount = this.identityService.getMinAmounts()[tradingSetup.config.firstToken]
                action = TradingSetupTradeModelUtils.UpdateTakeProfit(trade, tradingSetup, minAmount)
                if (TradingSetupActionModelUtils.IsNoOp(action)){
                    action = TradingSetupTradeModelUtils.UpdateStopLoss(trade, tradingSetup, minAmount)
                    if (TradingSetupActionModelUtils.IsNoOp(action)){
                        action = tradingSetup.currentAction
                    }else{
                        tradingSetup.timeoutTimestamp = Date.now() + ((tradingSetup.config.stopLoss?.timeout ?? 0) * 1000)
                    }
                }
            }
            trade.currentAction = action
            if (TradingSetupActionModelUtils.IsSell(action)){
                trade.status = TradingSetupTradeTransactionStatus.SELL_PARTIALLY_DONE
                if (action.type !== TradingSetupActionType.STOPLOSS){
                    tradingSetup.timeoutTimestamp = Date.now() + (tradingSetup.config.sellTimeout * 1000)
                }
            }
        }else if (trade.status === TradingSetupTradeTransactionStatus.SELL_PENDING){
            if (trade.sellTransactionPending){
                try{
                    const newTransaction = await this.transactionService.updateTransaction(tradingSetup, trade.sellTransactionPending)
                    if (newTransaction){
                        TradingSetupTradeModelUtils.UpdateSellTransaction(trade, tradingSetup, newTransaction)
                    }
                }catch(e){
                    console.error("updateOpenTrade SELL_PENDING error: " + JSON.stringify(e))
                }
            }else{
                trade.status = TradingSetupTradeTransactionStatus.SELL_PARTIALLY_DONE
            }
        }
        if (trade.status === TradingSetupTradeTransactionStatus.SELL_PARTIALLY_DONE){
            const transaction = await this.transactionService.makeTransaction(tradingSetup, new TradingSetupActionModel(trade.currentAction.type, -1), trade)
            if (transaction){
                TradingSetupTradeModelUtils.UpdateSellTransaction(trade, tradingSetup, transaction)
            }else if (!this.transactionService.canMakeTransaction(tradingSetup, new TradingSetupActionModel(trade.currentAction.type, -1), trade)){
                console.log("!!!XXX!!! COULDn'T MAKE A SELL FOR WALLET FREE:")
                console.log(tradingSetup.config.isMarginAccount ? this.transactionService.getWalletMarginFree() : this.transactionService.getWalletFree())
                console.log("!!!XXX!!! COULDn'T MAKE A SELL FOR WALLET LOCKED:")
                console.log(tradingSetup.config.isMarginAccount ? this.transactionService.getWalletMarginLocked() : this.transactionService.getWalletLocked())
                // console.log("!!!XXX!!! COULDn'T MAKE A SELL FOR SETUP:")
                // console.log(tradingSetup)
                console.log("!!!XXX!!! TRADE:")
                console.log(trade)

                if (!this.transactionService.isTransactionAboveMinLimit(tradingSetup, new TradingSetupActionModel(trade.currentAction.type, -1), trade)){
                    console.log("!!!XXX!!! TRADE failing to make the transaction due to not passing min limit -> releasing")
                    trade.status = TradingSetupTradeTransactionStatus.COMPLETE
                }
            }
        }
        if (trade.status === TradingSetupTradeTransactionStatus.COMPLETE){
            TradingSetupTradeModelUtils.UpdateComplete(trade, tradingSetup)
        }
    }

    private async attemptNewAction(setup: TradingSetupModel) : Promise<boolean>
    {
        if (!MathUtils.IsBiggerThanZero(setup.currentPriceAmount)){ return false }
        if (!setup.currentAction){ return false }

        if (TradingSetupActionModelUtils.IsBuy(setup.currentAction)){
            const transaction = await this.transactionService.makeTransaction(setup, setup.currentAction)
            if (transaction){
                TradingSetupModelUtils.CreateBuyTrade(setup, transaction)
                return true
            }
        }
        return false
    }

    private getAction(tradingSetup: TradingSetupModel) : TradingSetupActionModel
    {
        const signalProvider = tradingSetup.config.signal
        const tokenPair = TradingSetupConfigModelUtils.GetTokenPair(tradingSetup.config)
        const interval = tradingSetup.config.interval
        const signal = this.signalsService.getFromCache(signalProvider, tokenPair, interval)

        return new TradingSetupActionModel(TradingSetupActionType.SIGNAL, signal.action * signal.certainty)
    }
}