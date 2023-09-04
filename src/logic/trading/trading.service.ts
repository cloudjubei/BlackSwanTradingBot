import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import TradingSetupModel, { TradingSetupModelUtils } from 'src/models/trading/TradingSetupModel.dto'
import { TradingSetupsService } from './setups/trading-setups.service'
import { TransactionService } from '../transaction/transaction.service'
import TradingSetupStatusType from 'src/models/trading/TradingSetupStatusType.dto'
import { PricesService } from '../prices/prices.service'
import { SignalsService } from '../signals/signals.service'
import TokenPriceTimeModel from 'src/models/prices/TokenPriceTimeModel.dto'
import SignalModel from 'src/models/signals/SignalModel.dto'
import { WebsocketsService } from '../websockets/websockets.service'
import { TradingSetupConfigModelUtils } from 'src/models/trading/TradingSetupConfigModel.dto'
import MathUtils from 'src/lib/mathUtils'

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
        const pricePorts = this.pricesService.getAllPorts()
        for(const port of pricePorts){
            this.websocketsService.connect(port)
        }
        // const priceTokens = this.pricesService.getAllTokens()
        // for(const token of priceTokens){
        //     const port = this.pricesService.getPort(token)
        //     this.websocketsService.listen(port, token, (price) => {
        //         console.log("LISTENED TO PRICE: ", price)
        //     })
        // }
        
        const signalPorts = this.signalsService.getAllPorts()
        for(const port of signalPorts){
            this.websocketsService.connect(port)
        }
        // const signalIds = this.signalsService.getAllSignals()
        // for(const signalId of signalIds){
        //     const port = this.signalsService.getSignalPort(signalId)
        //     const tokens = this.signalsService.getSignalTokens(signalId)
        //     for(const token of tokens){
        //         this.websocketsService.listen(port, token, (signal) => {
        //             console.log("LISTENED TO SIGNAL: ", signal)
        //         })
        //     }
        // }
    }

    private async updatePrices()
    {
        const tokens = this.pricesService.getAllTokens()
        for(const token of tokens){

            const port = this.pricesService.getPort(token)
            try{
                const price = await this.websocketsService.sendMessage(port, "price_latest", token)
                if (price){
                    this.pricesService.storeInCache(price as TokenPriceTimeModel)
                }
            }catch(error){
                // TODO: handle multiple timeouts
            }
        }
    }

    private async updateSignals()
    {
        const ids = this.signalsService.getAllSignals()
        for(const id of ids){
            const port = this.signalsService.getSignalPort(id)
            for(const token of this.signalsService.getSignalTokens(id)){
                try{
                    const signal = await this.websocketsService.sendMessage(port, "signal_latest", token)
                    if (signal){
                        this.signalsService.storeInCache(id, signal as SignalModel)
                    }
                }catch(error){
                    // TODO: handle multiple timeouts
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

        this.updatePrice(setup)
        this.updateOpenTransactions(setup)
        this.attemptAction(setup)
        this.tradingSetupsService.save(setup)
    }

    private async updatePrice(setup: TradingSetupModel) : Promise<void>
    {
        const tokenPair = TradingSetupConfigModelUtils.GetTokenPair(setup.config)
        const price = this.pricesService.getFromCache(tokenPair)

        if (price){
            const priceAmount = price.price
            TradingSetupModelUtils.UpdatePrice(setup, priceAmount)
        }
    }

    private async updateOpenTransactions(setup: TradingSetupModel) : Promise<void>
    {
        const openTransactions = Object.values(setup.openTransactions)
        for(const t of openTransactions){
            const newT = await this.transactionService.updateTransaction(setup, t)
            if (newT){
                TradingSetupModelUtils.UpdateTransaction(setup, newT)
            }
        }
    }

    private async attemptAction(setup: TradingSetupModel) : Promise<void>
    {
        if (!MathUtils.IsBiggerThanZero(setup.currentPriceAmount)){ return }
        if (Object.keys(setup.openTransactions).length > 0) { return }

        const action = this.updateAction(setup)
            
        if (action !== 0){
            const transaction = await this.transactionService.makeTransaction(setup, action)
            if (transaction){
                TradingSetupModelUtils.UpdateTransaction(setup, transaction)
            }
        }
    }

    private updateAction(tradingSetup: TradingSetupModel) : number
    {
        let action = TradingSetupModelUtils.UpdateTermination(tradingSetup)
        if (action === 0){
            action = TradingSetupModelUtils.UpdateTakeProfit(tradingSetup)
            if (action === 0){
                action = TradingSetupModelUtils.UpdateStopLoss(tradingSetup)
                if (action === 0){
                    const signalActions = []
                    for(const signalIdentifier of tradingSetup.config.signals){
                        const signal = this.signalsService.getFromCache(signalIdentifier, TradingSetupConfigModelUtils.GetTokenPair(tradingSetup.config))
                        const signalAction = TradingSetupModelUtils.UpdateSignal(tradingSetup, signal)
                        signalActions.push(signalAction)
                    }
                    action = TradingSetupModelUtils.UpdateSignalActions(tradingSetup, signalActions)
                }
            }
        }
        return action
    }
}