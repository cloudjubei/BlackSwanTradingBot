import { ApiProperty } from "@nestjs/swagger"
import TradingTransactionModel from '../transaction/TradingTransactionModel.dto'
import MathUtils from "commons/lib/mathUtils"
import TradingSetupTradeTransactionStatus from './TradingSetupTradeTransactionStatus.dto'
import TradingSetupModel from '../TradingSetupModel.dto'
import TradingSetupActionModel from '../action/TradingSetupActionModel.dto'
import TradingSetupActionType from '../action/TradingSetupActionType.dto'
import { Timestamp } from "commons/models/swagger.consts"

export default class TradingSetupTradeModel
{
    @ApiProperty() id: string

    @ApiProperty() startingFirstAmount: string = "0"
    @ApiProperty() startingSecondAmount: string = "0"
    @ApiProperty() firstAmount: string = "0"
    @ApiProperty() secondAmount: string = "0"
    @ApiProperty() feesAmount: string = "0"
    @ApiProperty() feesAsset: string = ""

    @ApiProperty(Timestamp) startTimestamp: number = 0
    @ApiProperty(Timestamp) updateTimestamp: number = 0
    @ApiProperty() entryPriceAmount: string = "0"
    @ApiProperty() lowestPriceAmount: string = "99999999999"
    @ApiProperty() highestPriceAmount: string = "0"

    @ApiProperty() currentAction: TradingSetupActionModel = new TradingSetupActionModel(TradingSetupActionType.MANUAL, 0)
    @ApiProperty() manualOverrideAction?: TradingSetupActionModel = undefined
    
    @ApiProperty() status: TradingSetupTradeTransactionStatus = TradingSetupTradeTransactionStatus.BUY_PENDING
    @ApiProperty() buyTransaction: TradingTransactionModel
    @ApiProperty() sellTransactionPending: TradingTransactionModel = undefined
    @ApiProperty() sellTransactionsComplete: TradingTransactionModel[] = []

    @ApiProperty() failedDueToMarketMaking: number = 0
}

export class TradingSetupTradeModelUtils
{
    static FromTransaction(transaction: TradingTransactionModel) : TradingSetupTradeModel
    {
        const trade = new TradingSetupTradeModel()
        trade.id = transaction.transactionId
        trade.startingFirstAmount = '0'
        trade.startingSecondAmount = transaction.offeredAmount
        trade.firstAmount = trade.startingFirstAmount
        trade.secondAmount = trade.startingSecondAmount
        trade.feesAmount = MathUtils.IsBiggerThanZero(transaction.commissionAmount) ? (transaction.commissionAsset === transaction.firstToken ? MathUtils.MultiplyNumbers(transaction.priceAmount, transaction.commissionAmount) : transaction.commissionAmount) : '0'
        trade.feesAsset = transaction.commissionAsset
        trade.buyTransaction = transaction
        trade.entryPriceAmount = transaction.priceAmount
        trade.lowestPriceAmount = transaction.priceAmount
        trade.highestPriceAmount = transaction.priceAmount
        trade.status = transaction.complete ? TradingSetupTradeTransactionStatus.BUY_DONE : TradingSetupTradeTransactionStatus.BUY_PENDING
        trade.startTimestamp = Date.now()
        trade.updateTimestamp = trade.startTimestamp
        return trade
    }

    static GetTotalAmount(trade: TradingSetupTradeModel, setup: TradingSetupModel) : string
    {
        return MathUtils.AddNumbers(MathUtils.MultiplyNumbers(trade.firstAmount, setup.currentPriceAmount), trade.secondAmount)
    }

    static UpdateBuyCompleteTransaction(trade: TradingSetupTradeModel, setup: TradingSetupModel, transaction: TradingTransactionModel)
    {
        setup.secondAmount = MathUtils.SubtractNumbers(setup.secondAmount, transaction.secondAmount)

        trade.firstAmount = transaction.firstAmount
        trade.secondAmount = '0'
        trade.startingFirstAmount = '0'
        trade.startingSecondAmount = transaction.secondAmount

        trade.feesAmount = MathUtils.IsBiggerThanZero(transaction.commissionAmount) ? (transaction.commissionAsset === transaction.firstToken ? MathUtils.MultiplyNumbers(transaction.commissionAmount, transaction.priceAmount) : transaction.commissionAmount) : '0'
        trade.feesAsset = transaction.commissionAmount

        trade.status = MathUtils.IsZero(trade.firstAmount) && MathUtils.IsZero(trade.secondAmount) ? TradingSetupTradeTransactionStatus.COMPLETE : TradingSetupTradeTransactionStatus.BUY_DONE
            
        console.log('UpdateBuyTransaction id: ' + trade.id + " BUY " + setup.config.firstToken + ': ' + trade.firstAmount, ' | ' + setup.config.secondToken + ' : ' + trade.secondAmount + ' avgPrice: ' + MathUtils.Shorten(transaction.priceAmount) + ' vs currentPrice: ' + MathUtils.Shorten(setup.currentPriceAmount))
        console.log('UpdateBuyTransaction transaction: ' + setup.config.firstToken + ': ' + transaction.firstAmount, ' | ' + setup.config.secondToken + ' : ' + transaction.secondAmount + ' wantedPriceAmount: ' + MathUtils.Shorten(transaction.wantedPriceAmount))
    }
    static UpdateBuyTransaction(trade: TradingSetupTradeModel, setup: TradingSetupModel, transaction: TradingTransactionModel)
    {
        trade.buyTransaction = transaction
        if (transaction.complete){
            if (transaction.canceled && MathUtils.IsZero(transaction.firstAmount)){
                setup.secondAmount = MathUtils.AddNumbers(setup.secondAmount, trade.startingSecondAmount)
                trade.status = TradingSetupTradeTransactionStatus.CANCELLED
                return
            }
            trade.entryPriceAmount = transaction.priceAmount
            trade.lowestPriceAmount = transaction.priceAmount
            trade.highestPriceAmount = transaction.priceAmount

            setup.secondAmount = MathUtils.AddNumbers(setup.secondAmount, trade.startingSecondAmount)
            TradingSetupTradeModelUtils.UpdateBuyCompleteTransaction(trade, setup, transaction)
        }
    }

    static UpdateSellTransaction(trade: TradingSetupTradeModel, setup: TradingSetupModel, transaction: TradingTransactionModel)
    {
        trade.status = TradingSetupTradeTransactionStatus.SELL_PENDING
        trade.sellTransactionPending = transaction

        if (transaction.complete){
            TradingSetupTradeModelUtils.UpdateSellCompleteTransaction(trade, setup, transaction)
        }
    }
    static UpdateSellCompleteTransaction(trade: TradingSetupTradeModel, setup: TradingSetupModel, transaction: TradingTransactionModel)
    {
        trade.sellTransactionPending = undefined
        trade.sellTransactionsComplete.push(transaction)

        trade.firstAmount = MathUtils.SubtractNumbers(trade.firstAmount, transaction.firstAmount)
        trade.secondAmount = MathUtils.AddNumbers(trade.secondAmount, transaction.secondAmount)
        if (MathUtils.IsBiggerThanZero(transaction.commissionAmount)){
            trade.feesAsset = transaction.commissionAmount
            const feesAmount = transaction.commissionAsset === transaction.firstToken ? MathUtils.MultiplyNumbers(transaction.commissionAmount, transaction.priceAmount) : transaction.commissionAmount
            trade.feesAmount = MathUtils.AddNumbers(trade.feesAmount, feesAmount)
        }

        trade.status = !MathUtils.IsBiggerThanZero(trade.firstAmount) ? TradingSetupTradeTransactionStatus.COMPLETE : TradingSetupTradeTransactionStatus.SELL_PARTIALLY_DONE   
    
        console.log('UpdateSellTransaction id: ' + trade.id + " SELL " + setup.config.firstToken + ': ' + trade.firstAmount, ' | ' + setup.config.secondToken + ' : ' + trade.secondAmount + ' avgPrice: ' + MathUtils.Shorten(transaction.priceAmount) + ' vs currentPrice: ' + MathUtils.Shorten(setup.currentPriceAmount))
        console.log('UpdateSellTransaction transaction: ' + setup.config.firstToken + ': ' + transaction.firstAmount, ' | ' + setup.config.secondToken + ' : ' + transaction.secondAmount + ' wantedPriceAmount: ' + MathUtils.Shorten(transaction.wantedPriceAmount))
    }

    static UpdateComplete(trade: TradingSetupTradeModel, setup: TradingSetupModel)
    {
        setup.firstAmount = MathUtils.AddNumbers(setup.firstAmount, trade.firstAmount)
        setup.secondAmount = MathUtils.AddNumbers(setup.secondAmount, trade.secondAmount)

        if (MathUtils.IsBiggerThanZero(trade.feesAmount)){
            setup.feesAsset = trade.feesAsset
            setup.feesAmount = MathUtils.AddNumbers(setup.feesAmount, trade.feesAmount)
            setup.feesLastTradeAmount = trade.feesAmount
        }
    }

    static UpdateTakeProfit(trade: TradingSetupTradeModel, setup: TradingSetupModel, minAmount: string) : TradingSetupActionModel
    {
        if (MathUtils.IsLessThan(trade.firstAmount, minAmount)) { return new TradingSetupActionModel(TradingSetupActionType.TAKEPROFIT) }

        const takeProfit = setup.config.takeProfit
        if (takeProfit){
            const trailingStop = takeProfit.trailingStop
            if (trailingStop){
                const hardLimitPercentage = trailingStop.hardLimitPercentage
                if (hardLimitPercentage){
                    const triggerAmount = MathUtils.MultiplyNumbers(trade.entryPriceAmount, "" + (1.0 + hardLimitPercentage))
                    if (MathUtils.IsGreaterThanOrEqualTo(setup.currentPriceAmount, triggerAmount)){
                        return new TradingSetupActionModel(TradingSetupActionType.TAKEPROFIT, -1)
                    }
                }
                const activationAmount = MathUtils.MultiplyNumbers(trade.entryPriceAmount, "" + (1.0 + takeProfit.percentage))
                if (MathUtils.IsGreaterThanOrEqualTo(trade.highestPriceAmount, activationAmount)){
                    const triggerAmount = MathUtils.MultiplyNumbers(trade.highestPriceAmount, "" + (1.0 - trailingStop.deltaPercentage))
                    if (MathUtils.IsLessThanOrEqualTo(setup.currentPriceAmount, triggerAmount)){
                        return new TradingSetupActionModel(TradingSetupActionType.TAKEPROFIT, -1)
                    }
                }
            }else{
                const triggerAmount = MathUtils.MultiplyNumbers(trade.entryPriceAmount, "" + (1.0 + takeProfit.percentage))
                if (MathUtils.IsGreaterThanOrEqualTo(setup.currentPriceAmount, triggerAmount)){
                    return new TradingSetupActionModel(TradingSetupActionType.TAKEPROFIT, -1)
                }
            }
        }
        return new TradingSetupActionModel(TradingSetupActionType.TAKEPROFIT)
    }

    static UpdateStopLoss(trade: TradingSetupTradeModel, setup: TradingSetupModel, minAmount: string) : TradingSetupActionModel
    {
        if (MathUtils.IsLessThan(trade.firstAmount, minAmount)) { return new TradingSetupActionModel(TradingSetupActionType.STOPLOSS) }
        
        const stopLoss = setup.config.stopLoss
        if (stopLoss){
            const thresholdAmount = stopLoss.isBasedOnMaxPrice ? trade.highestPriceAmount : trade.entryPriceAmount
            const triggerAmount = MathUtils.MultiplyNumbers(thresholdAmount, "" + (1.0 - stopLoss.percentage))
            if (MathUtils.IsLessThanOrEqualTo(setup.currentPriceAmount, triggerAmount)){
                return new TradingSetupActionModel(TradingSetupActionType.STOPLOSS, -1)
            }
        }
        return new TradingSetupActionModel(TradingSetupActionType.STOPLOSS)
    }
}