enum TradingSetupTradeTransactionStatus
{
    BUY_PENDING = 'BUY_PENDING',
    BUY_DONE = 'BUY_DONE',
    SELL_PENDING = 'SELL_PENDING',
    SELL_PARTIALLY_DONE = 'SELL_PARTIALLY_DONE',
    COMPLETE = 'COMPLETE'
}
export default TradingSetupTradeTransactionStatus

export const TradingSetupTradeTransactionStatusAPI = { enum: TradingSetupTradeTransactionStatus, enumName: 'TradingSetupTradeTransactionStatus' }
