import { Injectable } from '@nestjs/common'
import TradingSetupConfigModel from 'models/trading/TradingSetupConfigModel.dto'
import TradingSetupModel from 'models/trading/TradingSetupModel.dto'
import StorageUtils from "commons/lib/storageUtils"

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

    get(id: string) : TradingSetupModel | undefined
    {
        return this.setups[id]
    }

    save(tradingSetup: TradingSetupModel) : TradingSetupModel
    {
        this.setups[tradingSetup.id] = tradingSetup

        StorageUtils.createOrWriteToFile('/', 'setups.json', JSON.stringify(this.getAll()))

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

        StorageUtils.createOrWriteToFile('/', 'setups.json', JSON.stringify(this.getAll()))

        return o
    }

    remove(id: string) : TradingSetupModel | undefined
    {
        const temp = this.setups[id]
        delete this.setups[id]

        StorageUtils.createOrWriteToFile('/', 'setups.json', JSON.stringify(this.getAll()))

        return temp
    }
}