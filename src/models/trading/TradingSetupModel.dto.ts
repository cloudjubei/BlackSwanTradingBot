import { Prop, Schema, raw } from '@nestjs/mongoose'
import { ApiHideProperty, ApiProperty } from "@nestjs/swagger"
import TradingSetupConfigModel from './TradingSetupConfigModel.dto'
import TradingTransactionModel from './transaction/TradingTransactionModel.dto'
import TradingSetupStatusType, { TradingSetupStatusTypeAPI } from './TradingSetupStatusType.dto'
import MathUtils from "commons/lib/mathUtils"
import SignalModel from "commons/models/signal/SignalModel.dto"
import { StringMap, Timestamp } from "commons/models/swagger.consts"

export default class TradingSetupModel
{
    @ApiProperty() id: string

    @ApiProperty(TradingSetupStatusTypeAPI) status: TradingSetupStatusType
    @ApiProperty() config : TradingSetupConfigModel

    @ApiProperty() startingFirstAmount: string
    @ApiProperty() startingSecondAmount: string
    @ApiProperty() firstAmount: string
    @ApiProperty() secondAmount: string

    @ApiProperty(Timestamp) lastUpdate: number = Date.now()

    @ApiProperty() currentPriceAmount: string = "0"
    @ApiProperty() lowestPriceAmount: string = "99999999999"
    @ApiProperty() highestPriceAmount: string = "0"

    @ApiProperty() tradeEntryPriceAmount: string = "0"
    @ApiProperty() tradeLowestPriceAmount: string = "99999999999"
    @ApiProperty() tradeHighestPriceAmount: string = "0"

    @ApiProperty() transactions: TradingTransactionModel[] = []
    @ApiProperty({ type: "object", additionalProperties: { type: "TradingTransactionModel" }}) openTransactions: { [id: string] : TradingTransactionModel } = {}
    @ApiProperty() failedDueToMarketMaking: number = 0
}

export class TradingSetupModelUtils
{
    static GetTokenPair(t: TradingSetupModel) : string
    {
        return t.config.firstToken + t.config.secondToken
    }

    static UpdatePrice(t: TradingSetupModel, priceAmount: string) : TradingSetupModel
    {
        t.status = TradingSetupStatusType.RUNNING
        t.currentPriceAmount = priceAmount
        if (MathUtils.IsGreaterThan(t.currentPriceAmount, t.highestPriceAmount)){
            t.highestPriceAmount = t.currentPriceAmount
        }
        if (MathUtils.IsLessThan(t.currentPriceAmount, t.lowestPriceAmount)){
            t.lowestPriceAmount = t.currentPriceAmount
        }
        if (MathUtils.IsGreaterThan(t.currentPriceAmount, t.tradeHighestPriceAmount)){
            t.tradeHighestPriceAmount = t.currentPriceAmount
        }
        if (MathUtils.IsLessThan(t.currentPriceAmount, t.tradeLowestPriceAmount)){
            t.tradeLowestPriceAmount = t.currentPriceAmount
        }
        return t
    }
    
    static UpdateTransaction(t: TradingSetupModel, transaction: TradingTransactionModel) : TradingSetupModel
    {
        if (transaction.complete){
            delete t.openTransactions[transaction.transactionId]
            t.transactions.push(transaction)

            if (transaction.canceled) { return t }
            
            //TODO: fix once trades are actually per order
            if (transaction.buy){
                t.tradeEntryPriceAmount = transaction.priceAmount
                t.tradeLowestPriceAmount = transaction.priceAmount
                t.tradeHighestPriceAmount = transaction.priceAmount
            }
    
            if (transaction.buy){
                t.firstAmount = MathUtils.AddNumbers(t.firstAmount, transaction.firstAmount)
                t.secondAmount = MathUtils.SubtractNumbers(t.secondAmount, transaction.secondAmount)
            }else{
                t.firstAmount = MathUtils.SubtractNumbers(t.firstAmount, transaction.firstAmount)
                t.secondAmount = MathUtils.AddNumbers(t.secondAmount, transaction.secondAmount)
            }
            console.log('UpdateTransaction id: ' + t.id + (transaction.buy ? ' BUY ' : ' SELL ') + t.config.firstToken + ': ' + t.firstAmount, ' | ' + t.config.secondToken + ' : ' + t.secondAmount + ' avgPrice: ' + MathUtils.Shorten(transaction.priceAmount) + ' vs currentPrice: ' + MathUtils.Shorten(t.currentPriceAmount))
            console.log('UpdateTransaction transaction: ' + t.config.firstToken + ': ' + transaction.firstAmount, ' | ' + t.config.secondToken + ' : ' + transaction.secondAmount + ' wantedPriceAmount: ' + MathUtils.Shorten(transaction.wantedPriceAmount))
        }else{
            t.openTransactions[transaction.transactionId] = transaction
        }
        return t
    }

    static UpdateTermination(t: TradingSetupModel) : number
    {
        const firstInSecondAmount = MathUtils.MultiplyNumbers(t.firstAmount, t.currentPriceAmount)
        const totalSecondAmount = MathUtils.AddNumbers(firstInSecondAmount, t.secondAmount)

        const startingFirstInSecondAmount = MathUtils.MultiplyNumbers(t.startingFirstAmount, t.currentPriceAmount)
        const startingTotalSecondAmount = MathUtils.AddNumbers(startingFirstInSecondAmount, t.startingSecondAmount)
        if (MathUtils.IsBiggerThanZero(startingTotalSecondAmount)){
            const currentPercentageWinAmount = MathUtils.DivideNumbers(totalSecondAmount, startingTotalSecondAmount)
            const triggerPercentage = "" + (1.0 - t.config.terminationPercentageLoss)
            
            if (MathUtils.IsLessThanOrEqualTo(currentPercentageWinAmount, triggerPercentage)){
                t.status = TradingSetupStatusType.TERMINATED
                return -1
            }
        }
        return 0
    }

    static UpdateTakeProfit(t: TradingSetupModel, minAmount: string) : number
    {
        if (MathUtils.IsLessThan(t.firstAmount, minAmount)) { return 0 }

        const takeProfit = t.config.takeProfit
        if (takeProfit){
            const trailingStop = takeProfit.trailingStop
            if (trailingStop){
                const hardLimitPercentage = trailingStop.hardLimitPercentage
                if (hardLimitPercentage){
                    const triggerAmount = MathUtils.MultiplyNumbers(t.tradeEntryPriceAmount, "" + (1.0 + hardLimitPercentage))
                    if (MathUtils.IsGreaterThanOrEqualTo(t.currentPriceAmount, triggerAmount)){
                        return -1
                    }
                }
                const activationAmount = MathUtils.MultiplyNumbers(t.tradeEntryPriceAmount, "" + (1.0 + takeProfit.percentage))
                if (MathUtils.IsGreaterThanOrEqualTo(t.tradeHighestPriceAmount, activationAmount)){
                    const triggerAmount = MathUtils.MultiplyNumbers(t.tradeHighestPriceAmount, "" + (1.0 - trailingStop.deltaPercentage))
                    if (MathUtils.IsLessThanOrEqualTo(t.currentPriceAmount, triggerAmount)){
                        return -1
                    }
                }
            }else{
                const triggerAmount = MathUtils.MultiplyNumbers(t.tradeEntryPriceAmount, "" + (1.0 + takeProfit.percentage))
                if (MathUtils.IsGreaterThanOrEqualTo(t.currentPriceAmount, triggerAmount)){
                    return -1
                }
            }
        }
        return 0
    }

    static UpdateStopLoss(t: TradingSetupModel, minAmount: string) : number
    {
        if (MathUtils.IsLessThan(t.firstAmount, minAmount)) { return 0 }
        
        const stopLoss = t.config.stopLoss
        if (stopLoss){
            const triggerAmount = MathUtils.MultiplyNumbers(t.tradeEntryPriceAmount, "" + (1.0 - stopLoss.percentage))
            if (MathUtils.IsLessThanOrEqualTo(t.currentPriceAmount, triggerAmount)){
                return -1
            }
        }
        return 0
    }

    static UpdateSignal(t: TradingSetupModel, signal: SignalModel) : number
    {
        return signal.action * signal.certainty
    }
}