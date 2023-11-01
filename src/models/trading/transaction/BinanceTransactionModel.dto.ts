import TradingTransactionModel from "./TradingTransactionModel.dto"
import MathUtils from "commons/lib/mathUtils"

export default class BinanceTransactionModel
{
    id: string
    firstToken: string
    secondToken: string
    firstAmount: string
    secondAmount: string
    wantedPrice: string
    price: string
    timestamp: number
    status: string
    buy: boolean

    constructor(id: string, firstToken: string, secondToken: string, firstAmount: string, secondAmount: string, wantedPrice: string, price: string, timestamp: number, status: string, buy: boolean)
    {
        this.id = id
        this.firstToken = firstToken
        this.secondToken = secondToken
        this.firstAmount = firstAmount
        this.secondAmount = secondAmount
        this.wantedPrice = wantedPrice
        this.price = price
        this.timestamp = timestamp
        this.status = status
        this.buy = buy
    }
}

export class BinanceTransactionModelUtils
{
    static FromResponse(firstToken: string, secondToken: string, wantedPrice: string, response: any) : BinanceTransactionModel
    {
        const firstAmount = parseFloat(response['executedQty']) ?? 0
        const secondAmount = parseFloat(response['cummulativeQuoteQty']) ?? 0
        let price = '' + (parseFloat(response['price']) ?? 0)
        if (BinanceTransactionModelUtils.IsCompleted(response) && MathUtils.IsZero(price)){
            const fullAmount = "" + firstAmount
            const fills = response['fills'] ?? []
            for (const fill of fills){
                const percentAmount = MathUtils.DivideNumbers(fill['qty'], fullAmount)
                price = MathUtils.AddNumbers(price, MathUtils.MultiplyNumbers(percentAmount, fill['price']))
            }
        }
        console.log("Binance Response: ")
        console.log(response)
        return new BinanceTransactionModel('' + response['orderId'], firstToken, secondToken, '' + firstAmount, '' + secondAmount, wantedPrice, price, response['transactTime'], response['status'], response['side'] === 'BUY')
    }

    static ToTradingTransaction(m: BinanceTransactionModel, augmentingTransaction: TradingTransactionModel = undefined) : TradingTransactionModel
    {
        return {
            buy: m.buy,
            firstToken: m.firstToken,
            secondToken: m.secondToken,
            firstAmount: m.firstAmount,
            secondAmount: m.secondAmount,
            wantedPriceAmount: m.wantedPrice,
            priceAmount: m.price,
            transactionId: m.id,
            complete: BinanceTransactionModelUtils.IsCompleted(m),
            canceled: BinanceTransactionModelUtils.IsCanceled(m),
            firstUpdateTimestamp: augmentingTransaction?.firstUpdateTimestamp ?? Date.now(),
            lastUpdateTimestamp: Date.now(),
            checks: (augmentingTransaction?.checks ?? -1) + 1
        }
    }
    static IsCompleted(m: BinanceTransactionModel) : boolean
    {
        return BinanceTransactionModelUtils.IsCanceled(m) || BinanceTransactionModelUtils.IsFilled(m)
    }
    
    static IsFilled(m: BinanceTransactionModel) : boolean
    {
        return m.status === 'FILLED'
    }
    
    static IsCanceled(m: BinanceTransactionModel) : boolean
    {
        return m.status === 'CANCELED'
    }
}