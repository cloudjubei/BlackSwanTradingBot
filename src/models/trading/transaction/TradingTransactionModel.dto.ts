export default class TradingTransactionModel
{
    buy: boolean
    firstToken: string
    secondToken: string
    firstAmount: string
    secondAmount: string
    wantedPriceAmount: string
    priceAmount: string
    transactionId: string
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
}