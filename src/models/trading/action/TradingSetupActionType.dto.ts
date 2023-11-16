enum TradingSetupActionType
{
    MANUAL = 'MANUAL',
    SIGNAL = 'SIGNAL',
    TAKEPROFIT = 'TAKEPROFIT',
    STOPLOSS = 'STOPLOSS',
    TERMINATION = 'TERMINATION'
}
export default TradingSetupActionType

export const TradingSetupActionTypeAPI = { enum: TradingSetupActionType, enumName: 'TradingSetupActionType' }
