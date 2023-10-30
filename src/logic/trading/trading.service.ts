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
        const setups = this.tradingSetupsService.getAll()
        for(const setup of setups) {
            hasUpdate = hasUpdate || await this.updateSetup(setup)
        }

        if (hasUpdate){
            StorageUtils.createOrWriteToFile('.', 'setups.json', JSON.stringify(this.tradingSetupsService.getAll()))
        }
    }

    private async updateSetup(setup: TradingSetupModel) : Promise<boolean>
    {
        if (setup.status === TradingSetupStatusType.TERMINATED){ return false }

        if (!this.updatePrice(setup)) { return false }
        if (!await this.updateOpenTransactions(setup)) { return false }
        if (!await this.attemptAction(setup)) { return false }
        return true
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

    private async updateOpenTransactions(setup: TradingSetupModel) : Promise<boolean>
    {
        let hasNoTransactionsOpen = true
        const openTransactions = Object.values(setup.openTransactions)
        for(const t of openTransactions){
            try{
                const newT = await this.transactionService.updateTransaction(setup, t)
                if (newT){
                    hasNoTransactionsOpen = false
                    TradingSetupModelUtils.UpdateTransaction(setup, newT)
                }
            }catch(e){
                hasNoTransactionsOpen = false
                console.error("updateOpenTransactions error: " + JSON.stringify(e))
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
            const minAmount = this.identityService.getMinAmounts()[tradingSetup.config.firstToken]
            action = TradingSetupModelUtils.UpdateTakeProfit(tradingSetup, minAmount)
            if (action === 0){
                action = TradingSetupModelUtils.UpdateStopLoss(tradingSetup, minAmount)
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