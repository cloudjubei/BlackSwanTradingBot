import TradingSetupActionType, { TradingSetupActionTypeAPI } from './TradingSetupActionType.dto'
import { ApiProperty } from '@nestjs/swagger'

export default class TradingSetupActionModel
{
    @ApiProperty(TradingSetupActionTypeAPI) type: TradingSetupActionType
    @ApiProperty() action: number = 0

    constructor(type: TradingSetupActionType, action: number = 0)
    {
        this.type = type
        this.action = action
    }
}

export class TradingSetupActionModelUtils
{
    static IsNoOp(m: TradingSetupActionModel) : boolean
    {
        return m.action === 0
    }
    static IsBuy(m: TradingSetupActionModel) : boolean
    {
        return m.action > 0
    }
    static IsSell(m: TradingSetupActionModel) : boolean
    {
        return m.action < 0
    }
}