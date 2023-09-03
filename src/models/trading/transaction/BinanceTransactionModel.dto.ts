import MathUtils from "src/lib/mathUtils"
import TradingTransactionModel from "./TradingTransactionModel.dto"

export default class BinanceTransactionModel
{
    id: string
    firstToken: string
    secondToken: string
    firstAmount: string
    secondAmount: string
    price: string
    timestamp: number
    status: string
    buy: boolean

    constructor(id: string, firstToken: string, secondToken: string, firstAmount: string, secondAmount: string, price: string, timestamp: number, status: string, buy: boolean)
    {
        this.id = id
        this.firstToken = firstToken
        this.secondToken = secondToken
        this.firstAmount = firstAmount
        this.secondAmount = secondAmount
        this.price = price
        this.timestamp = timestamp
        this.status = status
        this.buy = buy
    }
}

export class BinanceTransactionModelUtils
{
    static FromResponse(firstToken: string, secondToken: string, response: any) : BinanceTransactionModel
    {
        const fullAmount = response['executedQty']
        let price = '0'
        for (const fill of response['fills']){
            const percentAmount = MathUtils.DivideNumbers(fill['qty'], fullAmount)
            price = MathUtils.AddNumbers(price, MathUtils.MultiplyNumbers(percentAmount, fill['price']))
        }
        return new BinanceTransactionModel(response['orderId'], firstToken, secondToken, response['executedQty'], response['cummulativeQuoteQty'], price, response['transactTime'], response['status'], response['side'] === 'BUY')
    }

    static ToTradingTransaction(m: BinanceTransactionModel) : TradingTransactionModel
    {
        return {
            buy: m.buy,
            boughtAmount: m.firstAmount,
            priceAmount: m.price,
            boughtForAmount: m.secondAmount
        }
    }
}