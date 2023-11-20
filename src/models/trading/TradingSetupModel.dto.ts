import { Prop, Schema, raw } from '@nestjs/mongoose'
import { ApiHideProperty, ApiProperty } from "@nestjs/swagger"
import TradingSetupConfigModel from './TradingSetupConfigModel.dto'
import TradingTransactionModel from './transaction/TradingTransactionModel.dto'
import TradingSetupStatusType, { TradingSetupStatusTypeAPI } from './TradingSetupStatusType.dto'
import MathUtils from "commons/lib/mathUtils"
import SignalModel from "commons/models/signal/SignalModel.dto"
import { StringMap, Timestamp } from "commons/models/swagger.consts"
import TradingSetupActionModel from './action/TradingSetupActionModel.dto'
import TradingSetupActionType from './action/TradingSetupActionType.dto'
import TradingSetupTradeModel, { TradingSetupTradeModelUtils } from './trade/TradingSetupTradeModel.dto'

export default class TradingSetupModel
{
    @ApiProperty() id: string

    @ApiProperty(TradingSetupStatusTypeAPI) status: TradingSetupStatusType
    @ApiProperty() config : TradingSetupConfigModel

    @ApiProperty() startingFirstAmount: string
    @ApiProperty() startingSecondAmount: string
    @ApiProperty() firstAmount: string
    @ApiProperty() secondAmount: string

    @ApiProperty(Timestamp) updateTimestamp: number = 0
    @ApiProperty(Timestamp) timeoutTimestamp: number = 0

    @ApiProperty() currentPriceAmount: string = "0"
    @ApiProperty() lowestPriceAmount: string = "99999999999"
    @ApiProperty() highestPriceAmount: string = "0"

    @ApiProperty() currentAction: TradingSetupActionModel = new TradingSetupActionModel(TradingSetupActionType.MANUAL, 0)
    @ApiProperty() manualOverrideAction?: TradingSetupActionModel = undefined

    @ApiProperty() openTrades: TradingSetupTradeModel[] = []
    @ApiProperty() finishedTrades: TradingSetupTradeModel[] = []

    @ApiProperty() failedDueToMarketMaking: number = 0
}

export class TradingSetupModelUtils
{
    static IsRunning(t: TradingSetupModel) : boolean
    {
        return t.status === TradingSetupStatusType.RUNNING || t.status === TradingSetupStatusType.TERMINATING
    }

    static GetTokenPair(t: TradingSetupModel) : string
    {
        return t.config.firstToken + t.config.secondToken
    }

    static UpdatePrice(t: TradingSetupModel, priceAmount: string) : TradingSetupModel
    {
        t.status = TradingSetupStatusType.RUNNING
        t.currentPriceAmount = priceAmount
        t.updateTimestamp = Date.now()
        if (MathUtils.IsGreaterThan(t.currentPriceAmount, t.highestPriceAmount)){
            t.highestPriceAmount = t.currentPriceAmount
        }
        if (MathUtils.IsLessThan(t.currentPriceAmount, t.lowestPriceAmount)){
            t.lowestPriceAmount = t.currentPriceAmount
        }
        for(const trade of t.openTrades){
            if (MathUtils.IsGreaterThan(t.currentPriceAmount, trade.highestPriceAmount)){
                trade.highestPriceAmount = t.currentPriceAmount
            }
            if (MathUtils.IsLessThan(t.currentPriceAmount, trade.lowestPriceAmount)){
                trade.lowestPriceAmount = t.currentPriceAmount
            }
        }
        return t
    }
    
    static CreateBuyTrade(t: TradingSetupModel, transaction: TradingTransactionModel) : TradingSetupModel
    {
        const trade = TradingSetupTradeModelUtils.FromTransaction(transaction)
        t.openTrades.push(trade)

        if (transaction.complete){
            TradingSetupTradeModelUtils.UpdateBuyCompleteTransaction(trade, t, transaction)
        }else{
            t.secondAmount = MathUtils.SubtractNumbers(t.secondAmount, trade.startingSecondAmount)
        }
        return t
    }

    static UpdateTerminating(t: TradingSetupModel)
    {
        if (t.status === TradingSetupStatusType.TERMINATING || t.status === TradingSetupStatusType.TERMINATED) { return }

        const firstInSecondAmount = MathUtils.MultiplyNumbers(t.firstAmount, t.currentPriceAmount)
        const totalSecondAmount = MathUtils.AddNumbers(firstInSecondAmount, t.secondAmount)

        const startingFirstInSecondAmount = MathUtils.MultiplyNumbers(t.startingFirstAmount, t.currentPriceAmount)
        const startingTotalSecondAmount = MathUtils.AddNumbers(startingFirstInSecondAmount, t.startingSecondAmount)
        if (MathUtils.IsBiggerThanZero(startingTotalSecondAmount)){
            const currentPercentageWinAmount = MathUtils.DivideNumbers(totalSecondAmount, startingTotalSecondAmount)
            const triggerPercentage = "" + (1.0 - t.config.terminationPercentageLoss)
            
            if (MathUtils.IsLessThanOrEqualTo(currentPercentageWinAmount, triggerPercentage)){
                t.status = TradingSetupStatusType.TERMINATING
            }
        }
    }

    static UpdateTermination(t: TradingSetupModel) : boolean
    {
        if (t.status === TradingSetupStatusType.TERMINATING){
            if (t.openTrades.length === 0){
                t.status = TradingSetupStatusType.TERMINATED
            }
            return true
        }
        return false
    }
}