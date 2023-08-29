enum TradingSetupStatusType
{
    INITIAL = 'INITIAL',
    RUNNING = 'RUNNING',
    TERMINATED = 'TERMINATED'
}
export default TradingSetupStatusType

export const TradingSetupStatusTypeAPI = { enum: TradingSetupStatusType, enumName: 'TradingSetupStatusType' }
