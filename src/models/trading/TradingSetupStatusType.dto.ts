enum TradingSetupStatusType
{
    INITIAL = 'INITIAL',
    RUNNING = 'RUNNING',
    TERMINATING = 'TERMINATING',
    TERMINATED = 'TERMINATED'
}
export default TradingSetupStatusType

export const TradingSetupStatusTypeAPI = { enum: TradingSetupStatusType, enumName: 'TradingSetupStatusType' }
