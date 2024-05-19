import MathUtils from "commons/lib/mathUtils"
import TradingSetupModel from "../TradingSetupModel.dto"

export default class TradingTransactionModel
{
    buy: boolean
    firstToken: string
    secondToken: string
    firstAmount: string
    secondAmount: string
    offeredAmount: string
    wantedPriceAmount: string
    priceAmount: string
    transactionId: string
    commissionAmount: string
    commissionAsset: string
    complete: boolean = false
    canceled: boolean = false
    checks: number = 0
    firstUpdateTimestamp: number = 0
    lastUpdateTimestamp: number = 0
}

export class TradingTransactionModelUtils
{
    static GetTokenPair(m: TradingTransactionModel) : string
    {
        return m.firstToken + m.secondToken
    }

    static FromBinanceTransactionResponse(tradingSetup: TradingSetupModel, transaction: TradingTransactionModel, response: any) : TradingTransactionModel
    {
        return TradingTransactionModelUtils.FromBinanceResponse(tradingSetup.config.firstToken, tradingSetup.config.secondToken, transaction.offeredAmount, transaction.wantedPriceAmount, response, transaction)
    }
    static FromBinanceResponse(firstToken: string, secondToken: string, offeredAmount: string, wantedPriceAmount: string, response: any, augmentingTransaction: TradingTransactionModel = undefined) : TradingTransactionModel
    {
        const firstAmount = parseFloat(response['executedQty'] ?? '0') ?? 0
        const secondAmount = parseFloat(response['cummulativeQuoteQty'] ?? '0') ?? 0
        let priceAmount = '' + (parseFloat(response['price'] ?? '0') ?? 0)
        let commissionAsset = firstToken
        let commissionAmount = '0'

        if (TradingTransactionModelUtils.IsCompleted(response)){
            const needsToSetPrice = MathUtils.IsZero(priceAmount)
            const fullAmount = "" + firstAmount
            const fills = response['fills'] ?? []
            for (const fill of fills){
                if (needsToSetPrice){
                    const percentAmount = MathUtils.DivideNumbers(fill['qty'], fullAmount)
                    priceAmount = MathUtils.AddNumbers(priceAmount, MathUtils.MultiplyNumbers(percentAmount, fill['price']))
                }
                commissionAsset = fill['commissionAsset']
                commissionAmount = MathUtils.AddNumbers(commissionAmount, fill['commission'])
            }
        }
        // response['transactTime']
        console.log(`FromBinanceResponse commissionAsset: ${commissionAsset} commissionAmount: ${commissionAmount}`)

        return {
            buy: response['side'] === 'BUY',
            firstToken,
            secondToken,
            firstAmount: '' + firstAmount,
            secondAmount: '' + secondAmount, 
            offeredAmount,
            wantedPriceAmount,
            priceAmount,
            commissionAmount,
            commissionAsset,
            transactionId: '' + response['orderId'],
            complete: TradingTransactionModelUtils.IsCompleted(response),
            canceled: TradingTransactionModelUtils.IsResponseCanceled(response),
            firstUpdateTimestamp: augmentingTransaction?.firstUpdateTimestamp ?? Date.now(),
            lastUpdateTimestamp: Date.now(),
            checks: (augmentingTransaction?.checks ?? -1) + 1
        }
    }

    static IsCompleted(response: any) : boolean
    {
        return TradingTransactionModelUtils.IsResponseCanceled(response) || TradingTransactionModelUtils.IsResponseFilled(response)
    }
    
    static IsResponseFilled(response: any) : boolean
    {
        return response.status === 'FILLED'
    }
    
    static IsResponseCanceled(response: any) : boolean
    {
        return response.status === 'CANCELED'
    }
}