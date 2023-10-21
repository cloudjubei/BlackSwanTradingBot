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

@Injectable()
export class TradingService implements OnApplicationBootstrap
{
    hasSetup = false
    isUpdating = false

    constructor(
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
        const tokens = this.pricesService.getAllTokens()
        for(const tokenPair of tokens){
            const url = this.pricesService.getUrl(tokenPair)
            for(const interval of this.pricesService.getAllIntervals(tokenPair)){
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
    }

    private async updateSignals()
    {
        const ids = this.signalsService.getAllSignals()
        for(const identifier of ids){
            const url = this.signalsService.getSignalUrl(identifier)
            for(const tokenPair of this.signalsService.getSignalTokens(identifier)){
                for(const interval of this.signalsService.getSignalIntervals(identifier, tokenPair)){
                    try{
                        const signal = await this.websocketsService.sendMessage(url, "signal_latest", JSON.stringify({ identifier, tokenPair, interval }))
                        if (signal){
                            this.signalsService.storeInCache(identifier, signal as SignalModel)
                        }
                    }catch(error){
                        // TODO: handle multiple timeouts
                        console.error("updateSignals identifier: " + identifier + " url: " + url + " token: " + tokenPair + " interval: " + interval + " error: ", error)
                    }
                }
            }
        }
    }

    private updateSetups()
    {
        const setups = this.tradingSetupsService.getAll()
        for(const setup of setups) {
            this.updateSetup(setup)
        }
    }

    private async updateSetup(setup: TradingSetupModel) : Promise<void>
    {
        if (setup.status === TradingSetupStatusType.TERMINATED){ return }

        if (!await this.updatePrice(setup)) { return }
        if (!await this.updateOpenTransactions(setup)) { return }
        if (!await this.attemptAction(setup)) { return }
        this.tradingSetupsService.save(setup)
    }

    private async updatePrice(setup: TradingSetupModel) : Promise<boolean>
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

    private async updateOpenTransactions(setup: TradingSetupModel) : Promise<boolean>
    {
        let hasNoTransactionsOpen = true
        const openTransactions = Object.values(setup.openTransactions)
        for(const t of openTransactions){
            const newT = await this.transactionService.updateTransaction(setup, t)
            if (newT){
                hasNoTransactionsOpen = false
                TradingSetupModelUtils.UpdateTransaction(setup, newT)
            }
        }
        return hasNoTransactionsOpen
    }

    private async attemptAction(setup: TradingSetupModel) : Promise<boolean>
    {
        if (!MathUtils.IsBiggerThanZero(setup.currentPriceAmount)){ return false }
        if (Object.keys(setup.openTransactions).length > 0) { return false }

        const action = this.updateAction(setup)
            
        if (action !== 0){
            const transaction = await this.transactionService.makeTransaction(setup, action)
            if (transaction){
                TradingSetupModelUtils.UpdateTransaction(setup, transaction)
                return true
            }
        }
        return false
    }

    private updateAction(tradingSetup: TradingSetupModel) : number
    {
        let action = TradingSetupModelUtils.UpdateTermination(tradingSetup)
        if (action === 0){
            action = TradingSetupModelUtils.UpdateTakeProfit(tradingSetup)
            if (action === 0){
                action = TradingSetupModelUtils.UpdateStopLoss(tradingSetup)
                if (action === 0){
                    const tokenPair = TradingSetupConfigModelUtils.GetTokenPair(tradingSetup.config)
                    const interval = tradingSetup.config.interval
                    const signal = this.signalsService.getFromCache(tradingSetup.config.signal, tokenPair, interval)
                    action = TradingSetupModelUtils.UpdateSignal(tradingSetup, signal)
                }
            }
        }
        return action
    }
}