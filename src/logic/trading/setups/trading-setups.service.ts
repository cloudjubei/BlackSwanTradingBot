import { Injectable } from '@nestjs/common'
import TradingSetupConfigModel from 'models/trading/TradingSetupConfigModel.dto'
import TradingSetupModel, { TradingSetupModelUtils } from 'models/trading/TradingSetupModel.dto'
import StorageUtils from "commons/lib/storageUtils"
import TradingSetupStatusType from 'models/trading/TradingSetupStatusType.dto'

@Injectable()
export class TradingSetupsService
{
    private setups: { [key: string]: TradingSetupModel } = {}

    constructor()
    {
        const setupsFile = StorageUtils.getFile('setups.json')
        const setups = JSON.parse(setupsFile) as TradingSetupModel[]
        for(const setup of setups){
            this.setups[setup.id] = setup
        }
    }
  
    getAll() : TradingSetupModel[]
    {
        return Object.values(this.setups)
    }
    getAllRunning() : TradingSetupModel[]
    {
        return Object.values(this.setups).filter(s => TradingSetupModelUtils.IsRunning(s))
    }

    get(id: string) : TradingSetupModel | undefined
    {
        return this.setups[id]
    }

    save(tradingSetup: TradingSetupModel) : TradingSetupModel
    {
        this.setups[tradingSetup.id] = tradingSetup

        return tradingSetup
    }

    create(id: string, config: TradingSetupConfigModel, startingFirstAmount: string, startingSecondAmount: string) : TradingSetupModel
    {
        const template = new TradingSetupModel()
        
        const o = {
            ...template,
            id,
            config,
            startingFirstAmount,
            startingSecondAmount,
            firstAmount: startingFirstAmount,
            secondAmount: startingSecondAmount
        }
        this.save(o)

        return o
    }

    remove(id: string) : TradingSetupModel | undefined
    {
        const temp = this.setups[id]
        delete this.setups[id]

        return temp
    }
}